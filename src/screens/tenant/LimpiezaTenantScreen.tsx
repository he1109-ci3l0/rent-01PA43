import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, Modal, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, FlatList,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { cartasBosque } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/spacing';
import { useAuth } from '@/hooks/useAuth';
import {
  listenMisTurnos, subirFotoTurno, togglePrivacidad,
  actualizarHora, solicitarPermuta,
  AREA_LABELS, formatFechaTurno,
} from '@/services/firebase/limpieza';
import {
  getDocs, addDoc, collection, query, where, Timestamp,
} from 'firebase/firestore';
import { db, collections } from '@/services/firebase/firestore';
import type { TurnoLimpieza, Inquilino } from '@/types/firestore';

// ─── Helpers de estado ────────────────────────────────────────

function calcEstadoTurno(turno: TurnoLimpieza): string {
  if (turno.estado === 'completado') return 'realizada';
  const ahora = new Date();
  const fecha = turno.fechaProgramada.toDate();
  if (fecha > ahora) return 'pendiente';
  const diffHrs = (ahora.getTime() - fecha.getTime()) / (1000 * 60 * 60);
  return diffHrs < 5 ? 'vencida' : 'ignorada';
}

function colorEstado(estado: string): string {
  switch (estado) {
    case 'realizada': return '#4A5E48';
    case 'pendiente': return '#8A9E80';
    case 'vencida':   return '#960018';
    case 'ignorada':  return '#8A6A72';
    default:          return cartasBosque.helecho;
  }
}

// ─── Helpers de fecha ─────────────────────────────────────────

const MESES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const DIAS_SEMANA_CORTOS = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
const DIAS_NOMBRE = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MESES_LARGO = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function mismaFecha(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function inicioSemana(): Date {
  const hoy = new Date();
  const d = new Date(hoy);
  const dia = d.getDay();
  d.setDate(d.getDate() - ((dia + 6) % 7)); // retrocede al lunes
  d.setHours(0, 0, 0, 0);
  return d;
}

const HORAS = Array.from({ length: 16 }, (_, i) => {
  const h = i + 7;
  return `${String(h).padStart(2, '0')}:00`;
});

// ─── Modal hora ───────────────────────────────────────────────

function ModalHora({
  turno, visible, onClose, onGuardar,
}: {
  turno: TurnoLimpieza | null;
  visible: boolean;
  onClose: () => void;
  onGuardar: (hora: string) => Promise<void>;
}) {
  const [hora, setHora] = useState(turno?.horaInicio ?? '08:00');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => { if (turno) setHora(turno.horaInicio); }, [turno]);

  async function confirmar() {
    setGuardando(true);
    try { await onGuardar(hora); onClose(); }
    catch { Alert.alert('Error', 'No se pudo actualizar la hora.'); }
    finally { setGuardando(false); }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        <Text style={styles.sheetTitulo}>Elegir hora</Text>
        <Text style={styles.sheetSub}>
          {turno ? `${AREA_LABELS[turno.area]} · ${formatFechaTurno(turno.fechaProgramada)}` : ''}
        </Text>
        <ScrollView style={{ maxHeight: 240 }} nestedScrollEnabled>
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

// ─── Modal permuta ────────────────────────────────────────────

function ModalPermuta({
  turno, visible, onClose,
}: {
  turno: TurnoLimpieza | null;
  visible: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [inquilinos, setInquilinos] = useState<Inquilino[]>([]);
  const [selecId, setSelecId]       = useState<string | null>(null);
  const [enviando, setEnviando]     = useState(false);

  useEffect(() => {
    if (!visible) return;
    getDocs(query(collections.inquilinos, where('estado', '==', 'activo')))
      .then(snap => {
        setInquilinos(
          snap.docs
            .map(d => ({ ...(d.data() as any), id: d.id }))
            .filter((i: Inquilino) => i.uid !== user?.uid)
        );
      })
      .catch(() => {});
  }, [visible]);

  async function enviar() {
    if (!turno || !selecId) return;
    const destino = inquilinos.find(i => i.uid === selecId);
    if (!destino) return;
    const meSnap = await getDocs(query(collections.inquilinos, where('uid', '==', user?.uid)));
    const me = meSnap.docs[0]?.data() as Inquilino | undefined;
    setEnviando(true);
    try {
      await solicitarPermuta({
        solicitanteId:          user!.uid,
        solicitanteNombre:      me ? `${me.nombre} ${me.apellido}`.trim() : user!.uid,
        solicitanteHab:         me?.habitacionId ?? '',
        turnoOrigenId:          turno.id,
        turnoOrigenFecha:       turno.fechaProgramada,
        inquilinoDestinoId:     destino.uid,
        inquilinoDestinoNombre: `${destino.nombre} ${destino.apellido}`.trim(),
        inquilinoDestinoHab:    destino.habitacionId ?? '',
      });
      Alert.alert('Solicitud enviada', 'El administrador revisará la permuta.');
      onClose();
    } catch {
      Alert.alert('Error', 'No se pudo enviar la solicitud.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        <Text style={styles.sheetTitulo}>Solicitar permuta</Text>
        <Text style={styles.sheetSub}>
          {turno ? `${AREA_LABELS[turno.area]} · ${formatFechaTurno(turno.fechaProgramada)}` : ''}
        </Text>
        <Text style={styles.sheetLabel}>CON QUIÉN PERMUTAR</Text>
        {inquilinos.length === 0
          ? <ActivityIndicator color={cartasBosque.bosque} style={{ marginVertical: spacing[3] }} />
          : (
            <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
              {inquilinos.map(i => (
                <TouchableOpacity
                  key={i.uid}
                  style={[styles.horaItem, selecId === i.uid && styles.horaItemSel]}
                  onPress={() => setSelecId(i.uid)}
                >
                  <Text style={[styles.horaText, selecId === i.uid && styles.horaTextSel]}>
                    {i.nombre} {i.apellido} · Hab. {i.habitacionId ?? '—'}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )
        }
        <TouchableOpacity
          style={[styles.btnPrimario, (!selecId || enviando) && { opacity: 0.5 }]}
          onPress={enviar} disabled={!selecId || enviando}
        >
          {enviando
            ? <ActivityIndicator color={cartasBosque.bruma} />
            : <Text style={styles.btnPrimarioText}>Enviar solicitud</Text>
          }
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnSecundario} onPress={onClose}>
          <Text style={styles.btnSecundarioText}>Cancelar</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ─── Badge de estado ──────────────────────────────────────────

function BadgeEstado({ estado, compact = false }: { estado: string; compact?: boolean }) {
  const color = colorEstado(estado);
  return (
    <View style={[
      styles.badge,
      { backgroundColor: color + '26' },
      !compact && { borderWidth: 1, borderColor: color },
    ]}>
      <Text style={[styles.badgeText, { color }]}>{estado.toUpperCase()}</Text>
    </View>
  );
}

// ─── Pantalla principal ───────────────────────────────────────

type Tab = 'hoy' | 'semana' | 'mes';

export default function LimpiezaTenantScreen() {
  const { user } = useAuth();
  const [turnos, setTurnos]           = useState<TurnoLimpieza[]>([]);
  const [cargando, setCargando]       = useState(true);
  const [tab, setTab]                 = useState<Tab>('hoy');
  const [turnoHora, setTurnoHora]     = useState<TurnoLimpieza | null>(null);
  const [turnoPermuta, setTurnoPermuta] = useState<TurnoLimpieza | null>(null);
  const [mesCalendario, setMesCalendario] = useState(() => {
    const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d;
  });
  const [diaModal, setDiaModal] = useState<Date | null>(null);
  const reportadosRef = useRef<Set<string>>(new Set());

  // ── Firebase listener ──────────────────────────────────────
  useEffect(() => {
    if (!user?.uid) return;
    return listenMisTurnos(user.uid, data => {
      setTurnos(data);
      setCargando(false);
    });
  }, [user?.uid]);

  // ── Reportar turnos ignorados ──────────────────────────────
  useEffect(() => {
    if (turnos.length === 0) return;
    const ignoradas = turnos.filter(t => calcEstadoTurno(t) === 'ignorada');
    for (const turno of ignoradas) {
      if (reportadosRef.current.has(turno.id)) continue;
      (async () => {
        try {
          const snap = await getDocs(
            query(collection(db, 'reportes_limpieza'), where('turnoId', '==', turno.id))
          );
          if (!snap.empty) { reportadosRef.current.add(turno.id); return; }
          await addDoc(collection(db, 'reportes_limpieza'), {
            turnoId:         turno.id,
            inquilinoId:     turno.inquilinoId,
            area:            turno.area,
            fechaProgramada: turno.fechaProgramada,
            estado:          'ignorada',
            reportadoEn:     Timestamp.now(),
            visto:           false,
          });
          reportadosRef.current.add(turno.id);
        } catch { /* silencioso */ }
      })();
    }
  }, [turnos]);

  // ── Acciones de foto ───────────────────────────────────────
  async function handleFoto(turno: TurnoLimpieza) {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a tus fotos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: false,
    });
    if (result.canceled) return;
    try {
      await subirFotoTurno(turno.id, result.assets[0].uri);
      Alert.alert('¡Listo!', 'Turno acreditado correctamente.');
    } catch {
      Alert.alert('Error', 'No se pudo registrar la foto.');
    }
  }

  const handlePrivacidad = useCallback(async (turno: TurnoLimpieza) => {
    try { await togglePrivacidad(turno.id, !turno.privacidad); }
    catch { Alert.alert('Error', 'No se pudo cambiar la privacidad.'); }
  }, []);

  // ── Datos por pestaña ──────────────────────────────────────
  const hoy = new Date();

  const turnosHoy = turnos.filter(t => mismaFecha(t.fechaProgramada.toDate(), hoy));

  const lunesSemana = inicioSemana();
  const turnosSemana = turnos.filter(t => {
    const f = t.fechaProgramada.toDate();
    const fin = new Date(lunesSemana); fin.setDate(lunesSemana.getDate() + 6); fin.setHours(23, 59, 59, 999);
    return f >= lunesSemana && f <= fin;
  });

  const gruposSemana = (() => {
    const dias: { fecha: Date; label: string; items: TurnoLimpieza[] }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(lunesSemana); d.setDate(lunesSemana.getDate() + i);
      const items = turnosSemana.filter(t => mismaFecha(t.fechaProgramada.toDate(), d));
      if (items.length > 0) {
        const dia = DIAS_SEMANA_CORTOS[(d.getDay())];
        const num = d.getDate();
        dias.push({ fecha: d, label: `${dia} ${num}`, items });
      }
    }
    return dias;
  })();

  // ── Calendario de mes ──────────────────────────────────────
  const anioMes = mesCalendario.getFullYear();
  const mesMes  = mesCalendario.getMonth();
  const diasEnMes = new Date(anioMes, mesMes + 1, 0).getDate();
  const primerDiaSemana = new Date(anioMes, mesMes, 1).getDay(); // 0=Dom

  const celdas: (number | null)[] = [
    ...Array(primerDiaSemana).fill(null),
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
    ? turnos.filter(t => mismaFecha(t.fechaProgramada.toDate(), diaModal))
    : [];

  // ─── Render ───────────────────────────────────────────────

  const TABS: { key: Tab; label: string }[] = [
    { key: 'hoy',    label: 'HOY'    },
    { key: 'semana', label: 'SEMANA' },
    { key: 'mes',    label: 'MES'    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: cartasBosque.bruma }}>

      {/* ── Tab bar ─────────────────────────────────────────── */}
      <View style={styles.tabBar}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tabBtn, tab === t.key && styles.tabBtnActivo]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActivo]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {cargando ? (
        <ActivityIndicator color={cartasBosque.bosque} style={{ marginTop: spacing[8] }} />
      ) : (
        <>
          {/* ── HOY ─────────────────────────────────────────── */}
          {tab === 'hoy' && (
            <ScrollView contentContainerStyle={styles.scrollContent}>
              {turnosHoy.length === 0 ? (
                <View style={styles.emptyContain}>
                  <Ionicons name="brush-outline" size={32} color={cartasBosque.niebla} />
                  <Text style={styles.emptyText}>Sin tareas para hoy</Text>
                </View>
              ) : turnosHoy.map(turno => {
                const estado = calcEstadoTurno(turno);
                const color  = colorEstado(estado);
                const fecha  = turno.fechaProgramada.toDate();
                const vencePronto = estado === 'pendiente'
                  && (fecha.getTime() - Date.now()) < 60 * 60 * 1000;
                return (
                  <View key={turno.id} style={styles.card}>
                    <Text style={styles.cardArea}>{AREA_LABELS[turno.area]}</Text>
                    <View style={styles.cardRow}>
                      <Text style={styles.cardHora}>{turno.horaInicio}</Text>
                      <BadgeEstado estado={estado} />
                    </View>
                    {vencePronto && (
                      <Text style={styles.vencePronto}>⏱ Vence pronto</Text>
                    )}
                    {estado === 'pendiente' && (
                      <TouchableOpacity
                        style={[styles.btnPrimario, { height: 36, marginTop: spacing[3], marginBottom: 0 }]}
                        onPress={() => handleFoto(turno)}
                      >
                        <Text style={[styles.btnPrimarioText, { fontSize: 13 }]}>
                          Registrar limpieza
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          )}

          {/* ── SEMANA ──────────────────────────────────────── */}
          {tab === 'semana' && (
            <ScrollView contentContainerStyle={styles.scrollContent}>
              {gruposSemana.length === 0 ? (
                <View style={styles.emptyContain}>
                  <Ionicons name="brush-outline" size={32} color={cartasBosque.niebla} />
                  <Text style={styles.emptyText}>Sin tareas para hoy</Text>
                </View>
              ) : gruposSemana.map((grupo, idx) => (
                <View key={grupo.label}>
                  {idx > 0 && <View style={styles.separador} />}
                  <Text style={styles.diaHeader}>{grupo.label}</Text>
                  {grupo.items.map(turno => {
                    const estado = calcEstadoTurno(turno);
                    const color  = colorEstado(estado);
                    return (
                      <View key={turno.id} style={styles.semanaFila}>
                        <View style={[styles.dot, { backgroundColor: color }]} />
                        <Text style={styles.semanaArea} numberOfLines={1}>
                          {AREA_LABELS[turno.area]}
                        </Text>
                        <BadgeEstado estado={estado} compact />
                      </View>
                    );
                  })}
                </View>
              ))}
            </ScrollView>
          )}

          {/* ── MES ─────────────────────────────────────────── */}
          {tab === 'mes' && (
            <ScrollView contentContainerStyle={styles.scrollContent}>
              {/* Navegación de mes */}
              <View style={styles.calNav}>
                <TouchableOpacity
                  onPress={() => setMesCalendario(d => {
                    const n = new Date(d); n.setMonth(n.getMonth() - 1); return n;
                  })}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="chevron-back" size={18} color={cartasBosque.tinta} />
                </TouchableOpacity>
                <Text style={styles.calNavTitulo}>
                  {MESES_ES[mesMes].toUpperCase()} {anioMes}
                </Text>
                <TouchableOpacity
                  onPress={() => setMesCalendario(d => {
                    const n = new Date(d); n.setMonth(n.getMonth() + 1); return n;
                  })}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="chevron-forward" size={18} color={cartasBosque.tinta} />
                </TouchableOpacity>
              </View>

              {/* Encabezados de día */}
              <View style={styles.calGridRow}>
                {DIAS_SEMANA_CORTOS.map(d => (
                  <Text key={d} style={styles.calDiaNombre}>{d}</Text>
                ))}
              </View>

              {/* Celdas */}
              <View style={styles.calGrid}>
                {celdas.map((dia, idx) => {
                  if (dia === null) return <View key={`b-${idx}`} style={styles.calCelda} />;
                  const fechaCelda = new Date(anioMes, mesMes, dia);
                  const esHoy = mismaFecha(fechaCelda, new Date());
                  const tdDia = turnosDia(dia);
                  const primerEstado = tdDia.length > 0 ? calcEstadoTurno(tdDia[0]) : null;
                  return (
                    <TouchableOpacity
                      key={dia}
                      style={styles.calCelda}
                      onPress={() => setDiaModal(fechaCelda)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.calNumWrap, esHoy && styles.calNumHoy]}>
                        <Text style={[styles.calNum, esHoy && styles.calNumHoyText]}>
                          {dia}
                        </Text>
                      </View>
                      {primerEstado && (
                        <View style={[styles.calDot, { backgroundColor: colorEstado(primerEstado) }]} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          )}
        </>
      )}

      {/* ── Modal detalle de día ─────────────────────────────── */}
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
                {DIAS_NOMBRE[diaModal.getDay()]} {diaModal.getDate()} de {MESES_LARGO[diaModal.getMonth()]}
              </Text>
              {turnosDiaModal.length === 0 ? (
                <Text style={[styles.sheetSub, { marginTop: spacing[2] }]}>
                  {diaModal > new Date()
                    ? 'Sin tareas registradas para este día'
                    : 'Sin tareas registradas para este día'}
                </Text>
              ) : (
                <ScrollView style={{ maxHeight: 320 }} nestedScrollEnabled>
                  {turnosDiaModal.map(turno => {
                    const estado = calcEstadoTurno(turno);
                    const esBanoCocina = turno.tipo === 'bano' || turno.tipo === 'cocina';
                    return (
                      <View key={turno.id} style={styles.modalTurnoRow}>
                        <View style={styles.modalTurnoInfo}>
                          <Text style={styles.modalTurnoArea}>{AREA_LABELS[turno.area]}</Text>
                          <Text style={styles.modalTurnoHora}>{turno.horaInicio}</Text>
                        </View>
                        <BadgeEstado estado={estado} />
                        {esBanoCocina && estado === 'pendiente' && (
                          <TouchableOpacity
                            style={[styles.btnPrimario, { height: 36, marginTop: spacing[2], marginBottom: 0 }]}
                            onPress={() => { setDiaModal(null); handleFoto(turno); }}
                          >
                            <Text style={[styles.btnPrimarioText, { fontSize: 13 }]}>
                              Registrarme para este turno
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}
                </ScrollView>
              )}
              <TouchableOpacity
                style={[styles.btnSecundario, { marginTop: spacing[4] }]}
                onPress={() => setDiaModal(null)}
              >
                <Text style={styles.btnSecundarioText}>Cerrar</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </Modal>

      {/* ── Modal hora / permuta ─────────────────────────────── */}
      <ModalHora
        turno={turnoHora}
        visible={turnoHora !== null}
        onClose={() => setTurnoHora(null)}
        onGuardar={h => actualizarHora(turnoHora!.id, h)}
      />
      <ModalPermuta
        turno={turnoPermuta}
        visible={turnoPermuta !== null}
        onClose={() => setTurnoPermuta(null)}
      />
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Tab bar
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro,
    backgroundColor: cartasBosque.bruma,
  },
  tabBtn: {
    flex: 1, paddingVertical: spacing[2] + 2, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabBtnActivo:  { borderBottomColor: cartasBosque.bosque },
  tabText:       { fontFamily: 'MonaSans_400Regular', fontSize: 11, color: cartasBosque.helecho },
  tabTextActivo: { color: cartasBosque.bosque },

  scrollContent: { padding: spacing[4], paddingBottom: spacing[10] },

  // Empty state
  emptyContain: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[2], paddingTop: spacing[20] },
  emptyText:    { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 14, color: cartasBosque.helecho },

  // Card HOY
  card: {
    backgroundColor: cartasBosque.pergamino,
    borderRadius: borderRadius.lg,
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    padding: spacing[4], marginBottom: spacing[3],
  },
  cardArea: {
    fontFamily: 'MonaSans_400Regular', fontSize: 9,
    color: cartasBosque.helecho, textTransform: 'uppercase', letterSpacing: 1,
    marginBottom: spacing[1],
  },
  cardRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardHora: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 15, color: cartasBosque.tinta },
  vencePronto: {
    fontFamily: 'BricolageGrotesque_400Regular', fontSize: 11, color: '#8A6A72',
    marginTop: spacing[1],
  },

  // Badge
  badge: {
    paddingHorizontal: spacing[2], paddingVertical: 2,
    borderRadius: borderRadius.sm, alignSelf: 'flex-start',
  },
  badgeText: { fontFamily: 'MonaSans_400Regular', fontSize: 9, textTransform: 'uppercase' },

  // Semana
  diaHeader: {
    fontFamily: 'MonaSans_400Regular', fontSize: 10, color: cartasBosque.helecho,
    marginBottom: spacing[2], marginTop: spacing[1],
  },
  separador: {
    height: 1, backgroundColor: cartasBosque.pergaminoOscuro,
    marginVertical: spacing[3],
  },
  semanaFila: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingVertical: spacing[1] + 2,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  semanaArea: {
    fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: cartasBosque.tinta, flex: 1,
  },

  // Calendario
  calNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: spacing[4],
  },
  calNavTitulo: {
    fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 15, color: cartasBosque.tinta,
  },
  calGridRow: {
    flexDirection: 'row', marginBottom: spacing[2],
  },
  calDiaNombre: {
    flex: 1, textAlign: 'center',
    fontFamily: 'MonaSans_400Regular', fontSize: 9, color: cartasBosque.helecho,
  },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCelda: {
    width: `${100 / 7}%`, alignItems: 'center', paddingVertical: spacing[1],
    minHeight: 44,
  },
  calNumWrap: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  calNumHoy: { backgroundColor: cartasBosque.bosque },
  calNum:       { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: cartasBosque.tinta },
  calNumHoyText:{ color: cartasBosque.bruma },
  calDot: { width: 5, height: 5, borderRadius: 3, marginTop: 2 },

  // Modal día
  modalTurnoRow: {
    paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro,
  },
  modalTurnoInfo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[1] },
  modalTurnoArea: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: cartasBosque.tinta },
  modalTurnoHora: { fontFamily: 'MonaSans_400Regular', fontSize: 11, color: cartasBosque.helecho },

  // Modales compartidos
  overlay: { flex: 1, backgroundColor: 'rgba(18,42,31,0.35)' },
  sheet: {
    backgroundColor: cartasBosque.bruma,
    borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl,
    padding: spacing[5], paddingBottom: spacing[8],
  },
  sheetTitulo: {
    fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 18, color: cartasBosque.tinta,
    marginBottom: spacing[1],
  },
  sheetSub: {
    fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: cartasBosque.helecho,
    marginBottom: spacing[3],
  },
  sheetLabel: {
    fontFamily: 'MonaSans_400Regular', fontSize: 10, color: cartasBosque.helecho,
    letterSpacing: 0.5, marginBottom: spacing[1], marginTop: spacing[2],
  },
  horaItem: {
    paddingVertical: spacing[2] + 1, paddingHorizontal: spacing[3],
    borderRadius: borderRadius.sm, marginBottom: 2,
  },
  horaItemSel: { backgroundColor: cartasBosque.bosque },
  horaText:    { fontFamily: 'MonaSans_400Regular', fontSize: 13, color: cartasBosque.tinta },
  horaTextSel: { color: cartasBosque.bruma },
  btnPrimario: {
    backgroundColor: cartasBosque.bosque, borderRadius: borderRadius.sm,
    paddingVertical: spacing[3], alignItems: 'center', marginTop: spacing[3], marginBottom: spacing[2],
  },
  btnPrimarioText:  { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 14, color: cartasBosque.bruma },
  btnSecundario:    { paddingVertical: spacing[2], alignItems: 'center' },
  btnSecundarioText:{ fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: cartasBosque.helecho },
});
