import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Image, Modal, TextInput,
  KeyboardAvoidingView, Platform, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { cartasBosque } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/spacing';
import {
  listenTodosLosPagos, verificarPago, rechazarPago,
  setScoreManual, seedDemoPagos, SCORE_CONFIG,
  descontarPrenda, suspenderCuenta,
} from '@/services/firebase/pagos';
import type { Pago, NivelScore } from '@/types/firestore';
import { useAuth } from '@/hooks/useAuth';

// ─── Constants ────────────────────────────────────────────────

const ESTADO_STRIPE: Record<string, string> = {
  en_revision: '#3B82F6',
  vencido:     '#C0392B',
  pagado:      '#4A9B6F',
  rechazado:   '#E05C2A',
  pendiente:   '#E8A838',
};

const ESTADO_BADGE_LABEL: Record<string, string> = {
  en_revision: 'POR VERIFICAR',
  vencido:     'VENCIDO',
  pagado:      'PAGADO',
  rechazado:   'RECHAZADO',
  pendiente:   'PENDIENTE',
};

// ─── Helpers ──────────────────────────────────────────────────

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function formatFecha(ts: import('firebase/firestore').Timestamp | null | undefined): string {
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

// ─── PagoCardLista (web left column) ──────────────────────────

function PagoCardLista({ pago, seleccionado, onSelect }: {
  pago: Pago;
  seleccionado: boolean;
  onSelect: () => void;
}) {
  const hrs = horasRestantes(pago.comprobanteSubidoEn);
  const hrsColor = hrs > 24 ? '#E8A838' : '#C0392B';
  const stripe = ESTADO_STRIPE[pago.estado] ?? cartasBosque.helecho;
  const badgeLabel = ESTADO_BADGE_LABEL[pago.estado] ?? pago.estado.toUpperCase();

  return (
    <TouchableOpacity
      style={[pl.card, seleccionado && pl.cardSel, { borderLeftColor: stripe }]}
      onPress={onSelect}
      activeOpacity={0.85}
    >
      <View style={pl.top}>
        <View style={{ flex: 1 }}>
          <Text style={pl.nombre} numberOfLines={1}>{pago.inquilinoNombre}</Text>
          <Text style={pl.meta} numberOfLines={1}>
            Hab. {pago.habitacionNumero} · {pago.concepto}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 3 }}>
          <View style={[pl.badge, { backgroundColor: stripe + '20' }]}>
            <Text style={[pl.badgeText, { color: stripe }]}>{badgeLabel}</Text>
          </View>
          <Text style={pl.monto}>${pago.montoPagado.toLocaleString('es-MX')}</Text>
        </View>
      </View>

      {(pago.estado === 'en_revision' || pago.comprobante) && (
        <View style={pl.bottom}>
          {pago.estado === 'en_revision' && (
            <Text style={[pl.countdown, { color: hrsColor }]}>
              {hrs}h para revisar
            </Text>
          )}
          {pago.comprobante ? (
            <View style={pl.comprobanteChip}>
              <Ionicons name="image-outline" size={11} color="#3B82F6" />
              <Text style={pl.comprobanteChipText}>imagen</Text>
            </View>
          ) : null}
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── PanelVerificacion (web right column) ─────────────────────

function PanelVerificacion({ pago, todos, procesando, onVerificar, onRechazar }: {
  pago: Pago | null;
  todos: Pago[];
  procesando: string | null;
  onVerificar: (id: string) => void;
  onRechazar: (id: string) => void;
}) {
  if (!pago) {
    return (
      <View style={pv.empty}>
        <Ionicons name="card-outline" size={48} color={cartasBosque.pergaminoOscuro} />
        <Text style={pv.emptyText}>Selecciona un pago para verificar</Text>
      </View>
    );
  }

  const hrs = horasRestantes(pago.comprobanteSubidoEn);
  const hrsColor = hrs > 24 ? '#E8A838' : '#C0392B';
  const dias = pago.fechaVencimiento ? diasDesde(pago.fechaVencimiento) : 0;
  const diasColor = dias > 0 ? '#C0392B' : '#4A9B6F';
  const stripe = ESTADO_STRIPE[pago.estado] ?? cartasBosque.helecho;
  const badgeLabel = ESTADO_BADGE_LABEL[pago.estado] ?? pago.estado.toUpperCase();
  const isProcesando = procesando === pago.id;

  const { user } = useAuth();

  async function handleDescontarPrenda() {
    if (!user?.uid) return;
    Alert.alert(
      'Descontar prenda en garantía',
      '¿Confirmas descontar la prenda en garantía de este inquilino? Esta acción es irreversible.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar', style: 'destructive',
          onPress: async () => {
            try { await descontarPrenda(pago.id, user.uid); }
            catch { Alert.alert('Error', 'No se pudo descontar la prenda.'); }
          },
        },
      ],
    );
  }

  async function handleSuspenderCuenta() {
    if (!user?.uid) return;
    Alert.alert(
      'Suspender cuenta',
      '¿Confirmas suspender la cuenta de este inquilino? No podrá iniciar sesión hasta que el admin la reactive.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Suspender', style: 'destructive',
          onPress: async () => {
            try { await suspenderCuenta(pago.inquilinoId, user.uid); }
            catch { Alert.alert('Error', 'No se pudo suspender la cuenta.'); }
          },
        },
      ],
    );
  }

  const historial = todos
    .filter(p => p.inquilinoId === pago.inquilinoId && p.id !== pago.id)
    .slice(0, 3);

  function diasLabel(): string {
    if (dias > 0) return `+${dias}d vencido`;
    if (dias === 0) return 'Hoy';
    return `${Math.abs(dias)}d restantes`;
  }

  return (
    <ScrollView style={pv.container} contentContainerStyle={pv.content}>
      {/* Header */}
      <View style={[pv.panelHeader, { borderLeftColor: stripe }]}>
        <View style={{ flex: 1 }}>
          <Text style={pv.panelNombre}>{pago.inquilinoNombre}</Text>
          <Text style={pv.panelSub}>
            Hab. {pago.habitacionNumero} · {pago.concepto}
          </Text>
        </View>
        <View style={[pl.badge, { backgroundColor: stripe + '20' }]}>
          <Text style={[pl.badgeText, { color: stripe }]}>{badgeLabel}</Text>
        </View>
      </View>

      {/* Datos del pago */}
      <View style={pv.seccion}>
        <Text style={pv.seccionTitle}>Datos del pago</Text>
        <View style={pv.tabla}>
          {([
            ['Inquilino', pago.inquilinoNombre ?? '—'],
            ['Habitación', pago.habitacionNumero ?? '—'],
            ['Concepto', pago.concepto],
          ] as [string, string][]).map(([label, value]) => (
            <View key={label} style={pv.datoRow}>
              <Text style={pv.datoLabel}>{label}</Text>
              <Text style={pv.datoValue}>{value}</Text>
            </View>
          ))}
          <View style={pv.datoRow}>
            <Text style={pv.datoLabel}>Monto declarado</Text>
            <Text style={[pv.datoValue, { color: '#4A9B6F', fontFamily: 'BricolageGrotesque_700Bold' }]}>
              ${pago.montoPagado.toLocaleString('es-MX')}
            </Text>
          </View>
          <View style={pv.datoRow}>
            <Text style={pv.datoLabel}>Fecha vencimiento</Text>
            <Text style={pv.datoValue}>{formatFecha(pago.fechaVencimiento)}</Text>
          </View>
          <View style={pv.datoRow}>
            <Text style={pv.datoLabel}>Días desde vencimiento</Text>
            <Text style={[pv.datoValue, { color: diasColor }]}>{diasLabel()}</Text>
          </View>
          {pago.comprobanteSubidoEn && (
            <View style={pv.datoRow}>
              <Text style={pv.datoLabel}>Comprobante subido</Text>
              <Text style={pv.datoValue}>{formatFecha(pago.comprobanteSubidoEn)}</Text>
            </View>
          )}
          {pago.estado === 'en_revision' && pago.comprobanteSubidoEn && (
            <View style={pv.datoRow}>
              <Text style={pv.datoLabel}>Horas para revisar</Text>
              <Text style={[pv.datoValue, { color: hrsColor }]}>{hrs}h restantes</Text>
            </View>
          )}
        </View>
      </View>

      {/* Comprobante */}
      <View style={pv.seccion}>
        <Text style={pv.seccionTitle}>Comprobante</Text>
        {pago.comprobante ? (
          <View style={pv.comprobanteCard}>
            <Text style={pv.comprobanteCardTitle}>COMPROBANTE ADJUNTO</Text>
            <Image
              source={{ uri: pago.comprobante }}
              style={pv.comprobanteImg}
              resizeMode="contain"
            />
            <TouchableOpacity
              style={pv.verCompleto}
              onPress={() => {
                if (typeof window !== 'undefined') {
                  (window as any).open(pago.comprobante, '_blank');
                }
              }}
            >
              <Text style={pv.verCompletoText}>Ver en tamaño completo</Text>
              <Ionicons name="open-outline" size={12} color={cartasBosque.bosque} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={pv.comprobanteVacio}>
            <Ionicons name="image-outline" size={32} color={cartasBosque.pergaminoOscuro} />
            <Text style={pv.comprobanteVacioText}>Sin comprobante adjunto</Text>
          </View>
        )}
      </View>

      {/* Historial del inquilino */}
      {historial.length > 0 && (
        <View style={pv.seccion}>
          <Text style={pv.seccionTitle}>Historial del inquilino</Text>
          {historial.map(h => {
            const hColor = ESTADO_STRIPE[h.estado] ?? cartasBosque.helecho;
            return (
              <View key={h.id} style={pv.histRow}>
                <View style={{ flex: 1 }}>
                  <Text style={pv.histConcepto}>{h.concepto}</Text>
                  <Text style={pv.histFecha}>{formatFecha(h.fechaPago ?? h.fechaVencimiento)}</Text>
                </View>
                <View style={[pl.badge, { backgroundColor: hColor + '20' }]}>
                  <Text style={[pl.badgeText, { color: hColor }]}>
                    {ESTADO_BADGE_LABEL[h.estado] ?? h.estado}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Acciones */}
      <View style={pv.seccion}>
        {pago.estado === 'en_revision' && (
          <>
            <View style={pv.instruccionBox}>
              <Text style={pv.instruccionText}>
                Verifica que el monto, fecha y destinatario coincidan con el comprobante antes de aprobar.
              </Text>
            </View>
            <TouchableOpacity
              style={[pv.btnVerificar, isProcesando && { opacity: 0.6 }]}
              onPress={() => onVerificar(pago.id)}
              disabled={isProcesando}
            >
              {isProcesando
                ? <ActivityIndicator size="small" color="#FFFFFF" />
                : <>
                    <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                    <Text style={pv.btnVerificarText}>Aprobar pago</Text>
                  </>
              }
            </TouchableOpacity>
            <TouchableOpacity
              style={[pv.btnRechazar, isProcesando && { opacity: 0.6 }]}
              onPress={() => onRechazar(pago.id)}
              disabled={isProcesando}
            >
              <Ionicons name="close-circle" size={18} color="#C0392B" />
              <Text style={pv.btnRechazarText}>Rechazar comprobante</Text>
            </TouchableOpacity>
          </>
        )}

        {pago.estado === 'rechazado' && (
          <View style={pv.rechazadoCard}>
            <Text style={pv.rechazadoTitulo}>Comprobante rechazado</Text>
            {pago.rechazadoRazon
              ? <Text style={pv.rechazadoRazon}>Razón: {pago.rechazadoRazon}</Text>
              : null}
            <Text style={pv.rechazadoSub}>El inquilino debe subir nuevo comprobante</Text>
          </View>
        )}

        {pago.estado === 'pagado' && (
          <View style={pv.pagadoCard}>
            <Ionicons name="checkmark-circle" size={20} color="#4A9B6F" />
            <View style={{ flex: 1 }}>
              <Text style={pv.pagadoText}>Pago verificado el {formatFecha(pago.fechaPago)}</Text>
              <Text style={pv.pagadoSub}>Verificado por admin</Text>
            </View>
          </View>
        )}

        {(() => {
          const diasMora = pago.fechaVencimiento
            ? Math.floor((Date.now() - pago.fechaVencimiento.toMillis()) / 86_400_000)
            : 0;
          return diasMora >= 8 && pago.estado !== 'pagado' ? (
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 6,
              backgroundColor: 'rgba(103,0,16,0.12)',
              borderRadius: 6, padding: 10, marginTop: 8,
              borderWidth: 1, borderColor: cartasBosque.alertaBorde,
            }}>
              <Ionicons name="warning-outline" size={14} color={cartasBosque.alertaBorde} />
              <Text style={{ fontFamily: 'MonaSans_400Regular', fontSize: 10, color: cartasBosque.alertaBorde }}>
                Día {diasMora} sin pago — protocolo día 8 activo
              </Text>
            </View>
          ) : null;
        })()}

        {pago.estado !== 'pagado' && (
          <TouchableOpacity
            style={[pv.accionBtn, { backgroundColor: cartasBosque.alertaFondo, marginTop: 6 }]}
            onPress={handleDescontarPrenda}
          >
            <Text style={pv.accionBtnText}>Descontar prenda en garantía</Text>
          </TouchableOpacity>
        )}

        {pago.estado !== 'pagado' && (
          <TouchableOpacity
            style={[pv.accionBtn, { backgroundColor: cartasBosque.alertaBorde, marginTop: 6 }]}
            onPress={handleSuspenderCuenta}
          >
            <Text style={pv.accionBtnText}>Suspender cuenta</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

// ─── AdminPagoCard (mobile) ───────────────────────────────────

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

  const estadoColor = pago.estado === 'en_revision' ? '#3B82F6'
    : pago.estado === 'pagado'    ? '#4A9B6F'
    : pago.estado === 'rechazado' ? '#E05C2A'
    : pago.estado === 'vencido'   ? '#C0392B'
    : '#E8A838';

  const estadoLabel = pago.estado === 'en_revision' ? 'Por verificar'
    : pago.estado === 'pagado'    ? 'Pagado'
    : pago.estado === 'rechazado' ? 'Rechazado'
    : pago.estado === 'vencido'   ? `Vencido (${diasMora}d)`
    : 'Pendiente';

  return (
    <View style={[styles.adminCard, { borderLeftColor: estadoColor, borderLeftWidth: 4 }]}>
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

      {pago.comprobante && pago.estado === 'en_revision' && (
        <View style={[styles.comprobanteRow, esUrgente && styles.comprobanteRowUrgente]}>
          <Image source={{ uri: pago.comprobante }} style={styles.comprobanteMini} />
          <View style={{ flex: 1 }}>
            <Text style={styles.comprobanteLabel}>Comprobante recibido</Text>
            <Text style={styles.comprobanteDate}>{formatFecha(pago.comprobanteSubidoEn ?? null)}</Text>
          </View>
          <View style={styles.countdownPill}>
            <Ionicons name="hourglass-outline" size={12} color={esUrgente ? '#C0392B' : '#3B82F6'} />
            <Text style={[styles.countdownText, esUrgente && styles.countdownUrgente]}>
              {hrs}h
            </Text>
          </View>
        </View>
      )}

      {pago.estado === 'rechazado' && pago.rechazadoRazon && (
        <View style={styles.rechazadoBox}>
          <Ionicons name="close-circle-outline" size={14} color="#E05C2A" />
          <Text style={styles.rechazadoText}>{pago.rechazadoRazon}</Text>
        </View>
      )}

      {pago.estado === 'en_revision' && (
        <View style={styles.accionesRow}>
          <TouchableOpacity
            style={[styles.btnRechazar, procesando && { opacity: 0.5 }]}
            onPress={onRechazar}
            disabled={procesando}
            activeOpacity={0.8}
          >
            <Ionicons name="close" size={16} color="#C0392B" />
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

      <TouchableOpacity
        style={styles.scoreToggle}
        onPress={() => setShowScore(v => !v)}
        activeOpacity={0.75}
      >
        <Text style={styles.scoreToggleText}>
          {showScore ? 'Ocultar score' : 'Ajustar score'}
        </Text>
        <Ionicons name={showScore ? 'chevron-up' : 'chevron-down'} size={14} color={cartasBosque.helecho} />
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

// ─── StatCard ─────────────────────────────────────────────────

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
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);

  const [rechazarModalPagoId, setRechazarModalPagoId] = useState<string | null>(null);
  const [razonRechazo, setRazonRechazo] = useState('');

  const isWeb = Platform.OS === 'web';

  useEffect(() => {
    const unsub = listenTodosLosPagos(data => {
      setPagos(data);
      setLoading(false);
    });
    return unsub;
  }, []);

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

  const enRevision = pagos.filter(p => p.estado === 'en_revision');
  const vencidos   = pagos.filter(p => p.estado === 'vencido');
  const urgentes   = enRevision.filter(p => horasRestantes(p.comprobanteSubidoEn) <= 24);

  const pagosFiltrados = filtro === 'verificar'
    ? enRevision
    : filtro === 'vencidos'
    ? vencidos
    : pagos;

  const seleccionado = pagos.find(p => p.id === seleccionadoId) ?? null;

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

  // ── STATS & TABS (shared markup) ──────────────────────────────

  const statsSection = (
    <View style={styles.statsRow}>
      <StatCard label="Por verificar" value={enRevision.length} color="#3B82F6" icon="time-outline" />
      <StatCard label="Urgentes" value={urgentes.length} color="#E8A838" icon="warning-outline" />
      <StatCard label="Vencidos" value={vencidos.length} color="#C0392B" icon="alert-circle-outline" />
    </View>
  );

  const tabsSection = (
    <View style={styles.tabs}>
      {(['todos', 'verificar', 'vencidos'] as Filtro[]).map(f => (
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
  );

  // ── WEB LAYOUT ────────────────────────────────────────────────

  if (isWeb) {
    return (
      <>
        <View style={wl.root}>
          {/* Columna izquierda */}
          <View style={wl.left}>
            <View style={wl.leftHeader}>
              <Text style={styles.eyebrow}>{MESES[hoy.getMonth()]} {hoy.getFullYear()}</Text>
              <Text style={styles.title}>Pagos</Text>
            </View>
            {statsSection}
            {tabsSection}
            <ScrollView contentContainerStyle={{ padding: spacing[3] }}>
              {pagosFiltrados.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Ionicons name="checkmark-circle-outline" size={28} color={cartasBosque.helecho} />
                  <Text style={styles.emptyText}>
                    {filtro === 'verificar' ? 'Sin comprobantes pendientes' : 'Sin pagos en esta categoría'}
                  </Text>
                </View>
              ) : (
                pagosFiltrados.map(pago => (
                  <PagoCardLista
                    key={pago.id}
                    pago={pago}
                    seleccionado={seleccionadoId === pago.id}
                    onSelect={() => setSeleccionadoId(prev => prev === pago.id ? null : pago.id)}
                  />
                ))
              )}
              {__DEV__ && (
                <TouchableOpacity
                  style={styles.seedBtn}
                  onPress={() => seedDemoPagos(adminId).then(() => Alert.alert('Seed OK'))}
                >
                  <Text style={styles.seedText}>Dev: seed demo pagos</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>

          {/* Columna derecha */}
          <View style={wl.right}>
            <PanelVerificacion
              key={seleccionadoId ?? 'empty'}
              pago={seleccionado}
              todos={pagos}
              procesando={procesando}
              onVerificar={handleVerificar}
              onRechazar={id => { setRechazarModalPagoId(id); setRazonRechazo(''); }}
            />
          </View>
        </View>

        {/* Modal rechazo */}
        <Modal
          visible={!!rechazarModalPagoId}
          transparent
          animationType="slide"
          onRequestClose={() => setRechazarModalPagoId(null)}
        >
          <KeyboardAvoidingView behavior="padding" style={styles.modalOverlay}>
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
                <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setRechazarModalPagoId(null)}>
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

  // ── MOBILE LAYOUT ─────────────────────────────────────────────

  return (
    <>
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={cartasBosque.helecho} />}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>{MESES[hoy.getMonth()]} {hoy.getFullYear()}</Text>
          <Text style={styles.title}>Pagos</Text>
        </View>

        {statsSection}
        {tabsSection}

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

        {__DEV__ && (
          <TouchableOpacity
            style={styles.seedBtn}
            onPress={() => seedDemoPagos(adminId).then(() => Alert.alert('Seed OK'))}
          >
            <Text style={styles.seedText}>Dev: seed demo pagos</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

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
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setRechazarModalPagoId(null)}>
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

// ─── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: cartasBosque.bruma },
  content: { padding: spacing[5], paddingBottom: spacing[10] },
  center:  { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: cartasBosque.bruma },

  header:  { marginBottom: spacing[5] },
  eyebrow: { fontFamily: 'MonaSans_400Regular', fontSize: 11, color: cartasBosque.helecho, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: spacing[1] },
  title:   { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 26, color: cartasBosque.bosque, letterSpacing: -0.3 },

  statsRow: { flexDirection: 'row', gap: spacing[3], marginBottom: spacing[5] },
  statCard: {
    flex: 1, alignItems: 'center', gap: spacing[1],
    backgroundColor: cartasBosque.bruma, borderRadius: borderRadius.lg,
    padding: spacing[3], borderWidth: 1,
  },
  statValue: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 22 },
  statLabel: { fontFamily: 'MonaSans_400Regular', fontSize: 9, color: cartasBosque.helecho, textAlign: 'center', letterSpacing: 0.5 },

  tabs:          { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[5] },
  tab:           { flex: 1, alignItems: 'center', paddingVertical: spacing[2], borderRadius: borderRadius.full, backgroundColor: cartasBosque.bruma, borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro },
  tabActive:     { backgroundColor: cartasBosque.bosque, borderColor: cartasBosque.bosque },
  tabLabel:      { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: cartasBosque.helecho },
  tabLabelActive:{ color: cartasBosque.bruma },

  emptyCard: { alignItems: 'center', justifyContent: 'center', gap: spacing[3], backgroundColor: cartasBosque.bruma, borderRadius: borderRadius.xl, padding: spacing[8], borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro, borderStyle: 'dashed' },
  emptyText: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 14, color: cartasBosque.helecho },

  lista: { gap: spacing[4] },

  adminCard: {
    backgroundColor: cartasBosque.bruma, borderRadius: borderRadius.xl,
    padding: spacing[4], borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    shadowColor: cartasBosque.tinta, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2, gap: spacing[3],
  },
  cardHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardHeaderLeft:  { gap: spacing[1] },
  cardNombre:      { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 15, color: cartasBosque.tinta },
  cardHab:         { fontFamily: 'MonaSans_400Regular', fontSize: 10, color: cartasBosque.helecho, letterSpacing: 0.5 },
  estadoBadge:     { paddingHorizontal: spacing[3], paddingVertical: spacing[1], borderRadius: borderRadius.full },
  estadoLabelText: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 11 },
  divider:         { height: 1, backgroundColor: cartasBosque.pergaminoOscuro },

  cardMontoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  cardConcepto: { fontFamily: 'MonaSans_400Regular', fontSize: 10, color: cartasBosque.helecho, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing[1] },
  cardMonto:    { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 22, color: cartasBosque.tinta, letterSpacing: -0.3 },
  fechasCol:    { alignItems: 'flex-end' },
  fechaLabel:   { fontFamily: 'MonaSans_400Regular', fontSize: 9, color: cartasBosque.helecho, textTransform: 'uppercase', letterSpacing: 0.6 },
  fechaValue:   { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: cartasBosque.tinta },

  comprobanteRow:        { flexDirection: 'row', alignItems: 'center', gap: spacing[3], backgroundColor: '#E8EBE0', borderRadius: borderRadius.md, padding: spacing[3] },
  comprobanteRowUrgente: { backgroundColor: 'rgba(192,57,43,0.08)' },
  comprobanteMini:       { width: 40, height: 52, borderRadius: borderRadius.sm, backgroundColor: cartasBosque.pergaminoOscuro },
  comprobanteLabel:      { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: cartasBosque.tinta },
  comprobanteDate:       { fontFamily: 'MonaSans_400Regular', fontSize: 10, color: cartasBosque.helecho, marginTop: 2 },
  countdownPill:         { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: cartasBosque.bruma, borderRadius: borderRadius.full, paddingHorizontal: spacing[2], paddingVertical: spacing[1] },
  countdownText:         { fontFamily: 'MonaSans_400Regular', fontSize: 11, color: '#3B82F6' },
  countdownUrgente:      { color: '#C0392B' },

  rechazadoBox:  { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2], backgroundColor: 'rgba(224,92,42,0.1)', borderRadius: borderRadius.md, padding: spacing[3] },
  rechazadoText: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: '#E05C2A', flex: 1 },

  accionesRow:      { flexDirection: 'row', gap: spacing[3] },
  btnRechazar:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2], paddingVertical: spacing[3], borderRadius: borderRadius.md, borderWidth: 1.5, borderColor: '#C0392B' },
  btnRechazarText:  { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 14, color: '#C0392B' },
  btnVerificar:     { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2], paddingVertical: spacing[3], borderRadius: borderRadius.md, backgroundColor: '#4A9B6F' },
  btnVerificarText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 14, color: cartasBosque.bruma },

  scoreToggle:     { flexDirection: 'row', alignItems: 'center', gap: spacing[1], alignSelf: 'flex-start' },
  scoreToggleText: { fontFamily: 'MonaSans_400Regular', fontSize: 10, color: cartasBosque.helecho, letterSpacing: 0.5 },
  scoreRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  scoreChip:       { paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: borderRadius.full },
  scoreChipText:   { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 11 },

  seedBtn:  { marginTop: spacing[8], alignSelf: 'center', paddingVertical: spacing[2], paddingHorizontal: spacing[4], borderRadius: borderRadius.full, borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro },
  seedText: { fontFamily: 'MonaSans_400Regular', fontSize: 10, color: cartasBosque.helecho },

  modalOverlay:       { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(18,42,31,0.35)' },
  modalSheet:         { backgroundColor: cartasBosque.bruma, borderTopLeftRadius: borderRadius['2xl'], borderTopRightRadius: borderRadius['2xl'], padding: spacing[6], paddingBottom: spacing[8], gap: spacing[4] },
  modalHandle:        { width: 36, height: 4, borderRadius: 2, backgroundColor: cartasBosque.pergaminoOscuro, alignSelf: 'center', marginBottom: spacing[2] },
  modalTitle:         { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 18, color: cartasBosque.tinta },
  modalSubtitle:      { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: cartasBosque.helecho, lineHeight: 18 },
  modalInput:         { borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro, borderRadius: borderRadius.md, padding: spacing[3], fontFamily: 'BricolageGrotesque_400Regular', fontSize: 14, color: cartasBosque.tinta, minHeight: 80, textAlignVertical: 'top', backgroundColor: cartasBosque.pergamino },
  modalBtns:          { flexDirection: 'row', gap: spacing[3] },
  modalBtnCancel:     { flex: 1, paddingVertical: spacing[3], alignItems: 'center', borderRadius: borderRadius.md, borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro },
  modalBtnCancelText: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 14, color: cartasBosque.helecho },
  modalBtnReject:     { flex: 1, paddingVertical: spacing[3], alignItems: 'center', borderRadius: borderRadius.md, backgroundColor: '#C0392B' },
  modalBtnRejectText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 14, color: '#FFFFFF' },
});

// ─── Web layout styles ────────────────────────────────────────

const wl = StyleSheet.create({
  root:       { flex: 1, flexDirection: 'row', backgroundColor: cartasBosque.bruma },
  left:       { width: 380, flexShrink: 0, borderRightWidth: 1, borderRightColor: cartasBosque.pergaminoOscuro, backgroundColor: cartasBosque.pergamino },
  right:      { flex: 1, backgroundColor: cartasBosque.bruma },
  leftHeader: { paddingHorizontal: spacing[4], paddingTop: spacing[4], paddingBottom: spacing[3], borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro },
});

// ─── PagoCardLista styles ─────────────────────────────────────

const pl = StyleSheet.create({
  card: {
    backgroundColor: cartasBosque.pergamino, borderRadius: borderRadius.md,
    padding: spacing[3], marginBottom: spacing[2],
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    borderLeftWidth: 4,
  },
  cardSel: {
    borderColor: cartasBosque.bosque + '80',
    backgroundColor: '#E8EBE0' + '44',
  },
  top:     { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2] },
  nombre:  { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 14, color: cartasBosque.tinta, flexShrink: 1 },
  meta:    { fontFamily: 'MonaSans_400Regular', fontSize: 10, color: cartasBosque.helecho, marginTop: 2 },
  monto:   { fontFamily: 'MonaSans_400Regular', fontSize: 13, color: '#4A9B6F' },
  badge:   { borderRadius: borderRadius.sm, paddingHorizontal: spacing[2], paddingVertical: 2 },
  badgeText: { fontFamily: 'MonaSans_400Regular', fontSize: 8, letterSpacing: 0.4 },
  bottom:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing[2] },
  countdown: { fontFamily: 'MonaSans_400Regular', fontSize: 10 },
  comprobanteChip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#3B82F611', borderRadius: borderRadius.full, paddingHorizontal: spacing[2], paddingVertical: 2 },
  comprobanteChipText: { fontFamily: 'MonaSans_400Regular', fontSize: 9, color: '#3B82F6' },
});

// ─── PanelVerificacion styles ─────────────────────────────────

const pv = StyleSheet.create({
  container: { flex: 1 },
  content:   { padding: spacing[5], gap: spacing[4] },

  empty:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[3], padding: spacing[8] },
  emptyText: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 14, color: cartasBosque.helecho, textAlign: 'center' },

  panelHeader: {
    borderLeftWidth: 4, paddingLeft: spacing[3],
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3],
    backgroundColor: cartasBosque.pergamino, borderRadius: borderRadius.lg,
    padding: spacing[4], borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
  },
  panelNombre: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 18, color: cartasBosque.tinta },
  panelSub:    { fontFamily: 'MonaSans_400Regular', fontSize: 11, color: cartasBosque.helecho, marginTop: 2, marginBottom: spacing[2] },

  seccion:      { backgroundColor: cartasBosque.pergamino, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro, overflow: 'hidden', gap: spacing[2], padding: spacing[4] },
  seccionTitle: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: cartasBosque.tinta, marginBottom: spacing[1] },

  tabla:     { gap: 0 },
  datoRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing[2], borderBottomWidth: 1, borderBottomColor: cartasBosque.bruma },
  datoLabel: { fontFamily: 'MonaSans_400Regular', fontSize: 11, color: cartasBosque.helecho },
  datoValue: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: cartasBosque.tinta, flexShrink: 1, textAlign: 'right' },

  comprobanteCard:      { backgroundColor: '#F7F7F5', borderRadius: borderRadius.md, borderWidth: 1, borderColor: '#CDB29D', padding: spacing[3], gap: spacing[3] },
  comprobanteCardTitle: { fontFamily: 'MonaSans_400Regular', fontSize: 9, color: cartasBosque.helecho, letterSpacing: 0.8 },
  comprobanteImg:       { width: '100%', height: 300, borderRadius: borderRadius.md, backgroundColor: cartasBosque.pergaminoOscuro },
  verCompleto:          { flexDirection: 'row', alignItems: 'center', gap: spacing[1], alignSelf: 'flex-end' },
  verCompletoText:      { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: cartasBosque.bosque },
  comprobanteVacio:     { alignItems: 'center', gap: spacing[2], paddingVertical: spacing[4], borderWidth: 1, borderColor: '#CDB29D', borderRadius: borderRadius.md, borderStyle: 'dashed' },
  comprobanteVacioText: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: cartasBosque.helecho },

  histRow:     { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: spacing[2], borderBottomWidth: 1, borderBottomColor: cartasBosque.bruma },
  histConcepto:{ fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: cartasBosque.tinta },
  histFecha:   { fontFamily: 'MonaSans_400Regular', fontSize: 10, color: cartasBosque.helecho, marginTop: 1 },

  instruccionBox:  { backgroundColor: '#E8A83811', borderRadius: borderRadius.md, borderWidth: 1, borderColor: '#E8A83844', padding: spacing[3], marginBottom: spacing[3] },
  instruccionText: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: cartasBosque.helecho, lineHeight: 18 },

  btnVerificar:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2], backgroundColor: '#4A9B6F', borderRadius: borderRadius.md, height: 44, marginBottom: spacing[2] },
  btnVerificarText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 14, color: '#FFFFFF' },
  btnRechazar:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2], borderWidth: 1, borderColor: '#C0392B', borderRadius: borderRadius.md, height: 44 },
  btnRechazarText:  { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 14, color: '#C0392B' },

  rechazadoCard:  { backgroundColor: 'rgba(192,57,43,0.08)', borderRadius: borderRadius.md, borderWidth: 1, borderColor: '#C0392B44', padding: spacing[3], gap: spacing[1] },
  rechazadoTitulo:{ fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: '#C0392B' },
  rechazadoRazon: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: '#C0392B' },
  rechazadoSub:   { fontFamily: 'MonaSans_400Regular', fontSize: 10, color: cartasBosque.helecho, marginTop: spacing[1] },

  pagadoCard: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], backgroundColor: 'rgba(74,155,111,0.1)', borderRadius: borderRadius.md, borderWidth: 1, borderColor: '#4A9B6F44', padding: spacing[3] },
  pagadoText: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: '#4A9B6F' },
  pagadoSub:  { fontFamily: 'MonaSans_400Regular', fontSize: 10, color: cartasBosque.helecho, marginTop: 1 },

  accionBtn:     { borderRadius: borderRadius.md, height: 44, alignItems: 'center', justifyContent: 'center' },
  accionBtnText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: cartasBosque.bruma },
});
