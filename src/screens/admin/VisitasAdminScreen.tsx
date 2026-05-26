import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, ActivityIndicator, Modal, Platform,
} from 'react-native';
import { getDocs } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { cartasBosque } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/spacing';
import type { Visita, EstadoEstacionaria } from '@/types/firestore';
import {
  listenTodasVisitasActivas, seedVisitas,
  HORAS_ESTACIONARIA, MONTO_CARGO_ESTACIONARIA,
  calcularHorasActiva, calcularEstadoEstacionaria,
  registrarSalida, marcarCargo72h, elegirRuta,
} from '@/services/firebase/visitas';
import { collections } from '@/services/firebase/firestore';

// ─── Constants ────────────────────────────────────────────────

type Tab = 'activas' | 'historial' | 'analisis';

const ESTADO_COLOR: Record<EstadoEstacionaria, string> = {
  normal:        cartasBosque.helecho,
  alerta_40h:    '#E8A838',
  alerta_50h:    '#E05C2A',
  cargo_72h:     '#C0392B',
  deposito_102h: '#960018',
};

const ESTADO_LABEL: Record<EstadoEstacionaria, string> = {
  normal:        'Normal',
  alerta_40h:    'Alerta 40h',
  alerta_50h:    'Alerta 50h',
  cargo_72h:     'Cargo 72h',
  deposito_102h: 'Depósito 102h',
};

const UMBRAL_HORAS = [0, 40, 50, 72, 102];

const HORA_ESTADO: Record<number, EstadoEstacionaria> = {
  0:   'normal',
  40:  'alerta_40h',
  50:  'alerta_50h',
  72:  'cargo_72h',
  102: 'deposito_102h',
};

// ─── Helpers ──────────────────────────────────────────────────

function formatHoras(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  return `${hh}h ${mm}m`;
}

function formatFechaCorta(ts: { toDate: () => Date } | null): string {
  if (!ts) return '—';
  const d = ts.toDate();
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }) +
    ' ' + d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

function duracionHoras(v: Visita): number {
  const entrada = v.fechaEntrada.toDate().getTime();
  const salida = v.fechaSalida ? v.fechaSalida.toDate().getTime() : Date.now();
  return (salida - entrada) / (1000 * 60 * 60);
}

// ─── StatCard ─────────────────────────────────────────────────

function StatCard({ label, valor, color }: { label: string; valor: number; color: string }) {
  return (
    <View style={[s.statCard, { borderTopColor: color }]}>
      <Text style={[s.statValor, { color }]}>{valor}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

// ─── TabBtn ───────────────────────────────────────────────────

function TabBtn({ label, activa, onPress }: { label: string; activa: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[s.tabBtn, activa && s.tabBtnActivo]} onPress={onPress}>
      <Text style={[s.tabBtnText, activa && s.tabBtnTextActivo]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── FilaActiva ───────────────────────────────────────────────

function FilaActiva({ visita, seleccionada, onSelect }: {
  visita: Visita;
  seleccionada: boolean;
  onSelect: () => void;
}) {
  const [horas, setHoras] = useState(() => calcularHorasActiva(visita.fechaEntrada));

  useEffect(() => {
    const t = setInterval(() => setHoras(calcularHorasActiva(visita.fechaEntrada)), 60_000);
    return () => clearInterval(t);
  }, [visita.fechaEntrada]);

  const estado = calcularEstadoEstacionaria(horas);
  const color = ESTADO_COLOR[estado];
  const pct = Math.min((horas / 102) * 100, 100);

  return (
    <TouchableOpacity
      style={[fa.row, seleccionada && fa.rowSel, { borderLeftColor: color }]}
      onPress={onSelect}
    >
      <View style={fa.topRow}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
            <Text style={fa.nombre} numberOfLines={1}>
              {visita.nombreVisitante || visita.documentoNumero}
            </Text>
            {visita.esRecurrente && (
              <Text style={fa.recurrente}>RECURRENTE</Text>
            )}
          </View>
          <Text style={fa.meta} numberOfLines={1}>
            Hab. {visita.habitacionNumero ?? '—'} · {visita.documentoTipo} {visita.documentoNumero}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 3 }}>
          <View style={[fa.estadoBadge, { backgroundColor: color }]}>
            <Text style={fa.estadoText}>{ESTADO_LABEL[estado]}</Text>
          </View>
          <Text style={[fa.horasText, { color }]}>{formatHoras(horas)}</Text>
        </View>
      </View>
      <View style={fa.progressBg}>
        <View style={[fa.progressFill, { width: `${pct}%` as any, backgroundColor: color }]} />
      </View>
    </TouchableOpacity>
  );
}

// ─── FilaHistorial ────────────────────────────────────────────

function FilaHistorial({ visita }: { visita: Visita }) {
  const activa = !visita.fechaSalida;
  const horas = duracionHoras(visita);

  return (
    <View style={fh.row}>
      <View style={{ flex: 1 }}>
        <Text style={fh.nombre} numberOfLines={1}>
          {visita.nombreVisitante || visita.documentoNumero}
        </Text>
        <Text style={fh.meta}>
          {visita.inquilinoNombre ?? '—'} · Hab. {visita.habitacionNumero ?? '—'}
        </Text>
        <Text style={fh.fecha}>{formatFechaCorta(visita.fechaEntrada)}</Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 3 }}>
        <Text style={[fh.duracion, { color: activa ? cartasBosque.bosque : cartasBosque.helecho }]}>
          {formatHoras(horas)}
        </Text>
        {activa && (
          <View style={fh.activaBadge}>
            <Text style={fh.activaText}>activa</Text>
          </View>
        )}
        {visita.esRecurrente && <Text style={fh.rec}>REC</Text>}
      </View>
    </View>
  );
}

// ─── TabAnalisis ──────────────────────────────────────────────

function TabAnalisis({ activas, historial }: { activas: Visita[]; historial: Visita[] }) {
  const porInquilino = activas.reduce<Record<string, { nombre: string; visitas: Visita[] }>>((acc, v) => {
    if (!acc[v.inquilinoId]) acc[v.inquilinoId] = { nombre: v.inquilinoNombre ?? v.inquilinoId, visitas: [] };
    acc[v.inquilinoId].visitas.push(v);
    return acc;
  }, {});

  const rankingInquilinos = Object.entries(porInquilino)
    .map(([id, { nombre, visitas }]) => {
      const peorH = Math.max(...visitas.map(v => calcularHorasActiva(v.fechaEntrada)));
      return { id, nombre, count: visitas.length, peorH, estado: calcularEstadoEstacionaria(peorH) };
    })
    .sort((a, b) => b.peorH - a.peorH);

  const porDoc = historial.reduce<Record<string, { nombre: string; count: number }>>((acc, v) => {
    const k = v.documentoNumero;
    if (!acc[k]) acc[k] = { nombre: v.nombreVisitante || k, count: 0 };
    acc[k].count++;
    return acc;
  }, {});

  const frecuentes = Object.entries(porDoc)
    .filter(([, { count }]) => count > 1)
    .map(([doc, { nombre, count }]) => ({ doc, nombre, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const totalHistorial = historial.length;
  const totalRecurrentes = historial.filter(v => v.esRecurrente).length;
  const conCargo = historial.filter(v => v.cargoEstacionaria).length;

  return (
    <ScrollView contentContainerStyle={an.scroll}>
      <View style={an.metricsRow}>
        <View style={an.metricBox}>
          <Text style={an.metricVal}>{totalHistorial}</Text>
          <Text style={an.metricLabel}>Visitas totales</Text>
        </View>
        <View style={an.metricBox}>
          <Text style={[an.metricVal, { color: '#E8A838' }]}>{totalRecurrentes}</Text>
          <Text style={an.metricLabel}>Recurrentes</Text>
        </View>
        <View style={an.metricBox}>
          <Text style={[an.metricVal, { color: '#C0392B' }]}>{conCargo}</Text>
          <Text style={an.metricLabel}>Con cargo</Text>
        </View>
      </View>

      <Text style={an.secTitle}>Riesgo por inquilino</Text>
      {rankingInquilinos.length === 0 ? (
        <Text style={an.vacio}>Sin visitas activas</Text>
      ) : rankingInquilinos.map(({ id, nombre, count, peorH, estado }) => (
        <View key={id} style={an.row}>
          <View style={{ flex: 1 }}>
            <Text style={an.nombre}>{nombre}</Text>
            <Text style={an.meta}>{count} visita{count !== 1 ? 's' : ''} · máx {formatHoras(peorH)}</Text>
          </View>
          <View style={[an.badge, { backgroundColor: ESTADO_COLOR[estado] }]}>
            <Text style={an.badgeText}>{ESTADO_LABEL[estado]}</Text>
          </View>
        </View>
      ))}

      <Text style={[an.secTitle, { marginTop: spacing[5] }]}>Visitantes frecuentes</Text>
      {frecuentes.length === 0 ? (
        <Text style={an.vacio}>Sin visitantes recurrentes</Text>
      ) : frecuentes.map(({ doc, nombre, count }) => (
        <View key={doc} style={an.row}>
          <View style={{ flex: 1 }}>
            <Text style={an.nombre}>{nombre}</Text>
            <Text style={an.meta}>{doc}</Text>
          </View>
          <Text style={an.countText}>{count}×</Text>
        </View>
      ))}
    </ScrollView>
  );
}

// ─── PanelDerecho ─────────────────────────────────────────────

function PanelDerecho({ visita, historialDoc, onCerrar }: {
  visita: Visita;
  historialDoc: Visita[];
  onCerrar?: () => void;
}) {
  const [horas, setHoras] = useState(() => calcularHorasActiva(visita.fechaEntrada));
  const [accion, setAccion] = useState<string | null>(null);

  useEffect(() => {
    setHoras(calcularHorasActiva(visita.fechaEntrada));
    const t = setInterval(() => setHoras(calcularHorasActiva(visita.fechaEntrada)), 30_000);
    return () => clearInterval(t);
  }, [visita.id, visita.fechaEntrada]);

  const estado = calcularEstadoEstacionaria(horas);
  const color = ESTADO_COLOR[estado];
  const nombre = visita.nombreVisitante || visita.documentoNumero;

  async function handleSalida() {
    setAccion('salida');
    try { await registrarSalida(visita.id); } finally { setAccion(null); }
  }

  async function handleCargo72h() {
    setAccion('cargo');
    try { await marcarCargo72h(visita.id); } finally { setAccion(null); }
  }

  async function handleRuta(ruta: 'A' | 'B') {
    setAccion(`ruta${ruta}`);
    try { await elegirRuta(visita.id, ruta); } finally { setAccion(null); }
  }

  const prevVisitas = historialDoc.filter(v => v.id !== visita.id);

  return (
    <ScrollView style={pd.container} contentContainerStyle={pd.content}>
      {/* Header */}
      <View style={pd.panelHeader}>
        <View style={{ flex: 1 }}>
          <Text style={pd.panelNombre}>{nombre}</Text>
          <Text style={pd.panelSub}>{visita.documentoTipo} {visita.documentoNumero}</Text>
        </View>
        {onCerrar && (
          <TouchableOpacity style={pd.cerrarBtn} onPress={onCerrar}>
            <Ionicons name="close-outline" size={20} color={cartasBosque.helecho} />
          </TouchableOpacity>
        )}
      </View>

      {/* Horas realtime */}
      <View style={[pd.horasBox, { borderColor: color }]}>
        <Text style={[pd.horasNum, { color }]}>{formatHoras(horas)}</Text>
        <Text style={pd.horasLabel}>{ESTADO_LABEL[estado]}</Text>
      </View>

      {/* Timeline */}
      <View style={pd.timelineRow}>
        {UMBRAL_HORAS.map((h, i) => {
          const pasado = h === 0 || horas >= h;
          const nc = pasado ? ESTADO_COLOR[HORA_ESTADO[h]] : cartasBosque.pergaminoOscuro;
          return (
            <React.Fragment key={h}>
              <View style={pd.tlNode}>
                <View style={[pd.tlDot, { backgroundColor: nc }]} />
                <Text style={[pd.tlLabel, { color: nc }]}>{h === 0 ? '0h' : `${h}h`}</Text>
              </View>
              {i < UMBRAL_HORAS.length - 1 && (
                <View style={[pd.tlLine, {
                  backgroundColor: horas >= UMBRAL_HORAS[i + 1]!
                    ? ESTADO_COLOR[HORA_ESTADO[UMBRAL_HORAS[i + 1]!]]
                    : cartasBosque.pergaminoOscuro,
                }]} />
              )}
            </React.Fragment>
          );
        })}
      </View>

      {/* Datos */}
      <View style={pd.datosGrid}>
        {([
          ['Inquilino', visita.inquilinoNombre ?? '—'],
          ['Habitación', `Hab. ${visita.habitacionNumero ?? '—'}`],
          ['Motivo', visita.motivo || '—'],
          ['Teléfono', visita.telefono || '—'],
          ['Entrada', formatFechaCorta(visita.fechaEntrada)],
          ['Cargo', visita.cargoEstacionaria ? `$${visita.cargoEstacionaria} MXN` : 'Sin cargo'],
          ['Ruta elegida', visita.rutaElegida ? `Camino ${visita.rutaElegida}` : '—'],
        ] as [string, string][]).map(([label, value]) => (
          <View key={label} style={pd.datoRow}>
            <Text style={pd.datoLabel}>{label}</Text>
            <Text style={pd.datoValue} numberOfLines={1}>{value}</Text>
          </View>
        ))}
      </View>

      {/* Historial del documento */}
      {prevVisitas.length > 0 && (
        <View style={pd.seccion}>
          <Text style={pd.seccionTitle}>
            Historial — {visita.documentoNumero} ({prevVisitas.length} anterior{prevVisitas.length !== 1 ? 'es' : ''})
          </Text>
          {prevVisitas.slice(0, 5).map(v => (
            <View key={v.id} style={pd.histRow}>
              <Text style={pd.histFecha}>{formatFechaCorta(v.fechaEntrada)}</Text>
              <Text style={pd.histDur}>{formatHoras(duracionHoras(v))}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Acciones */}
      {!visita.fechaSalida && (
        <View style={pd.accionesBox}>
          <TouchableOpacity style={pd.accionBtn} onPress={handleSalida} disabled={!!accion}>
            {accion === 'salida'
              ? <ActivityIndicator size="small" color={cartasBosque.bruma} />
              : <Text style={pd.accionBtnText}>Registrar salida</Text>}
          </TouchableOpacity>

          {horas >= HORAS_ESTACIONARIA.CARGO && estado === 'alerta_50h' && (
            <TouchableOpacity
              style={[pd.accionBtn, { backgroundColor: '#C0392B' }]}
              onPress={handleCargo72h}
              disabled={!!accion}
            >
              {accion === 'cargo'
                ? <ActivityIndicator size="small" color={cartasBosque.bruma} />
                : <Text style={pd.accionBtnText}>Aplicar cargo 72h · ${MONTO_CARGO_ESTACIONARIA}</Text>}
            </TouchableOpacity>
          )}

          {estado === 'deposito_102h' && !visita.rutaElegida && (
            <View style={pd.rutaRow}>
              {(['A', 'B'] as const).map(r => (
                <TouchableOpacity
                  key={r}
                  style={[pd.rutaBtn, { borderColor: r === 'A' ? cartasBosque.bosque : '#C0392B' }]}
                  onPress={() => handleRuta(r)}
                  disabled={!!accion}
                >
                  {accion === `ruta${r}`
                    ? <ActivityIndicator size="small" color={cartasBosque.bosque} />
                    : <Text style={[pd.rutaBtnText, { color: r === 'A' ? cartasBosque.bosque : '#C0392B' }]}>
                        Camino {r}
                      </Text>}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {visita.rutaElegida && (
            <Text style={pd.rutaElegida}>Camino {visita.rutaElegida} elegido</Text>
          )}
        </View>
      )}
    </ScrollView>
  );
}

// ─── Main screen ──────────────────────────────────────────────

export default function VisitasAdminScreen() {
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [cargando, setCargando] = useState(true);
  const [seeded, setSeeded] = useState(false);
  const [tab, setTab] = useState<Tab>('activas');
  const [seleccionadaId, setSeleccionadaId] = useState<string | null>(null);
  const [historial, setHistorial] = useState<Visita[]>([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(true);

  const isWeb = Platform.OS === 'web';

  useEffect(() => {
    if (__DEV__ && !seeded) {
      seedVisitas().catch(() => {}).finally(() => setSeeded(true));
    }
    const unsub = listenTodasVisitasActivas(data => {
      setVisitas(data);
      setCargando(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    getDocs(collections.visitas)
      .then(snap => {
        const all = snap.docs.map(d => ({ ...d.data(), id: d.id } as Visita));
        all.sort((a, b) => (b.creadoEn?.toMillis?.() ?? 0) - (a.creadoEn?.toMillis?.() ?? 0));
        setHistorial(all);
      })
      .catch(() => {})
      .finally(() => setCargandoHistorial(false));
  }, []);

  const seleccionada = visitas.find(v => v.id === seleccionadaId) ?? null;

  const enAlerta = visitas.filter(v => calcularHorasActiva(v.fechaEntrada) >= HORAS_ESTACIONARIA.ALERTA_1);
  const cargoPendiente = visitas.filter(v => calcularHorasActiva(v.fechaEntrada) >= HORAS_ESTACIONARIA.CARGO);
  const recurrentes = visitas.filter(v => v.esRecurrente);

  const historialDoc = seleccionada
    ? historial.filter(v => v.documentoNumero === seleccionada.documentoNumero)
    : [];

  function handleSelect(id: string) {
    setSeleccionadaId(prev => prev === id ? null : id);
  }

  const headerStats = (
    <View style={s.statsRow}>
      <StatCard label="Activas" valor={visitas.length} color="#3B82F6" />
      <StatCard label="En alerta" valor={enAlerta.length} color="#E8A838" />
      <StatCard label="Cargo 72h" valor={cargoPendiente.length} color="#C0392B" />
      <StatCard label="Recurrentes" valor={recurrentes.length} color="#960018" />
    </View>
  );

  const tabBar = (
    <View style={s.tabBar}>
      <TabBtn label="ACTIVAS" activa={tab === 'activas'} onPress={() => setTab('activas')} />
      <TabBtn label="HISTORIAL" activa={tab === 'historial'} onPress={() => setTab('historial')} />
      <TabBtn label="ANÁLISIS" activa={tab === 'analisis'} onPress={() => setTab('analisis')} />
    </View>
  );

  function renderLista() {
    if (tab === 'activas') {
      if (cargando) return <ActivityIndicator style={{ margin: spacing[6] }} color={cartasBosque.bosque} />;
      if (visitas.length === 0) return <Text style={s.vacio}>Sin visitas activas</Text>;
      return (
        <ScrollView contentContainerStyle={{ padding: spacing[3] }}>
          {visitas.map(v => (
            <FilaActiva
              key={v.id}
              visita={v}
              seleccionada={seleccionadaId === v.id}
              onSelect={() => handleSelect(v.id)}
            />
          ))}
        </ScrollView>
      );
    }

    if (tab === 'historial') {
      if (cargandoHistorial) return <ActivityIndicator style={{ margin: spacing[6] }} color={cartasBosque.bosque} />;
      const historico = historial.filter(v => !!v.fechaSalida);
      if (historico.length === 0) return <Text style={s.vacio}>Sin historial</Text>;
      return (
        <ScrollView contentContainerStyle={{ padding: spacing[3] }}>
          {historico.map(v => (
            <FilaHistorial key={v.id} visita={v} />
          ))}
        </ScrollView>
      );
    }

    return <TabAnalisis activas={visitas} historial={historial} />;
  }

  const Root = isWeb ? View : SafeAreaView;

  if (isWeb) {
    return (
      <View style={s.webRoot}>
        {/* Columna izquierda */}
        <View style={s.webLeft}>
          <View style={s.webHeader}>
            <Text style={s.titulo}>Visitas</Text>
            {__DEV__ && (
              <TouchableOpacity style={s.seedBtn} onPress={() => { setSeeded(false); seedVisitas().catch(() => {}); }}>
                <Text style={s.seedBtnText}>seed</Text>
              </TouchableOpacity>
            )}
          </View>
          {headerStats}
          {tabBar}
          <View style={{ flex: 1 }}>
            {renderLista()}
          </View>
        </View>

        {/* Columna derecha */}
        <View style={s.webRight}>
          {seleccionada && tab === 'activas' ? (
            <PanelDerecho
              key={seleccionadaId ?? 'empty'}
              visita={seleccionada}
              historialDoc={historialDoc}
              onCerrar={() => setSeleccionadaId(null)}
            />
          ) : (
            <View style={s.emptyPanel}>
              <Ionicons name="eye-outline" size={32} color={cartasBosque.pergaminoOscuro} />
              <Text style={s.emptyPanelText}>Selecciona una visita activa para ver el detalle</Text>
            </View>
          )}
        </View>
      </View>
    );
  }

  // ── Mobile ──
  return (
    <Root style={s.safe}>
      <View style={s.mobileHeader}>
        <Text style={s.titulo}>Visitas</Text>
        {__DEV__ && (
          <TouchableOpacity style={s.seedBtn} onPress={() => { setSeeded(false); seedVisitas().catch(() => {}); }}>
            <Text style={s.seedBtnText}>seed</Text>
          </TouchableOpacity>
        )}
      </View>
      {headerStats}
      {tabBar}
      <View style={{ flex: 1 }}>
        {renderLista()}
      </View>

      <Modal
        visible={!!seleccionada && tab === 'activas'}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSeleccionadaId(null)}
      >
        {seleccionada && (
          <SafeAreaView style={{ flex: 1, backgroundColor: cartasBosque.bruma }}>
            <PanelDerecho
              key={seleccionadaId ?? 'empty'}
              visita={seleccionada}
              historialDoc={historialDoc}
              onCerrar={() => setSeleccionadaId(null)}
            />
          </SafeAreaView>
        )}
      </Modal>
    </Root>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: cartasBosque.bruma },
  webRoot: { flex: 1, flexDirection: 'row', backgroundColor: cartasBosque.bruma },
  webLeft: {
    width: 380, flexShrink: 0,
    borderRightWidth: 1, borderRightColor: cartasBosque.pergaminoOscuro,
    backgroundColor: cartasBosque.pergamino,
  },
  webRight: { flex: 1, backgroundColor: cartasBosque.bruma },
  webHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingTop: spacing[4], paddingBottom: spacing[3],
    borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro,
  },
  mobileHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingTop: spacing[4], paddingBottom: spacing[3],
    borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro,
  },
  titulo: { fontFamily: 'Inter_600SemiBold', fontSize: 18, color: cartasBosque.tinta },
  seedBtn: {
    borderRadius: borderRadius.sm, borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    paddingHorizontal: spacing[2], paddingVertical: 3,
  },
  seedBtnText: { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.helecho },
  statsRow: {
    flexDirection: 'row', paddingHorizontal: spacing[3], paddingVertical: spacing[3], gap: spacing[2],
  },
  statCard: {
    flex: 1, backgroundColor: cartasBosque.bruma, borderRadius: borderRadius.sm,
    padding: spacing[2], alignItems: 'center', borderTopWidth: 3,
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
  },
  statValor: { fontFamily: 'Inter_700Bold', fontSize: 20 },
  statLabel: { fontFamily: 'SpaceMono_400Regular', fontSize: 9, color: cartasBosque.helecho, marginTop: 1, textAlign: 'center' },
  tabBar: {
    flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro,
    paddingHorizontal: spacing[3],
  },
  tabBtn: { paddingVertical: spacing[2], paddingHorizontal: spacing[3], marginRight: spacing[1] },
  tabBtnActivo: { borderBottomWidth: 2, borderBottomColor: cartasBosque.bosque },
  tabBtnText: { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.helecho },
  tabBtnTextActivo: { color: cartasBosque.bosque },
  vacio: {
    fontFamily: 'Inter_400Regular', fontSize: 14, color: cartasBosque.helecho,
    textAlign: 'center', margin: spacing[6],
  },
  emptyPanel: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[3],
    paddingHorizontal: spacing[6],
  },
  emptyPanelText: {
    fontFamily: 'Inter_400Regular', fontSize: 13, color: cartasBosque.helecho,
    textAlign: 'center',
  },
});

const fa = StyleSheet.create({
  row: {
    backgroundColor: cartasBosque.pergamino, borderRadius: borderRadius.md,
    padding: spacing[3], marginBottom: spacing[2],
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    borderLeftWidth: 3,
  },
  rowSel: {
    borderColor: cartasBosque.bosque + '80',
    backgroundColor: '#E8EBE0' + '44',
  },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2], marginBottom: spacing[2] },
  nombre: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: cartasBosque.tinta, flexShrink: 1 },
  recurrente: { fontFamily: 'SpaceMono_400Regular', fontSize: 8, color: '#960018', letterSpacing: 0.5 },
  meta: { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.helecho, marginTop: 1 },
  estadoBadge: { borderRadius: borderRadius.sm, paddingHorizontal: spacing[2], paddingVertical: 2 },
  estadoText: { fontFamily: 'SpaceMono_400Regular', fontSize: 9, color: '#FFFFFF' },
  horasText: { fontFamily: 'SpaceMono_400Regular', fontSize: 10 },
  progressBg: {
    height: 3, backgroundColor: cartasBosque.pergaminoOscuro,
    borderRadius: borderRadius.full, overflow: 'hidden',
  },
  progressFill: { height: 3, borderRadius: borderRadius.full },
});

const fh = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: cartasBosque.pergamino, borderRadius: borderRadius.md,
    padding: spacing[3], marginBottom: spacing[2],
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
  },
  nombre: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: cartasBosque.tinta },
  meta: { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.helecho, marginTop: 1 },
  fecha: { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.helecho, marginTop: 2 },
  duracion: { fontFamily: 'SpaceMono_400Regular', fontSize: 12 },
  activaBadge: {
    backgroundColor: '#4A9B6F', borderRadius: borderRadius.full,
    paddingHorizontal: spacing[2], paddingVertical: 1,
  },
  activaText: { fontFamily: 'SpaceMono_400Regular', fontSize: 8, color: '#FFFFFF' },
  rec: { fontFamily: 'SpaceMono_400Regular', fontSize: 8, color: '#960018' },
});

const an = StyleSheet.create({
  scroll: { padding: spacing[4], gap: spacing[3] },
  metricsRow: { flexDirection: 'row', gap: spacing[3], marginBottom: spacing[2] },
  metricBox: {
    flex: 1, backgroundColor: cartasBosque.pergamino, borderRadius: borderRadius.md,
    padding: spacing[3], alignItems: 'center',
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
  },
  metricVal: { fontFamily: 'Inter_700Bold', fontSize: 22, color: cartasBosque.tinta },
  metricLabel: { fontFamily: 'SpaceMono_400Regular', fontSize: 9, color: cartasBosque.helecho, marginTop: 2 },
  secTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: cartasBosque.tinta, marginBottom: spacing[2] },
  vacio: { fontFamily: 'Inter_400Regular', fontSize: 13, color: cartasBosque.helecho, marginBottom: spacing[2] },
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: cartasBosque.pergamino, borderRadius: borderRadius.md,
    padding: spacing[3], marginBottom: spacing[2],
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    gap: spacing[3],
  },
  nombre: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: cartasBosque.tinta },
  meta: { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.helecho, marginTop: 1 },
  badge: { borderRadius: borderRadius.sm, paddingHorizontal: spacing[2], paddingVertical: 3 },
  badgeText: { fontFamily: 'SpaceMono_400Regular', fontSize: 9, color: '#FFFFFF' },
  countText: { fontFamily: 'Inter_700Bold', fontSize: 16, color: '#960018' },
});

const pd = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing[4], gap: spacing[4] },
  panelHeader: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3],
  },
  panelNombre: { fontFamily: 'Inter_600SemiBold', fontSize: 17, color: cartasBosque.tinta },
  panelSub: { fontFamily: 'SpaceMono_400Regular', fontSize: 11, color: cartasBosque.helecho, marginTop: 2 },
  cerrarBtn: {
    width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    backgroundColor: cartasBosque.pergaminoOscuro,
  },
  horasBox: {
    alignItems: 'center', paddingVertical: spacing[4],
    backgroundColor: cartasBosque.pergamino, borderRadius: borderRadius.lg,
    borderWidth: 2,
  },
  horasNum: { fontFamily: 'Inter_700Bold', fontSize: 32 },
  horasLabel: { fontFamily: 'SpaceMono_400Regular', fontSize: 11, color: cartasBosque.helecho, marginTop: 4 },
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start' },
  tlNode: { alignItems: 'center', width: 42 },
  tlDot: { width: 12, height: 12, borderRadius: 6 },
  tlLabel: { fontFamily: 'SpaceMono_400Regular', fontSize: 8, textAlign: 'center', marginTop: 3 },
  tlLine: { flex: 1, height: 2, marginTop: 5 },
  datosGrid: {
    backgroundColor: cartasBosque.pergamino, borderRadius: borderRadius.lg,
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro, overflow: 'hidden',
  },
  datoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    borderBottomWidth: 1, borderBottomColor: cartasBosque.bruma,
  },
  datoLabel: { fontFamily: 'SpaceMono_400Regular', fontSize: 11, color: cartasBosque.helecho },
  datoValue: { fontFamily: 'Inter_400Regular', fontSize: 12, color: cartasBosque.tinta, flexShrink: 1, textAlign: 'right' },
  seccion: {
    backgroundColor: cartasBosque.pergamino, borderRadius: borderRadius.lg,
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro, padding: spacing[3],
  },
  seccionTitle: {
    fontFamily: 'Inter_600SemiBold', fontSize: 12, color: cartasBosque.tinta, marginBottom: spacing[2],
  },
  histRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: spacing[1],
    borderTopWidth: 1, borderTopColor: cartasBosque.bruma,
  },
  histFecha: { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.helecho },
  histDur: { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.tinta },
  accionesBox: { gap: spacing[2] },
  accionBtn: {
    backgroundColor: cartasBosque.bosque, borderRadius: borderRadius.md,
    paddingVertical: spacing[3], alignItems: 'center',
  },
  accionBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: cartasBosque.bruma },
  rutaRow: { flexDirection: 'row', gap: spacing[2] },
  rutaBtn: {
    flex: 1, borderWidth: 1, borderRadius: borderRadius.md,
    paddingVertical: spacing[2] + 2, alignItems: 'center',
  },
  rutaBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  rutaElegida: {
    fontFamily: 'SpaceMono_400Regular', fontSize: 11,
    color: cartasBosque.helecho, textAlign: 'center', paddingVertical: spacing[2],
  },
});
