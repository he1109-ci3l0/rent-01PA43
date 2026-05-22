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
import {
  onSnapshot, doc, addDoc, collection, Timestamp,
} from 'firebase/firestore';
import { db } from '@/services/firebase/firestore';
import { cartasBosque } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/spacing';
import { useAuth } from '@/hooks/useAuth';
import { listenMisPagos, registrarComprobante, listenScore } from '@/services/firebase/pagos';
import { listenMisVisitas, registrarSalida, calcularHorasActiva } from '@/services/firebase/visitas';
import { listenMisReservas, CARGAS_INCLUIDAS_MES } from '@/services/firebase/lavanderia';
import { listenEspacios } from '@/services/firebase/almacenamiento';
import { listenMisTickets, CATEGORIA_LABELS } from '@/services/firebase/tickets';
import { listenExpediente, listenDocumentos } from '@/services/firebase/expedientes';
import type {
  Inquilino, Pago, Visita, ReservaLavanderia,
  EspacioAlmacenamiento, Ticket, Expediente, DocumentoExpediente, ScoreReputacion,
} from '@/types/firestore';

// ─── Nav type ─────────────────────────────────────────────────

type TenantTabList = {
  Dossier: undefined; Comunidad: undefined; Home: undefined;
  Servicios: undefined; Soporte: undefined;
};
type NavProp = BottomTabNavigationProp<TenantTabList, 'Home'>;

// ─── Estado pago (local) ──────────────────────────────────────

type LocalEstado = 'cargando' | 'sin_pago' | 'vence_hoy' | 'al_corriente' | 'adeudo';

function calcEstado(pagos: Pago[]): {
  estado: LocalEstado; pagoActual: Pago | null;
  diasVencido: number; proxPago: Pago | null;
} {
  const arrendos = pagos.filter(p => p.concepto === 'arriendo');
  if (arrendos.length === 0) return { estado: 'sin_pago', pagoActual: null, diasVencido: 0, proxPago: null };

  const ahora = Date.now();
  const pendientes = arrendos.filter(p =>
    p.estado === 'pendiente' || p.estado === 'rechazado' || p.estado === 'vencido',
  ).sort((a, b) => a.fechaVencimiento.toMillis() - b.fechaVencimiento.toMillis());

  const pagActual = pendientes[0] ?? null;

  if (pagActual) {
    const dias = Math.floor((ahora - pagActual.fechaVencimiento.toMillis()) / 86_400_000);
    if (dias >= 4) return { estado: 'adeudo', pagoActual: pagActual, diasVencido: dias, proxPago: null };
    return { estado: 'vence_hoy', pagoActual: pagActual, diasVencido: Math.max(0, dias), proxPago: null };
  }

  const proxPago = arrendos.find(p =>
    p.estado === 'pendiente' && p.fechaVencimiento.toMillis() > ahora,
  ) ?? null;
  return { estado: 'al_corriente', pagoActual: null, diasVencido: 0, proxPago };
}

// ─── Helpers ──────────────────────────────────────────────────

const MESES_CORTO = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const DIAS_CORTO  = ['dom','lun','mar','mié','jue','vie','sáb'];

function fmtFecha(ts: Timestamp | null): string {
  if (!ts) return '—';
  const d = ts.toDate();
  return `${d.getDate()} ${MESES_CORTO[d.getMonth()]}`;
}

function fmtDiaHora(ts: Timestamp): string {
  const d = ts.toDate();
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${DIAS_CORTO[d.getDay()]} ${h}:${m}`;
}

function fmtMoneda(n: number): string {
  return `$${n.toLocaleString('es-MX')}`;
}

function fechaRelativa(ts: number): string {
  if (ts === 0) return '—';
  const now = new Date();
  const hoy = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dia = new Date(new Date(ts).getFullYear(), new Date(ts).getMonth(), new Date(ts).getDate()).getTime();
  if (dia === hoy)              return 'hoy';
  if (dia === hoy - 86_400_000) return 'ayer';
  const d = new Date(ts);
  return `${d.getDate()} ${MESES_CORTO[d.getMonth()]}`;
}

function tiempoDesde(ts: Timestamp | null): string {
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

const NIVEL_LABEL: Record<string, string> = {
  pesimo: 'Pésimo', moroso: 'Moroso', regular: 'Regular', bueno: 'Bueno', excelente: 'Excelente',
};

// ─── Pantalla ─────────────────────────────────────────────────

export default function HomeScreen() {
  const { user }   = useAuth();
  const navigation = useNavigation<NavProp>();
  const uid        = user?.uid ?? '';

  const [inquilino,  setInquilino]  = useState<Inquilino | null>(null);
  const [pagos,      setPagos]      = useState<Pago[]>([]);
  const [visitas,    setVisitas]    = useState<Visita[]>([]);
  const [reservas,   setReservas]   = useState<ReservaLavanderia[]>([]);
  const [espacios,   setEspacios]   = useState<EspacioAlmacenamiento[]>([]);
  const [tickets,    setTickets]    = useState<Ticket[]>([]);
  const [expediente, setExpediente] = useState<Expediente | null>(null);
  const [documentos, setDocumentos] = useState<DocumentoExpediente[]>([]);
  const [score,      setScore]      = useState<ScoreReputacion | null>(null);
  const [cargando,   setCargando]   = useState(true);
  const [enviando,   setEnviando]   = useState(false);

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
    const u7 = listenExpediente(uid, setExpediente);
    const u8 = listenDocumentos(uid, setDocumentos);
    const u9 = listenScore(uid, s => setScore(s));
    return () => { u1(); u2(); u3(); u4(); u5(); u6(); u7(); u8(); u9(); };
  }, [uid]);

  const { estado, pagoActual, diasVencido, proxPago } = calcEstado(pagos);

  const nombre = inquilino?.nombre ?? user?.email?.split('@')[0] ?? '—';
  const hab    = inquilino?.habitacionId?.replace('hab_', '') ?? '—';

  // ADEUDOS: suma de pagos vencidos/rechazados/pendientes con fecha pasada
  const adeudosTotal = useMemo(() => {
    const ahora = Date.now();
    return pagos
      .filter(p =>
        ['pendiente', 'rechazado', 'vencido'].includes(p.estado) &&
        p.fechaVencimiento.toMillis() < ahora,
      )
      .reduce((sum, p) => sum + p.monto, 0);
  }, [pagos]);

  // Próximo pago calculado desde fechaIngreso + ciclo mensual
  const proximoPagoDate = useMemo((): Date | null => {
    if (!inquilino?.fechaIngreso) return null;
    const dia = inquilino.fechaIngreso.toDate().getDate();
    const ahora = new Date();
    const esteMs = new Date(ahora.getFullYear(), ahora.getMonth(), dia);
    return esteMs >= ahora
      ? esteMs
      : new Date(ahora.getFullYear(), ahora.getMonth() + 1, dia);
  }, [inquilino]);

  const venceLabel = proximoPagoDate
    ? (proximoPagoDate.toDateString() === new Date().toDateString()
        ? 'hoy'
        : `${proximoPagoDate.getDate()} ${MESES_CORTO[proximoPagoDate.getMonth()]}`)
    : '—';

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

  // Próxima reserva lavandería (futura pendiente/confirmada)
  const proximaReserva = useMemo(() =>
    reservas
      .filter(r =>
        ['pendiente', 'confirmada', 'pendiente_auth'].includes(r.estado) &&
        r.fechaReserva.toMillis() > Date.now(),
      )
      .sort((a, b) => a.fechaReserva.toMillis() - b.fechaReserva.toMillis())[0] ?? null,
  [reservas]);

  // Mi espacio de almacenamiento
  const miEspacio = espacios.find(e => e.inquilinoId === uid && e.estado === 'ocupado');

  // Tickets abiertos
  const ticketsAbiertos = tickets.filter(t => t.estado !== 'resuelto').length;

  // Visitas activas
  const visitasActivas = visitas.filter(v => !v.fechaSalida);

  // Visita con alerta 40h (para alert naranja)
  const visitaAlerta40h = visitasActivas.find(v => calcularHorasActiva(v.fechaEntrada) >= 40) ?? null;

  // Expediente: docs pendientes y prendas
  const docsPendientes = documentos.filter(d => d.estado === 'pendiente').length;
  const prendaSubidas  = documentos.filter(d =>
    (d.tipo === 'PRENDA_1_1' || d.tipo === 'PRENDA_1_2') && d.estado === 'subido',
  ).length;

  // Actividad reciente
  const actividad = useMemo(() => {
    const items: Array<{
      id: string; color: string; texto: string; ts: number;
    }> = [];

    pagos.slice(0, 5).forEach(p => {
      const ts = p.actualizadoEn?.toMillis?.() ?? p.creadoEn?.toMillis?.() ?? 0;
      if (p.estado === 'pagado')
        items.push({ id: `p-${p.id}`, color: '#3A7D44', texto: `Pago verificado · ${fmtMoneda(p.monto)}`, ts });
      else if (p.estado === 'en_revision')
        items.push({ id: `p-${p.id}`, color: '#C05A00', texto: 'Comprobante en revisión', ts });
      else if (p.estado === 'vencido')
        items.push({ id: `p-${p.id}`, color: '#A63228', texto: 'Pago vencido', ts });
    });

    visitas.slice(0, 4).forEach(v => {
      const nom = v.nombreVisitante ?? v.documentoNumero;
      if (!v.fechaSalida)
        items.push({ id: `v-${v.id}`, color: '#2A5EB0', texto: `Visita activa · ${nom}`, ts: v.fechaEntrada?.toMillis?.() ?? 0 });
      else
        items.push({ id: `v-${v.id}`, color: cartasBosque.helecho, texto: `Visita finalizada · ${nom}`, ts: v.fechaSalida?.toMillis?.() ?? 0 });
    });

    tickets.slice(0, 4).forEach(t => {
      const ts  = t.creadoEn?.toMillis?.() ?? 0;
      const cat = CATEGORIA_LABELS[t.categoria];
      if (t.estado === 'resuelto')
        items.push({ id: `t-${t.id}`, color: '#3A7D44', texto: `Ticket resuelto · ${cat}`, ts });
      else
        items.push({ id: `t-${t.id}`, color: '#C05A00', texto: `Reporte enviado · ${cat}`, ts });
    });

    return items.sort((a, b) => b.ts - a.ts).slice(0, 8);
  }, [pagos, visitas, tickets]);

  // ── Acciones ─────────────────────────────────────────────────

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

  function onReportarPago() {
    const pago = pagoActual ?? proxPago;
    if (!pago) {
      Alert.alert('Sin pago pendiente', 'No encontramos un pago activo para reportar.');
      return;
    }
    adjuntarComprobante(pago.id);
  }

  function confirmarDejarCorrer() {
    Alert.alert(
      'Dejar correr depósito',
      'Confirmas que dejarás correr tu depósito y entregarás la habitación al finalizar este periodo.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar', style: 'destructive',
          onPress: async () => {
            try {
              await addDoc(collection(db, 'apelaciones'), {
                tipo: 'solicitud_desocupacion',
                solicitanteId: uid,
                estado: 'pendiente',
                creadoEn: Timestamp.now(),
              });
              Alert.alert('Registrado', 'Administración ha sido notificada.');
            } catch {
              Alert.alert('Error', 'No se pudo registrar la solicitud.');
            }
          },
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

  // ── Qué alerta mostrar (prioridad: rojo > rosa > naranja) ────
  const mostrarAlertaRoja    = estado === 'adeudo';
  const mostrarAlertaRosa    = !mostrarAlertaRoja && estado === 'vence_hoy';
  const mostrarAlertaNaranja = !mostrarAlertaRoja && !mostrarAlertaRosa && !!visitaAlerta40h;

  return (
    <View style={s.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* ══════════════════════════════════════════════════
            HEADER OSCURO
        ══════════════════════════════════════════════════ */}
        <View style={s.header}>
          <SafeAreaView edges={['top']}>
            <Text style={s.headerHola}>Hola, {nombre}</Text>
            <Text style={s.headerHab}>HABITACIÓN {hab}</Text>

            {/* RENTA + VENCE + BADGE */}
            <View style={s.headerRentaRow}>
              <View style={s.headerField}>
                <Text style={s.headerFieldLabel}>RENTA</Text>
                <Text style={s.headerMonto}>
                  {inquilino?.rentaMensual ? fmtMoneda(inquilino.rentaMensual) : '—'}
                </Text>
              </View>
              <View style={s.headerField}>
                <Text style={s.headerFieldLabel}>VENCE</Text>
                <Text style={s.headerVenceVal}>{venceLabel}</Text>
              </View>
              <View style={s.headerBadgeWrap}>
                {estado === 'adeudo' && (
                  <View style={[s.badge, s.badgeRojo]}>
                    <Text style={[s.badgeText, { color: '#F5C6C2' }]}>Adeudo</Text>
                  </View>
                )}
                {estado === 'vence_hoy' && (
                  <View style={[s.badge, s.badgeNaranja]}>
                    <Text style={[s.badgeText, { color: '#F8A84B' }]}>Pendiente</Text>
                  </View>
                )}
                {estado === 'al_corriente' && (
                  <View style={[s.badge, s.badgeVerde]}>
                    <Ionicons name="checkmark-circle" size={10} color="#D6EDD9" />
                    <Text style={[s.badgeText, { color: '#D6EDD9', marginLeft: 3 }]}>Al corriente</Text>
                  </View>
                )}
              </View>
            </View>

            {/* PRÓXIMO PAGO · ADEUDOS */}
            <View style={s.headerInfoRow}>
              <Text style={s.headerInfoText}>
                PRÓXIMO PAGO:{' '}
                {proximoPagoDate
                  ? `${proximoPagoDate.getDate()} ${MESES_CORTO[proximoPagoDate.getMonth()]}`
                  : '—'}
              </Text>
              <Text style={s.headerInfoText}>
                ADEUDOS: {adeudosTotal > 0 ? fmtMoneda(adeudosTotal) : '$0'}
              </Text>
            </View>

            {/* ALERTA ROJA — adeudo 4+ días */}
            {mostrarAlertaRoja && pagoActual && (
              <View style={[s.alertaCard, { borderColor: '#F5C6C2', backgroundColor: 'rgba(165,50,40,0.18)' }]}>
                <Ionicons name="alert-circle-outline" size={16} color="#F5C6C2" />
                <Text style={[s.alertaText, { color: '#F5C6C2' }]}>
                  Han pasado {diasVencido} día{diasVencido !== 1 ? 's' : ''} sin registrar pago · Selecciona una opción.
                </Text>
              </View>
            )}

            {/* ALERTA ROSA — vence hoy */}
            {mostrarAlertaRosa && (
              <View style={[s.alertaCard, { borderColor: '#F5C6C2', backgroundColor: '#FEF0EF' }]}>
                <Ionicons name="alert-circle-outline" size={16} color="#A63228" />
                <Text style={[s.alertaText, { color: '#A63228' }]}>
                  {diasVencido === 0
                    ? 'Hoy es tu día de pago · Registra antes de que termine el día para evitar mora.'
                    : `Venció hace ${diasVencido} día${diasVencido !== 1 ? 's' : ''} · Registra tu pago.`}
                </Text>
              </View>
            )}

            {/* ALERTA NARANJA — visita +40h */}
            {mostrarAlertaNaranja && visitaAlerta40h && (
              <View style={[s.alertaCard, { borderColor: '#F8A84B55', backgroundColor: '#FFF5E0' }]}>
                <Ionicons name="time-outline" size={16} color="#C05A00" />
                <Text style={[s.alertaText, { color: '#C05A00' }]}>
                  Visita de {visitaAlerta40h.nombreVisitante ?? visitaAlerta40h.documentoNumero} lleva{' '}
                  {Math.floor(calcularHorasActiva(visitaAlerta40h.fechaEntrada))}h en la propiedad.
                </Text>
              </View>
            )}

            {/* BOTÓN REPORTAR PAGO — siempre visible */}
            <TouchableOpacity
              style={[s.btnPrincipal, enviando && { opacity: 0.5 }]}
              onPress={onReportarPago}
              disabled={enviando}
              activeOpacity={0.85}
            >
              {enviando
                ? <ActivityIndicator color={cartasBosque.bruma} />
                : <Text style={s.btnPrincipalText}>Reportar Pago</Text>
              }
            </TouchableOpacity>

            {/* BOTÓN DEJAR CORRER — solo adeudo */}
            {estado === 'adeudo' && (
              <TouchableOpacity
                style={s.btnDeposito}
                onPress={confirmarDejarCorrer}
                activeOpacity={0.8}
              >
                <Text style={s.btnDepositoText}>
                  Dejar correr mi depósito · entrego la habitación al finalizar este periodo
                </Text>
              </TouchableOpacity>
            )}
          </SafeAreaView>
        </View>

        {/* ══════════════════════════════════════════════════
            CARD EXPEDIENTE + DEPÓSITO
        ══════════════════════════════════════════════════ */}
        <View style={s.cardWrap}>
          <View style={s.card}>
            <Text style={s.cardLabel}>EXPEDIENTE · DEPÓSITO</Text>
            <View style={s.cardRow}>
              <Text style={s.cardVal}>
                Docs pendientes: <Text style={docsPendientes > 0 ? s.alertVal : s.okVal}>{docsPendientes}</Text>
              </Text>
              <Text style={s.cardDivider}> | </Text>
              <Text style={s.cardVal}>
                Score: <Text style={s.boldVal}>{score?.puntos ?? '—'}%</Text>
                {score ? ` ${NIVEL_LABEL[score.nivel] ?? score.nivel}` : ''}
              </Text>
            </View>
            <View style={s.cardRow}>
              <Text style={s.cardVal}>
                Prenda{' '}
                <Text style={prendaSubidas >= 1 ? s.okVal : s.alertVal}>{prendaSubidas}/2</Text>
                {prendaSubidas >= 2 ? ' ✓' : ' pendiente'}
              </Text>
              {expediente?.firmaDigital && (
                <>
                  <Text style={s.cardDivider}> | </Text>
                  <Text style={s.okVal}>Firma ✓</Text>
                </>
              )}
            </View>
          </View>
        </View>

        {/* ══════════════════════════════════════════════════
            CARD LAVANDERÍA (condicional)
        ══════════════════════════════════════════════════ */}
        {proximaReserva && (
          <View style={s.cardWrap}>
            <View style={s.card}>
              <View style={s.cardHeaderRow}>
                <Text style={s.cardLabel}>LAVANDERÍA</Text>
                <TouchableOpacity onPress={() => navigation.navigate('Servicios')} activeOpacity={0.78}>
                  <Text style={s.cardAccion}>Reservar</Text>
                </TouchableOpacity>
              </View>
              <Text style={s.cardVal}>
                Próxima lavada: <Text style={s.boldVal}>{fmtDiaHora(proximaReserva.fechaReserva)}</Text>
                {'  ·  '}
                <Text style={s.boldVal}>{cargasDisp}</Text> carga{cargasDisp !== 1 ? 's' : ''} restante{cargasDisp !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>
        )}

        {/* ══════════════════════════════════════════════════
            CARD VISITAS (condicional)
        ══════════════════════════════════════════════════ */}
        {visitasActivas.length > 0 && (
          <View style={s.cardWrap}>
            <View style={s.card}>
              <Text style={s.cardLabel}>VISITAS ACTIVAS</Text>
              {visitasActivas.map(v => (
                <View key={v.id} style={s.visitaRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.visitaNombre}>
                      {v.nombreVisitante ?? v.documentoNumero}
                    </Text>
                    <Text style={s.visitaMeta}>{fmtDiaHora(v.fechaEntrada)}</Text>
                  </View>
                  <TouchableOpacity
                    style={s.btnSalida}
                    onPress={() => Alert.alert(
                      'Registrar salida',
                      `¿Registrar salida de ${v.nombreVisitante ?? 'la visita'}?`,
                      [
                        { text: 'Cancelar', style: 'cancel' },
                        {
                          text: 'Confirmar',
                          onPress: () => registrarSalida(v.id).catch(() =>
                            Alert.alert('Error', 'No se pudo registrar.'),
                          ),
                        },
                      ],
                    )}
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
                <Text style={s.btnNuevaVisitaText}>+ Nueva visita</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ══════════════════════════════════════════════════
            GRID 2×2 — texto, sin iconos
        ══════════════════════════════════════════════════ */}
        <View style={s.gridWrap}>
          <TouchableOpacity style={s.gridCard} onPress={() => navigation.navigate('Servicios')} activeOpacity={0.78}>
            <Text style={s.gridTitulo}>Lavandería</Text>
            <Text style={s.gridSub}>
              {cargasDisp} carga{cargasDisp !== 1 ? 's' : ''} disponible{cargasDisp !== 1 ? 's' : ''}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.gridCard} onPress={() => navigation.navigate('Servicios')} activeOpacity={0.78}>
            <Text style={s.gridTitulo}>Almacén</Text>
            <Text style={s.gridSub}>
              {miEspacio
                ? `${miEspacio.tipo === 'locker' ? 'Casillero' : 'Refrigerador'} #${miEspacio.numero}`
                : 'Sin espacio asignado'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.gridCard} onPress={() => navigation.navigate('Dossier')} activeOpacity={0.78}>
            <Text style={s.gridTitulo}>Dossier</Text>
            <Text style={s.gridSub}>Mi expediente</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.gridCard} onPress={() => navigation.navigate('Soporte')} activeOpacity={0.78}>
            <Text style={s.gridTitulo}>Soporte</Text>
            <Text style={s.gridSub}>
              {ticketsAbiertos > 0
                ? `${ticketsAbiertos} ticket${ticketsAbiertos > 1 ? 's' : ''} abierto${ticketsAbiertos > 1 ? 's' : ''}`
                : 'Sin tickets abiertos'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ══════════════════════════════════════════════════
            ACTIVIDAD RECIENTE
        ══════════════════════════════════════════════════ */}
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
                    <View style={[s.actividadDot, { backgroundColor: a.color }]} />
                    <Text style={s.actividadTexto} numberOfLines={1}>{a.texto}</Text>
                    <Text style={s.actividadFecha}>{fechaRelativa(a.ts)}</Text>
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
    fontFamily: 'DMSans_700Bold', fontSize: 24, color: cartasBosque.bruma,
    marginTop: spacing[4], letterSpacing: -0.3,
  },
  headerHab: {
    fontFamily: 'DMMono_400Regular', fontSize: 10, color: cartasBosque.niebla,
    letterSpacing: 1.5, marginTop: 2, marginBottom: spacing[4],
  },
  headerRentaRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: spacing[4],
    marginBottom: spacing[2],
  },
  headerField: { gap: 2 },
  headerFieldLabel: {
    fontFamily: 'DMMono_400Regular', fontSize: 9, color: cartasBosque.niebla,
    letterSpacing: 1,
  },
  headerMonto: {
    fontFamily: 'DMSans_700Bold', fontSize: 30, color: cartasBosque.bruma,
    letterSpacing: -0.5, lineHeight: 34,
  },
  headerVenceVal: {
    fontFamily: 'DMSans_600SemiBold', fontSize: 18, color: cartasBosque.bruma, lineHeight: 34,
  },
  headerBadgeWrap: { flex: 1, alignItems: 'flex-end', paddingBottom: 6 },

  // Badges header
  badge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing[2], paddingVertical: 3,
    borderRadius: borderRadius.sm, borderWidth: 1,
  },
  badgeText: { fontFamily: 'DMMono_400Regular', fontSize: 9, letterSpacing: 0.3 },
  badgeRojo:    { backgroundColor: 'rgba(165,50,40,0.25)', borderColor: '#F5C6C2' + '88' },
  badgeNaranja: { backgroundColor: 'rgba(248,168,75,0.15)', borderColor: '#F8A84B' + '66' },
  badgeVerde:   { backgroundColor: 'rgba(58,125,68,0.2)', borderColor: '#3A7D44' + '66' },

  headerInfoRow: {
    flexDirection: 'row', gap: spacing[4], marginBottom: spacing[3],
  },
  headerInfoText: {
    fontFamily: 'DMMono_400Regular', fontSize: 10, color: cartasBosque.niebla, letterSpacing: 0.5,
  },

  // Alerta card (header)
  alertaCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2],
    borderRadius: borderRadius.md, borderWidth: 1,
    padding: spacing[3], marginBottom: spacing[3],
  },
  alertaText: {
    flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 12, lineHeight: 17,
  },

  // Botón principal (bosque)
  btnPrincipal: {
    backgroundColor: cartasBosque.bosque,
    borderRadius: borderRadius.md, paddingVertical: spacing[4],
    alignItems: 'center', marginBottom: spacing[2],
  },
  btnPrincipalText: {
    fontFamily: 'DMSans_600SemiBold', fontSize: 15, color: cartasBosque.bruma, letterSpacing: 0.1,
  },

  // Botón dejar correr (borde rosa)
  btnDeposito: {
    borderRadius: borderRadius.md, paddingVertical: spacing[3],
    alignItems: 'center',
    borderWidth: 1, borderColor: '#F5C6C2',
    marginBottom: spacing[2],
  },
  btnDepositoText: {
    fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#F5C6C2',
    textAlign: 'center', lineHeight: 18,
  },

  // ── CARDS ──
  cardWrap: { paddingHorizontal: spacing[4], marginTop: spacing[4] },
  card: {
    backgroundColor: cartasBosque.pergamino,
    borderRadius: borderRadius.lg, padding: spacing[4],
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    gap: spacing[2],
  },
  cardLabel: {
    fontFamily: 'DMMono_400Regular', fontSize: 9, color: cartasBosque.helecho,
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2,
  },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardAccion: {
    fontFamily: 'DMSans_600SemiBold', fontSize: 13, color: cartasBosque.bosque,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  cardVal: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: cartasBosque.tinta },
  cardDivider: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: cartasBosque.pergaminoOscuro },
  boldVal:  { fontFamily: 'DMSans_700Bold', fontSize: 13, color: cartasBosque.tinta },
  alertVal: { fontFamily: 'DMSans_700Bold', fontSize: 13, color: '#A63228' },
  okVal:    { fontFamily: 'DMSans_700Bold', fontSize: 13, color: '#3A7D44' },

  // Visita card rows
  visitaRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    paddingTop: spacing[2],
  },
  visitaNombre: { fontFamily: 'DMSans_600SemiBold', fontSize: 13, color: cartasBosque.tinta },
  visitaMeta:   { fontFamily: 'DMMono_400Regular', fontSize: 10, color: cartasBosque.helecho },
  btnSalida: {
    paddingHorizontal: spacing[2], paddingVertical: spacing[1] + 1,
    borderRadius: borderRadius.sm, borderWidth: 1,
    borderColor: cartasBosque.pergaminoOscuro,
  },
  btnSalidaText: { fontFamily: 'DMMono_400Regular', fontSize: 10, color: cartasBosque.tinta },
  btnNuevaVisita: {
    alignItems: 'center', paddingVertical: spacing[2], marginTop: spacing[1],
    borderTopWidth: 1, borderTopColor: cartasBosque.pergaminoOscuro,
  },
  btnNuevaVisitaText: {
    fontFamily: 'DMSans_400Regular', fontSize: 13, color: cartasBosque.bosque,
  },

  // ── GRID 2×2 ──
  gridWrap: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: spacing[4], paddingTop: spacing[4], gap: spacing[3],
  },
  gridCard: {
    width: '47%',
    backgroundColor: cartasBosque.pergamino,
    borderRadius: borderRadius.lg, padding: spacing[4],
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    gap: 4,
  },
  gridTitulo: { fontFamily: 'DMSans_600SemiBold', fontSize: 14, color: cartasBosque.tinta },
  gridSub:    { fontFamily: 'DMMono_400Regular',  fontSize: 10, color: cartasBosque.helecho, lineHeight: 13 },

  // ── SECCIONES ──
  seccion: { paddingHorizontal: spacing[4], marginTop: spacing[5] },
  seccionLabel: {
    fontFamily: 'DMMono_400Regular', fontSize: 10, color: cartasBosque.helecho,
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: spacing[3],
  },

  // Actividad
  actividadCard: {
    backgroundColor: cartasBosque.pergamino,
    borderRadius: borderRadius.md,
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
  actividadDot: { width: 8, height: 8, borderRadius: 4 },
  actividadTexto: {
    flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 12, color: cartasBosque.tinta,
  },
  actividadFecha: {
    fontFamily: 'DMMono_400Regular', fontSize: 9, color: cartasBosque.niebla,
  },
});
