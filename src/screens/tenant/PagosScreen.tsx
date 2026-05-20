import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { cartasBosque } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/spacing';
import ScoreBadge from '@/components/common/ScoreBadge';
import {
  listenMisPagos, listenScore, registrarComprobante, calcularScore,
  seedDemoPagos,
} from '@/services/firebase/pagos';
import type { Pago, ScoreReputacion, NivelScore } from '@/types/firestore';
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
    case 'pagado':     return { label: 'Pagado',           color: '#00897B', icon: 'checkmark-circle' };
    case 'en_revision':return { label: 'En revisión',      color: '#1565C0', icon: 'time' };
    case 'rechazado':  return { label: 'Rechazado',        color: '#C62828', icon: 'close-circle' };
    case 'vencido':    return { label: `Vencido (${diasMora}d)`, color: '#C62828', icon: 'alert-circle' };
    case 'pendiente':
      if (diasMora > 3) return { label: 'Vencido',        color: '#C62828', icon: 'alert-circle' };
      if (diasMora > 0) return { label: `${3-diasMora}d gracia`, color: '#EF6C00', icon: 'warning' };
      return { label: 'Por pagar',                         color: '#F9A825', icon: 'ellipse-outline' };
    default:           return { label: pago.estado,        color: cartasBosque.musgo, icon: 'ellipse-outline' };
  }
}

// ─── Demo data (cuando Firestore está vacío) ──────────────────

const DEMO_SCORE: ScoreReputacion = {
  id: 'demo', inquilinoId: 'demo', nivel: 'bueno', puntos: 72,
  ajusteManual: false, ultimaActualizacion: null as any,
};

// ─── Componente ───────────────────────────────────────────────

export default function PagosScreen() {
  const { user } = useAuth();
  const uid = user?.uid ?? 'demo';

  const [pagos, setPagos] = useState<Pago[]>([]);
  const [score, setScore] = useState<ScoreReputacion | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [seeded, setSeeded] = useState(false);

  // Listeners en tiempo real
  useEffect(() => {
    const unsubPagos = listenMisPagos(uid, data => {
      setPagos(data);
      setLoading(false);
    });
    const unsubScore = listenScore(uid, s => setScore(s));
    return () => { unsubPagos(); unsubScore(); };
  }, [uid]);

  // Seed demo si Firestore vacío (solo DEV, una vez)
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
      <View style={styles.center}>
        <ActivityIndicator color={cartasBosque.bosque} />
      </View>
    );
  }

  const hoy = new Date();
  const mesActual = `${MESES[hoy.getMonth()]} ${hoy.getFullYear()}`;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={cartasBosque.musgo} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.eyebrow}>{mesActual}</Text>
        <Text style={styles.title}>Mis pagos</Text>
      </View>

      {/* ── Pago actual ── */}
      {pagoActual ? (
        <PagoCard
          pago={pagoActual}
          uploading={uploading === pagoActual.id}
          onPagar={() => handleRegistrarPago(pagoActual.id)}
        />
      ) : (
        <View style={styles.emptyCard}>
          <Ionicons name="checkmark-circle" size={32} color={cartasBosque.helecho} />
          <Text style={styles.emptyText}>Sin pagos pendientes</Text>
        </View>
      )}

      {/* ── Score ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tu reputación</Text>
        <View style={styles.scoreCard}>
          <ScoreBadge nivel={scoreData.nivel} puntos={scoreData.puntos} showBar size="lg" />
          {scoreData.ajusteManual && (
            <Text style={styles.scoreAjuste}>Ajustado manualmente por admin</Text>
          )}
        </View>
      </View>

      {/* ── Historial ── */}
      {historial.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Historial</Text>
          <View style={styles.historialList}>
            {historial.map(p => <HistorialRow key={p.id} pago={p} />)}
          </View>
        </View>
      )}

      {/* Nota INPC */}
      <View style={styles.inpcNote}>
        <Ionicons name="information-circle-outline" size={14} color={cartasBosque.helecho} />
        <Text style={styles.inpcText}>
          El incremento anual INPC se notifica con 15 días de anticipación.
        </Text>
      </View>
    </ScrollView>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────

function PagoCard({ pago, uploading, onPagar }: {
  pago: Pago;
  uploading: boolean;
  onPagar: () => void;
}) {
  const estado = estadoLabel(pago);
  const puedeSubir = pago.estado === 'pendiente' || pago.estado === 'rechazado';
  const enRevision = pago.estado === 'en_revision';

  return (
    <View style={styles.pagoCard}>
      {/* Monto */}
      <View style={styles.pagoMontoRow}>
        <View>
          <Text style={styles.pagoLabel}>Renta mensual</Text>
          <Text style={styles.pagoMonto}>
            ${pago.monto.toLocaleString('es-MX')}
            <Text style={styles.pagueMXN}> MXN</Text>
          </Text>
        </View>
        <View style={[styles.estadoBadge, { backgroundColor: estado.color + '18' }]}>
          <Ionicons name={estado.icon as any} size={14} color={estado.color} />
          <Text style={[styles.estadoLabel, { color: estado.color }]}>{estado.label}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      {/* Fechas */}
      <View style={styles.fechasRow}>
        <FechaItem label="Vence" value={formatFecha(pago.fechaVencimiento)} />
        {pago.fechaPago && <FechaItem label="Pagado" value={formatFecha(pago.fechaPago)} />}
        <FechaItem label="Modalidad" value={pago.modalidad === 'semanal' ? 'Semanal' : 'Mensual'} />
      </View>

      {/* Comprobante ya subido */}
      {pago.comprobante && enRevision && (
        <View style={styles.comprobanteRow}>
          <Image source={{ uri: pago.comprobante }} style={styles.comprobanteMini} />
          <View style={{ flex: 1 }}>
            <Text style={styles.comprobanteLabel}>Comprobante enviado</Text>
            <Text style={styles.comprobanteDate}>
              {formatFecha(pago.comprobanteSubidoEn ?? null)}
            </Text>
          </View>
          <Ionicons name="time-outline" size={18} color='#1565C0' />
        </View>
      )}

      {/* Razón de rechazo */}
      {pago.estado === 'rechazado' && pago.rechazadoRazon && (
        <View style={styles.rechazadoBox}>
          <Ionicons name="close-circle-outline" size={15} color='#C62828' />
          <Text style={styles.rechazadoText}>{pago.rechazadoRazon}</Text>
        </View>
      )}

      {/* Botón */}
      {puedeSubir && (
        <TouchableOpacity
          style={[styles.btnPagar, uploading && { opacity: 0.5 }]}
          onPress={onPagar}
          disabled={uploading}
          activeOpacity={0.82}
        >
          {uploading
            ? <ActivityIndicator size="small" color={cartasBosque.bruma} />
            : <>
                <Ionicons name="camera-outline" size={18} color={cartasBosque.bruma} />
                <Text style={styles.btnPagarText}>
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
      <Text style={styles.fechaLabel}>{label}</Text>
      <Text style={styles.fechaValue}>{value}</Text>
    </View>
  );
}

function HistorialRow({ pago }: { pago: Pago }) {
  const d = pago.fechaVencimiento.toDate();
  const mes = `${MESES[d.getMonth()]} ${d.getFullYear()}`;
  return (
    <View style={styles.historialRow}>
      <View style={styles.historialDot} />
      <View style={{ flex: 1 }}>
        <Text style={styles.historialMes}>{mes}</Text>
        {pago.metodoPago && (
          <Text style={styles.historialMetodo}>{pago.metodoPago}</Text>
        )}
      </View>
      <Text style={styles.historialMonto}>${pago.monto.toLocaleString('es-MX')}</Text>
      <Ionicons name="checkmark-circle" size={16} color="#00897B" style={{ marginLeft: spacing[2] }} />
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: cartasBosque.pergamino },
  content: { padding: spacing[5], paddingBottom: spacing[10] },
  center:  { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: cartasBosque.pergamino },

  header:   { marginBottom: spacing[5] },
  eyebrow:  { fontFamily: 'DMMono_400Regular', fontSize: 11, color: cartasBosque.musgo, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: spacing[1] },
  title:    { fontFamily: 'DMSans_700Bold', fontSize: 26, color: cartasBosque.bosque, letterSpacing: -0.3 },

  // Pago card
  pagoCard: {
    backgroundColor: cartasBosque.bruma,
    borderRadius: borderRadius.xl,
    padding: spacing[5],
    borderWidth: 1,
    borderColor: cartasBosque.pergaminoOscuro,
    shadowColor: cartasBosque.tinta,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    gap: spacing[4],
  },
  pagoMontoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  pagoLabel:    { fontFamily: 'DMMono_400Regular', fontSize: 10, color: cartasBosque.helecho, letterSpacing: 1, textTransform: 'uppercase', marginBottom: spacing[1] },
  pagoMonto:    { fontFamily: 'DMSans_700Bold', fontSize: 28, color: cartasBosque.tinta, letterSpacing: -0.5 },
  pagueMXN:     { fontFamily: 'DMSans_400Regular', fontSize: 14, color: cartasBosque.helecho },
  estadoBadge:  { flexDirection: 'row', alignItems: 'center', gap: spacing[1], paddingHorizontal: spacing[2.5], paddingVertical: spacing[1], borderRadius: borderRadius.full },
  estadoLabel:  { fontFamily: 'DMSans_500Medium', fontSize: 12 },
  divider:      { height: 1, backgroundColor: cartasBosque.pergaminoOscuro },
  fechasRow:    { flexDirection: 'row', justifyContent: 'space-between' },
  fechaLabel:   { fontFamily: 'DMMono_400Regular', fontSize: 9, color: cartasBosque.helecho, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 },
  fechaValue:   { fontFamily: 'DMSans_500Medium', fontSize: 13, color: cartasBosque.tinta },

  // Comprobante
  comprobanteRow:  { flexDirection: 'row', alignItems: 'center', gap: spacing[3], backgroundColor: '#EEF2FF', borderRadius: borderRadius.md, padding: spacing[3] },
  comprobanteMini: { width: 40, height: 52, borderRadius: borderRadius.sm, backgroundColor: cartasBosque.pergaminoOscuro },
  comprobanteLabel:{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: '#1565C0' },
  comprobanteDate: { fontFamily: 'DMMono_400Regular', fontSize: 10, color: '#5C6BC0', marginTop: 2 },

  // Rechazo
  rechazadoBox:  { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2], backgroundColor: '#FFEBEE', borderRadius: borderRadius.md, padding: spacing[3] },
  rechazadoText: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#C62828', flex: 1 },

  // Botón pagar
  btnPagar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: cartasBosque.bosque, borderRadius: borderRadius.md,
    paddingVertical: 14, gap: spacing[2],
    shadowColor: cartasBosque.bosque, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25, shadowRadius: 6, elevation: 3,
  },
  btnPagarText: { fontFamily: 'DMSans_600SemiBold', fontSize: 15, color: cartasBosque.bruma },

  // Empty
  emptyCard: {
    alignItems: 'center', justifyContent: 'center', gap: spacing[3],
    backgroundColor: cartasBosque.bruma, borderRadius: borderRadius.xl,
    padding: spacing[8], borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    borderStyle: 'dashed',
  },
  emptyText: { fontFamily: 'DMSans_400Regular', fontSize: 14, color: cartasBosque.helecho },

  // Score
  section:      { marginTop: spacing[6] },
  sectionTitle: { fontFamily: 'DMSans_600SemiBold', fontSize: 16, color: cartasBosque.tinta, marginBottom: spacing[3] },
  scoreCard:    { backgroundColor: cartasBosque.bruma, borderRadius: borderRadius.xl, padding: spacing[5], borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro, gap: spacing[3] },
  scoreAjuste:  { fontFamily: 'DMMono_400Regular', fontSize: 10, color: cartasBosque.helecho },

  // Historial
  historialList: { gap: spacing[1] },
  historialRow:  { flexDirection: 'row', alignItems: 'center', backgroundColor: cartasBosque.bruma, borderRadius: borderRadius.md, padding: spacing[3], gap: spacing[3] },
  historialDot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: '#00897B' },
  historialMes:  { fontFamily: 'DMSans_500Medium', fontSize: 13, color: cartasBosque.tinta },
  historialMetodo:{ fontFamily: 'DMMono_400Regular', fontSize: 10, color: cartasBosque.helecho, marginTop: 1 },
  historialMonto:{ fontFamily: 'DMSans_600SemiBold', fontSize: 13, color: cartasBosque.tinta },

  // INPC nota
  inpcNote: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2], marginTop: spacing[8] },
  inpcText: { fontFamily: 'DMMono_400Regular', fontSize: 10, color: cartasBosque.helecho, flex: 1, lineHeight: 16 },
});
