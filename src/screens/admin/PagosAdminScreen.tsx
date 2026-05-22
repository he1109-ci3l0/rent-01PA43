import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Image, Modal, TextInput,
  KeyboardAvoidingView, Platform, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { cartasBosque } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/spacing';
import ScoreBadge from '@/components/common/ScoreBadge';
import {
  listenTodosLosPagos, verificarPago, rechazarPago,
  setScoreManual, seedDemoPagos, SCORE_CONFIG,
} from '@/services/firebase/pagos';
import type { Pago, NivelScore } from '@/types/firestore';
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

function horasRestantes(ts: import('firebase/firestore').Timestamp | undefined): number {
  if (!ts) return 120;
  const hrsTranscurridas = (Date.now() - ts.toMillis()) / 3_600_000;
  return Math.max(0, Math.round(120 - hrsTranscurridas));
}

type Filtro = 'todos' | 'verificar' | 'vencidos';

// ─── Componente principal ─────────────────────────────────────

export default function PagosAdminScreen() {
  const { user } = useAuth();
  const adminId = user?.uid ?? 'admin';

  const [pagos, setPagos] = useState<Pago[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>('verificar');
  const [procesando, setProcesando] = useState<string | null>(null);
  const [seeded, setSeeded] = useState(false);

  // Modal de rechazo
  const [rechazarModalPagoId, setRechazarModalPagoId] = useState<string | null>(null);
  const [razonRechazo, setRazonRechazo] = useState('');

  useEffect(() => {
    const unsub = listenTodosLosPagos(data => {
      setPagos(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  // Seed demo si vacío (DEV)
  useEffect(() => {
    if (!loading && pagos.length === 0 && __DEV__ && !seeded) {
      setSeeded(true);
      seedDemoPagos(adminId).catch(() => {});
    }
  }, [loading, pagos.length, adminId, seeded]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  // Stats
  const enRevision = pagos.filter(p => p.estado === 'en_revision');
  const vencidos   = pagos.filter(p => p.estado === 'vencido');
  const urgentes   = enRevision.filter(p => horasRestantes(p.comprobanteSubidoEn) <= 24);

  // Filtro aplicado
  const pagosFiltrados = filtro === 'verificar'
    ? enRevision
    : filtro === 'vencidos'
    ? vencidos
    : pagos;

  const handleVerificar = async (pagoId: string) => {
    setProcesando(pagoId);
    try {
      await verificarPago(pagoId, adminId);
      Alert.alert('Verificado', 'El pago fue marcado como pagado.');
    } catch {
      Alert.alert('Error', 'No se pudo verificar el pago.');
    } finally {
      setProcesando(null);
    }
  };

  const handleRechazar = async () => {
    if (!rechazarModalPagoId) return;
    if (!razonRechazo.trim()) {
      Alert.alert('Razón requerida', 'Escribe el motivo del rechazo.');
      return;
    }
    setProcesando(rechazarModalPagoId);
    setRechazarModalPagoId(null);
    try {
      await rechazarPago(rechazarModalPagoId, adminId, razonRechazo.trim());
    } catch {
      Alert.alert('Error', 'No se pudo rechazar el pago.');
    } finally {
      setProcesando(null);
      setRazonRechazo('');
    }
  };

  const handleSetScore = async (inquilinoId: string, nivel: NivelScore) => {
    try {
      await setScoreManual(inquilinoId, nivel, adminId);
      Alert.alert('Score actualizado', `Score de ${inquilinoId} → ${SCORE_CONFIG[nivel].label}`);
    } catch {
      Alert.alert('Error', 'No se pudo actualizar el score.');
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

  return (
    <>
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={cartasBosque.musgo} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.eyebrow}>
            {MESES[hoy.getMonth()]} {hoy.getFullYear()}
          </Text>
          <Text style={styles.title}>Pagos</Text>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <StatCard
            label="Por verificar"
            value={enRevision.length}
            color="#4A5E48"
            icon="time-outline"
          />
          <StatCard
            label="Urgentes"
            value={urgentes.length}
            color="#8A6A72"
            icon="warning-outline"
          />
          <StatCard
            label="Vencidos"
            value={vencidos.length}
            color="#670010"
            icon="alert-circle-outline"
          />
        </View>

        {/* Filter tabs */}
        <View style={styles.tabs}>
          {(['todos','verificar','vencidos'] as Filtro[]).map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.tab, filtro === f && styles.tabActive]}
              onPress={() => setFiltro(f)}
              activeOpacity={0.75}
            >
              <Text style={[styles.tabLabel, filtro === f && styles.tabLabelActive]}>
                {f === 'todos' ? 'Todos' : f === 'verificar' ? 'Verificar' : 'Vencidos'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Lista */}
        {pagosFiltrados.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="checkmark-circle-outline" size={32} color={cartasBosque.helecho} />
            <Text style={styles.emptyText}>
              {filtro === 'verificar' ? 'Sin comprobantes pendientes' : 'Sin pagos en esta categoría'}
            </Text>
          </View>
        ) : (
          <View style={styles.lista}>
            {pagosFiltrados.map(pago => (
              <AdminPagoCard
                key={pago.id}
                pago={pago}
                procesando={procesando === pago.id}
                onVerificar={() => handleVerificar(pago.id)}
                onRechazar={() => { setRechazarModalPagoId(pago.id); setRazonRechazo(''); }}
                onSetScore={nivel => handleSetScore(pago.inquilinoId, nivel)}
              />
            ))}
          </View>
        )}

        {/* Seed button (DEV) */}
        {__DEV__ && (
          <TouchableOpacity
            style={styles.seedBtn}
            onPress={() => seedDemoPagos(adminId).then(() => Alert.alert('Seed OK'))}
          >
            <Text style={styles.seedText}>Dev: seed demo pagos</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Modal de rechazo */}
      <Modal
        visible={!!rechazarModalPagoId}
        transparent
        animationType="slide"
        onRequestClose={() => setRechazarModalPagoId(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Motivo del rechazo</Text>
            <Text style={styles.modalSubtitle}>
              El inquilino verá este mensaje y deberá subir un nuevo comprobante.
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Ej: el comprobante está borroso o el monto no coincide…"
              placeholderTextColor={cartasBosque.helecho}
              value={razonRechazo}
              onChangeText={setRazonRechazo}
              multiline
              numberOfLines={3}
              autoFocus
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.modalBtnCancel}
                onPress={() => setRechazarModalPagoId(null)}
              >
                <Text style={styles.modalBtnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnReject} onPress={handleRechazar}>
                <Text style={styles.modalBtnRejectText}>Rechazar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────

function StatCard({ label, value, color, icon }: {
  label: string; value: number; color: string; icon: string;
}) {
  return (
    <View style={[styles.statCard, { borderColor: color + '30' }]}>
      <Ionicons name={icon as any} size={18} color={color} />
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function AdminPagoCard({ pago, procesando, onVerificar, onRechazar, onSetScore }: {
  pago: Pago;
  procesando: boolean;
  onVerificar: () => void;
  onRechazar: () => void;
  onSetScore: (nivel: NivelScore) => void;
}) {
  const [showScore, setShowScore] = useState(false);
  const hrs = horasRestantes(pago.comprobanteSubidoEn);
  const esUrgente = hrs <= 24 && pago.estado === 'en_revision';
  const diasMora = diasDesde(pago.fechaVencimiento);

  const estadoColor = pago.estado === 'en_revision' ? '#4A5E48'
    : pago.estado === 'pagado'   ? '#4A5E48'
    : pago.estado === 'rechazado'? '#670010'
    : '#8A6A72';

  const estadoLabel = pago.estado === 'en_revision' ? 'En revisión'
    : pago.estado === 'pagado'   ? 'Pagado'
    : pago.estado === 'rechazado'? 'Rechazado'
    : pago.estado === 'vencido'  ? `Vencido (${diasMora}d)`
    : 'Pendiente';

  return (
    <View style={styles.adminCard}>
      {/* Encabezado inquilino */}
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Text style={styles.cardNombre}>{pago.inquilinoNombre}</Text>
          <Text style={styles.cardHab}>Hab. {pago.habitacionNumero}</Text>
        </View>
        <View style={[styles.estadoBadge, { backgroundColor: estadoColor + '18' }]}>
          <Text style={[styles.estadoLabelText, { color: estadoColor }]}>{estadoLabel}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      {/* Monto + fechas */}
      <View style={styles.cardMontoRow}>
        <View>
          <Text style={styles.cardConcepto}>{pago.concepto}</Text>
          <Text style={styles.cardMonto}>${pago.monto.toLocaleString('es-MX')}</Text>
        </View>
        <View style={styles.fechasCol}>
          <Text style={styles.fechaLabel}>Vence</Text>
          <Text style={styles.fechaValue}>{formatFecha(pago.fechaVencimiento)}</Text>
          {pago.fechaPago && (
            <>
              <Text style={[styles.fechaLabel, { marginTop: spacing[1] }]}>Pagado</Text>
              <Text style={styles.fechaValue}>{formatFecha(pago.fechaPago)}</Text>
            </>
          )}
        </View>
      </View>

      {/* Comprobante + countdown */}
      {pago.comprobante && pago.estado === 'en_revision' && (
        <View style={[styles.comprobanteRow, esUrgente && styles.comprobanteRowUrgente]}>
          <Image source={{ uri: pago.comprobante }} style={styles.comprobanteMini} />
          <View style={{ flex: 1 }}>
            <Text style={styles.comprobanteLabel}>Comprobante recibido</Text>
            <Text style={styles.comprobanteDate}>{formatFecha(pago.comprobanteSubidoEn ?? null)}</Text>
          </View>
          <View style={styles.countdownPill}>
            <Ionicons
              name="hourglass-outline"
              size={12}
              color={esUrgente ? '#8A6A72' : '#4A5E48'}
            />
            <Text style={[styles.countdownText, esUrgente && styles.countdownUrgente]}>
              {hrs}h
            </Text>
          </View>
        </View>
      )}

      {/* Razón rechazo */}
      {pago.estado === 'rechazado' && pago.rechazadoRazon && (
        <View style={styles.rechazadoBox}>
          <Ionicons name="close-circle-outline" size={14} color="#670010" />
          <Text style={styles.rechazadoText}>{pago.rechazadoRazon}</Text>
        </View>
      )}

      {/* Acciones para en_revision */}
      {pago.estado === 'en_revision' && (
        <View style={styles.accionesRow}>
          <TouchableOpacity
            style={[styles.btnRechazar, procesando && { opacity: 0.5 }]}
            onPress={onRechazar}
            disabled={procesando}
            activeOpacity={0.8}
          >
            <Ionicons name="close" size={16} color="#670010" />
            <Text style={styles.btnRechazarText}>Rechazar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btnVerificar, procesando && { opacity: 0.5 }]}
            onPress={onVerificar}
            disabled={procesando}
            activeOpacity={0.8}
          >
            {procesando
              ? <ActivityIndicator size="small" color={cartasBosque.bruma} />
              : <>
                  <Ionicons name="checkmark" size={16} color={cartasBosque.bruma} />
                  <Text style={styles.btnVerificarText}>Autorizar</Text>
                </>
            }
          </TouchableOpacity>
        </View>
      )}

      {/* Score manual */}
      <TouchableOpacity
        style={styles.scoreToggle}
        onPress={() => setShowScore(v => !v)}
        activeOpacity={0.75}
      >
        <Text style={styles.scoreToggleText}>
          {showScore ? 'Ocultar score' : 'Ajustar score'}
        </Text>
        <Ionicons
          name={showScore ? 'chevron-up' : 'chevron-down'}
          size={14}
          color={cartasBosque.helecho}
        />
      </TouchableOpacity>

      {showScore && (
        <View style={styles.scoreRow}>
          {(Object.keys(SCORE_CONFIG) as NivelScore[]).map(nivel => (
            <TouchableOpacity
              key={nivel}
              style={[styles.scoreChip, { backgroundColor: SCORE_CONFIG[nivel].bg }]}
              onPress={() => onSetScore(nivel)}
            >
              <Text style={[styles.scoreChipText, { color: SCORE_CONFIG[nivel].color }]}>
                {SCORE_CONFIG[nivel].label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: cartasBosque.bruma },
  content: { padding: spacing[5], paddingBottom: spacing[10] },
  center:  { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: cartasBosque.bruma },

  header:   { marginBottom: spacing[5] },
  eyebrow:  { fontFamily: 'SpaceMono_400Regular', fontSize: 11, color: cartasBosque.musgo, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: spacing[1] },
  title:    { fontFamily: 'Inter_700Bold', fontSize: 26, color: cartasBosque.bosque, letterSpacing: -0.3 },

  // Stats
  statsRow: { flexDirection: 'row', gap: spacing[3], marginBottom: spacing[5] },
  statCard: {
    flex: 1, alignItems: 'center', gap: spacing[1],
    backgroundColor: cartasBosque.bruma,
    borderRadius: borderRadius.lg, padding: spacing[3],
    borderWidth: 1,
  },
  statValue: { fontFamily: 'Inter_700Bold', fontSize: 22 },
  statLabel: { fontFamily: 'SpaceMono_400Regular', fontSize: 9, color: cartasBosque.helecho, textAlign: 'center', letterSpacing: 0.5 },

  // Tabs
  tabs: { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[5] },
  tab: {
    flex: 1, alignItems: 'center', paddingVertical: spacing[2],
    borderRadius: borderRadius.full, backgroundColor: cartasBosque.bruma,
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
  },
  tabActive: { backgroundColor: cartasBosque.bosque, borderColor: cartasBosque.bosque },
  tabLabel: { fontFamily: 'Inter_500Medium', fontSize: 12, color: cartasBosque.helecho },
  tabLabelActive: { color: cartasBosque.bruma },

  // Empty
  emptyCard: {
    alignItems: 'center', justifyContent: 'center', gap: spacing[3],
    backgroundColor: cartasBosque.bruma, borderRadius: borderRadius.xl,
    padding: spacing[8], borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    borderStyle: 'dashed',
  },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: cartasBosque.helecho },

  // Lista
  lista: { gap: spacing[4] },

  // Card admin
  adminCard: {
    backgroundColor: cartasBosque.bruma, borderRadius: borderRadius.xl,
    padding: spacing[4], borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    shadowColor: cartasBosque.tinta, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2, gap: spacing[3],
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardHeaderLeft: { gap: spacing[0.5] },
  cardNombre: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: cartasBosque.tinta },
  cardHab:    { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.helecho, letterSpacing: 0.5 },
  estadoBadge: { paddingHorizontal: spacing[2.5], paddingVertical: spacing[1], borderRadius: borderRadius.full },
  estadoLabelText: { fontFamily: 'Inter_500Medium', fontSize: 11 },
  divider: { height: 1, backgroundColor: cartasBosque.pergaminoOscuro },

  cardMontoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  cardConcepto: { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.helecho, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing[0.5] },
  cardMonto:    { fontFamily: 'Inter_700Bold', fontSize: 22, color: cartasBosque.tinta, letterSpacing: -0.3 },
  fechasCol:    { alignItems: 'flex-end', gap: 0 },
  fechaLabel:   { fontFamily: 'SpaceMono_400Regular', fontSize: 9, color: cartasBosque.helecho, textTransform: 'uppercase', letterSpacing: 0.6 },
  fechaValue:   { fontFamily: 'Inter_500Medium', fontSize: 12, color: cartasBosque.tinta },

  // Comprobante
  comprobanteRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    backgroundColor: '#E8EBE0', borderRadius: borderRadius.md, padding: spacing[3],
  },
  comprobanteRowUrgente: { backgroundColor: 'rgba(205,178,157,0.15)' },
  comprobanteMini: { width: 40, height: 52, borderRadius: borderRadius.sm, backgroundColor: cartasBosque.pergaminoOscuro },
  comprobanteLabel: { fontFamily: 'Inter_500Medium', fontSize: 13, color: '#4A5E48' },
  comprobanteDate:  { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: '#4A5E48', marginTop: 2 },
  countdownPill: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: cartasBosque.bruma, borderRadius: borderRadius.full, paddingHorizontal: spacing[2], paddingVertical: spacing[0.5] },
  countdownText: { fontFamily: 'SpaceMono_400Regular', fontSize: 11, color: '#4A5E48' },
  countdownUrgente: { color: '#8A6A72' },

  // Rechazo
  rechazadoBox: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2], backgroundColor: 'rgba(103,0,16,0.2)', borderRadius: borderRadius.md, padding: spacing[3] },
  rechazadoText: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#670010', flex: 1 },

  // Acciones
  accionesRow: { flexDirection: 'row', gap: spacing[3] },
  btnRechazar: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing[1.5], paddingVertical: spacing[3],
    borderRadius: borderRadius.md, borderWidth: 1.5, borderColor: '#670010',
  },
  btnRechazarText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#670010' },
  btnVerificar: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing[1.5], paddingVertical: spacing[3],
    borderRadius: borderRadius.md, backgroundColor: '#4A5E48',
    shadowColor: '#4A5E48', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25, shadowRadius: 6, elevation: 3,
  },
  btnVerificarText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: cartasBosque.bruma },

  // Score manual
  scoreToggle: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], alignSelf: 'flex-start' },
  scoreToggleText: { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.helecho, letterSpacing: 0.5 },
  scoreRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  scoreChip: { paddingHorizontal: spacing[3], paddingVertical: spacing[1.5], borderRadius: borderRadius.full },
  scoreChipText: { fontFamily: 'Inter_500Medium', fontSize: 11 },

  // Dev seed
  seedBtn: { marginTop: spacing[8], alignSelf: 'center', paddingVertical: spacing[2], paddingHorizontal: spacing[4], borderRadius: borderRadius.full, borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro },
  seedText: { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.helecho },

  // Modal rechazo
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(18,42,31,0.35)' },
  modalSheet: {
    backgroundColor: cartasBosque.bruma, borderTopLeftRadius: borderRadius['2xl'],
    borderTopRightRadius: borderRadius['2xl'], padding: spacing[6],
    paddingBottom: spacing[8], gap: spacing[4],
  },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: cartasBosque.pergaminoOscuro, alignSelf: 'center', marginBottom: spacing[2] },
  modalTitle:    { fontFamily: 'Inter_700Bold', fontSize: 18, color: cartasBosque.tinta },
  modalSubtitle: { fontFamily: 'Inter_400Regular', fontSize: 13, color: cartasBosque.musgo, lineHeight: 18 },
  modalInput: {
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    borderRadius: borderRadius.md, padding: spacing[3],
    fontFamily: 'Inter_400Regular', fontSize: 14, color: cartasBosque.tinta,
    minHeight: 80, textAlignVertical: 'top',
    backgroundColor: cartasBosque.pergamino,
  },
  modalBtns: { flexDirection: 'row', gap: spacing[3] },
  modalBtnCancel: {
    flex: 1, paddingVertical: spacing[3], alignItems: 'center',
    borderRadius: borderRadius.md, borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
  },
  modalBtnCancelText: { fontFamily: 'Inter_500Medium', fontSize: 14, color: cartasBosque.musgo },
  modalBtnReject: {
    flex: 1, paddingVertical: spacing[3], alignItems: 'center',
    borderRadius: borderRadius.md, backgroundColor: '#670010',
  },
  modalBtnRejectText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#FFFFFF' },
});
