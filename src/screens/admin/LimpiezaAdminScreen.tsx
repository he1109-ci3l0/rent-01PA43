import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, FlatList, Modal, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Timestamp } from 'firebase/firestore';
import { cartasBosque } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/spacing';
import TurnoCard from '@/components/common/TurnoCard';
import {
  listenTodosTurnos, listenPermutasPendientes, listenIncumplimientos,
  seedTurnos, regenerarTurnos, moverTurno, marcarIncumplimiento,
  aprobarPermuta, bloquearPermuta,
  AREA_LABELS, AREA_ICONS, AREAS_COMUNES, formatFechaTurno,
  HORAS_LIMITE_FOTO,
} from '@/services/firebase/limpieza';
import type { TurnoLimpieza, PermutaLimpieza, AreaLimpieza } from '@/types/firestore';

// ─── Helpers ──────────────────────────────────────────────────

type Vista    = 'calendario' | 'areas' | 'turnos';
type SubVista = 'lista' | 'permutas' | 'incumplimientos';

const DIAS_SEMANA_CAL = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
const MESES_ES_CAL    = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                         'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function mismaFechaLimp(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

const HORAS = Array.from({ length: 16 }, (_, i) => `${String(i + 7).padStart(2, '0')}:00`);

function agruparPorFecha(
  turnos: TurnoLimpieza[],
): Array<{ fecha: string; items: TurnoLimpieza[] }> {
  const map = new Map<string, TurnoLimpieza[]>();
  for (const t of turnos) {
    const key = t.fechaProgramada.toDate().toLocaleDateString('es-MX', {
      weekday: 'short', day: 'numeric', month: 'short',
    });
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(t);
  }
  return Array.from(map.entries()).map(([fecha, items]) => ({ fecha, items }));
}

// ─── Modal mover turno ────────────────────────────────────────

function ModalMover({
  turno, visible, onClose,
}: {
  turno: TurnoLimpieza | null;
  visible: boolean;
  onClose: () => void;
}) {
  const [hora, setHora]         = useState('08:00');
  const [diasOffset, setDias]   = useState(0);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (turno) { setHora(turno.horaInicio); setDias(0); }
  }, [turno]);

  async function confirmar() {
    if (!turno) return;
    setGuardando(true);
    try {
      const base = turno.fechaProgramada.toDate();
      base.setDate(base.getDate() + diasOffset);
      await moverTurno(turno.id, base, hora);
      onClose();
    } catch {
      Alert.alert('Error', 'No se pudo mover el turno.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        <Text style={styles.sheetTitulo}>Mover turno</Text>
        {turno && (
          <Text style={styles.sheetSub}>
            {turno.inquilinoNombre} · {AREA_LABELS[turno.area]}
          </Text>
        )}

        <Text style={styles.sheetLabel}>DESPLAZAR DÍAS</Text>
        <View style={styles.stepper}>
          <TouchableOpacity onPress={() => setDias(d => d - 1)} style={styles.stepBtn}>
            <Ionicons name="remove-outline" size={20} color={cartasBosque.bosque} />
          </TouchableOpacity>
          <Text style={styles.stepValue}>{diasOffset > 0 ? `+${diasOffset}` : diasOffset}</Text>
          <TouchableOpacity onPress={() => setDias(d => d + 1)} style={styles.stepBtn}>
            <Ionicons name="add-outline" size={20} color={cartasBosque.bosque} />
          </TouchableOpacity>
        </View>

        <Text style={styles.sheetLabel}>HORA</Text>
        <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
          {HORAS.map(h => (
            <TouchableOpacity
              key={h}
              style={[styles.horaItem, hora === h && styles.horaItemSel]}
              onPress={() => setHora(h)}
            >
              <Text style={[styles.horaText, hora === h && styles.horaTextSel]}>{h}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <TouchableOpacity
          style={[styles.btnPrimario, guardando && { opacity: 0.5 }]}
          onPress={confirmar} disabled={guardando}
        >
          {guardando
            ? <ActivityIndicator color={cartasBosque.bruma} />
            : <Text style={styles.btnPrimarioText}>Guardar</Text>
          }
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnSecundario} onPress={onClose}>
          <Text style={styles.btnSecundarioText}>Cancelar</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ─── Fila permuta ─────────────────────────────────────────────

function PermutaRow({
  permuta, onAprobar, onBloquear,
}: {
  permuta: PermutaLimpieza;
  onAprobar: () => void;
  onBloquear: () => void;
}) {
  return (
    <View style={styles.permutaCard}>
      <View style={styles.permutaTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.permutaTitle}>
            {permuta.solicitanteNombre}
            <Text style={styles.permutaSub}> · Hab. {permuta.solicitanteHab || '—'}</Text>
          </Text>
          <Text style={styles.permutaSub}>
            {formatFechaTurno(permuta.turnoOrigenFecha)} → con {permuta.inquilinoDestinoNombre}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: '#E8EBE0' }]}>
          <Text style={[styles.badgeText, { color: '#8A6A72' }]}>pendiente</Text>
        </View>
      </View>
      <View style={styles.permutaAcciones}>
        <TouchableOpacity style={styles.btnAprobar} onPress={onAprobar}>
          <Ionicons name="checkmark-outline" size={13} color={cartasBosque.bruma} />
          <Text style={styles.btnAprobarText}>Aprobar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnBloquear} onPress={onBloquear}>
          <Ionicons name="ban-outline" size={13} color={cartasBosque.helecho} />
          <Text style={styles.btnBloquearText}>Bloquear</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Fila incumplimiento ──────────────────────────────────────

function IncumpRow({ turno }: { turno: TurnoLimpieza }) {
  return (
    <View style={styles.incumpCard}>
      <View style={{ flex: 1 }}>
        <Text style={styles.incumpNombre}>{turno.inquilinoNombre}</Text>
        <Text style={styles.incumpSub}>
          {AREA_LABELS[turno.area]} · {formatFechaTurno(turno.fechaProgramada)} · {turno.horaInicio}
        </Text>
      </View>
      <View style={[styles.badge, { backgroundColor: 'rgba(103,0,16,0.15)' }]}>
        <Text style={[styles.badgeText, { color: '#960018' }]}>incumpl.</Text>
      </View>
    </View>
  );
}

// ─── Pantalla principal ───────────────────────────────────────

export default function LimpiezaAdminScreen() {
  const [vistaActiva, setVistaActiva] = useState<Vista>('calendario');
  const [tabTurnos, setTabTurnos]     = useState<SubVista>('lista');
  const [turnos, setTurnos]           = useState<TurnoLimpieza[]>([]);
  const [permutas, setPermutas]       = useState<PermutaLimpieza[]>([]);
  const [incumplimientos, setIncumpl] = useState<TurnoLimpieza[]>([]);
  const [cargando, setCargando]       = useState(true);
  const [turnoMover, setTurnoMover]   = useState<TurnoLimpieza | null>(null);
  const [seeding, setSeeding]         = useState(false);
  const [regenerando, setRegenerando] = useState(false);
  const [areaFiltro, setAreaFiltro]   = useState<AreaLimpieza | 'todas'>('todas');
  const [mesCalendario, setMesCalendario] = useState(() => {
    const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d;
  });
  const [diaModal, setDiaModal] = useState<Date | null>(null);

  useEffect(() => {
    seedTurnos()
      .catch(() => {})
      .finally(() => setSeeding(false));

    const uns1 = listenTodosTurnos(data => {
      setTurnos(data);
      setCargando(false);
    });
    const uns2 = listenPermutasPendientes(setPermutas);
    const uns3 = listenIncumplimientos(setIncumpl);
    return () => { uns1(); uns2(); uns3(); };
  }, []);

  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const turnosFiltrados = turnos.filter(t => {
    const futuro = t.fechaProgramada.toDate() >= hoy;
    const matchArea = areaFiltro === 'todas' || t.area === areaFiltro;
    return futuro && matchArea;
  });

  const grupos = agruparPorFecha(turnosFiltrados);

  const ALL_AREAS: Array<AreaLimpieza | 'todas'> = [
    'todas', 'bano_1_pb', 'bano_2_pb', 'bano_gris', 'bano_marron', 'bano_terraza',
    'cocina_pb', 'cocina_tp', 'pasillo', 'escalera', 'patio', 'tendedero',
  ];

  async function handleMarcarIncumplimiento(turno: TurnoLimpieza) {
    Alert.alert(
      'Marcar incumplimiento',
      `¿Registrar incumplimiento para ${turno.inquilinoNombre}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar', style: 'destructive',
          onPress: () => marcarIncumplimiento(turno.id).catch(() => {}),
        },
      ],
    );
  }

  async function handleAprobar(p: PermutaLimpieza) {
    try { await aprobarPermuta(p); }
    catch { Alert.alert('Error', 'No se pudo aprobar la permuta.'); }
  }

  async function handleBloquear(p: PermutaLimpieza) {
    try { await bloquearPermuta(p); }
    catch { Alert.alert('Error', 'No se pudo bloquear la permuta.'); }
  }

  async function handleRegenerarTurnos() {
    Alert.alert(
      'Regenerar turnos',
      'Esto generará 60 días de turnos para todos los inquilinos activos. ¿Continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Regenerar', onPress: async () => {
            setRegenerando(true);
            try {
              await regenerarTurnos(60);
              Alert.alert('Listo', 'Turnos generados correctamente.');
            } catch (e: any) {
              Alert.alert('Error', e.message ?? 'No se pudieron generar los turnos.');
            } finally {
              setRegenerando(false);
            }
          },
        },
      ],
    );
  }

  // ── Datos calendario ────────────────────────────────────────
  const anioMes   = mesCalendario.getFullYear();
  const mesMes    = mesCalendario.getMonth();
  const diasEnMes = new Date(anioMes, mesMes + 1, 0).getDate();
  const primerDia = new Date(anioMes, mesMes, 1).getDay();
  const celdas: (number | null)[] = [
    ...Array(primerDia).fill(null),
    ...Array.from({ length: diasEnMes }, (_, i) => i + 1),
  ];
  while (celdas.length % 7 !== 0) celdas.push(null);

  function turnosDia(dia: number): TurnoLimpieza[] {
    return turnos.filter(t => {
      const f = t.fechaProgramada.toDate();
      return f.getFullYear() === anioMes && f.getMonth() === mesMes && f.getDate() === dia;
    });
  }

  const turnosDiaModal = diaModal
    ? turnos.filter(t => mismaFechaLimp(t.fechaProgramada.toDate(), diaModal))
    : [];

  const AREA_KEYS = Object.keys(AREA_LABELS) as AreaLimpieza[];

  return (
    <View style={{ flex: 1, backgroundColor: cartasBosque.bruma }}>

      {/* ── Header de 3 pestañas ── */}
      <View style={styles.vistaTabs}>
        {(['calendario', 'turnos', 'areas'] as Vista[]).map(v => (
          <TouchableOpacity
            key={v}
            style={[styles.vistaTab, vistaActiva === v && styles.vistaTabActiva]}
            onPress={() => setVistaActiva(v)}
          >
            <Text style={[styles.vistaTabText, vistaActiva === v && styles.vistaTabTextActiva]}>
              {v === 'calendario' ? 'CALENDARIO' : v === 'turnos' ? 'TURNOS' : 'POR ÁREA'}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[styles.regenerarBtn, regenerando && { opacity: 0.6 }]}
          onPress={handleRegenerarTurnos}
          disabled={regenerando}
        >
          {regenerando
            ? <ActivityIndicator size="small" color={cartasBosque.bruma} />
            : <>
                <Ionicons name="refresh-outline" size={14} color={cartasBosque.bruma} />
                <Text style={styles.regenerarBtnText}>Regenerar turnos</Text>
              </>
          }
        </TouchableOpacity>
      </View>

      {cargando ? (
        <ActivityIndicator color={cartasBosque.bosque} style={{ marginTop: spacing[8] }} />
      ) : (
        <>
          {/* ══ CALENDARIO ══ */}
          {vistaActiva === 'calendario' && (
            <ScrollView contentContainerStyle={{ padding: spacing[4], paddingBottom: spacing[10] }}>
              <View style={styles.calNav}>
                <TouchableOpacity
                  onPress={() => setMesCalendario(d => { const n = new Date(d); n.setMonth(n.getMonth() - 1); return n; })}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="chevron-back" size={18} color={cartasBosque.tinta} />
                </TouchableOpacity>
                <Text style={styles.calNavTitulo}>
                  {MESES_ES_CAL[mesMes].toUpperCase()} {anioMes}
                </Text>
                <TouchableOpacity
                  onPress={() => setMesCalendario(d => { const n = new Date(d); n.setMonth(n.getMonth() + 1); return n; })}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="chevron-forward" size={18} color={cartasBosque.tinta} />
                </TouchableOpacity>
              </View>
              <View style={styles.calGridRow}>
                {DIAS_SEMANA_CAL.map(d => (
                  <Text key={d} style={styles.calDiaNombre}>{d}</Text>
                ))}
              </View>
              <View style={styles.calGrid}>
                {celdas.map((dia, idx) => {
                  if (dia === null) return <View key={`b-${idx}`} style={styles.calCelda} />;
                  const fechaCelda = new Date(anioMes, mesMes, dia);
                  const esHoy = mismaFechaLimp(fechaCelda, new Date());
                  const tieneTurnos = turnosDia(dia).length > 0;
                  return (
                    <TouchableOpacity
                      key={dia}
                      style={styles.calCelda}
                      onPress={() => setDiaModal(fechaCelda)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.calNumWrap, esHoy && styles.calNumHoy]}>
                        <Text style={[styles.calNum, esHoy && styles.calNumHoyText]}>{dia}</Text>
                      </View>
                      {tieneTurnos && <View style={styles.calDot} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          )}

          {/* ══ TURNOS (contenido original) ══ */}
          {vistaActiva === 'turnos' && (
            <>
              <View style={styles.tabs}>
                {([
                  ['lista',           `Turnos (${turnosFiltrados.length})`],
                  ['permutas',        `Permutas (${permutas.length})`],
                  ['incumplimientos', `Incumpl. (${incumplimientos.length})`],
                ] as [SubVista, string][]).map(([v, label]) => (
                  <TouchableOpacity
                    key={v}
                    style={[styles.tabBtn, tabTurnos === v && styles.tabBtnActivo]}
                    onPress={() => setTabTurnos(v)}
                  >
                    <Text style={[styles.tabText, tabTurnos === v && styles.tabTextActivo]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {tabTurnos === 'lista' ? (
                <>
                  <ScrollView
                    horizontal showsHorizontalScrollIndicator={false}
                    style={styles.areaScroll}
                    contentContainerStyle={{ gap: spacing[2], padding: spacing[3] }}
                  >
                    {ALL_AREAS.map(a => (
                      <TouchableOpacity
                        key={a}
                        style={[styles.areaChip, areaFiltro === a && styles.areaChipActivo]}
                        onPress={() => setAreaFiltro(a)}
                      >
                        {a !== 'todas' && (
                          <Ionicons
                            name={AREA_ICONS[a as AreaLimpieza] as any}
                            size={12}
                            color={areaFiltro === a ? cartasBosque.bruma : cartasBosque.bosque}
                          />
                        )}
                        <Text style={[styles.areaChipText, areaFiltro === a && styles.areaChipTextActivo]}>
                          {a === 'todas' ? 'Todas' : AREA_LABELS[a as AreaLimpieza]}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  {grupos.length === 0 ? (
                    <View style={styles.vacio}>
                      <Ionicons name="brush-outline" size={36} color={cartasBosque.niebla} />
                      <Text style={styles.vacioText}>Sin turnos próximos</Text>
                    </View>
                  ) : (
                    <FlatList
                      data={grupos}
                      keyExtractor={g => g.fecha}
                      contentContainerStyle={{ padding: spacing[4], paddingBottom: spacing[10] }}
                      renderItem={({ item: grupo }) => (
                        <View>
                          <Text style={styles.fechaHeader}>{grupo.fecha}</Text>
                          {grupo.items.map(t => (
                            <View key={t.id}>
                              <TurnoCard turno={t} onMover={t2 => setTurnoMover(t2)} />
                              {t.estado === 'pendiente' && (
                                <TouchableOpacity
                                  style={styles.btnIncumplimiento}
                                  onPress={() => handleMarcarIncumplimiento(t)}
                                >
                                  <Text style={styles.btnIncumplimientoText}>
                                    Registrar incumplimiento
                                  </Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          ))}
                        </View>
                      )}
                    />
                  )}
                </>
              ) : tabTurnos === 'permutas' ? (
                <FlatList
                  data={permutas}
                  keyExtractor={p => p.id}
                  contentContainerStyle={{ padding: spacing[4], paddingBottom: spacing[10] }}
                  ListEmptyComponent={
                    <View style={styles.vacio}>
                      <Ionicons name="swap-horizontal-outline" size={36} color={cartasBosque.niebla} />
                      <Text style={styles.vacioText}>Sin permutas pendientes</Text>
                    </View>
                  }
                  renderItem={({ item }) => (
                    <PermutaRow
                      permuta={item}
                      onAprobar={() => handleAprobar(item)}
                      onBloquear={() => handleBloquear(item)}
                    />
                  )}
                />
              ) : (
                <FlatList
                  data={incumplimientos}
                  keyExtractor={t => t.id}
                  contentContainerStyle={{ padding: spacing[4], paddingBottom: spacing[10] }}
                  ListEmptyComponent={
                    <View style={styles.vacio}>
                      <Ionicons name="shield-checkmark-outline" size={36} color={cartasBosque.niebla} />
                      <Text style={styles.vacioText}>Sin incumplimientos registrados</Text>
                    </View>
                  }
                  renderItem={({ item }) => <IncumpRow turno={item} />}
                />
              )}
            </>
          )}

          {/* ══ POR ÁREA ══ */}
          {vistaActiva === 'areas' && (
            <ScrollView>
              <View style={styles.areaGrid}>
                {AREA_KEYS.map(area => {
                  const ta = turnos.filter(t => t.area === area);
                  const completados = ta.filter(t => t.estado === 'completado').length;
                  const pendientes  = ta.filter(t => t.estado === 'pendiente').length;
                  const incumplidos = ta.filter(t => t.estado === 'incumplimiento').length;
                  return (
                    <View key={area} style={styles.areaCard}>
                      <Ionicons name={AREA_ICONS[area] as any} size={22} color={cartasBosque.bosque} />
                      <Text style={styles.areaCardNombre}>{AREA_LABELS[area]}</Text>
                      <Text style={[styles.areaMetricVal, { color: '#3B82F6' }]}>
                        {ta.length} total
                      </Text>
                      <View style={styles.areaMetricRow}>
                        <Text style={[styles.areaMetricVal, { color: '#4A9B6F' }]}>{completados} ✓</Text>
                        <Text style={[styles.areaMetricVal, { color: '#E8A838' }]}>{pendientes} ⏳</Text>
                        <Text style={[styles.areaMetricVal, { color: '#E05C2A' }]}>{incumplidos} ✗</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          )}
        </>
      )}

      {/* ── Modal detalle día ── */}
      <Modal
        visible={diaModal !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setDiaModal(null)}
      >
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setDiaModal(null)} />
        <View style={styles.sheet}>
          {diaModal && (
            <>
              <Text style={styles.sheetTitulo}>
                {diaModal.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
              </Text>
              {turnosDiaModal.length === 0 ? (
                <Text style={styles.sheetSub}>Sin turnos este día</Text>
              ) : (
                <ScrollView style={{ maxHeight: 320 }} nestedScrollEnabled>
                  {turnosDiaModal.map(t => (
                    <View key={t.id} style={styles.diaModalRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.diaModalNombre}>{t.inquilinoNombre}</Text>
                        <Text style={styles.diaModalSub}>
                          {AREA_LABELS[t.area]} · {t.horaInicio} · {t.estado}
                        </Text>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              )}
              <TouchableOpacity style={styles.btnSecundario} onPress={() => setDiaModal(null)}>
                <Text style={styles.btnSecundarioText}>Cerrar</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </Modal>

      <ModalMover
        turno={turnoMover}
        visible={turnoMover !== null}
        onClose={() => setTurnoMover(null)}
      />
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ─── Nuevas pestañas de vista ─────────────────────────────
  vistaTabs: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: cartasBosque.pergaminoOscuro,
  },
  vistaTab: {
    flex: 1, paddingVertical: spacing[2] + 2,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  vistaTabActiva:     { borderBottomColor: cartasBosque.bosque },
  vistaTabText:       { fontFamily: 'MonaSans_400Regular', fontSize: 10, color: cartasBosque.helecho, letterSpacing: 0.5 },
  vistaTabTextActiva: { color: cartasBosque.bosque },

  // ─── Grid POR ÁREA ────────────────────────────────────────
  areaGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    padding: spacing[4], gap: spacing[3],
  },
  areaCard: {
    width: '47%',
    backgroundColor: cartasBosque.pergamino,
    borderRadius: borderRadius.md,
    padding: spacing[3],
    borderWidth: 1,
    borderColor: cartasBosque.pergaminoOscuro,
    gap: spacing[1],
  },
  areaCardNombre: {
    fontFamily: 'BricolageGrotesque_600SemiBold',
    fontSize: 13, color: cartasBosque.tinta,
  },
  areaMetricRow: {
    flexDirection: 'row', gap: spacing[3], marginTop: spacing[1],
  },
  areaMetricVal: {
    fontFamily: 'MonaSans_400Regular', fontSize: 11,
  },

  // ─── Calendario ───────────────────────────────────────────
  calNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: spacing[4],
  },
  calNavTitulo: {
    fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 15, color: cartasBosque.tinta,
  },
  calGridRow: { flexDirection: 'row', marginBottom: spacing[2] },
  calDiaNombre: {
    flex: 1, textAlign: 'center',
    fontFamily: 'MonaSans_400Regular', fontSize: 9, color: cartasBosque.helecho,
  },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCelda: {
    width: `${100 / 7}%` as any,
    alignItems: 'center', paddingVertical: spacing[1],
    minHeight: 44,
  },
  calNumWrap: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  calNumHoy:     { backgroundColor: cartasBosque.bosque },
  calNum:        { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: cartasBosque.tinta },
  calNumHoyText: { color: cartasBosque.bruma },
  calDot:        { width: 5, height: 5, borderRadius: 3, marginTop: 2, backgroundColor: cartasBosque.bosque },

  // ─── Modal día ────────────────────────────────────────────
  diaModalRow: {
    paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro,
  },
  diaModalNombre: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: cartasBosque.tinta },
  diaModalSub:    { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 11, color: cartasBosque.helecho, marginTop: 2 },

  // ─── Sub-pestañas TURNOS ──────────────────────────────────
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro,
    backgroundColor: cartasBosque.bruma,
  },
  tabBtn: {
    flex: 1, paddingVertical: spacing[2], alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabBtnActivo: { borderBottomColor: cartasBosque.bosque },
  tabText:      { fontFamily: 'MonaSans_400Regular', fontSize: 9, color: cartasBosque.helecho },
  tabTextActivo:{ color: cartasBosque.bosque },
  areaScroll: { borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro, maxHeight: 52 },
  areaChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing[2] + 2, paddingVertical: spacing[1] + 1,
    borderRadius: borderRadius.full,
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    backgroundColor: cartasBosque.pergamino,
  },
  areaChipActivo: { backgroundColor: cartasBosque.bosque, borderColor: cartasBosque.bosque },
  areaChipText:   { fontFamily: 'MonaSans_400Regular', fontSize: 10, color: cartasBosque.bosque },
  areaChipTextActivo: { color: cartasBosque.bruma },
  fechaHeader: {
    fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: cartasBosque.tinta,
    marginBottom: spacing[2], marginTop: spacing[3],
  },
  btnIncumplimiento: {
    alignSelf: 'flex-end', marginTop: -spacing[1], marginBottom: spacing[2],
    paddingHorizontal: spacing[2], paddingVertical: 3,
  },
  btnIncumplimientoText: {
    fontFamily: 'MonaSans_400Regular', fontSize: 9, color: '#960018', letterSpacing: 0.2,
  },
  vacio: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[2], marginTop: spacing[10] },
  vacioText: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 14, color: cartasBosque.helecho },
  // Permuta
  permutaCard: {
    backgroundColor: cartasBosque.pergamino,
    borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    padding: spacing[3], marginBottom: spacing[2],
  },
  permutaTop:    { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing[2] },
  permutaTitle:  { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: cartasBosque.tinta },
  permutaSub:    { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 11, color: cartasBosque.helecho, marginTop: 2 },
  permutaAcciones: { flexDirection: 'row', gap: spacing[2] },
  btnAprobar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[1],
    backgroundColor: cartasBosque.bosque,
    paddingHorizontal: spacing[3], paddingVertical: spacing[1] + 2,
    borderRadius: borderRadius.sm,
  },
  btnAprobarText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 12, color: cartasBosque.bruma },
  btnBloquear: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[1],
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    paddingHorizontal: spacing[2], paddingVertical: spacing[1] + 1,
    borderRadius: borderRadius.sm,
  },
  btnBloquearText: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: cartasBosque.helecho },
  badge: { paddingHorizontal: spacing[2], paddingVertical: 3, borderRadius: borderRadius.full },
  badgeText: { fontFamily: 'MonaSans_400Regular', fontSize: 9, letterSpacing: 0.3 },
  // Incumplimiento
  incumpCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: cartasBosque.pergamino,
    borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    padding: spacing[3], marginBottom: spacing[2],
  },
  incumpNombre: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: cartasBosque.tinta },
  incumpSub:    { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 11, color: cartasBosque.helecho, marginTop: 2 },
  regenerarBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: cartasBosque.bosque,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing[3], paddingVertical: spacing[1] + 2,
    marginRight: spacing[2],
  },
  regenerarBtnText: {
    fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 12, color: cartasBosque.bruma,
  },
  // Modal
  overlay: { flex: 1, backgroundColor: 'rgba(18,42,31,0.35)' },
  sheet: {
    backgroundColor: cartasBosque.bruma,
    borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl,
    padding: spacing[5], paddingBottom: spacing[8],
  },
  sheetTitulo: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 18, color: cartasBosque.tinta, marginBottom: spacing[1] },
  sheetSub:    { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: cartasBosque.helecho, marginBottom: spacing[3] },
  sheetLabel:  { fontFamily: 'MonaSans_400Regular', fontSize: 10, color: cartasBosque.helecho, letterSpacing: 0.5, marginBottom: spacing[1], marginTop: spacing[2] },
  stepper:     { flexDirection: 'row', alignItems: 'center', gap: spacing[4], marginBottom: spacing[2] },
  stepBtn:     { padding: spacing[2] },
  stepValue:   { fontFamily: 'MonaSans_400Regular', fontSize: 18, color: cartasBosque.tinta, minWidth: 32, textAlign: 'center' },
  horaItem:    { paddingVertical: spacing[2], paddingHorizontal: spacing[3], borderRadius: borderRadius.sm, marginBottom: 2 },
  horaItemSel: { backgroundColor: cartasBosque.bosque },
  horaText:    { fontFamily: 'MonaSans_400Regular', fontSize: 13, color: cartasBosque.tinta },
  horaTextSel: { color: cartasBosque.bruma },
  btnPrimario: {
    backgroundColor: cartasBosque.bosque, borderRadius: borderRadius.sm,
    paddingVertical: spacing[3], alignItems: 'center', marginTop: spacing[3], marginBottom: spacing[2],
  },
  btnPrimarioText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 14, color: cartasBosque.bruma },
  btnSecundario: { paddingVertical: spacing[2], alignItems: 'center' },
  btnSecundarioText: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: cartasBosque.helecho },
});
