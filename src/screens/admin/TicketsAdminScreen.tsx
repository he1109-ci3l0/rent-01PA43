import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  Modal, ScrollView, ActivityIndicator, Alert, Switch, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { cartasBosque } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/spacing';
import TicketCard from '@/components/common/TicketCard';
import {
  listenTodosTickets, actualizarEstado, agregarEtiqueta, quitarEtiqueta,
  actualizarDecisionAdmin,
  CATEGORIA_LABELS, ESTADO_LABELS, ETIQUETA_LABELS,
} from '@/services/firebase/tickets';
import type {
  Ticket, CategoriaTicket, EstadoTicket, EtiquetaTicket,
} from '@/types/firestore';

const CATEGORIAS_FILTER: Array<CategoriaTicket | 'todas'> = [
  'todas', 'internet', 'pago', 'reporte_limpieza', 'reporte_inquilino',
  'lavadora', 'almacenamiento', 'mantenimiento',
];
const ESTADOS_FILTER: Array<EstadoTicket | 'todos'> = ['todos', 'en_revision', 'en_proceso', 'resuelto'];
const ETIQUETAS: EtiquetaTicket[] = ['mal_uso', 'admin_cubre', 'sin_culpa', 'reportar_proveedor'];

const ETIQUETA_COLORES: Record<EtiquetaTicket, string> = {
  mal_uso:            '#F5DAD8',
  admin_cubre:        '#D6E8F5',
  sin_culpa:          '#D6EDD9',
  reportar_proveedor: '#EEE5F8',
};

const ESTADO_COLORES: Record<EstadoTicket, { bg: string; text: string }> = {
  en_revision: { bg: '#F5E8C8', text: '#B07D2A' },
  en_proceso:  { bg: '#D6E8F5', text: '#2A5EB0' },
  resuelto:    { bg: '#D6EDD9', text: '#3A7D44' },
};

// ─── Modal detalle ────────────────────────────────────────────

function ModalDetalle({
  ticket, visible, onClose,
}: {
  ticket: Ticket | null;
  visible: boolean;
  onClose: () => void;
}) {
  const [guardando, setGuardando] = useState(false);
  const [notasAdmin, setNotasAdmin] = useState('');

  useEffect(() => {
    if (ticket) setNotasAdmin(ticket.notasAdmin ?? '');
  }, [ticket?.id]);

  if (!ticket) return null;

  async function cambiarEstado(est: EstadoTicket) {
    if (!ticket) return;
    setGuardando(true);
    try { await actualizarEstado(ticket.id, est); }
    catch { Alert.alert('Error', 'No se pudo cambiar el estado.'); }
    finally { setGuardando(false); }
  }

  async function toggleEtiqueta(e: EtiquetaTicket) {
    if (!ticket) return;
    try {
      if (ticket.etiquetas.includes(e)) await quitarEtiqueta(ticket.id, e);
      else                              await agregarEtiqueta(ticket.id, e);
    } catch { Alert.alert('Error', 'No se pudo actualizar la etiqueta.'); }
  }

  async function guardarDecision() {
    if (!ticket) return;
    setGuardando(true);
    try {
      await actualizarDecisionAdmin(ticket.id, {
        afectaScore:      ticket.afectaScore,
        afectaExpediente: ticket.afectaExpediente,
        notasAdmin,
      });
      Alert.alert('Guardado', 'Cambios guardados correctamente.');
      onClose();
    } catch { Alert.alert('Error', 'No se pudo guardar.'); }
    finally { setGuardando(false); }
  }

  async function toggleAfectaScore() {
    if (!ticket) return;
    try { await actualizarDecisionAdmin(ticket.id, { afectaScore: !ticket.afectaScore }); }
    catch { Alert.alert('Error', 'No se pudo actualizar.'); }
  }

  async function toggleAfectaExpediente() {
    if (!ticket) return;
    try { await actualizarDecisionAdmin(ticket.id, { afectaExpediente: !ticket.afectaExpediente }); }
    catch { Alert.alert('Error', 'No se pudo actualizar.'); }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        <Text style={styles.sheetTitulo}>Ticket {ticket.folio.slice(-9)}</Text>
        <Text style={styles.sheetSub}>
          {CATEGORIA_LABELS[ticket.categoria]} · Hab. {ticket.habitacionNumero} · {ticket.inquilinoNombre}
        </Text>

        {/* Estado */}
        <Text style={styles.sheetLabel}>ESTADO</Text>
        <View style={styles.estadosRow}>
          {(Object.keys(ESTADO_LABELS) as EstadoTicket[]).map(est => {
            const col = ESTADO_COLORES[est];
            const activo = ticket.estado === est;
            return (
              <TouchableOpacity
                key={est}
                style={[styles.estadoBtn, activo && { backgroundColor: col.bg, borderColor: col.text }]}
                onPress={() => cambiarEstado(est)}
              >
                <Text style={[styles.estadoBtnText, activo && { color: col.text }]}>
                  {ESTADO_LABELS[est]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Etiquetas internas */}
        <Text style={styles.sheetLabel}>ETIQUETAS INTERNAS</Text>
        <View style={styles.etiquetasGrid}>
          {ETIQUETAS.map(e => {
            const activa = ticket.etiquetas.includes(e);
            return (
              <TouchableOpacity
                key={e}
                style={[styles.etiquetaBtn, activa && { backgroundColor: ETIQUETA_COLORES[e] }]}
                onPress={() => toggleEtiqueta(e)}
              >
                <Text style={styles.etiquetaBtnText}>{ETIQUETA_LABELS[e]}</Text>
                {activa && <Ionicons name="checkmark" size={12} color={cartasBosque.tinta} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Decisiones admin */}
        <Text style={styles.sheetLabel}>IMPACTO</Text>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Afecta score</Text>
          <Switch
            value={ticket.afectaScore}
            onValueChange={toggleAfectaScore}
            thumbColor={ticket.afectaScore ? cartasBosque.bosque : cartasBosque.niebla}
            trackColor={{ true: cartasBosque.bosque + '55', false: cartasBosque.niebla + '55' }}
          />
        </View>
        <View style={[styles.switchRow, { marginTop: spacing[1] }]}>
          <Text style={styles.switchLabel}>Afecta expediente</Text>
          <Switch
            value={ticket.afectaExpediente}
            onValueChange={toggleAfectaExpediente}
            thumbColor={ticket.afectaExpediente ? cartasBosque.bosque : cartasBosque.niebla}
            trackColor={{ true: cartasBosque.bosque + '55', false: cartasBosque.niebla + '55' }}
          />
        </View>

        {/* Notas admin */}
        <Text style={[styles.sheetLabel, { marginTop: spacing[3] }]}>NOTAS INTERNAS</Text>
        <TextInput
          style={styles.notasInput}
          value={notasAdmin}
          onChangeText={setNotasAdmin}
          multiline
          numberOfLines={3}
          placeholder="Notas privadas del admin…"
          placeholderTextColor={cartasBosque.niebla}
        />

        <TouchableOpacity
          style={[styles.btnGuardar, guardando && { opacity: 0.5 }]}
          onPress={guardarDecision}
          disabled={guardando}
        >
          {guardando
            ? <ActivityIndicator color={cartasBosque.bruma} />
            : <Text style={styles.btnGuardarText}>Guardar cambios</Text>
          }
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ─── Pantalla principal ───────────────────────────────────────

export default function TicketsAdminScreen() {
  const [tickets, setTickets]           = useState<Ticket[]>([]);
  const [cargando, setCargando]         = useState(true);
  const [filtroCat, setFiltroCat]       = useState<CategoriaTicket | 'todas'>('todas');
  const [filtroEst, setFiltroEst]       = useState<EstadoTicket | 'todos'>('todos');
  const [ticketDetalle, setTicketDetalle] = useState<Ticket | null>(null);

  useEffect(() => {
    const filtros: { categoria?: CategoriaTicket; estado?: EstadoTicket } = {};
    if (filtroCat !== 'todas') filtros.categoria = filtroCat;
    if (filtroEst !== 'todos') filtros.estado    = filtroEst;
    setCargando(true);
    const unsub = listenTodosTickets(data => {
      setTickets(data);
      setCargando(false);
    }, filtros);
    return unsub;
  }, [filtroCat, filtroEst]);

  const conteos = {
    en_revision: tickets.filter(t => t.estado === 'en_revision').length,
    en_proceso:  tickets.filter(t => t.estado === 'en_proceso').length,
    resuelto:    tickets.filter(t => t.estado === 'resuelto').length,
  };

  return (
    <View style={{ flex: 1, backgroundColor: cartasBosque.bruma }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: cartasBosque.bruma }}>

        {/* Contadores rápidos */}
        <View style={styles.contadoresRow}>
          {(Object.keys(conteos) as EstadoTicket[]).map(est => {
            const col = ESTADO_COLORES[est];
            return (
              <View key={est} style={[styles.contador, { backgroundColor: col.bg }]}>
                <Text style={[styles.contadorNum, { color: col.text }]}>{conteos[est]}</Text>
                <Text style={[styles.contadorLabel, { color: col.text }]}>{ESTADO_LABELS[est]}</Text>
              </View>
            );
          })}
        </View>

        {/* Filtro estado */}
        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
          style={styles.filtroBar}
          contentContainerStyle={{ paddingHorizontal: spacing[4], gap: spacing[2] }}
        >
          {ESTADOS_FILTER.map(est => (
            <TouchableOpacity
              key={est}
              style={[styles.chip, filtroEst === est && styles.chipActivo]}
              onPress={() => setFiltroEst(est)}
            >
              <Text style={[styles.chipText, filtroEst === est && styles.chipTextActivo]}>
                {est === 'todos' ? 'Todos' : ESTADO_LABELS[est]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Filtro categoría */}
        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
          style={[styles.filtroBar, { borderTopWidth: 0 }]}
          contentContainerStyle={{ paddingHorizontal: spacing[4], gap: spacing[2] }}
        >
          {CATEGORIAS_FILTER.map(cat => (
            <TouchableOpacity
              key={cat}
              style={[styles.chip, filtroCat === cat && styles.chipActivo]}
              onPress={() => setFiltroCat(cat)}
            >
              <Text style={[styles.chipText, filtroCat === cat && styles.chipTextActivo]}>
                {cat === 'todas' ? 'Todas' : CATEGORIA_LABELS[cat]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </SafeAreaView>

      {cargando ? (
        <ActivityIndicator color={cartasBosque.bosque} style={{ marginTop: spacing[8] }} />
      ) : tickets.length === 0 ? (
        <View style={styles.vacio}>
          <Ionicons name="headset-outline" size={36} color={cartasBosque.niebla} />
          <Text style={styles.vacioText}>Sin tickets en este filtro</Text>
        </View>
      ) : (
        <FlatList
          data={tickets}
          keyExtractor={t => t.id}
          contentContainerStyle={{ padding: spacing[4], paddingBottom: spacing[10] }}
          renderItem={({ item }) => (
            <TicketCard ticket={item} esAdmin onPress={setTicketDetalle} />
          )}
        />
      )}

      <ModalDetalle
        ticket={ticketDetalle}
        visible={ticketDetalle !== null}
        onClose={() => setTicketDetalle(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  contadoresRow: {
    flexDirection: 'row', paddingHorizontal: spacing[4],
    paddingVertical: spacing[2], gap: spacing[2],
  },
  contador: {
    flex: 1, alignItems: 'center', paddingVertical: spacing[2],
    borderRadius: borderRadius.sm,
  },
  contadorNum:   { fontFamily: 'DMSans_600SemiBold', fontSize: 20 },
  contadorLabel: { fontFamily: 'DMMono_400Regular', fontSize: 9, letterSpacing: 0.3 },

  filtroBar: {
    borderTopWidth: 1, borderTopColor: cartasBosque.pergaminoOscuro,
    paddingVertical: spacing[2],
  },
  chip: {
    paddingHorizontal: spacing[3], paddingVertical: spacing[1] + 2,
    borderRadius: borderRadius.xl, borderWidth: 1,
    borderColor: cartasBosque.pergaminoOscuro,
    backgroundColor: cartasBosque.pergamino,
  },
  chipActivo:    { backgroundColor: cartasBosque.bosque, borderColor: cartasBosque.bosque },
  chipText:      { fontFamily: 'DMMono_400Regular', fontSize: 10, color: cartasBosque.helecho },
  chipTextActivo:{ color: cartasBosque.bruma },

  vacio:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[2] },
  vacioText: { fontFamily: 'DMSans_400Regular', fontSize: 14, color: cartasBosque.helecho },

  // Modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: cartasBosque.bruma,
    borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl,
    padding: spacing[5], paddingBottom: spacing[8],
    maxHeight: '85%',
  },
  sheetTitulo: { fontFamily: 'DMSans_600SemiBold', fontSize: 17, color: cartasBosque.tinta },
  sheetSub: {
    fontFamily: 'DMSans_400Regular', fontSize: 12, color: cartasBosque.helecho,
    marginTop: spacing[1], marginBottom: spacing[3],
  },
  sheetLabel: {
    fontFamily: 'DMMono_400Regular', fontSize: 10, color: cartasBosque.helecho,
    letterSpacing: 0.5, marginBottom: spacing[2],
  },

  estadosRow:  { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[3] },
  estadoBtn: {
    flex: 1, paddingVertical: spacing[2], alignItems: 'center',
    borderRadius: borderRadius.sm, borderWidth: 1,
    borderColor: cartasBosque.pergaminoOscuro,
    backgroundColor: cartasBosque.pergamino,
  },
  estadoBtnText: { fontFamily: 'DMMono_400Regular', fontSize: 10, color: cartasBosque.helecho },

  etiquetasGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginBottom: spacing[3],
  },
  etiquetaBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing[2], paddingVertical: spacing[1] + 1,
    borderRadius: borderRadius.sm, borderWidth: 1,
    borderColor: cartasBosque.pergaminoOscuro,
    backgroundColor: cartasBosque.pergamino,
  },
  etiquetaBtnText: { fontFamily: 'DMMono_400Regular', fontSize: 10, color: cartasBosque.tinta },

  switchRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchLabel:{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: cartasBosque.tinta },

  notasInput: {
    backgroundColor: cartasBosque.pergamino, borderWidth: 1,
    borderColor: cartasBosque.pergaminoOscuro, borderRadius: borderRadius.sm,
    padding: spacing[3], fontFamily: 'DMSans_400Regular', fontSize: 13,
    color: cartasBosque.tinta, minHeight: 80, textAlignVertical: 'top',
    marginBottom: spacing[3],
  },
  btnGuardar: {
    backgroundColor: cartasBosque.bosque, borderRadius: borderRadius.sm,
    paddingVertical: spacing[3], alignItems: 'center',
  },
  btnGuardarText: { fontFamily: 'DMSans_600SemiBold', fontSize: 14, color: cartasBosque.bruma },
});
