import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { onSnapshot, doc } from 'firebase/firestore';
import { db } from '@/services/firebase/firestore';
import { cartasBosque } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/spacing';
import { useAuth } from '@/hooks/useAuth';
import { listenMisPagos, registrarComprobante } from '@/services/firebase/pagos';
import { listenMisVisitas, registrarSalida } from '@/services/firebase/visitas';
import { listenMisReservas, CARGAS_INCLUIDAS_MES } from '@/services/firebase/lavanderia';
import { listenEspacios } from '@/services/firebase/almacenamiento';
import { listenMisTickets, CATEGORIA_LABELS } from '@/services/firebase/tickets';
import type {
  Inquilino, Pago, Visita, ReservaLavanderia,
  EspacioAlmacenamiento, Ticket,
} from '@/types/firestore';

// ─── Nav type ─────────────────────────────────────────────────

type TenantTabList = { Dossier: undefined; Noticias: undefined; Home: undefined; Servicios: undefined; Soporte: undefined };
type NavProp = BottomTabNavigationProp<TenantTabList, 'Home'>;

// ─── Estado pago ──────────────────────────────────────────────

type EstadoPago = 'cargando' | 'sin_pago' | 'vence_hoy' | 'al_corriente' | 'adeudo';

function calcEstado(pagos: Pago[]): {
  estado: EstadoPago; pagoActual: Pago | null;
  diasVencido: number; proxPago: Pago | null;
} {
  const arrendos = pagos.filter(p => p.concepto === 'arriendo');
  if (arrendos.length === 0) return { estado: 'sin_pago', pagoActual: null, diasVencido: 0, proxPago: null };

  const ahora = Date.now();

  // Pago pendiente más próximo a vencer
  const pendientes = arrendos.filter(p =>
    p.estado === 'pendiente' || p.estado === 'rechazado' || p.estado === 'vencido',
  ).sort((a, b) => a.fechaVencimiento.toMillis() - b.fechaVencimiento.toMillis());

  const pagActual = pendientes[0] ?? null;

  if (pagActual) {
    const dias = Math.floor((ahora - pagActual.fechaVencimiento.toMillis()) / 86_400_000);
    if (dias >= 4) return { estado: 'adeudo', pagoActual: pagActual, diasVencido: dias, proxPago: null };
    return { estado: 'vence_hoy', pagoActual: pagActual, diasVencido: Math.max(0, dias), proxPago: null };
  }

  // Al corriente — próximo pago pendiente (futuro)
  const proxPago = arrendos.find(p => p.estado === 'pendiente' && p.fechaVencimiento.toMillis() > ahora) ?? null;
  return { estado: 'al_corriente', pagoActual: null, diasVencido: 0, proxPago };
}

// ─── Helpers ──────────────────────────────────────────────────

const MESES_CORTO = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

function fmtFecha(ts: import('firebase/firestore').Timestamp | null): string {
  if (!ts) return '—';
  const d = ts.toDate();
  return `${d.getDate()} ${MESES_CORTO[d.getMonth()]}`;
}

function fmtMoneda(n: number): string {
  return `$${n.toLocaleString('es-MX')}`;
}

function tiempoDesde(ts: import('firebase/firestore').Timestamp | null): string {
  if (!ts) return '—';
  try {
    const diff = Date.now() - ts.toDate().getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `hace ${mins} min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `hace ${hrs} h`;
    return `hace ${Math.floor(hrs / 24)} días`;
  } catch { return '—'; }
}

// ─── Pantalla ─────────────────────────────────────────────────

export default function HomeScreen() {
  const { user }     = useAuth();
  const navigation   = useNavigation<NavProp>();
  const uid          = user?.uid ?? '';

  const [inquilino, setInquilino]  = useState<Inquilino | null>(null);
  const [pagos,     setPagos]      = useState<Pago[]>([]);
  const [visitas,   setVisitas]    = useState<Visita[]>([]);
  const [reservas,  setReservas]   = useState<ReservaLavanderia[]>([]);
  const [espacios,  setEspacios]   = useState<EspacioAlmacenamiento[]>([]);
  const [tickets,   setTickets]    = useState<Ticket[]>([]);
  const [cargando,  setCargando]   = useState(true);
  const [enviando,  setEnviando]   = useState(false);

  useEffect(() => {
    if (!uid) return;
    const u1 = onSnapshot(doc(db, 'inquilinos', uid), snap => {
      if (snap.exists()) setInquilino({ ...snap.data(), id: snap.id } as Inquilino);
    });
    const u2 = listenMisPagos(uid, data => { setPagos(data); setCargando(false); });
    const u3 = listenMisVisitas(uid, setVisitas);
    const u4 = listenMisReservas(uid, setReservas);
    const u5 = listenEspacios(setEspacios);
    const u6 = listenMisTickets(uid, setTickets);
    return () => { u1(); u2(); u3(); u4(); u5(); u6(); };
  }, [uid]);

  const { estado, pagoActual, diasVencido, proxPago } = calcEstado(pagos);

  const nombre = inquilino?.nombre ?? user?.email?.split('@')[0] ?? '—';
  const hab    = inquilino?.habitacionId?.replace('hab_', '') ?? '—';

  // Cargas lavandería disponibles este mes
  const cargasEste = useMemo(() => {
    const now = new Date();
    return reservas.filter(r => {
      const d = r.fechaReserva.toDate();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
        && ['pendiente','confirmada','pendiente_auth','completada'].includes(r.estado);
    }).length;
  }, [reservas]);
  const cargasDisp = Math.max(0, CARGAS_INCLUIDAS_MES - cargasEste);

  // Mi espacio de almacenamiento
  const miEspacio = espacios.find(e => e.inquilinoId === uid && e.estado === 'ocupado');

  // Tickets abiertos
  const ticketsAbiertos = tickets.filter(t => t.estado !== 'resuelto').length;

  // Visitas activas
  const visitasActivas = visitas.filter(v => !v.fechaSalida);

  // Actividad reciente
  const actividad = useMemo(() => {
    const items: Array<{ id: string; icon: React.ComponentProps<typeof Ionicons>['name']; color: string; texto: string; ts: number }> = [];

    pagos.slice(0, 5).forEach(p => {
      const ts = p.actualizadoEn?.toMillis?.() ?? p.creadoEn?.toMillis?.() ?? 0;
      if (p.estado === 'pagado')       items.push({ id: `p-${p.id}`, icon: 'checkmark-circle', color: '#3A7D44', texto: `Pago verificado · ${fmtMoneda(p.monto)}`, ts });
      else if (p.estado === 'en_revision') items.push({ id: `p-${p.id}`, icon: 'time-outline', color: '#C05A00', texto: 'Comprobante en revisión', ts });
      else if (p.estado === 'vencido') items.push({ id: `p-${p.id}`, icon: 'alert-circle-outline', color: '#A63228', texto: 'Pago vencido', ts });
    });

    visitas.slice(0, 4).forEach(v => {
      const nombre = v.nombreVisitante ?? v.documentoNumero;
      if (!v.fechaSalida) {
        items.push({ id: `v-${v.id}`, icon: 'person-outline', color: '#2A5EB0', texto: `Visita activa · ${nombre}`, ts: v.fechaEntrada?.toMillis?.() ?? 0 });
      } else {
        items.push({ id: `v-${v.id}`, icon: 'person-remove-outline', color: cartasBosque.helecho, texto: `Visita finalizada · ${nombre}`, ts: v.fechaSalida?.toMillis?.() ?? 0 });
      }
    });

    tickets.slice(0, 4).forEach(t => {
      const ts = t.creadoEn?.toMillis?.() ?? 0;
      const cat = CATEGORIA_LABELS[t.categoria];
      if (t.estado === 'resuelto') items.push({ id: `t-${t.id}`, icon: 'checkmark-done-outline', color: '#3A7D44', texto: `Ticket resuelto · ${cat}`, ts });
      else items.push({ id: `t-${t.id}`, icon: 'headset-outline', color: '#C05A00', texto: `Reporte enviado · ${cat}`, ts });
    });

    return items.sort((a, b) => b.ts - a.ts).slice(0, 8);
  }, [pagos, visitas, tickets]);

  // ── Acción: adjuntar comprobante ────────────────────────────
  async function adjuntarComprobante(pagoId: string) {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a tus fotos.');
      return;
    }
    Alert.alert('Comprobante de pago', '', [
      {
        text: 'Cámara', onPress: async () => {
          const r = await ImagePicker.launchCameraAsync({ quality: 0.8 });
          if (!r.canceled) await subirComprobante(pagoId, r.assets[0].uri);
        },
      },
      {
        text: 'Galería', onPress: async () => {
          const r = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
          if (!r.canceled) await subirComprobante(pagoId, r.assets[0].uri);
        },
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  async function subirComprobante(pagoId: string, uri: string) {
    setEnviando(true);
    try {
      await registrarComprobante(pagoId, uri);
      Alert.alert('Enviado', 'Tu comprobante está en revisión. Te notificaremos pronto.');
    } catch {
      Alert.alert('Error', 'No se pudo enviar el comprobante. Intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  function confirmarDejarCorrer() {
    Alert.alert(
      'Dejar correr depósito',
      'Confirmas que dejarás correr tu depósito y entregarás la habitación al finalizar este periodo.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar', style: 'destructive',
          onPress: () => Alert.alert('Registrado', 'Administración ha sido notificada.'),
        },
      ],
    );
  }

  if (cargando) {
    return (
      <View style={s.loadingRoot}>
        <ActivityIndicator color={cartasBosque.bosque} />
      </View>
    );
  }

  return (
    <View style={s.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* ═══════════════════════════════════════════════════
            HEADER OSCURO — varía por estado
        ═══════════════════════════════════════════════════ */}
        <View style={s.header}>
          <SafeAreaView edges={['top']}>
            <Text style={s.headerHola}>Hola, {nombre}</Text>
            <Text style={s.headerHab}>HABITACIÓN {hab}</Text>

            {/* ── Estado 1: VENCE HOY ── */}
            {estado === 'vence_hoy' && pagoActual && (
              <>
                <View style={s.headerMontoRow}>
                  <Text style={s.headerRentaLabel}>RENTA</Text>
                  <Text style={s.headerMonto}>{fmtMoneda(pagoActual.monto)}</Text>
                </View>
                <View style={s.headerEstadoRow}>
                  <Text style={s.headerVenceNaranja}>
                    {diasVencido === 0 ? 'VENCE hoy' : `VENCIÓ HACE ${diasVencido} día${diasVencido > 1 ? 's' : ''}`}
                  </Text>
                  <View style={s.badgePendiente}>
                    <Text style={s.badgePendienteText}>Pendiente</Text>
                  </View>
                </View>
                <View style={[s.alerta, { borderColor: '#F5C6C2', backgroundColor: '#FEF0EF' }]}>
                  <Ionicons name="alert-circle-outline" size={16} color="#A63228" />
                  <Text style={s.alertaText}>
                    Hoy es tu día de pago · Registra antes de que termine el día para evitar mora.
                  </Text>
                </View>
                <TouchableOpacity
                  style={[s.btnPrincipal, enviando && { opacity: 0.5 }]}
                  onPress={() => adjuntarComprobante(pagoActual.id)}
                  disabled={enviando}
                  activeOpacity={0.85}
                >
                  {enviando
                    ? <ActivityIndicator color={cartasBosque.bruma} />
                    : <Text style={s.btnPrincipalText}>Reportar pago</Text>
                  }
                </TouchableOpacity>
              </>
            )}

            {/* ── Estado 2: AL CORRIENTE ── */}
            {estado === 'al_corriente' && (
              <>
                <Text style={s.headerRentaLabel}>PRÓXIMO PAGO</Text>
                {proxPago && (
                  <Text style={s.headerFechaProx}>{fmtFecha(proxPago.fechaVencimiento)}</Text>
                )}
                <View style={s.headerMontoRow}>
                  <Text style={s.headerMonto}>
                    {proxPago ? fmtMoneda(proxPago.monto) : '—'}
                  </Text>
                </View>
                <View style={s.headerEstadoRow}>
                  <View style={s.badgeAlCorriente}>
                    <Ionicons name="checkmark-circle" size={12} color="#3A7D44" />
                    <Text style={s.badgeAlCorrienteText}>Al corriente</Text>
                  </View>
                </View>
              </>
            )}

            {/* ── Estado 3: ADEUDO ── */}
            {estado === 'adeudo' && pagoActual && (
              <>
                <View style={s.headerMontoRow}>
                  <Text style={s.headerRentaLabel}>RENTA</Text>
                  <Text style={s.headerMonto}>{fmtMoneda(pagoActual.monto)}</Text>
                </View>
                <View style={s.headerEstadoRow}>
                  <Text style={[s.headerVenceNaranja, { color: '#F5C6C2' }]}>
                    VENCIÓ HACE {diasVencido} día{diasVencido > 1 ? 's' : ''}
                  </Text>
                  <View style={s.badgeAdeudo}>
                    <Text style={s.badgeAdeudoText}>Adeudo</Text>
                  </View>
                </View>
                <View style={[s.alerta, { borderColor: '#F5C6C2', backgroundColor: '#FEF0EF' }]}>
                  <Ionicons name="alert-circle-outline" size={16} color="#A63228" />
                  <Text style={s.alertaText}>
                    Han pasado {diasVencido} días sin registrar pago · Por favor selecciona una de las dos opciones para continuar.
                  </Text>
                </View>
                <TouchableOpacity
                  style={[s.btnPrincipal, enviando && { opacity: 0.5 }]}
                  onPress={() => adjuntarComprobante(pagoActual.id)}
                  disabled={enviando}
                  activeOpacity={0.85}
                >
                  {enviando
                    ? <ActivityIndicator color={cartasBosque.bruma} />
                    : <Text style={s.btnPrincipalText}>Pago realizado · adjuntar comprobante</Text>
                  }
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.btnDeposito}
                  onPress={confirmarDejarCorrer}
                  activeOpacity={0.8}
                >
                  <Text style={s.btnDepositoText}>Dejar correr mi depósito · entrego la habitación al finalizar este periodo</Text>
                </TouchableOpacity>
              </>
            )}

            {/* Estado: sin pago cargado */}
            {estado === 'sin_pago' && (
              <Text style={s.headerRentaLabel}>Sin pagos registrados aún</Text>
            )}
          </SafeAreaView>
        </View>

        {/* ═══════════════════════════════════════════════════
            GRID 2x2 ACCESOS RÁPIDOS
        ═══════════════════════════════════════════════════ */}
        <View style={s.gridWrap}>
          {/* Lavandería */}
          <TouchableOpacity style={s.gridCard} onPress={() => navigation.navigate('Servicios')} activeOpacity={0.78}>
            <View style={[s.gridIcon, { backgroundColor: '#EEE5F8' }]}>
              <Ionicons name="shirt-outline" size={22} color="#7B52AB" />
            </View>
            <Text style={s.gridTitulo}>Lavandería</Text>
            <Text style={s.gridSub}>{cargasDisp} carga{cargasDisp !== 1 ? 's' : ''} disponible{cargasDisp !== 1 ? 's' : ''}</Text>
          </TouchableOpacity>

          {/* Almacén */}
          <TouchableOpacity style={s.gridCard} onPress={() => navigation.navigate('Servicios')} activeOpacity={0.78}>
            <View style={[s.gridIcon, { backgroundColor: '#FFF0E0' }]}>
              <Ionicons name="archive-outline" size={22} color="#C05A00" />
            </View>
            <Text style={s.gridTitulo}>Almacén</Text>
            <Text style={s.gridSub}>
              {miEspacio ? `${miEspacio.tipo === 'locker' ? 'Casillero' : 'Refrigerador'} #${miEspacio.numero}` : 'Sin espacio asignado'}
            </Text>
          </TouchableOpacity>

          {/* Dossier */}
          <TouchableOpacity style={s.gridCard} onPress={() => navigation.navigate('Dossier')} activeOpacity={0.78}>
            <View style={[s.gridIcon, { backgroundColor: '#D6EDD9' }]}>
              <Ionicons name="id-card-outline" size={22} color="#3A7D44" />
            </View>
            <Text style={s.gridTitulo}>Dossier</Text>
            <Text style={s.gridSub}>Mi expediente</Text>
          </TouchableOpacity>

          {/* Soporte */}
          <TouchableOpacity style={s.gridCard} onPress={() => navigation.navigate('Soporte')} activeOpacity={0.78}>
            <View style={[s.gridIcon, { backgroundColor: '#D6E8F5' }]}>
              <Ionicons name="headset-outline" size={22} color="#2A5EB0" />
            </View>
            <Text style={s.gridTitulo}>Soporte</Text>
            <Text style={s.gridSub}>
              {ticketsAbiertos > 0 ? `${ticketsAbiertos} ticket${ticketsAbiertos > 1 ? 's' : ''} abierto${ticketsAbiertos > 1 ? 's' : ''}` : 'Sin tickets abiertos'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ═══════════════════════════════════════════════════
            REGISTRAR VISITA (solo Estado 2 - al corriente)
        ═══════════════════════════════════════════════════ */}
        {estado === 'al_corriente' && (
          <View style={s.seccion}>
            <Text style={s.seccionLabel}>REGISTRAR VISITA</Text>

            {visitasActivas.length > 0 && visitasActivas.map(v => (
              <View key={v.id} style={s.visitaCard}>
                <View style={s.visitaIcon}>
                  <Ionicons name="person" size={16} color={cartasBosque.bosque} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.visitaNombre}>{v.nombreVisitante ?? v.documentoNumero}</Text>
                  <Text style={s.visitaMeta}>Desde {tiempoDesde(v.fechaEntrada)}</Text>
                </View>
                <TouchableOpacity
                  style={s.btnSalida}
                  onPress={() => Alert.alert('Registrar salida', `¿Registrar salida de ${v.nombreVisitante ?? 'la visita'}?`, [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Confirmar', onPress: () => registrarSalida(v.id).catch(() => Alert.alert('Error', 'No se pudo registrar.')) },
                  ])}
                >
                  <Text style={s.btnSalidaText}>Registrar salida</Text>
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity
              style={s.btnNuevaVisita}
              onPress={() => navigation.navigate('Servicios')}
              activeOpacity={0.78}
            >
              <Ionicons name="add-circle-outline" size={16} color={cartasBosque.bosque} />
              <Text style={s.btnNuevaVisitaText}>+ Registrar nueva visita</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ═══════════════════════════════════════════════════
            ACTIVIDAD RECIENTE
        ═══════════════════════════════════════════════════ */}
        <View style={s.seccion}>
          <Text style={s.seccionLabel}>ACTIVIDAD RECIENTE</Text>
          {actividad.length === 0 ? (
            <View style={s.actividadVacioCard}>
              <Text style={s.actividadVacioText}>Sin actividad reciente</Text>
            </View>
          ) : (
            <View style={s.actividadCard}>
              {actividad.map((a, i) => (
                <View key={a.id}>
                  {i > 0 && <View style={s.actividadDivider} />}
                  <View style={s.actividadRow}>
                    <View style={[s.actividadDot, { backgroundColor: a.color }]}>
                      <Ionicons name={a.icon} size={12} color={cartasBosque.bruma} />
                    </View>
                    <Text style={s.actividadTexto} numberOfLines={1}>{a.texto}</Text>
                    <Text style={s.actividadFecha}>
                      {a.ts > 0 ? new Date(a.ts).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }) : '—'}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={{ height: spacing[10] }} />
      </ScrollView>
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: cartasBosque.bruma },
  loadingRoot: { flex: 1, backgroundColor: cartasBosque.bruma, alignItems: 'center', justifyContent: 'center' },
  scroll:      { flexGrow: 1 },

  // ── HEADER ──
  header: {
    backgroundColor: cartasBosque.tinta,
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[5],
  },
  headerHola: {
    fontFamily: 'DMSans_700Bold', fontSize: 26, color: cartasBosque.bruma,
    marginTop: spacing[4], letterSpacing: -0.3,
  },
  headerHab: {
    fontFamily: 'DMMono_400Regular', fontSize: 10, color: cartasBosque.niebla,
    letterSpacing: 1.5, marginTop: 2, marginBottom: spacing[3],
  },
  headerRentaLabel: {
    fontFamily: 'DMMono_400Regular', fontSize: 10, color: cartasBosque.niebla,
    letterSpacing: 1, marginBottom: 2,
  },
  headerMonto: {
    fontFamily: 'DMSans_700Bold', fontSize: 34, color: cartasBosque.bruma,
    letterSpacing: -0.5, lineHeight: 38,
  },
  headerFechaProx: {
    fontFamily: 'DMSans_400Regular', fontSize: 15, color: cartasBosque.niebla, marginBottom: 2,
  },
  headerMontoRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing[2] },
  headerEstadoRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    marginTop: spacing[2], marginBottom: spacing[3],
  },
  headerVenceNaranja: {
    fontFamily: 'DMMono_400Regular', fontSize: 11, color: '#F8A84B', letterSpacing: 0.4,
  },

  // Badges
  badgePendiente: {
    backgroundColor: '#F8A84B' + '33',
    borderWidth: 1, borderColor: '#F8A84B' + '88',
    paddingHorizontal: spacing[2], paddingVertical: 2, borderRadius: borderRadius.sm,
  },
  badgePendienteText: { fontFamily: 'DMMono_400Regular', fontSize: 9, color: '#F8A84B', letterSpacing: 0.3 },

  badgeAlCorriente: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#D6EDD9' + '33',
    borderWidth: 1, borderColor: '#3A7D44' + '66',
    paddingHorizontal: spacing[2], paddingVertical: 2, borderRadius: borderRadius.sm,
  },
  badgeAlCorrienteText: { fontFamily: 'DMMono_400Regular', fontSize: 9, color: '#D6EDD9', letterSpacing: 0.3 },

  badgeAdeudo: {
    backgroundColor: '#F5DAD8' + '33',
    borderWidth: 1, borderColor: '#F5DAD8' + '88',
    paddingHorizontal: spacing[2], paddingVertical: 2, borderRadius: borderRadius.sm,
  },
  badgeAdeudoText: { fontFamily: 'DMMono_400Regular', fontSize: 9, color: '#F5DAD8', letterSpacing: 0.3 },

  // Alerta rosa
  alerta: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2],
    borderRadius: borderRadius.md, borderWidth: 1,
    padding: spacing[3], marginBottom: spacing[3],
  },
  alertaText: {
    flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#A63228', lineHeight: 17,
  },

  // Botón principal oscuro
  btnPrincipal: {
    backgroundColor: cartasBosque.bosque,
    borderRadius: borderRadius.md, paddingVertical: spacing[4],
    alignItems: 'center', marginBottom: spacing[2],
  },
  btnPrincipalText: {
    fontFamily: 'DMSans_600SemiBold', fontSize: 15, color: cartasBosque.bruma, letterSpacing: 0.1,
  },

  // Botón dejar correr depósito (borde rosa)
  btnDeposito: {
    borderRadius: borderRadius.md, paddingVertical: spacing[4],
    alignItems: 'center',
    borderWidth: 1, borderColor: '#F5C6C2',
    backgroundColor: 'transparent',
    marginBottom: spacing[2],
  },
  btnDepositoText: {
    fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#F5C6C2',
    textAlign: 'center', lineHeight: 18,
  },

  // ── GRID 2x2 ──
  gridWrap: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: spacing[4], paddingTop: spacing[4], gap: spacing[3],
  },
  gridCard: {
    width: '47%',
    backgroundColor: cartasBosque.pergamino,
    borderRadius: borderRadius.lg, padding: spacing[4],
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
  },
  gridIcon: {
    width: 44, height: 44, borderRadius: borderRadius.md,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing[2],
  },
  gridTitulo: { fontFamily: 'DMSans_600SemiBold', fontSize: 14, color: cartasBosque.tinta, marginBottom: 2 },
  gridSub:    { fontFamily: 'DMMono_400Regular',  fontSize: 10, color: cartasBosque.helecho, lineHeight: 13 },

  // ── SECCIONES ──
  seccion: { paddingHorizontal: spacing[4], marginTop: spacing[5] },
  seccionLabel: {
    fontFamily: 'DMMono_400Regular', fontSize: 10, color: cartasBosque.helecho,
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: spacing[3],
  },

  // Visita card
  visitaCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    backgroundColor: cartasBosque.pergamino,
    borderRadius: borderRadius.md, padding: spacing[3],
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    marginBottom: spacing[2],
  },
  visitaIcon: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: cartasBosque.niebla + '44',
    alignItems: 'center', justifyContent: 'center',
  },
  visitaNombre: { fontFamily: 'DMSans_600SemiBold', fontSize: 13, color: cartasBosque.tinta },
  visitaMeta:   { fontFamily: 'DMMono_400Regular',  fontSize: 10, color: cartasBosque.helecho },
  btnSalida: {
    paddingHorizontal: spacing[2], paddingVertical: spacing[1] + 1,
    borderRadius: borderRadius.sm, borderWidth: 1,
    borderColor: cartasBosque.pergaminoOscuro,
    backgroundColor: cartasBosque.bruma,
  },
  btnSalidaText: { fontFamily: 'DMMono_400Regular', fontSize: 10, color: cartasBosque.tinta },

  btnNuevaVisita: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    justifyContent: 'center',
    backgroundColor: cartasBosque.pergamino,
    borderRadius: borderRadius.md, padding: spacing[3],
    borderWidth: 1, borderColor: cartasBosque.bosque + '55',
    borderStyle: 'dashed',
  },
  btnNuevaVisitaText: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: cartasBosque.bosque },

  // Actividad
  actividadCard: {
    backgroundColor: cartasBosque.pergamino,
    borderRadius: borderRadius.md, padding: spacing[1],
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
  },
  actividadVacioCard: {
    backgroundColor: cartasBosque.pergamino,
    borderRadius: borderRadius.md, padding: spacing[4],
    alignItems: 'center',
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    borderStyle: 'dashed',
  },
  actividadVacioText: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: cartasBosque.helecho },
  actividadRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    paddingHorizontal: spacing[3], paddingVertical: spacing[3],
  },
  actividadDivider: { height: 1, backgroundColor: cartasBosque.pergaminoOscuro, marginHorizontal: spacing[3] },
  actividadDot: {
    width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  actividadTexto: {
    flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 12, color: cartasBosque.tinta,
  },
  actividadFecha: {
    fontFamily: 'DMMono_400Regular', fontSize: 9, color: cartasBosque.niebla,
  },
});
