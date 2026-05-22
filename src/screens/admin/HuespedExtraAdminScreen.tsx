import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { cartasBosque } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/spacing';
import { useAuth } from '@/hooks/useAuth';
import {
  listenTodosHuespedes, autorizarHuesped, rechazarHuesped, seedHuespedes,
} from '@/services/firebase/huespedes';
import { TABLA_COBROS } from '@/services/firebase/huespedes';
import type { HuespedExtra } from '@/types/firestore';

type Filtro = 'pendientes' | 'activos' | 'todos';

const FILTROS: { key: Filtro; label: string }[] = [
  { key: 'pendientes', label: 'Pendientes' },
  { key: 'activos',    label: 'Activos' },
  { key: 'todos',      label: 'Todos' },
];

const ESTADO_LABEL: Record<string, string> = {
  pendiente_auth: 'Pen. auth',
  activo:         'Activo',
  incorporado:    'Mensual',
  inactivo:       'Inactivo',
};

const ESTADO_COLORS: Record<string, { bg: string; txt: string; border: string }> = {
  pendiente_auth: { bg: 'rgba(205,178,157,0.15)', txt: '#8A6A72',    border: '#CDB29D60' },
  activo:         { bg: '#E8EBE0', txt: '#122A1F',    border: '#4A5E4840' },
  incorporado:    { bg: '#E8EBE0', txt: '#122A1F',    border: '#4A5E4840' },
  inactivo:       { bg: cartasBosque.pergaminoOscuro, txt: cartasBosque.musgo, border: cartasBosque.helecho + '60' },
};

export default function HuespedExtraAdminScreen() {
  const { user } = useAuth();
  const adminUid = user?.uid ?? '';

  const [huespedes, setHuespedes] = useState<HuespedExtra[]>([]);
  const [filtro, setFiltro] = useState<Filtro>('pendientes');
  const [rechazarId, setRechazarId] = useState<string | null>(null);
  const [rechazarNombre, setRechazarNombre] = useState('');
  const [notas, setNotas] = useState('');
  const [procesando, setProcesando] = useState<string | null>(null);
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (__DEV__ && !seeded) {
      seedHuespedes().catch(() => {}).finally(() => setSeeded(true));
    }
    return listenTodosHuespedes(setHuespedes);
  }, []);

  const pendientes = huespedes.filter(h => h.estado === 'pendiente_auth');
  const activos    = huespedes.filter(h => h.estado === 'activo' && h.activo);
  const todos      = huespedes;

  const listaMostrada =
    filtro === 'pendientes' ? pendientes :
    filtro === 'activos'    ? activos    : todos;

  async function handleAutorizar(h: HuespedExtra) {
    setProcesando(h.id);
    try {
      await autorizarHuesped(h.id, adminUid);
    } catch {
      Alert.alert('Error', 'No se pudo autorizar el huésped.');
    } finally {
      setProcesando(null);
    }
  }

  function abrirRechazar(h: HuespedExtra) {
    setRechazarId(h.id);
    setRechazarNombre(`${h.nombre} ${h.apellido}`);
    setNotas('');
  }

  async function handleRechazar() {
    if (!rechazarId || !notas.trim()) {
      Alert.alert('Motivo requerido', 'Ingresa el motivo del rechazo.');
      return;
    }
    setProcesando(rechazarId);
    try {
      await rechazarHuesped(rechazarId, adminUid, notas.trim());
      setRechazarId(null);
    } catch {
      Alert.alert('Error', 'No se pudo rechazar el huésped.');
    } finally {
      setProcesando(null);
    }
  }

  const stats = {
    pendientes: pendientes.length,
    activos: activos.length,
    total: todos.length,
  };

  return (
    <>
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Admin</Text>
          <Text style={styles.title}>Huéspedes Extra</Text>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <StatBox label="Pendientes" value={stats.pendientes} alert={stats.pendientes > 0} />
          <StatBox label="Activos" value={stats.activos} />
          <StatBox label="Total" value={stats.total} />
        </View>

        {/* Filtro tabs */}
        <View style={styles.filterRow}>
          {FILTROS.map(f => (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterTab, filtro === f.key && styles.filterTabActive]}
              onPress={() => setFiltro(f.key)}
            >
              <Text style={[styles.filterTxt, filtro === f.key && styles.filterTxtActive]}>
                {f.label}
                {f.key === 'pendientes' && stats.pendientes > 0 && (
                  ` (${stats.pendientes})`
                )}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Lista */}
        {listaMostrada.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={36} color={cartasBosque.niebla} />
            <Text style={styles.emptyTxt}>Sin huéspedes en esta categoría</Text>
          </View>
        ) : (
          <View style={styles.lista}>
            {listaMostrada.map(h => (
              <HuespedCard
                key={h.id}
                huesped={h}
                procesando={procesando === h.id}
                onAutorizar={() => handleAutorizar(h)}
                onRechazar={() => abrirRechazar(h)}
              />
            ))}
          </View>
        )}

        {/* Tabla referencia */}
        <View style={styles.refBox}>
          <Text style={styles.refLabel}>REFERENCIA · TABLA DE COBROS</Text>
          {([1, 2, 3, 4] as const).map(s => {
            const c = TABLA_COBROS[s];
            return (
              <View key={s} style={styles.refRow}>
                <Text style={styles.refSemana}>{c.label} · {c.diasRango}</Text>
                <Text style={styles.refMonto}>
                  {c.semana > 0 ? `$${c.semana}/sem` : 'auto'} · ${c.mensual}/mes
                </Text>
                {c.requiereAuth && (
                  <View style={styles.authPill}>
                    <Ionicons name="lock-closed" size={10} color={cartasBosque.corteza} />
                    <Text style={styles.authPillTxt}>auth</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Modal rechazo */}
      <Modal
        visible={rechazarId !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setRechazarId(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Rechazar huésped</Text>
            <Text style={styles.modalSub}>{rechazarNombre}</Text>

            <Text style={styles.inputLabel}>Motivo del rechazo *</Text>
            <TextInput
              style={styles.notasInput}
              value={notas}
              onChangeText={setNotas}
              placeholder="Ej: Documentación incompleta, límite de ocupantes..."
              placeholderTextColor={cartasBosque.helecho}
              multiline
              numberOfLines={3}
              autoFocus
            />

            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.modalBtnCancel}
                onPress={() => setRechazarId(null)}
              >
                <Text style={styles.modalBtnCancelTxt}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtnRechazar, procesando !== null && { opacity: 0.5 }]}
                onPress={handleRechazar}
                disabled={procesando !== null}
              >
                {procesando !== null
                  ? <ActivityIndicator size="small" color={cartasBosque.bruma} />
                  : <Text style={styles.modalBtnRechazarTxt}>Rechazar</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────

function StatBox({ label, value, alert: alerta }: { label: string; value: number; alert?: boolean }) {
  return (
    <View style={[statStyles.box, alerta && statStyles.boxAlert]}>
      <Text style={[statStyles.value, alerta && statStyles.valueAlert]}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  box: {
    flex: 1, backgroundColor: cartasBosque.bruma,
    borderRadius: borderRadius.lg, borderWidth: 1,
    borderColor: cartasBosque.pergaminoOscuro,
    padding: spacing[3], alignItems: 'center', gap: 2,
  },
  boxAlert: { backgroundColor: 'rgba(205,178,157,0.15)', borderColor: '#CDB29D60' },
  value: {
    fontFamily: 'Inter_700Bold', fontSize: 24,
    color: cartasBosque.bosque,
  },
  valueAlert: { color: '#8A6A72' },
  label: {
    fontFamily: 'SpaceMono_400Regular', fontSize: 9,
    color: cartasBosque.helecho, letterSpacing: 0.5,
  },
});

interface CardProps {
  huesped: HuespedExtra;
  procesando: boolean;
  onAutorizar: () => void;
  onRechazar: () => void;
}

function HuespedCard({ huesped: h, procesando, onAutorizar, onRechazar }: CardProps) {
  const ec = ESTADO_COLORS[h.estado] ?? ESTADO_COLORS.inactivo;
  const semanaInfo = TABLA_COBROS[h.semanaIngreso];
  const esPendiente = h.estado === 'pendiente_auth';

  return (
    <View style={cardStyles.card}>
      {/* Fila principal */}
      <View style={cardStyles.row}>
        <View style={[cardStyles.avatar, { backgroundColor: ec.bg }]}>
          <Text style={[cardStyles.iniciales, { color: ec.txt }]}>
            {h.nombre[0]}{h.apellido[0]}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={cardStyles.nombre}>{h.nombre} {h.apellido}</Text>
          <Text style={cardStyles.sub}>
            Hab. {h.habitacionNumero ?? h.habitacionId} · {h.inquilinoNombre ?? h.inquilinoId}
          </Text>
          <Text style={cardStyles.sub}>
            {h.documentoTipo} {h.documentoNumero}
            {h.parentesco ? ` · ${h.parentesco}` : ''}
          </Text>
        </View>
        <View style={[cardStyles.estadoBadge, { backgroundColor: ec.bg, borderColor: ec.border }]}>
          <Text style={[cardStyles.estadoTxt, { color: ec.txt }]}>{ESTADO_LABEL[h.estado]}</Text>
        </View>
      </View>

      {/* Info semana */}
      <View style={cardStyles.semanaRow}>
        <View style={cardStyles.semanaChip}>
          <Text style={cardStyles.semanaChipTxt}>
            {semanaInfo.label} · {semanaInfo.diasRango}
          </Text>
        </View>
        <Text style={cardStyles.montoTxt}>
          ${h.montoSemana > 0 ? `${h.montoSemana}/sem` : '—'} · ${h.montoMensual}/mes
        </Text>
      </View>

      {/* Notas admin si existe */}
      {h.adminNotas && (
        <View style={cardStyles.notasBox}>
          <Ionicons name="document-text-outline" size={12} color={cartasBosque.helecho} />
          <Text style={cardStyles.notasTxt}>{h.adminNotas}</Text>
        </View>
      )}

      {/* Botones autorización */}
      {esPendiente && (
        <View style={cardStyles.btns}>
          <TouchableOpacity
            style={[cardStyles.btnRechazar, procesando && { opacity: 0.4 }]}
            onPress={onRechazar}
            disabled={procesando}
          >
            <Text style={cardStyles.btnRechazarTxt}>Rechazar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[cardStyles.btnAutorizar, procesando && { opacity: 0.4 }]}
            onPress={onAutorizar}
            disabled={procesando}
          >
            {procesando
              ? <ActivityIndicator size="small" color={cartasBosque.bruma} />
              : <>
                  <Ionicons name="checkmark" size={14} color={cartasBosque.bruma} />
                  <Text style={cardStyles.btnAutorizarTxt}>Autorizar</Text>
                </>
            }
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: cartasBosque.bruma,
    borderRadius: borderRadius.lg, borderWidth: 1,
    borderColor: cartasBosque.pergaminoOscuro,
    padding: spacing[4], gap: spacing[3],
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  iniciales: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  nombre: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: cartasBosque.tinta },
  sub: { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.helecho },
  estadoBadge: {
    paddingHorizontal: spacing[2], paddingVertical: spacing[0.5],
    borderRadius: borderRadius.full, borderWidth: 1,
  },
  estadoTxt: { fontFamily: 'SpaceMono_400Regular', fontSize: 10 },
  semanaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  semanaChip: {
    backgroundColor: cartasBosque.pergaminoOscuro,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing[2], paddingVertical: spacing[0.5],
  },
  semanaChipTxt: { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.musgo },
  montoTxt: { fontFamily: 'SpaceMono_400Regular', fontSize: 11, color: cartasBosque.bosque },
  notasBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2],
    backgroundColor: cartasBosque.pergaminoOscuro,
    borderRadius: borderRadius.md, padding: spacing[2],
  },
  notasTxt: {
    fontFamily: 'SpaceMono_400Regular', fontSize: 10,
    color: cartasBosque.musgo, flex: 1,
  },
  btns: { flexDirection: 'row', gap: spacing[3] },
  btnRechazar: {
    flex: 1, paddingVertical: spacing[2.5], alignItems: 'center',
    borderRadius: borderRadius.md, borderWidth: 1,
    borderColor: cartasBosque.corteza + '60',
  },
  btnRechazarTxt: { fontFamily: 'Inter_500Medium', fontSize: 13, color: cartasBosque.corteza },
  btnAutorizar: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing[2], paddingVertical: spacing[2.5],
    borderRadius: borderRadius.md, backgroundColor: cartasBosque.bosque,
  },
  btnAutorizarTxt: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: cartasBosque.bruma },
});

// ─── Estilos pantalla ─────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: cartasBosque.bruma },
  content: { padding: spacing[5], paddingBottom: spacing[12], gap: spacing[5] },

  header: { gap: spacing[1] },
  eyebrow: {
    fontFamily: 'SpaceMono_400Regular', fontSize: 10,
    color: cartasBosque.musgo, letterSpacing: 1.5, textTransform: 'uppercase',
  },
  title: {
    fontFamily: 'Inter_700Bold', fontSize: 26,
    color: cartasBosque.bosque, letterSpacing: -0.3,
  },

  statsRow: { flexDirection: 'row', gap: spacing[3] },

  filterRow: {
    flexDirection: 'row', gap: spacing[2],
    backgroundColor: cartasBosque.pergaminoOscuro,
    borderRadius: borderRadius.lg, padding: spacing[1],
  },
  filterTab: {
    flex: 1, paddingVertical: spacing[2], alignItems: 'center',
    borderRadius: borderRadius.md,
  },
  filterTabActive: { backgroundColor: cartasBosque.bruma },
  filterTxt: {
    fontFamily: 'SpaceMono_400Regular', fontSize: 11, color: cartasBosque.helecho,
  },
  filterTxtActive: { color: cartasBosque.bosque, fontFamily: 'Inter_600SemiBold' },

  lista: { gap: spacing[3] },

  empty: {
    alignItems: 'center', gap: spacing[3],
    paddingVertical: spacing[12],
  },
  emptyTxt: {
    fontFamily: 'SpaceMono_400Regular', fontSize: 13, color: cartasBosque.helecho,
  },

  // Referencia
  refBox: {
    backgroundColor: cartasBosque.bruma,
    borderRadius: borderRadius.lg, borderWidth: 1,
    borderColor: cartasBosque.pergaminoOscuro,
    padding: spacing[4], gap: spacing[2],
  },
  refLabel: {
    fontFamily: 'SpaceMono_400Regular', fontSize: 9,
    color: cartasBosque.helecho, letterSpacing: 1,
  },
  refRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  refSemana: { flex: 1, fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.tinta },
  refMonto: { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.bosque },
  authPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(205,178,157,0.15)', borderRadius: borderRadius.full,
    paddingHorizontal: spacing[2], paddingVertical: spacing[0.5],
  },
  authPillTxt: { fontFamily: 'SpaceMono_400Regular', fontSize: 9, color: cartasBosque.corteza },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(18,42,31,0.35)' },
  modalSheet: {
    backgroundColor: cartasBosque.bruma,
    borderTopLeftRadius: borderRadius['2xl'],
    borderTopRightRadius: borderRadius['2xl'],
    padding: spacing[6], paddingBottom: spacing[10], gap: spacing[4],
  },
  modalHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: cartasBosque.pergaminoOscuro,
    alignSelf: 'center', marginBottom: spacing[2],
  },
  modalTitle: { fontFamily: 'Inter_700Bold', fontSize: 18, color: cartasBosque.tinta },
  modalSub: { fontFamily: 'SpaceMono_400Regular', fontSize: 12, color: cartasBosque.helecho, marginTop: -spacing[2] },
  inputLabel: { fontFamily: 'SpaceMono_400Regular', fontSize: 11, color: cartasBosque.musgo, letterSpacing: 0.5 },
  notasInput: {
    backgroundColor: cartasBosque.pergamino,
    borderWidth: 1.5, borderColor: cartasBosque.pergaminoOscuro,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    fontFamily: 'Inter_400Regular', fontSize: 14, color: cartasBosque.tinta,
    minHeight: 80, textAlignVertical: 'top',
  },
  modalBtns: { flexDirection: 'row', gap: spacing[3] },
  modalBtnCancel: {
    flex: 1, paddingVertical: spacing[3], alignItems: 'center',
    borderRadius: borderRadius.md, borderWidth: 1,
    borderColor: cartasBosque.pergaminoOscuro,
  },
  modalBtnCancelTxt: { fontFamily: 'Inter_500Medium', fontSize: 14, color: cartasBosque.musgo },
  modalBtnRechazar: {
    flex: 1, paddingVertical: spacing[3], alignItems: 'center',
    borderRadius: borderRadius.md, backgroundColor: cartasBosque.corteza,
  },
  modalBtnRechazarTxt: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: cartasBosque.bruma },
});
