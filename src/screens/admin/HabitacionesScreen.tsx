import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, ActivityIndicator, useWindowDimensions, RefreshControl,
  Alert, TextInput, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { addDoc, collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '@/services/firebase/firestore';
import { cartasBosque } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/spacing';
import { HabitacionCell } from '@/components/common/HabitacionCard';
import CatalogoScreen from './CatalogoScreen';
import {
  listenHabitaciones, seedHabitaciones, cambiarEstado, updateHabitacion,
  ESTADO_COLOR, ESTADO_LABEL,
} from '@/services/firebase/habitaciones';
import type {
  Habitacion, EstadoHabitacion, TipoHabitacion, PisoNombre, BanoAsignacion, CocinaAsignacion,
} from '@/types/firestore';

// ─── Constantes ───────────────────────────────────────────────

const H_PADDING = spacing[5];
const GAP       = spacing[2];
const CELL_H    = 88;

const AMENIDADES_OPCIONES = [
  'WiFi', 'Ventilador', 'AC', 'Baño privado',
  'Balcón', 'Terraza privada', 'Vista terraza', 'Cocina equipada',
];
const TIPOS_HAB: TipoHabitacion[]  = ['simple', 'suite', 'estudio', 'doble'];
const TAMANOS = ['Pequeña', 'Mediana', 'Grande', 'Grande c/terraza', 'Mediana petit'];
const COCINAS: CocinaAsignacion[]  = ['CocinaPB', 'CocinaTP'];
const PISOS_MAP: { label: PisoNombre; piso: 0 | 1 | 2 }[] = [
  { label: 'PB', piso: 0 },
  { label: 'P1', piso: 1 },
  { label: 'TP', piso: 2 },
];

type FilterEstado = 'todos' | EstadoHabitacion;
type FilterPiso   = 'todos' | PisoNombre;

interface EditForm {
  tipo: TipoHabitacion;
  tamano: string;
  precioMensual: string;
  precioAlSalir: string;
  precioDeposito: string;
  area: string;
  amenidades: string[];
  descripcion: string;
  habilitada: boolean;
  fechaDia: string;
  fechaMes: string;
  fechaAnio: string;
}

interface MetricasData {
  ingresosTotal: number;
  totalInquilinos: number;
  diasVaciaAprox: number | null;
  diasEnConstruccion: number | null;
  ticketsTotal: number;
  ticketsEnProceso: number;
  ticketsResueltos: number;
}

// ─── Helpers ──────────────────────────────────────────────────

function estadoTextColor(estado: EstadoHabitacion): string {
  if (ESTADO_COLOR[estado] === cartasBosque.pergamino) return cartasBosque.helecho;
  if (ESTADO_COLOR[estado] === cartasBosque.bosque)    return cartasBosque.bruma;
  return ESTADO_COLOR[estado];
}

// ─── HabitacionesScreen ───────────────────────────────────────

export default function HabitacionesScreen() {
  const { width } = useWindowDimensions();
  const [rooms, setRooms]                     = useState<Habitacion[]>([]);
  const [loading, setLoading]                 = useState(true);
  const [refreshing, setRefreshing]           = useState(false);
  const [seeded, setSeeded]                   = useState(false);
  const [selected, setSelected]               = useState<Habitacion | null>(null);
  const [cambiandoEstado, setCambiandoEstado] = useState(false);
  const [showCatalogo, setShowCatalogo]       = useState(false);
  const [showNueva, setShowNueva]             = useState(false);
  const [vistaLista, setVistaLista]           = useState(false);
  const [filtroEstado, setFiltroEstado]       = useState<FilterEstado>('todos');
  const [filtroPiso, setFiltroPiso]           = useState<FilterPiso>('todos');

  useEffect(() => {
    const unsub = listenHabitaciones(data => { setRooms(data); setLoading(false); });
    return unsub;
  }, []);

  useEffect(() => {
    if (!loading && rooms.length === 0 && __DEV__ && !seeded) {
      setSeeded(true);
      seedHabitaciones().catch(() => {});
    }
  }, [loading, rooms.length, seeded]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  }, []);

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

  const contentW = width - H_PADDING * 2;
  const cellW3   = (contentW - GAP * 2) / 3;
  const cellW4   = (contentW - GAP * 3) / 4;

  const filtrados = rooms.filter(r => {
    if (filtroEstado !== 'todos' && r.estado     !== filtroEstado) return false;
    if (filtroPiso   !== 'todos' && r.pisoNombre !== filtroPiso)   return false;
    return true;
  });

  const pb = filtrados.filter(r => r.pisoNombre === 'PB');
  const p1 = filtrados.filter(r => r.pisoNombre === 'P1');
  const tp = filtrados.filter(r => r.pisoNombre === 'TP');

  const ocupadas = rooms.filter(r => r.estado === 'ocupada').length;
  const vacias   = rooms.filter(r => r.estado === 'disponible').length;
  const otras    = rooms.filter(r => r.estado !== 'ocupada' && r.estado !== 'disponible').length;

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={cartasBosque.bosque} /></View>;
  }

  const ESTADOS_FILTER: FilterEstado[] = ['todos', 'disponible', 'ocupada', 'mantenimiento', 'reservada'];
  const PISOS_FILTER:   FilterPiso[]   = ['todos', 'PB', 'P1', 'TP'];

  return (
    <>
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={cartasBosque.helecho} />}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>Admin · Antioquia 43</Text>
            <Text style={styles.title}>Habitaciones</Text>
          </View>
          <View style={styles.headerBtns}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => setVistaLista(v => !v)} activeOpacity={0.8}>
              <Ionicons name={vistaLista ? 'grid-outline' : 'list-outline'} size={18} color={cartasBosque.bosque} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.nuevaBtn} onPress={() => setShowNueva(true)} activeOpacity={0.8}>
              <Ionicons name="add" size={16} color={cartasBosque.bruma} />
              <Text style={styles.nuevaBtnText}>Nueva</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.catalogoBtn} onPress={() => setShowCatalogo(true)} activeOpacity={0.8}>
              <Ionicons name="list" size={16} color={cartasBosque.bosque} />
              <Text style={styles.catalogoBtnText}>Catálogo</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Filtros ── */}
        <View style={styles.filtrosWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtrosRow}>
            {ESTADOS_FILTER.map(e => {
              const active = filtroEstado === e;
              const label  = e === 'todos' ? 'Todos' : ESTADO_LABEL[e as EstadoHabitacion];
              return (
                <TouchableOpacity key={e} style={[styles.filterChip, active && styles.filterChipActive]} onPress={() => setFiltroEstado(e)}>
                  {e !== 'todos' && <View style={[styles.filterDot, { backgroundColor: active ? cartasBosque.bruma : ESTADO_COLOR[e as EstadoHabitacion] }]} />}
                  <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtrosRow}>
            {PISOS_FILTER.map(p => {
              const active = filtroPiso === p;
              return (
                <TouchableOpacity key={p} style={[styles.filterChip, active && styles.filterChipActive]} onPress={() => setFiltroPiso(p)}>
                  <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{p === 'todos' ? 'Todos' : p}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ── Stats ── */}
        <View style={styles.statsRow}>
          <StatPill label="Ocupadas" value={ocupadas}      color={cartasBosque.bosque} />
          <StatPill label="Vacías"   value={vacias}        color={cartasBosque.helecho} />
          <StatPill label="Otras"    value={otras}         color={cartasBosque.helecho} />
          <StatPill label="Total"    value={rooms.length}  color={cartasBosque.tinta} />
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

        {/* ── Contenido ── */}
        {vistaLista ? (
          <View>
            {filtrados.length === 0 ? (
              <Text style={styles.listaVacia}>Sin habitaciones con estos filtros</Text>
            ) : filtrados.map(r => (
              <ListaRow key={r.id} room={r} onSelect={setSelected} />
            ))}
          </View>
        ) : (
          <>
            {(filtroPiso === 'todos' || filtroPiso === 'PB') && (
              <PisoSection label="Planta Baja" sublabel="Baño 1 · Baño 2 · CocinaPB" rooms={pb} cellWidth={cellW3} cols={3} gap={GAP} onSelect={setSelected} />
            )}
            {(filtroPiso === 'todos' || filtroPiso === 'P1') && (
              <PisoSection label="Primer Piso" sublabel="Baño gris (07-08) · Baño marrón (09-10) · CocinaPB" rooms={p1} cellWidth={cellW4} cols={4} gap={GAP} onSelect={setSelected} />
            )}
            {(filtroPiso === 'todos' || filtroPiso === 'TP') && (
              <PisoSection label="Terraza Piso" sublabel="Baño terraza · CocinaTP" rooms={tp} cellWidth={cellW4} cols={4} gap={GAP} onSelect={setSelected} />
            )}
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
          </>
        )}

        {__DEV__ && (
          <TouchableOpacity style={styles.seedBtn} onPress={() => seedHabitaciones().then(() => Alert.alert('Seed OK'))}>
            <Text style={styles.seedText}>Dev: re-seed habitaciones</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* ── Modal detalle ── */}
      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.detailSheet}>
            <View style={styles.modalHandle} />
            {selected && (
              <DetalleHabitacion
                room={selected}
                cambiandoEstado={cambiandoEstado}
                onCambiarEstado={handleCambiarEstado}
                onClose={() => setSelected(null)}
                onUpdate={fields => setSelected(prev => prev ? { ...prev, ...fields } : null)}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* ── Modal catálogo ── */}
      <Modal visible={showCatalogo} animationType="slide" onRequestClose={() => setShowCatalogo(false)}>
        <View style={styles.catalogoModal}>
          <CatalogoScreen rooms={rooms} onClose={() => setShowCatalogo(false)} />
        </View>
      </Modal>

      {/* ── Modal nueva habitación ── */}
      <Modal visible={showNueva} transparent animationType="slide" onRequestClose={() => setShowNueva(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.detailSheet}>
            <View style={styles.modalHandle} />
            <NuevaHabitacionSheet onClose={() => setShowNueva(false)} />
          </View>
        </View>
      </Modal>
    </>
  );
}

// ─── PisoSection ──────────────────────────────────────────────

function PisoSection({
  label, sublabel, rooms, cellWidth, cols, gap, onSelect,
}: {
  label: string; sublabel: string; rooms: Habitacion[];
  cellWidth: number; cols: number; gap: number;
  onSelect: (r: Habitacion) => void;
}) {
  const filledRooms = [...rooms];
  while (filledRooms.length % cols !== 0) filledRooms.push(null as any);
  return (
    <View style={pisoStyles.section}>
      <Text style={pisoStyles.label}>{label}</Text>
      <Text style={pisoStyles.sublabel}>{sublabel}</Text>
      <View style={[pisoStyles.grid, { gap }]}>
        {filledRooms.map((room, i) =>
          room ? (
            <HabitacionCell key={room.id} habitacion={room} width={cellWidth} height={CELL_H} onPress={() => onSelect(room)} />
          ) : (
            <View key={`empty-${i}`} style={{ width: cellWidth, height: CELL_H }} />
          ),
        )}
      </View>
    </View>
  );
}

const pisoStyles = StyleSheet.create({
  section:  { gap: spacing[2] },
  label:    { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: cartasBosque.tinta },
  sublabel: { fontFamily: 'SpaceMono_400Regular', fontSize: 9, color: cartasBosque.helecho, letterSpacing: 0.4, marginTop: -spacing[1] },
  grid:     { flexDirection: 'row', flexWrap: 'wrap' },
});

// ─── ListaRow ─────────────────────────────────────────────────

function ListaRow({ room, onSelect }: { room: Habitacion; onSelect: (r: Habitacion) => void }) {
  const numColor = estadoTextColor(room.estado);
  const badgeBg  = ESTADO_COLOR[room.estado] === cartasBosque.pergamino
    ? cartasBosque.pergaminoOscuro : ESTADO_COLOR[room.estado] + '28';
  return (
    <TouchableOpacity style={listaStyles.row} onPress={() => onSelect(room)} activeOpacity={0.7}>
      <View style={listaStyles.left}>
        <Text style={[listaStyles.numero, { color: numColor }]}>{room.numero}</Text>
        <Text style={listaStyles.piso}>{room.pisoNombre}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={listaStyles.tipoTamano}>{room.tipo} · {room.tamano}</Text>
        {room.estado === 'ocupada' && room.inquilinoNombre ? (
          <Text style={listaStyles.inquilino}>{room.inquilinoNombre}</Text>
        ) : null}
        <Text style={listaStyles.precio}>${room.precioMensual.toLocaleString('es-MX')}/mes</Text>
      </View>
      <View style={[listaStyles.estadoBadge, { backgroundColor: badgeBg }]}>
        <Text style={[listaStyles.estadoBadgeText, { color: numColor }]}>{ESTADO_LABEL[room.estado]}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={cartasBosque.niebla} />
    </TouchableOpacity>
  );
}

const listaStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    paddingVertical: spacing[3], paddingHorizontal: spacing[1],
    borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro,
  },
  left:            { width: 44, alignItems: 'center' },
  numero:          { fontFamily: 'Inter_700Bold', fontSize: 16 },
  piso:            { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.helecho, marginTop: 2 },
  tipoTamano:      { fontFamily: 'Inter_400Regular', fontSize: 12, color: cartasBosque.tinta },
  inquilino:       { fontFamily: 'Inter_400Regular', fontSize: 12, color: cartasBosque.helecho, marginTop: 1 },
  precio:          { fontFamily: 'SpaceMono_400Regular', fontSize: 12, color: '#4A9B6F', marginTop: 2 },
  estadoBadge:     { paddingHorizontal: spacing[2], paddingVertical: 3, borderRadius: borderRadius.full },
  estadoBadgeText: { fontFamily: 'SpaceMono_400Regular', fontSize: 9 },
});

// ─── NuevaHabitacionSheet ─────────────────────────────────────

function NuevaHabitacionSheet({ onClose }: { onClose: () => void }) {
  const [numero, setNumero]         = useState('');
  const [piso, setPiso]             = useState<0 | 1 | 2>(0);
  const [pisoNombre, setPisoNombre] = useState<PisoNombre>('PB');
  const [tipo, setTipo]             = useState<TipoHabitacion>('simple');
  const [tamano, setTamano]         = useState('Pequeña');
  const [precio, setPrecio]         = useState('');
  const [deposito, setDeposito]     = useState('');
  const [area, setArea]             = useState('');
  const [bano, setBano]             = useState('libre');
  const [cocina, setCocina]         = useState<CocinaAsignacion>('CocinaPB');
  const [amenidades, setAmenidades] = useState<string[]>(['WiFi']);
  const [habilitada, setHabilitada] = useState(false);
  const [guardando, setGuardando]   = useState(false);

  function toggleAmenidad(a: string) {
    setAmenidades(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]);
  }

  async function guardar() {
    if (!numero.trim()) return Alert.alert('Error', 'Ingresa un número de habitación');
    setGuardando(true);
    try {
      await addDoc(collection(db, 'habitaciones'), {
        numero: numero.trim(),
        piso,
        pisoNombre,
        tipo,
        tamano,
        estado: habilitada ? 'disponible' : 'mantenimiento',
        precioMensual: Number(precio) || 0,
        precioDeposito: Number(deposito) || 0,
        area: Number(area) || 0,
        bano: (bano || 'libre') as BanoAsignacion,
        cocina,
        amenidades,
        habilitada,
        fotos: [],
        inquilinoId: null,
        modulosHabilitados: {
          lavanderia: true, almacenamiento: true,
          huespedExtra: true, visitas: true, facturacion: true,
        },
        creadoEn: Timestamp.now(),
        actualizadoEn: Timestamp.now(),
      });
      onClose();
    } catch {
      Alert.alert('Error', 'No se pudo crear la habitación');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={nuevaStyles.scroll}>
      <Text style={nuevaStyles.titulo}>Nueva habitación</Text>

      <Text style={nuevaStyles.label}>Número</Text>
      <TextInput style={nuevaStyles.input} placeholder="ej. 15" placeholderTextColor={cartasBosque.helecho}
        value={numero} onChangeText={setNumero} keyboardType="numeric" />

      <Text style={nuevaStyles.label}>Piso</Text>
      <View style={nuevaStyles.chipRow}>
        {PISOS_MAP.map(p => (
          <TouchableOpacity key={p.label} style={[nuevaStyles.chip, piso === p.piso && nuevaStyles.chipActive]}
            onPress={() => { setPiso(p.piso); setPisoNombre(p.label); }}>
            <Text style={[nuevaStyles.chipText, piso === p.piso && nuevaStyles.chipTextActive]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={nuevaStyles.label}>Tipo</Text>
      <View style={nuevaStyles.chipRow}>
        {TIPOS_HAB.map(t => (
          <TouchableOpacity key={t} style={[nuevaStyles.chip, tipo === t && nuevaStyles.chipActive]} onPress={() => setTipo(t)}>
            <Text style={[nuevaStyles.chipText, tipo === t && nuevaStyles.chipTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={nuevaStyles.label}>Tamaño</Text>
      <View style={nuevaStyles.chipRow}>
        {TAMANOS.map(t => (
          <TouchableOpacity key={t} style={[nuevaStyles.chip, tamano === t && nuevaStyles.chipActive]} onPress={() => setTamano(t)}>
            <Text style={[nuevaStyles.chipText, tamano === t && nuevaStyles.chipTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={nuevaStyles.row3}>
        <View style={{ flex: 1 }}>
          <Text style={nuevaStyles.label}>Precio mensual</Text>
          <View style={nuevaStyles.priceWrap}>
            <Text style={nuevaStyles.prefijo}>$</Text>
            <TextInput style={nuevaStyles.priceInput} keyboardType="numeric" value={precio} onChangeText={setPrecio} placeholder="0" placeholderTextColor={cartasBosque.helecho} />
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={nuevaStyles.label}>Depósito</Text>
          <View style={nuevaStyles.priceWrap}>
            <Text style={nuevaStyles.prefijo}>$</Text>
            <TextInput style={nuevaStyles.priceInput} keyboardType="numeric" value={deposito} onChangeText={setDeposito} placeholder="0" placeholderTextColor={cartasBosque.helecho} />
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={nuevaStyles.label}>Área m²</Text>
          <TextInput style={nuevaStyles.input} keyboardType="numeric" value={area} onChangeText={setArea} placeholder="0" placeholderTextColor={cartasBosque.helecho} />
        </View>
      </View>

      <Text style={nuevaStyles.label}>Baño</Text>
      <TextInput style={nuevaStyles.input} placeholder="libre / Baño gris / …" placeholderTextColor={cartasBosque.helecho}
        value={bano} onChangeText={setBano} />

      <Text style={nuevaStyles.label}>Cocina</Text>
      <View style={nuevaStyles.chipRow}>
        {COCINAS.map(c => (
          <TouchableOpacity key={c} style={[nuevaStyles.chip, cocina === c && nuevaStyles.chipActive]} onPress={() => setCocina(c)}>
            <Text style={[nuevaStyles.chipText, cocina === c && nuevaStyles.chipTextActive]}>{c}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={nuevaStyles.label}>Amenidades</Text>
      <View style={nuevaStyles.chipRow}>
        {AMENIDADES_OPCIONES.map(a => {
          const active = amenidades.includes(a);
          return (
            <TouchableOpacity key={a} style={[nuevaStyles.chip, active && nuevaStyles.chipActive]} onPress={() => toggleAmenidad(a)}>
              <Text style={[nuevaStyles.chipText, active && nuevaStyles.chipTextActive]}>{a}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={nuevaStyles.switchRow}>
        <Text style={nuevaStyles.switchLabel}>Habilitada</Text>
        <Switch value={habilitada} onValueChange={setHabilitada}
          trackColor={{ true: cartasBosque.bosque, false: cartasBosque.pergaminoOscuro }}
          thumbColor={cartasBosque.bruma} />
      </View>

      <TouchableOpacity
        style={[nuevaStyles.guardarBtn, guardando && { opacity: 0.6 }]}
        onPress={guardar} disabled={guardando}
      >
        {guardando ? <ActivityIndicator color={cartasBosque.bruma} size="small" />
          : <Text style={nuevaStyles.guardarBtnText}>Crear habitación</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const nuevaStyles = StyleSheet.create({
  scroll:  { paddingBottom: spacing[8] },
  titulo:  { fontFamily: 'Inter_700Bold', fontSize: 18, color: cartasBosque.tinta, marginBottom: spacing[4] },
  label:   { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.helecho, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: spacing[1], marginTop: spacing[3] },
  input: {
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro, borderRadius: borderRadius.md,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    fontFamily: 'Inter_400Regular', fontSize: 13, color: cartasBosque.tinta,
    backgroundColor: cartasBosque.pergamino,
  },
  row3:       { flexDirection: 'row', gap: spacing[2] },
  priceWrap:  { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro, borderRadius: borderRadius.md, backgroundColor: cartasBosque.pergamino, overflow: 'hidden' },
  prefijo:    { paddingHorizontal: spacing[2], fontFamily: 'Inter_400Regular', fontSize: 13, color: cartasBosque.helecho },
  priceInput: { flex: 1, paddingVertical: spacing[2], fontFamily: 'Inter_400Regular', fontSize: 13, color: cartasBosque.tinta },
  chipRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  chip: {
    paddingHorizontal: spacing[3], paddingVertical: spacing[1] + 2,
    borderRadius: borderRadius.full, borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    backgroundColor: cartasBosque.pergamino,
  },
  chipActive:     { backgroundColor: cartasBosque.bosque, borderColor: cartasBosque.bosque },
  chipText:       { fontFamily: 'Inter_400Regular', fontSize: 12, color: cartasBosque.helecho },
  chipTextActive: { fontFamily: 'Inter_600SemiBold', color: cartasBosque.bruma },
  switchRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing[4], paddingVertical: spacing[2] },
  switchLabel:    { fontFamily: 'Inter_500Medium', fontSize: 14, color: cartasBosque.tinta },
  guardarBtn: {
    marginTop: spacing[5], backgroundColor: cartasBosque.bosque,
    borderRadius: borderRadius.full, paddingVertical: spacing[3], alignItems: 'center',
  },
  guardarBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: cartasBosque.bruma },
});

// ─── ModuloRow ────────────────────────────────────────────────

function ModuloRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={modStyles.row}>
      <View style={{ flex: 1 }}>
        <Text style={modStyles.label}>{label}</Text>
        <Text style={modStyles.helper}>ON = usa config global · OFF = deshabilitado para esta hab</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: cartasBosque.bosque, false: cartasBosque.pergaminoOscuro }}
        thumbColor={cartasBosque.bruma}
      />
    </View>
  );
}

const modStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacing[2],
    borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro,
  },
  label:  { fontFamily: 'Inter_400Regular', fontSize: 13, color: cartasBosque.tinta },
  helper: { fontFamily: 'SpaceMono_400Regular', fontSize: 9, color: cartasBosque.niebla, marginTop: 2 },
});

// ─── DetalleHabitacion ────────────────────────────────────────

const ESTADOS_OPCIONES: EstadoHabitacion[] = ['disponible', 'ocupada', 'mantenimiento', 'reservada'];

function DetalleHabitacion({
  room, cambiandoEstado, onCambiarEstado, onClose, onUpdate,
}: {
  room: Habitacion;
  cambiandoEstado: boolean;
  onCambiarEstado: (e: EstadoHabitacion) => void;
  onClose: () => void;
  onUpdate: (fields: Partial<Habitacion>) => void;
}) {
  type DetTab = 'info' | 'editar' | 'metricas';
  const [tab, setTab] = useState<DetTab>('info');

  const [editForm, setEditForm] = useState<EditForm>({
    tipo:          room.tipo,
    tamano:        room.tamano,
    precioMensual: String(room.precioMensual),
    precioAlSalir: String(room.precioAlSalir ?? ''),
    precioDeposito:String(room.precioDeposito),
    area:          String(room.area),
    amenidades:    [...room.amenidades],
    descripcion:   room.descripcion ?? '',
    habilitada:    room.habilitada,
    fechaDia: '', fechaMes: '', fechaAnio: '',
  });

  // Módulos habilitados (undefined → usa config global = ON)
  const [modLavanderia,     setModLavanderia]     = useState(room.modulosHabilitados?.lavanderia     ?? true);
  const [modAlmacenamiento, setModAlmacenamiento] = useState(room.modulosHabilitados?.almacenamiento ?? true);
  const [modHuespedExtra,   setModHuespedExtra]   = useState(room.modulosHabilitados?.huespedExtra   ?? true);
  const [modVisitas,        setModVisitas]         = useState(room.modulosHabilitados?.visitas        ?? true);
  const [modFacturacion,    setModFacturacion]     = useState(room.modulosHabilitados?.facturacion    ?? true);

  const [guardando, setGuardando]               = useState(false);
  const [metricas, setMetricas]                 = useState<MetricasData | null>(null);
  const [metricasCargando, setMetricasCargando] = useState(false);
  const [metricasCargadas, setMetricasCargadas] = useState(false);

  useEffect(() => {
    if (tab !== 'metricas' || metricasCargadas) return;
    setMetricasCargando(true);
    Promise.all([
      getDocs(query(collection(db, 'pagos'), where('habitacionId', '==', room.id), where('estado', '==', 'pagado'))),
      getDocs(query(collection(db, 'inquilinos'), where('habitacionId', '==', room.id))),
      getDocs(query(collection(db, 'tickets'), where('habitacionId', '==', room.id))),
    ]).then(([pagosSnap, inqSnap, ticketsSnap]) => {
      const ingresosTotal    = pagosSnap.docs.reduce((s, d2) => s + ((d2.data().montoPagado as number) ?? 0), 0);
      const totalInquilinos  = inqSnap.size;
      const ticketsList      = ticketsSnap.docs.map(d2 => d2.data());
      const ticketsTotal     = ticketsList.length;
      const ticketsEnProceso = ticketsList.filter(t => t.estado === 'en_proceso').length;
      const ticketsResueltos = ticketsList.filter(t => t.estado === 'resuelto').length;
      const diasDesdeCreacion = room.creadoEn
        ? Math.floor((Date.now() - room.creadoEn.toDate().getTime()) / 86_400_000)
        : 0;
      const diasVaciaAprox = pagosSnap.size > 0
        ? Math.max(0, (Math.ceil(diasDesdeCreacion / 30) - pagosSnap.size) * 30)
        : null;
      const diasEnConstruccion = room.estado === 'mantenimiento' && room.creadoEn
        ? Math.ceil((Date.now() - room.creadoEn.toDate().getTime()) / 864e5)
        : null;
      setMetricas({ ingresosTotal, totalInquilinos, diasVaciaAprox, diasEnConstruccion, ticketsTotal, ticketsEnProceso, ticketsResueltos });
      setMetricasCargadas(true);
    }).catch(() => {
      setMetricas({ ingresosTotal: 0, totalInquilinos: 0, diasVaciaAprox: null, diasEnConstruccion: null, ticketsTotal: 0, ticketsEnProceso: 0, ticketsResueltos: 0 });
      setMetricasCargadas(true);
    }).finally(() => setMetricasCargando(false));
  }, [tab]);

  function toggleAmenidad(a: string) {
    setEditForm(f => ({ ...f, amenidades: f.amenidades.includes(a) ? f.amenidades.filter(x => x !== a) : [...f.amenidades, a] }));
  }

  async function guardarCambios() {
    setGuardando(true);
    try {
      const payload: any = {
        tipo:           editForm.tipo,
        tamano:         editForm.tamano,
        precioMensual:  Number(editForm.precioMensual) || room.precioMensual,
        precioDeposito: Number(editForm.precioDeposito) || room.precioDeposito,
        area:           Number(editForm.area) || room.area,
        amenidades:     editForm.amenidades,
        descripcion:    editForm.descripcion,
        habilitada:     editForm.habilitada,
        modulosHabilitados: {
          lavanderia:     modLavanderia,
          almacenamiento: modAlmacenamiento,
          huespedExtra:   modHuespedExtra,
          visitas:        modVisitas,
          facturacion:    modFacturacion,
        },
      };
      if (editForm.precioAlSalir) payload.precioAlSalir = Number(editForm.precioAlSalir);
      if (editForm.habilitada !== room.habilitada) {
        payload.estado = editForm.habilitada ? 'disponible' : 'mantenimiento';
      }
      if (editForm.fechaAnio && editForm.fechaMes && editForm.fechaDia) {
        const anio = editForm.fechaAnio.padStart(4, '0');
        const mes  = editForm.fechaMes.padStart(2, '0');
        const dia  = editForm.fechaDia.padStart(2, '0');
        payload.fechaEstimadaDisponibilidad = `${anio}-${mes}-${dia}`;
      }
      await updateHabitacion(room.id, payload);
      onUpdate(payload);
    } catch {
      Alert.alert('Error', 'No se pudieron guardar los cambios');
    } finally {
      setGuardando(false);
    }
  }

  async function marcarLista() {
    try {
      await updateHabitacion(room.id, { estado: 'disponible', habilitada: true });
      onUpdate({ estado: 'disponible', habilitada: true });
      setEditForm(f => ({ ...f, habilitada: true }));
    } catch { Alert.alert('Error', 'No se pudo marcar como lista'); }
  }

  const TABS: { id: DetTab; label: string }[] = [
    { id: 'info',     label: 'INFO' },
    { id: 'editar',   label: 'EDITAR' },
    { id: 'metricas', label: 'MÉTRICAS' },
  ];

  return (
    <View style={{ flex: 1 }}>
      {/* Cabecera */}
      <View style={detStyles.head}>
        <View style={[detStyles.numBox, { backgroundColor: ESTADO_COLOR[room.estado] }]}>
          <Text style={[detStyles.numText, room.estado === 'ocupada' && { color: cartasBosque.bruma }]}>{room.numero}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={detStyles.tamano}>{room.tamano}</Text>
          <Text style={detStyles.pisoStr}>{room.pisoNombre} · {room.area} m²</Text>
        </View>
        <TouchableOpacity onPress={onClose} hitSlop={8}>
          <Ionicons name="close-circle" size={26} color={cartasBosque.helecho} />
        </TouchableOpacity>
      </View>

      {/* Tab bar */}
      <View style={detStyles.tabBar}>
        {TABS.map(t => (
          <TouchableOpacity key={t.id} style={[detStyles.tabBtn, tab === t.id && detStyles.tabBtnActive]} onPress={() => setTab(t.id)}>
            <Text style={[detStyles.tabBtnText, tab === t.id && detStyles.tabBtnTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab content */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: spacing[3], paddingBottom: spacing[10] }}>

        {/* ── TAB INFO ── */}
        {tab === 'info' && (
          <>
            <View style={[detStyles.estadoBadge, { backgroundColor: ESTADO_COLOR[room.estado] + '20' }]}>
              <View style={[detStyles.estadoDot, { backgroundColor: ESTADO_COLOR[room.estado] }]} />
              <Text style={[detStyles.estadoText, { color: estadoTextColor(room.estado) }]}>{ESTADO_LABEL[room.estado]}</Text>
            </View>

            {room.inquilinoNombre && (
              <View style={detStyles.infoRow}>
                <Ionicons name="person-outline" size={15} color={cartasBosque.helecho} />
                <Text style={detStyles.infoText}>{room.inquilinoNombre}</Text>
                {room.estado === 'ocupada' && (
                  <TouchableOpacity
                    style={detStyles.expBtn}
                    onPress={() => Alert.alert('Expediente', `UID: ${room.inquilinoId}\nUsa el panel Expedientes para ver el perfil completo.`)}
                  >
                    <Text style={detStyles.expBtnText}>Ver expediente →</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <View style={detStyles.infoGrid}>
              <InfoItem icon="water-outline"      label="Baño"       value={room.bano} />
              <InfoItem icon="restaurant-outline" label="Cocina"     value={room.cocina} />
              <InfoItem icon="cash-outline"       label="Precio"     value={`$${room.precioMensual.toLocaleString('es-MX')}/mes`} />
              {room.precioAlSalir ? <InfoItem icon="arrow-forward-outline" label="Al salir" value={`$${room.precioAlSalir.toLocaleString('es-MX')}/mes`} /> : null}
              <InfoItem icon="grid-outline"       label="Amenidades" value={room.amenidades.join(' · ')} />
            </View>

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
                  <Text style={[detStyles.estadoChipText, { color: room.estado === estado && estado === 'disponible' ? cartasBosque.helecho : room.estado === estado ? cartasBosque.bruma : cartasBosque.helecho }]}>
                    {ESTADO_LABEL[estado]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {room.moduloRemodelacion && (
              <View style={detStyles.remodelBox}>
                <Ionicons name="construct-outline" size={14} color="#CDB29D" />
                <Text style={detStyles.remodelText}>
                  Módulo remodelación disponible · Pequeña → Grande $3,600/mes.{'\n'}Gestionar desde Catálogo.
                </Text>
              </View>
            )}
          </>
        )}

        {/* ── TAB EDITAR ── */}
        {tab === 'editar' && (
          <>
            <Text style={editStyles.secLabel}>Tipo</Text>
            <View style={editStyles.chipRow}>
              {TIPOS_HAB.map(t => (
                <TouchableOpacity key={t} style={[editStyles.chip, editForm.tipo === t && editStyles.chipActive]} onPress={() => setEditForm(f => ({ ...f, tipo: t }))}>
                  <Text style={[editStyles.chipText, editForm.tipo === t && editStyles.chipTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={editStyles.secLabel}>Tamaño</Text>
            <View style={editStyles.chipRow}>
              {TAMANOS.map(t => (
                <TouchableOpacity key={t} style={[editStyles.chip, editForm.tamano === t && editStyles.chipActive]} onPress={() => setEditForm(f => ({ ...f, tamano: t }))}>
                  <Text style={[editStyles.chipText, editForm.tamano === t && editStyles.chipTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={editStyles.row3}>
              <View style={{ flex: 1 }}>
                <Text style={editStyles.secLabel}>Precio mensual</Text>
                <View style={editStyles.priceWrap}>
                  <Text style={editStyles.prefijo}>$</Text>
                  <TextInput style={editStyles.priceInput} keyboardType="numeric"
                    value={editForm.precioMensual} onChangeText={v => setEditForm(f => ({ ...f, precioMensual: v }))} />
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={editStyles.secLabel}>Al salir</Text>
                <View style={editStyles.priceWrap}>
                  <Text style={editStyles.prefijo}>$</Text>
                  <TextInput style={editStyles.priceInput} keyboardType="numeric"
                    value={editForm.precioAlSalir} onChangeText={v => setEditForm(f => ({ ...f, precioAlSalir: v }))} />
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={editStyles.secLabel}>Depósito</Text>
                <View style={editStyles.priceWrap}>
                  <Text style={editStyles.prefijo}>$</Text>
                  <TextInput style={editStyles.priceInput} keyboardType="numeric"
                    value={editForm.precioDeposito} onChangeText={v => setEditForm(f => ({ ...f, precioDeposito: v }))} />
                </View>
              </View>
            </View>

            <Text style={editStyles.secLabel}>Área m²</Text>
            <TextInput style={editStyles.input} keyboardType="numeric"
              value={editForm.area} onChangeText={v => setEditForm(f => ({ ...f, area: v }))} />

            <Text style={editStyles.secLabel}>Amenidades</Text>
            <View style={editStyles.chipRow}>
              {AMENIDADES_OPCIONES.map(a => {
                const active = editForm.amenidades.includes(a);
                return (
                  <TouchableOpacity key={a} style={[editStyles.chip, active && editStyles.chipActive]} onPress={() => toggleAmenidad(a)}>
                    <Text style={[editStyles.chipText, active && editStyles.chipTextActive]}>{a}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* ── Módulos habilitados ── */}
            <Text style={editStyles.modulosLabel}>MÓDULOS HABILITADOS</Text>
            <View style={editStyles.modulosBox}>
              <ModuloRow label="Lavandería"     value={modLavanderia}     onChange={setModLavanderia} />
              <ModuloRow label="Almacenamiento" value={modAlmacenamiento} onChange={setModAlmacenamiento} />
              <ModuloRow label="Huésped extra"  value={modHuespedExtra}   onChange={setModHuespedExtra} />
              <ModuloRow label="Visitas"        value={modVisitas}        onChange={setModVisitas} />
              <ModuloRow label="Facturación"    value={modFacturacion}    onChange={setModFacturacion} />
            </View>

            {/* ── Notas internas ── */}
            <Text style={editStyles.secLabel}>Notas internas</Text>
            <TextInput
              style={editStyles.textArea}
              multiline
              value={editForm.descripcion}
              onChangeText={v => setEditForm(f => ({ ...f, descripcion: v }))}
              placeholder="Notas internas sobre esta habitación…"
              placeholderTextColor={cartasBosque.helecho}
            />

            <View style={editStyles.switchRow}>
              <View>
                <Text style={editStyles.switchLabel}>Habilitada</Text>
                <Text style={editStyles.switchSub}>
                  {editForm.habilitada ? 'Disponible para inquilinos' : 'Marcará como Construcción'}
                </Text>
              </View>
              <Switch value={editForm.habilitada} onValueChange={v => setEditForm(f => ({ ...f, habilitada: v }))}
                trackColor={{ true: cartasBosque.bosque, false: cartasBosque.pergaminoOscuro }}
                thumbColor={cartasBosque.bruma} />
            </View>

            {room.estado === 'mantenimiento' && (
              <>
                <Text style={editStyles.secLabel}>Fecha estimada disponibilidad</Text>
                <View style={editStyles.dateRow}>
                  <TextInput style={[editStyles.datePart, { flex: 1 }]} placeholder="DD" placeholderTextColor={cartasBosque.helecho}
                    keyboardType="numeric" maxLength={2}
                    value={editForm.fechaDia} onChangeText={v => setEditForm(f => ({ ...f, fechaDia: v }))} />
                  <Text style={editStyles.dateSep}>/</Text>
                  <TextInput style={[editStyles.datePart, { flex: 1 }]} placeholder="MM" placeholderTextColor={cartasBosque.helecho}
                    keyboardType="numeric" maxLength={2}
                    value={editForm.fechaMes} onChangeText={v => setEditForm(f => ({ ...f, fechaMes: v }))} />
                  <Text style={editStyles.dateSep}>/</Text>
                  <TextInput style={[editStyles.datePart, { flex: 2 }]} placeholder="AAAA" placeholderTextColor={cartasBosque.helecho}
                    keyboardType="numeric" maxLength={4}
                    value={editForm.fechaAnio} onChangeText={v => setEditForm(f => ({ ...f, fechaAnio: v }))} />
                </View>
                <TouchableOpacity style={editStyles.marcarListaBtn} onPress={marcarLista}>
                  <Ionicons name="checkmark-circle-outline" size={14} color="#4A9B6F" />
                  <Text style={editStyles.marcarListaText}>Marcar lista → Disponible</Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity
              style={[editStyles.guardarBtn, guardando && { opacity: 0.6 }]}
              onPress={guardarCambios} disabled={guardando}
            >
              {guardando
                ? <ActivityIndicator color={cartasBosque.bruma} size="small" />
                : <Text style={editStyles.guardarBtnText}>Guardar cambios</Text>}
            </TouchableOpacity>
          </>
        )}

        {/* ── TAB MÉTRICAS ── */}
        {tab === 'metricas' && (
          metricasCargando ? (
            <ActivityIndicator color={cartasBosque.bosque} style={{ marginTop: spacing[8] }} />
          ) : metricas ? (
            <>
              <View style={metStyles.grid}>
                <View style={metStyles.card}>
                  <Text style={[metStyles.val, { color: '#4A9B6F' }]}>${metricas.ingresosTotal.toLocaleString('es-MX')}</Text>
                  <Text style={metStyles.cardLabel}>Ingresos históricos</Text>
                </View>
                <View style={metStyles.card}>
                  <Text style={[metStyles.val, { color: '#3B82F6' }]}>{metricas.totalInquilinos}</Text>
                  <Text style={metStyles.cardLabel}>Inquilinos totales</Text>
                </View>
                <View style={metStyles.card}>
                  <Text style={[metStyles.val, { color: '#E8A838' }]}>
                    {metricas.diasVaciaAprox !== null ? `~${metricas.diasVaciaAprox}d` : '—'}
                  </Text>
                  <Text style={metStyles.cardLabel}>Días vacía (aprox.)</Text>
                </View>
              </View>

              {metricas.diasEnConstruccion !== null && (
                <View style={metStyles.construccionCard}>
                  <Text style={[metStyles.val, { color: '#E05C2A' }]}>{metricas.diasEnConstruccion}d</Text>
                  <Text style={metStyles.cardLabel}>Días en construcción</Text>
                </View>
              )}

              <Text style={metStyles.secLabel}>Tickets asociados</Text>
              <View style={metStyles.ticketsRow}>
                <View style={metStyles.ticketCard}>
                  <Text style={[metStyles.ticketVal, { color: '#3B82F6' }]}>{metricas.ticketsTotal}</Text>
                  <Text style={metStyles.ticketLabel}>Total</Text>
                </View>
                <View style={metStyles.ticketCard}>
                  <Text style={[metStyles.ticketVal, { color: '#E8A838' }]}>{metricas.ticketsEnProceso}</Text>
                  <Text style={metStyles.ticketLabel}>En proceso</Text>
                </View>
                <View style={metStyles.ticketCard}>
                  <Text style={[metStyles.ticketVal, { color: '#4A9B6F' }]}>{metricas.ticketsResueltos}</Text>
                  <Text style={metStyles.ticketLabel}>Resueltos</Text>
                </View>
              </View>
            </>
          ) : null
        )}
      </ScrollView>
    </View>
  );
}

// ─── InfoItem ─────────────────────────────────────────────────

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
    borderRadius: borderRadius.lg, paddingVertical: spacing[2] + 2,
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
  },
  value: { fontFamily: 'Inter_700Bold', fontSize: 18 },
  label: { fontFamily: 'SpaceMono_400Regular', fontSize: 9, color: cartasBosque.helecho, letterSpacing: 0.3 },
});

// ─── StyleSheets ──────────────────────────────────────────────

const detStyles = StyleSheet.create({
  head:    { flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginBottom: spacing[3] },
  numBox:  { width: 52, height: 52, borderRadius: borderRadius.lg, alignItems: 'center', justifyContent: 'center' },
  numText: { fontFamily: 'Inter_700Bold', fontSize: 22, color: cartasBosque.tinta },
  tamano:  { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: cartasBosque.tinta },
  pisoStr: { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.helecho, marginTop: 2 },

  tabBar:           { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro, marginBottom: spacing[1] },
  tabBtn:           { flex: 1, alignItems: 'center', paddingVertical: spacing[2] },
  tabBtnActive:     { borderBottomWidth: 2, borderBottomColor: cartasBosque.bosque },
  tabBtnText:       { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.helecho, letterSpacing: 0.5 },
  tabBtnTextActive: { color: cartasBosque.bosque, fontFamily: 'Inter_600SemiBold', fontSize: 11 },

  estadoBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], alignSelf: 'flex-start', paddingHorizontal: spacing[3], paddingVertical: spacing[1] + 1, borderRadius: borderRadius.full, marginBottom: spacing[3] },
  estadoDot:   { width: 8, height: 8, borderRadius: 4 },
  estadoText:  { fontFamily: 'Inter_600SemiBold', fontSize: 13 },

  infoRow:   { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[2], flexWrap: 'wrap' },
  infoText:  { fontFamily: 'Inter_500Medium', fontSize: 14, color: cartasBosque.tinta },
  expBtn:    { paddingHorizontal: spacing[2], paddingVertical: spacing[1], borderRadius: borderRadius.full, backgroundColor: cartasBosque.pergaminoOscuro },
  expBtnText:{ fontFamily: 'Inter_600SemiBold', fontSize: 11, color: cartasBosque.bosque },

  infoGrid:  { gap: spacing[2] + 1, marginBottom: spacing[4] },
  infoItem:  { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2] },
  infoLabel: { fontFamily: 'SpaceMono_400Regular', fontSize: 9, color: cartasBosque.helecho, letterSpacing: 0.5 },
  infoValue: { fontFamily: 'Inter_500Medium', fontSize: 13, color: cartasBosque.tinta },

  cambiarLabel: { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.helecho, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: spacing[2] },
  estadosRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginBottom: spacing[4] },
  estadoChip:   { paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: borderRadius.full },
  estadoChipActive: { shadowColor: '#122A1F', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 3, elevation: 2 },
  estadoChipText:   { fontFamily: 'Inter_500Medium', fontSize: 12 },

  remodelBox:  { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2], backgroundColor: 'rgba(205,178,157,0.12)', borderRadius: borderRadius.md, padding: spacing[3], marginBottom: spacing[2] },
  remodelText: { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.helecho, flex: 1, lineHeight: 16 },
});

const editStyles = StyleSheet.create({
  secLabel:   { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.helecho, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: spacing[1], marginTop: spacing[3] },
  input: {
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro, borderRadius: borderRadius.md,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    fontFamily: 'Inter_400Regular', fontSize: 13, color: cartasBosque.tinta,
    backgroundColor: cartasBosque.pergamino,
  },
  textArea: {
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro, borderRadius: borderRadius.md,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    fontFamily: 'Inter_400Regular', fontSize: 13, color: cartasBosque.tinta,
    backgroundColor: cartasBosque.pergamino, minHeight: 64, textAlignVertical: 'top',
  },
  row3:       { flexDirection: 'row', gap: spacing[2] },
  priceWrap:  { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro, borderRadius: borderRadius.md, backgroundColor: cartasBosque.pergamino, overflow: 'hidden' },
  prefijo:    { paddingHorizontal: spacing[2], fontFamily: 'Inter_400Regular', fontSize: 13, color: cartasBosque.helecho },
  priceInput: { flex: 1, paddingVertical: spacing[2], fontFamily: 'Inter_400Regular', fontSize: 13, color: cartasBosque.tinta },
  chipRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[1] + 1 },
  chip:       { paddingHorizontal: spacing[2] + 2, paddingVertical: spacing[1] + 1, borderRadius: borderRadius.full, borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro, backgroundColor: cartasBosque.pergamino },
  chipActive: { backgroundColor: cartasBosque.bosque, borderColor: cartasBosque.bosque },
  chipText:       { fontFamily: 'Inter_400Regular', fontSize: 12, color: cartasBosque.helecho },
  chipTextActive: { fontFamily: 'Inter_600SemiBold', color: cartasBosque.bruma },

  modulosLabel: { fontFamily: 'SpaceMono_400Regular', fontSize: 9, color: cartasBosque.helecho, letterSpacing: 1, textTransform: 'uppercase', marginTop: spacing[4], marginBottom: spacing[2] },
  modulosBox:   { borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro, borderRadius: borderRadius.md, backgroundColor: cartasBosque.pergamino, paddingHorizontal: spacing[3], overflow: 'hidden' },

  switchRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing[4], paddingVertical: spacing[2] },
  switchLabel:  { fontFamily: 'Inter_500Medium', fontSize: 14, color: cartasBosque.tinta },
  switchSub:    { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.helecho, marginTop: 2 },
  dateRow:      { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  datePart:     { borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro, borderRadius: borderRadius.md, paddingHorizontal: spacing[2], paddingVertical: spacing[2], fontFamily: 'Inter_400Regular', fontSize: 13, color: cartasBosque.tinta, backgroundColor: cartasBosque.pergamino, textAlign: 'center' },
  dateSep:      { fontFamily: 'Inter_400Regular', fontSize: 14, color: cartasBosque.helecho },
  marcarListaBtn:  { flexDirection: 'row', alignItems: 'center', gap: spacing[1], marginTop: spacing[3], paddingVertical: spacing[2], paddingHorizontal: spacing[3], borderRadius: borderRadius.full, backgroundColor: '#4A9B6F18', borderWidth: 1, borderColor: '#4A9B6F44', alignSelf: 'flex-start' },
  marcarListaText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#4A9B6F' },
  guardarBtn:      { marginTop: spacing[5], backgroundColor: cartasBosque.bosque, borderRadius: borderRadius.full, paddingVertical: spacing[3], alignItems: 'center' },
  guardarBtnText:  { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: cartasBosque.bruma },
});

const metStyles = StyleSheet.create({
  grid:            { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[3] },
  card:            { flex: 1, backgroundColor: cartasBosque.pergamino, borderRadius: borderRadius.md, padding: spacing[3], borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro, alignItems: 'center' },
  construccionCard:{ backgroundColor: cartasBosque.pergamino, borderRadius: borderRadius.md, padding: spacing[3], borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro, alignItems: 'center', marginBottom: spacing[3] },
  val:             { fontFamily: 'Inter_700Bold', fontSize: 18, marginBottom: 2 },
  cardLabel:       { fontFamily: 'SpaceMono_400Regular', fontSize: 9, color: cartasBosque.helecho, textAlign: 'center' },
  secLabel:        { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.helecho, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: spacing[2] },
  ticketsRow:      { flexDirection: 'row', gap: spacing[2] },
  ticketCard:      { flex: 1, backgroundColor: cartasBosque.pergamino, borderRadius: borderRadius.md, padding: spacing[3], borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro, alignItems: 'center' },
  ticketVal:       { fontFamily: 'Inter_700Bold', fontSize: 22 },
  ticketLabel:     { fontFamily: 'SpaceMono_400Regular', fontSize: 9, color: cartasBosque.helecho, marginTop: 2 },
});

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: cartasBosque.bruma },
  content: { padding: H_PADDING, paddingBottom: spacing[10], gap: spacing[5] },
  center:  { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: cartasBosque.bruma },

  header:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  eyebrow:    { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.helecho, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: spacing[0] + 2 },
  title:      { fontFamily: 'Inter_700Bold', fontSize: 26, color: cartasBosque.bosque, letterSpacing: -0.3 },
  headerBtns: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },

  iconBtn: {
    width: 36, height: 36, borderRadius: borderRadius.full,
    borderWidth: 1.5, borderColor: cartasBosque.bosque,
    alignItems: 'center', justifyContent: 'center',
  },
  nuevaBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[1],
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    borderRadius: borderRadius.full,
    backgroundColor: cartasBosque.bosque,
  },
  nuevaBtnText:    { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: cartasBosque.bruma },
  catalogoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[1] + 1,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    borderRadius: borderRadius.full, borderWidth: 1.5, borderColor: cartasBosque.bosque,
  },
  catalogoBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: cartasBosque.bosque },

  filtrosWrap: { gap: spacing[2] },
  filtrosRow:  { gap: spacing[2], paddingVertical: spacing[1] },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: spacing[3], paddingVertical: spacing[1] + 2,
    borderRadius: borderRadius.full, borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    backgroundColor: cartasBosque.pergamino,
  },
  filterChipActive:     { backgroundColor: cartasBosque.bosque, borderColor: cartasBosque.bosque },
  filterDot:            { width: 7, height: 7, borderRadius: 4 },
  filterChipText:       { fontFamily: 'Inter_400Regular', fontSize: 12, color: cartasBosque.helecho },
  filterChipTextActive: { fontFamily: 'Inter_600SemiBold', color: cartasBosque.bruma },

  statsRow: { flexDirection: 'row', gap: spacing[2] },

  leyenda:      { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  leyendaItem:  { flexDirection: 'row', alignItems: 'center', gap: spacing[1] + 1 },
  leyendaDot:   { width: 10, height: 10, borderRadius: 5, borderWidth: 1, borderColor: 'rgba(18,42,31,0.08)' },
  leyendaLabel: { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.helecho },

  listaVacia: { fontFamily: 'Inter_400Regular', fontSize: 13, color: cartasBosque.helecho, textAlign: 'center', marginTop: spacing[6], fontStyle: 'italic' },

  slotsSection: { gap: spacing[2] },
  slotsLabel:   { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.helecho, letterSpacing: 0.8, textTransform: 'uppercase' },
  slotsRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  slotChip:     { height: 36, borderRadius: borderRadius.md, backgroundColor: '#EAEAE4', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#D8D8D0', borderStyle: 'dashed' },
  slotEtc:      { backgroundColor: 'transparent', borderColor: '#E8EBE0' },
  slotText:     { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: '#A8A8A0' },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(18,42,31,0.4)' },
  detailSheet: {
    backgroundColor: cartasBosque.bruma,
    borderTopLeftRadius: borderRadius['2xl'],
    borderTopRightRadius: borderRadius['2xl'],
    paddingTop: spacing[3],
    paddingHorizontal: spacing[5],
    paddingBottom: 0,
    height: '92%',
  },
  modalHandle:   { width: 36, height: 4, borderRadius: 2, backgroundColor: cartasBosque.pergaminoOscuro, alignSelf: 'center', marginBottom: spacing[4] },
  catalogoModal: { flex: 1, backgroundColor: cartasBosque.bruma },

  seedBtn:  { alignSelf: 'center', paddingVertical: spacing[2], paddingHorizontal: spacing[4], borderRadius: borderRadius.full, borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro },
  seedText: { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.helecho },
});
