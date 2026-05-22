import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, ActivityIndicator, useWindowDimensions, RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { cartasBosque } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/spacing';
import { HabitacionCell } from '@/components/common/HabitacionCard';
import CatalogoScreen from './CatalogoScreen';
import {
  listenHabitaciones, seedHabitaciones, cambiarEstado,
  ESTADO_COLOR, ESTADO_LABEL,
} from '@/services/firebase/habitaciones';
import type { Habitacion, EstadoHabitacion } from '@/types/firestore';
import { useAuth } from '@/hooks/useAuth';

// ─── Constantes de layout ─────────────────────────────────────

const H_PADDING = spacing[5];   // 20pt
const GAP = spacing[2];         // 8pt
const CELL_H = 88;

// ─── Componente principal ─────────────────────────────────────

export default function HabitacionesScreen() {
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const [rooms, setRooms] = useState<Habitacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [seeded, setSeeded] = useState(false);

  // Modal detalle
  const [selected, setSelected] = useState<Habitacion | null>(null);
  const [cambiandoEstado, setCambiandoEstado] = useState(false);

  // Modal catálogo
  const [showCatalogo, setShowCatalogo] = useState(false);

  // ── Listener ──────────────────────────────────────────────────
  useEffect(() => {
    const unsub = listenHabitaciones(data => {
      setRooms(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  // ── Seed demo ─────────────────────────────────────────────────
  useEffect(() => {
    if (!loading && rooms.length === 0 && __DEV__ && !seeded) {
      setSeeded(true);
      seedHabitaciones().catch(() => {});
    }
  }, [loading, rooms.length, seeded]);

  // ── Refrescar ─────────────────────────────────────────────────
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  }, []);

  // ── Cambiar estado ────────────────────────────────────────────
  const handleCambiarEstado = async (estado: EstadoHabitacion) => {
    if (!selected) return;
    setCambiandoEstado(true);
    try {
      await cambiarEstado(selected.id, estado);
      setSelected(prev => prev ? { ...prev, estado } : null);
    } catch {
      Alert.alert('Error', 'No se pudo cambiar el estado.');
    } finally {
      setCambiandoEstado(false);
    }
  };

  // ── Widths de celdas por piso ─────────────────────────────────
  const contentW = width - H_PADDING * 2;
  const cellW3 = (contentW - GAP * 2) / 3;   // PB: 3 cols
  const cellW4 = (contentW - GAP * 3) / 4;   // P1/TP: 4 cols

  // ── Datos por piso ────────────────────────────────────────────
  const pb = rooms.filter(r => r.pisoNombre === 'PB');
  const p1 = rooms.filter(r => r.pisoNombre === 'P1');
  const tp = rooms.filter(r => r.pisoNombre === 'TP');

  // ── Stats ─────────────────────────────────────────────────────
  const ocupadas   = rooms.filter(r => r.estado === 'ocupada').length;
  const vacias     = rooms.filter(r => r.estado === 'disponible').length;
  const otras      = rooms.filter(r => r.estado !== 'ocupada' && r.estado !== 'disponible').length;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={cartasBosque.bosque} />
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={cartasBosque.musgo} />
        }
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>Admin · Antioquia 43</Text>
            <Text style={styles.title}>Habitaciones</Text>
          </View>
          <TouchableOpacity
            style={styles.catalogoBtn}
            onPress={() => setShowCatalogo(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="list" size={16} color={cartasBosque.bosque} />
            <Text style={styles.catalogoBtnText}>Catálogo</Text>
          </TouchableOpacity>
        </View>

        {/* ── Stats ── */}
        <View style={styles.statsRow}>
          <StatPill label="Ocupadas" value={ocupadas} color={cartasBosque.bosque} />
          <StatPill label="Vacías" value={vacias} color={cartasBosque.musgo} />
          <StatPill label="Otras" value={otras} color={cartasBosque.helecho} />
          <StatPill label="Total" value={rooms.length} color={cartasBosque.tinta} />
        </View>

        {/* ── Leyenda ── */}
        <View style={styles.leyenda}>
          {(Object.entries(ESTADO_LABEL) as [EstadoHabitacion, string][]).map(([key, label]) => (
            <View key={key} style={styles.leyendaItem}>
              <View style={[styles.leyendaDot, { backgroundColor: ESTADO_COLOR[key] }]} />
              <Text style={styles.leyendaLabel}>{label}</Text>
            </View>
          ))}
        </View>

        {/* ── Planta Baja ── */}
        <PisoSection
          label="Planta Baja"
          sublabel="Baño 1 · Baño 2 · CocinaPB"
          rooms={pb}
          cellWidth={cellW3}
          cols={3}
          gap={GAP}
          onSelect={setSelected}
        />

        {/* ── Primer Piso ── */}
        <PisoSection
          label="Primer Piso"
          sublabel="Baño gris (07-08) · Baño marrón (09-10) · CocinaPB"
          rooms={p1}
          cellWidth={cellW4}
          cols={4}
          gap={GAP}
          onSelect={setSelected}
        />

        {/* ── Terraza Piso ── */}
        <PisoSection
          label="Terraza Piso"
          sublabel="Baño terraza · CocinaTP"
          rooms={tp}
          cellWidth={cellW4}
          cols={4}
          gap={GAP}
          onSelect={setSelected}
        />

        {/* ── Slots deshabilitados ── */}
        <View style={styles.slotsSection}>
          <Text style={styles.slotsLabel}>Expansión · 015–045</Text>
          <View style={styles.slotsRow}>
            {Array.from({ length: 6 }, (_, i) => (
              <View key={i} style={[styles.slotChip, { width: cellW4 }]}>
                <Text style={styles.slotText}>{String(15 + i).padStart(3, '0')}</Text>
              </View>
            ))}
            <View style={[styles.slotChip, styles.slotEtc, { width: cellW4 }]}>
              <Text style={styles.slotText}>···</Text>
            </View>
          </View>
        </View>

        {/* Seed DEV */}
        {__DEV__ && (
          <TouchableOpacity
            style={styles.seedBtn}
            onPress={() => seedHabitaciones().then(() => Alert.alert('Seed OK'))}
          >
            <Text style={styles.seedText}>Dev: re-seed habitaciones</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* ── Modal detalle ── */}
      <Modal
        visible={!!selected}
        transparent
        animationType="slide"
        onRequestClose={() => setSelected(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.detailSheet}>
            <View style={styles.modalHandle} />
            {selected && (
              <DetalleHabitacion
                room={selected}
                cambiandoEstado={cambiandoEstado}
                onCambiarEstado={handleCambiarEstado}
                onClose={() => setSelected(null)}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* ── Modal catálogo ── */}
      <Modal
        visible={showCatalogo}
        animationType="slide"
        onRequestClose={() => setShowCatalogo(false)}
      >
        <View style={styles.catalogoModal}>
          <CatalogoScreen
            rooms={rooms}
            onClose={() => setShowCatalogo(false)}
          />
        </View>
      </Modal>
    </>
  );
}

// ─── PisoSection ──────────────────────────────────────────────

function PisoSection({
  label, sublabel, rooms, cellWidth, cols, gap, onSelect,
}: {
  label: string;
  sublabel: string;
  rooms: Habitacion[];
  cellWidth: number;
  cols: number;
  gap: number;
  onSelect: (r: Habitacion) => void;
}) {
  // Rellenar filas hasta múltiplo de cols
  const filledRooms = [...rooms];
  while (filledRooms.length % cols !== 0) filledRooms.push(null as any);

  return (
    <View style={pisoStyles.section}>
      <Text style={pisoStyles.label}>{label}</Text>
      <Text style={pisoStyles.sublabel}>{sublabel}</Text>
      <View style={[pisoStyles.grid, { gap }]}>
        {filledRooms.map((room, i) =>
          room ? (
            <HabitacionCell
              key={room.id}
              habitacion={room}
              width={cellWidth}
              height={CELL_H}
              onPress={() => onSelect(room)}
            />
          ) : (
            <View key={`empty-${i}`} style={{ width: cellWidth, height: CELL_H }} />
          ),
        )}
      </View>
    </View>
  );
}

const pisoStyles = StyleSheet.create({
  section: { gap: spacing[2] },
  label: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 15,
    color: cartasBosque.tinta,
  },
  sublabel: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 9,
    color: cartasBosque.helecho,
    letterSpacing: 0.4,
    marginTop: -spacing[1],
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});

// ─── DetalleHabitacion ────────────────────────────────────────

const ESTADOS_OPCIONES: EstadoHabitacion[] = ['disponible', 'ocupada', 'mantenimiento', 'reservada'];

function DetalleHabitacion({
  room, cambiandoEstado, onCambiarEstado, onClose,
}: {
  room: Habitacion;
  cambiandoEstado: boolean;
  onCambiarEstado: (e: EstadoHabitacion) => void;
  onClose: () => void;
}) {
  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      {/* Cabecera */}
      <View style={detStyles.head}>
        <View style={[detStyles.numBox, { backgroundColor: ESTADO_COLOR[room.estado] }]}>
          <Text style={[
            detStyles.numText,
            room.estado === 'ocupada' && { color: cartasBosque.bruma },
          ]}>
            {room.numero}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={detStyles.tamano}>{room.tamano}</Text>
          <Text style={detStyles.pisoStr}>{room.pisoNombre} · {room.area} m²</Text>
        </View>
        <TouchableOpacity onPress={onClose} hitSlop={8}>
          <Ionicons name="close-circle" size={26} color={cartasBosque.helecho} />
        </TouchableOpacity>
      </View>

      {/* Estado actual */}
      <View style={[detStyles.estadoBadge, { backgroundColor: ESTADO_COLOR[room.estado] + '20' }]}>
        <View style={[detStyles.estadoDot, { backgroundColor: ESTADO_COLOR[room.estado] }]} />
        <Text style={[detStyles.estadoText, { color: ESTADO_COLOR[room.estado] === cartasBosque.pergamino ? cartasBosque.musgo : ESTADO_COLOR[room.estado] }]}>
          {ESTADO_LABEL[room.estado]}
        </Text>
      </View>

      {/* Inquilino */}
      {room.inquilinoNombre && (
        <View style={detStyles.infoRow}>
          <Ionicons name="person-outline" size={15} color={cartasBosque.helecho} />
          <Text style={detStyles.infoText}>{room.inquilinoNombre}</Text>
        </View>
      )}

      {/* Detalles */}
      <View style={detStyles.infoGrid}>
        <InfoItem icon="water-outline"    label="Baño"    value={room.bano} />
        <InfoItem icon="restaurant-outline" label="Cocina" value={room.cocina} />
        <InfoItem icon="cash-outline"     label="Precio"  value={`$${room.precioMensual.toLocaleString('es-MX')}/mes`} />
        {room.precioAlSalir && (
          <InfoItem icon="arrow-forward-outline" label="Al salir" value={`$${room.precioAlSalir.toLocaleString('es-MX')}/mes`} />
        )}
        <InfoItem icon="grid-outline"     label="Amenidades" value={room.amenidades.join(' · ')} />
      </View>

      {/* Cambiar estado */}
      <Text style={detStyles.cambiarLabel}>Cambiar estado</Text>
      <View style={detStyles.estadosRow}>
        {ESTADOS_OPCIONES.map(estado => (
          <TouchableOpacity
            key={estado}
            style={[
              detStyles.estadoChip,
              { backgroundColor: ESTADO_COLOR[estado] + (room.estado === estado ? 'FF' : '28') },
              room.estado === estado && detStyles.estadoChipActive,
              cambiandoEstado && { opacity: 0.5 },
            ]}
            onPress={() => onCambiarEstado(estado)}
            disabled={cambiandoEstado || room.estado === estado}
          >
            <Text style={[
              detStyles.estadoChipText,
              { color: room.estado === estado && estado === 'disponible'
                  ? cartasBosque.musgo
                  : room.estado === estado
                  ? cartasBosque.bruma
                  : cartasBosque.musgo,
              },
            ]}>
              {ESTADO_LABEL[estado]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Módulo remodelación */}
      {room.moduloRemodelacion && (
        <View style={detStyles.remodelBox}>
          <Ionicons name="construct-outline" size={14} color="#F9A825" />
          <Text style={detStyles.remodelText}>
            Módulo remodelación disponible · Pequeña → Grande $3,600/mes.
            {'\n'}Gestionar desde Catálogo.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

function InfoItem({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={detStyles.infoItem}>
      <Ionicons name={icon as any} size={13} color={cartasBosque.helecho} />
      <View>
        <Text style={detStyles.infoLabel}>{label}</Text>
        <Text style={detStyles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

const detStyles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginBottom: spacing[3] },
  numBox: {
    width: 52, height: 52, borderRadius: borderRadius.lg,
    alignItems: 'center', justifyContent: 'center',
  },
  numText: { fontFamily: 'DMSans_700Bold', fontSize: 22, color: cartasBosque.tinta },
  tamano: { fontFamily: 'DMSans_600SemiBold', fontSize: 16, color: cartasBosque.tinta },
  pisoStr: { fontFamily: 'DMMono_400Regular', fontSize: 10, color: cartasBosque.helecho, marginTop: 2 },

  estadoBadge: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    alignSelf: 'flex-start', paddingHorizontal: spacing[3], paddingVertical: spacing[1.5],
    borderRadius: borderRadius.full, marginBottom: spacing[3],
  },
  estadoDot: { width: 8, height: 8, borderRadius: 4 },
  estadoText: { fontFamily: 'DMSans_600SemiBold', fontSize: 13 },

  infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[2] },
  infoText: { fontFamily: 'DMSans_500Medium', fontSize: 14, color: cartasBosque.tinta },

  infoGrid: { gap: spacing[2.5], marginBottom: spacing[4] },
  infoItem: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2] },
  infoLabel: { fontFamily: 'DMMono_400Regular', fontSize: 9, color: cartasBosque.helecho, letterSpacing: 0.5 },
  infoValue: { fontFamily: 'DMSans_500Medium', fontSize: 13, color: cartasBosque.tinta },

  cambiarLabel: {
    fontFamily: 'DMMono_400Regular', fontSize: 10,
    color: cartasBosque.helecho, letterSpacing: 0.8,
    textTransform: 'uppercase', marginBottom: spacing[2],
  },
  estadosRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginBottom: spacing[4] },
  estadoChip: {
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    borderRadius: borderRadius.full,
  },
  estadoChipActive: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 3, elevation: 2 },
  estadoChipText: { fontFamily: 'DMSans_500Medium', fontSize: 12 },

  remodelBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2],
    backgroundColor: '#FFFDE7', borderRadius: borderRadius.md,
    padding: spacing[3], marginBottom: spacing[2],
  },
  remodelText: { fontFamily: 'DMMono_400Regular', fontSize: 10, color: cartasBosque.musgo, flex: 1, lineHeight: 16 },
});

// ─── StatPill ─────────────────────────────────────────────────

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={statStyles.pill}>
      <Text style={[statStyles.value, { color }]}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  pill: {
    flex: 1, alignItems: 'center', gap: 2,
    backgroundColor: cartasBosque.bruma,
    borderRadius: borderRadius.lg, paddingVertical: spacing[2.5],
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
  },
  value: { fontFamily: 'DMSans_700Bold', fontSize: 18 },
  label: { fontFamily: 'DMMono_400Regular', fontSize: 9, color: cartasBosque.helecho, letterSpacing: 0.3 },
});

// ─── Estilos principales ──────────────────────────────────────

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: cartasBosque.bruma },
  content: { padding: H_PADDING, paddingBottom: spacing[10], gap: spacing[5] },
  center:  { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: cartasBosque.bruma },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  eyebrow: { fontFamily: 'DMMono_400Regular', fontSize: 10, color: cartasBosque.musgo, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: spacing[0.5] },
  title:   { fontFamily: 'DMSans_700Bold', fontSize: 26, color: cartasBosque.bosque, letterSpacing: -0.3 },

  catalogoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[1.5],
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    borderRadius: borderRadius.full, borderWidth: 1.5,
    borderColor: cartasBosque.bosque,
  },
  catalogoBtnText: { fontFamily: 'DMSans_600SemiBold', fontSize: 13, color: cartasBosque.bosque },

  statsRow: { flexDirection: 'row', gap: spacing[2] },

  leyenda: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  leyendaItem: { flexDirection: 'row', alignItems: 'center', gap: spacing[1.5] },
  leyendaDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' },
  leyendaLabel: { fontFamily: 'DMMono_400Regular', fontSize: 10, color: cartasBosque.helecho },

  // Slots deshabilitados
  slotsSection: { gap: spacing[2] },
  slotsLabel: { fontFamily: 'DMMono_400Regular', fontSize: 10, color: cartasBosque.helecho, letterSpacing: 0.8, textTransform: 'uppercase' },
  slotsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  slotChip: {
    height: 36, borderRadius: borderRadius.md,
    backgroundColor: '#EAEAE4', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#D8D8D0', borderStyle: 'dashed',
  },
  slotEtc: { backgroundColor: 'transparent', borderColor: '#C8C8C0' },
  slotText: { fontFamily: 'DMMono_400Regular', fontSize: 10, color: '#A8A8A0' },

  // Modales
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  detailSheet: {
    backgroundColor: cartasBosque.bruma,
    borderTopLeftRadius: borderRadius['2xl'],
    borderTopRightRadius: borderRadius['2xl'],
    padding: spacing[5],
    paddingBottom: spacing[10],
    maxHeight: '80%',
  },
  modalHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: cartasBosque.pergaminoOscuro,
    alignSelf: 'center', marginBottom: spacing[4],
  },

  catalogoModal: { flex: 1, backgroundColor: cartasBosque.bruma },

  // Dev
  seedBtn: { alignSelf: 'center', paddingVertical: spacing[2], paddingHorizontal: spacing[4], borderRadius: borderRadius.full, borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro },
  seedText: { fontFamily: 'DMMono_400Regular', fontSize: 10, color: cartasBosque.helecho },
});
