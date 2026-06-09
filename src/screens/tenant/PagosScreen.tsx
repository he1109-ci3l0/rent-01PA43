import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { cartasBosque } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/spacing';
import ScoreBadge from '@/components/common/ScoreBadge';
import {
  listenMisPagos, listenScore, registrarComprobante, calcularScore,
  seedDemoPagos,
} from '@/services/firebase/pagos';
import type { Pago, ScoreReputacion } from '@/types/firestore';
import { useAuth } from '@/hooks/useAuth';

// ─── Helpers ──────────────────────────────────────────────────

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function formatFecha(ts: import('firebase/firestore').Timestamp | null): string {
  if (!ts) return '—';
  const d = ts.toDate();
  return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
}

function diasDesde(ts: import('firebase/firestore').Timestamp): number {
  return Math.floor((Date.now() - ts.toMillis()) / 86_400_000);
}

function estadoLabel(pago: Pago): { label: string; color: string; icon: string } {
  const diasMora = diasDesde(pago.fechaVencimiento);
  switch (pago.estado) {
    case 'pagado':      return { label: 'Pagado',                 color: '#4A5E48', icon: 'checkmark-circle' };
    case 'en_revision': return { label: 'En revisión',            color: '#4A5E48', icon: 'time' };
    case 'rechazado':   return { label: 'Rechazado',              color: '#670010', icon: 'close-circle' };
    case 'vencido':     return { label: `Vencido (${diasMora}d)`, color: '#670010', icon: 'alert-circle' };
    case 'pendiente':
      if (diasMora > 3) return { label: 'Vencido',               color: '#670010', icon: 'alert-circle' };
      if (diasMora > 0) return { label: `${3-diasMora}d gracia`,  color: '#8A6A72', icon: 'warning' };
      return               { label: 'Por pagar',                  color: '#CDB29D', icon: 'ellipse-outline' };
    default:            return { label: pago.estado,              color: cartasBosque.helecho, icon: 'ellipse-outline' };
  }
}

const DEMO_SCORE: ScoreReputacion = {
  id: 'demo', inquilinoId: 'demo', nivel: 'bueno', puntos: 72,
  ajusteManual: false, ultimaActualizacion: null as any,
};

type TenantNav = BottomTabNavigationProp<{
  Dossier: undefined; Noticias: undefined; Home: undefined;
  Servicios: undefined; Soporte: undefined;
}>;

// ─── Accesos rápidos ──────────────────────────────────────────

const QUICK = [
  { id: 'servicios', label: 'Servicios',   icon: 'apps',      route: 'Servicios' as const },
  { id: 'noticias',  label: 'Noticias',    icon: 'megaphone', route: 'Noticias'  as const },
  { id: 'dossier',   label: 'Mi Dossier',  icon: 'id-card',   route: 'Dossier'   as const },
  { id: 'soporte',   label: 'Soporte',     icon: 'headset',   route: 'Soporte'   as const },
] as const;

// ─── Componente ───────────────────────────────────────────────

export default function PagosScreen() {
  const { user } = useAuth();
  const uid = user?.uid ?? 'demo';
  const nav = useNavigation<TenantNav>();

  const [pagos, setPagos] = useState<Pago[]>([]);
  const [score, setScore] = useState<ScoreReputacion | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    const unsubPagos = listenMisPagos(uid, data => {
      setPagos(data);
      setLoading(false);
    });
    const unsubScore = listenScore(uid, s => setScore(s));
    return () => { unsubPagos(); unsubScore(); };
  }, [uid]);

  useEffect(() => {
    if (!loading && pagos.length === 0 && __DEV__ && !seeded && uid !== 'demo') {
      setSeeded(true);
      seedDemoPagos(uid).catch(() => {});
    }
  }, [loading, pagos.length, uid, seeded]);

  const pagoActual = pagos.find(p =>
    p.estado !== 'pagado' && p.estado !== 'anulado'
  ) ?? pagos[0] ?? null;

  const historial = pagos.filter(p => p.estado === 'pagado');

  const scoreData = score ?? (pagos.length > 0
    ? { ...DEMO_SCORE, ...calcularScore(pagos) }
    : DEMO_SCORE);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  const handleRegistrarPago = async (pagoId: string) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería para subir el comprobante.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;

    setUploading(pagoId);
    try {
      await registrarComprobante(pagoId, result.assets[0].uri);
      Alert.alert('¡Listo!', 'Tu comprobante fue enviado. El admin lo revisará pronto.');
    } catch {
      Alert.alert('Error', 'No se pudo subir el comprobante. Intenta de nuevo.');
    } finally {
      setUploading(null);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={s.loadingWrap} edges={['top']}>
        <ActivityIndicator color={cartasBosque.bosque} />
      </SafeAreaView>
    );
  }

  const hora = new Date().getHours();
  const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';

  return (
    <SafeAreaView style={s.safeArea} edges={['top']}>
      <ScrollView
        style={s.root}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={cartasBosque.helecho} />}
      >
        {/* ── Header ── */}
        <View style={s.header}>
          <View>
            <Text style={s.saludo}>{saludo}</Text>
            <Text style={s.title}>Mi Hogar</Text>
          </View>
          <ScoreBadge nivel={scoreData.nivel} puntos={scoreData.puntos} size="sm" />
        </View>

        {/* ── Renta actual ── */}
        <Text style={s.sectionTitle}>Renta actual</Text>
        {pagoActual ? (
          <PagoCard
            pago={pagoActual}
            uploading={uploading === pagoActual.id}
            onPagar={() => handleRegistrarPago(pagoActual.id)}
          />
        ) : (
          <View style={s.emptyCard}>
            <Ionicons name="checkmark-circle" size={32} color={cartasBosque.helecho} />
            <Text style={s.emptyText}>Sin pagos pendientes</Text>
          </View>
        )}

        {/* ── Accesos rápidos ── */}
        <Text style={s.sectionTitle}>Accesos rápidos</Text>
        <View style={s.quickGrid}>
          {QUICK.map(item => (
            <TouchableOpacity
              key={item.id}
              style={s.quickCard}
              onPress={() => nav.navigate(item.route)}
              activeOpacity={0.75}
            >
              <View style={s.quickIcon}>
                <Ionicons name={item.icon as any} size={22} color={cartasBosque.bosque} />
              </View>
              <Text style={s.quickLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Reputación ── */}
        <Text style={s.sectionTitle}>Reputación</Text>
        <View style={s.scoreCard}>
          <ScoreBadge nivel={scoreData.nivel} puntos={scoreData.puntos} showBar size="lg" />
          {scoreData.ajusteManual && (
            <Text style={s.scoreAjuste}>Ajustado manualmente por admin</Text>
          )}
        </View>

        {/* ── Historial ── */}
        {historial.length > 0 && (
          <>
            <Text style={s.sectionTitle}>Historial</Text>
            <View style={s.historialList}>
              {historial.map(p => <HistorialRow key={p.id} pago={p} />)}
            </View>
          </>
        )}

        {/* Nota INPC */}
        <View style={s.inpcNote}>
          <Ionicons name="information-circle-outline" size={14} color={cartasBosque.helecho} />
          <Text style={s.inpcText}>
            El incremento anual INPC se notifica con 15 días de anticipación.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── PagoCard ─────────────────────────────────────────────────

function PagoCard({ pago, uploading, onPagar }: {
  pago: Pago;
  uploading: boolean;
  onPagar: () => void;
}) {
  const estado = estadoLabel(pago);
  const puedeSubir = pago.estado === 'pendiente' || pago.estado === 'rechazado';
  const enRevision = pago.estado === 'en_revision';

  return (
    <View style={s.pagoCard}>
      <View style={s.pagoMontoRow}>
        <View>
          <Text style={s.pagoLabel}>Renta mensual</Text>
          <Text style={s.pagoMonto}>
            ${pago.monto.toLocaleString('es-MX')}
            <Text style={s.pagoMXN}> MXN</Text>
          </Text>
        </View>
        <View style={[s.estadoBadge, { backgroundColor: estado.color + '18' }]}>
          <Ionicons name={estado.icon as any} size={14} color={estado.color} />
          <Text style={[s.estadoLabel, { color: estado.color }]}>{estado.label}</Text>
        </View>
      </View>

      <View style={s.divider} />

      <View style={s.fechasRow}>
        <FechaItem label="Vence"     value={formatFecha(pago.fechaVencimiento)} />
        {pago.fechaPago && <FechaItem label="Pagado" value={formatFecha(pago.fechaPago)} />}
        <FechaItem label="Modalidad" value={pago.modalidad === 'semanal' ? 'Semanal' : 'Mensual'} />
      </View>

      {pago.comprobante && enRevision && (
        <View style={s.comprobanteRow}>
          <Image source={{ uri: pago.comprobante }} style={s.comprobanteMini} />
          <View style={{ flex: 1 }}>
            <Text style={s.comprobanteLabel}>Comprobante enviado</Text>
            <Text style={s.comprobanteDate}>{formatFecha(pago.comprobanteSubidoEn ?? null)}</Text>
          </View>
          <Ionicons name="time-outline" size={18} color="#4A5E48" />
        </View>
      )}

      {pago.estado === 'rechazado' && pago.rechazadoRazon && (
        <View style={s.rechazadoBox}>
          <Ionicons name="close-circle-outline" size={15} color="#670010" />
          <Text style={s.rechazadoText}>{pago.rechazadoRazon}</Text>
        </View>
      )}

      {puedeSubir && (
        <TouchableOpacity
          style={[s.btnPagar, uploading && { opacity: 0.5 }]}
          onPress={onPagar}
          disabled={uploading}
          activeOpacity={0.82}
        >
          {uploading
            ? <ActivityIndicator size="small" color="#FFFFFF" />
            : <>
                <Ionicons name="camera-outline" size={18} color="#FFFFFF" />
                <Text style={s.btnPagarText}>
                  {pago.estado === 'rechazado' ? 'Subir nuevo comprobante' : 'Registrar pago'}
                </Text>
              </>
          }
        </TouchableOpacity>
      )}
    </View>
  );
}

function FechaItem({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text style={s.fechaLabel}>{label}</Text>
      <Text style={s.fechaValue}>{value}</Text>
    </View>
  );
}

function HistorialRow({ pago }: { pago: Pago }) {
  const d = pago.fechaVencimiento.toDate();
  const mes = `${MESES[d.getMonth()]} ${d.getFullYear()}`;
  return (
    <View style={s.historialRow}>
      <View style={s.historialDot} />
      <View style={{ flex: 1 }}>
        <Text style={s.historialMes}>{mes}</Text>
        {pago.metodoPago && <Text style={s.historialMetodo}>{pago.metodoPago}</Text>}
      </View>
      <Text style={s.historialMonto}>${pago.monto.toLocaleString('es-MX')}</Text>
      <Ionicons name="checkmark-circle" size={16} color="#4A5E48" style={{ marginLeft: spacing[2] }} />
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────

const s = StyleSheet.create({
  safeArea:    { flex: 1, backgroundColor: cartasBosque.bruma },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: cartasBosque.bruma },
  root:        { flex: 1, backgroundColor: cartasBosque.bruma },
  content:     { padding: spacing[5], paddingBottom: spacing[10] },

  header:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing[4] },
  saludo:  { fontFamily: 'MonaSans_400Regular', fontSize: 11, color: cartasBosque.helecho, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 },
  title:   { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 26, color: cartasBosque.tinta, letterSpacing: -0.3 },

  sectionTitle: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 15, color: cartasBosque.tinta, marginBottom: spacing[3], marginTop: spacing[5] },

  // Pago card
  pagoCard: {
    backgroundColor: cartasBosque.pergamino,
    borderRadius: borderRadius.xl,
    padding: spacing[5],
    borderWidth: 1,
    borderColor: cartasBosque.pergaminoOscuro,
    shadowColor: cartasBosque.tinta,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
    gap: spacing[4],
  },
  pagoMontoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  pagoLabel:    { fontFamily: 'MonaSans_400Regular', fontSize: 10, color: cartasBosque.helecho, letterSpacing: 1, textTransform: 'uppercase', marginBottom: spacing[1] },
  pagoMonto:    { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 30, color: cartasBosque.tinta, letterSpacing: -0.5 },
  pagoMXN:      { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 14, color: cartasBosque.helecho },
  estadoBadge:  { flexDirection: 'row', alignItems: 'center', gap: spacing[1], paddingHorizontal: spacing[2.5], paddingVertical: spacing[1], borderRadius: borderRadius.full },
  estadoLabel:  { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12 },
  divider:      { height: 1, backgroundColor: cartasBosque.pergaminoOscuro },
  fechasRow:    { flexDirection: 'row', justifyContent: 'space-between' },
  fechaLabel:   { fontFamily: 'MonaSans_400Regular', fontSize: 9, color: cartasBosque.helecho, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 },
  fechaValue:   { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: cartasBosque.tinta },

  comprobanteRow:   { flexDirection: 'row', alignItems: 'center', gap: spacing[3], backgroundColor: '#E8EBE0', borderRadius: borderRadius.md, padding: spacing[3] },
  comprobanteMini:  { width: 40, height: 52, borderRadius: borderRadius.sm, backgroundColor: cartasBosque.pergaminoOscuro },
  comprobanteLabel: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: '#4A5E48' },
  comprobanteDate:  { fontFamily: 'MonaSans_400Regular', fontSize: 10, color: '#4A5E48', marginTop: 2 },

  rechazadoBox:  { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2], backgroundColor: 'rgba(103,0,16,0.2)', borderRadius: borderRadius.md, padding: spacing[3] },
  rechazadoText: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: '#670010', flex: 1 },

  btnPagar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: cartasBosque.bosque, borderRadius: borderRadius.md,
    paddingVertical: 14, gap: spacing[2],
    shadowColor: cartasBosque.bosque, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25, shadowRadius: 6, elevation: 3,
  },
  btnPagarText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 15, color: '#FFFFFF' },

  emptyCard: {
    alignItems: 'center', justifyContent: 'center', gap: spacing[3],
    backgroundColor: cartasBosque.pergamino, borderRadius: borderRadius.xl,
    padding: spacing[8], borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    borderStyle: 'dashed',
  },
  emptyText: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 14, color: cartasBosque.helecho },

  // Quick access
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  quickCard: {
    width: '47%',
    backgroundColor: cartasBosque.pergamino,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    alignItems: 'center',
    gap: spacing[2],
    borderWidth: 1,
    borderColor: cartasBosque.pergaminoOscuro,
    shadowColor: cartasBosque.tinta,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  quickIcon: {
    width: 44, height: 44, borderRadius: borderRadius.md,
    backgroundColor: cartasBosque.bruma,
    alignItems: 'center', justifyContent: 'center',
  },
  quickLabel: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: cartasBosque.tinta, textAlign: 'center' },

  // Score
  scoreCard: {
    backgroundColor: cartasBosque.pergamino, borderRadius: borderRadius.xl,
    padding: spacing[5], borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro, gap: spacing[3],
  },
  scoreAjuste: { fontFamily: 'MonaSans_400Regular', fontSize: 10, color: cartasBosque.helecho },

  // Historial
  historialList:   { gap: spacing[1] },
  historialRow:    { flexDirection: 'row', alignItems: 'center', backgroundColor: cartasBosque.pergamino, borderRadius: borderRadius.md, padding: spacing[3], gap: spacing[3] },
  historialDot:    { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4A5E48' },
  historialMes:    { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: cartasBosque.tinta },
  historialMetodo: { fontFamily: 'MonaSans_400Regular', fontSize: 10, color: cartasBosque.helecho, marginTop: 1 },
  historialMonto:  { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: cartasBosque.tinta },

  inpcNote: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2], marginTop: spacing[8] },
  inpcText: { fontFamily: 'MonaSans_400Regular', fontSize: 10, color: cartasBosque.helecho, flex: 1, lineHeight: 16 },
});
