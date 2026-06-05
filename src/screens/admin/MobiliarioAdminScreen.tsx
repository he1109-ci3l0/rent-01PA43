import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, TextInput, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  collection, addDoc, updateDoc, doc, onSnapshot,
  query, orderBy, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db, collections } from '@/services/firebase/firestore';
import { cartasBosque } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/spacing';
import type { Inquilino } from '@/types/firestore';

// ─── Tipos ────────────────────────────────────────────────────

type TipoArticulo = 'cama' | 'colchon' | 'escritorio' | 'silla' | 'otro';
type EstadoArticulo = 'disponible' | 'asignado' | 'mantenimiento';

interface ArticuloMobiliario {
  id: string;
  tipo: TipoArticulo;
  descripcion: string;
  precioMensual: number;
  estado: EstadoArticulo;
  inquilinoId: string | null;
  inquilinoNombre: string | null;
  habitacionId: string | null;
  habitacionNumero: string | null;
  empresa: string;
  creadoEn: Timestamp;
  actualizadoEn: Timestamp;
}

const TIPO_LABELS: Record<TipoArticulo, string> = {
  cama:       'Cama',
  colchon:    'Colchón',
  escritorio: 'Escritorio',
  silla:      'Silla',
  otro:       'Otro',
};

const TIPO_ICONS: Record<TipoArticulo, string> = {
  cama:       'bed-outline',
  colchon:    'bed-outline',
  escritorio: 'desktop-outline',
  silla:      'accessibility-outline',
  otro:       'cube-outline',
};

const ESTADO_COLORS: Record<EstadoArticulo, string> = {
  disponible:    '#4A9B6F',
  asignado:      cartasBosque.bosque,
  mantenimiento: '#E8A838',
};

const EMPRESA = 'Servicios Kadamees Integrales';
const TIPOS: TipoArticulo[] = ['cama', 'colchon', 'escritorio', 'silla', 'otro'];

type Vista = 'lista' | 'nuevo';

// ─── Componente ───────────────────────────────────────────────

export default function MobiliarioAdminScreen() {
  const [articulos, setArticulos] = useState<ArticuloMobiliario[]>([]);
  const [inquilinos, setInquilinos] = useState<Inquilino[]>([]);
  const [cargando, setCargando] = useState(true);
  const [vista, setVista] = useState<Vista>('lista');

  // Form nuevo artículo
  const [tipo, setTipo] = useState<TipoArticulo>('cama');
  const [descripcion, setDescripcion] = useState('');
  const [precio, setPrecio] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const q = query(
      collection(db, 'mobiliario'),
      orderBy('creadoEn', 'desc'),
    );
    const unsub = onSnapshot(q, snap => {
      setArticulos(snap.docs.map(d => ({ ...d.data(), id: d.id } as ArticuloMobiliario)));
      setCargando(false);
    }, () => setCargando(false));

    const unsubInq = onSnapshot(
      query(collections.inquilinos),
      snap => setInquilinos(snap.docs.map(d => ({ ...d.data(), id: d.id } as Inquilino))),
      () => {},
    );

    return () => { unsub(); unsubInq(); };
  }, []);

  async function handleCrear() {
    if (!descripcion.trim() || !precio.trim()) {
      setError('Descripción y precio son obligatorios.');
      return;
    }
    setEnviando(true);
    setError('');
    try {
      const ahora = serverTimestamp();
      await addDoc(collection(db, 'mobiliario'), {
        tipo,
        descripcion:      descripcion.trim(),
        precioMensual:    Number(precio),
        estado:           'disponible',
        inquilinoId:      null,
        inquilinoNombre:  null,
        habitacionId:     null,
        habitacionNumero: null,
        empresa:          EMPRESA,
        creadoEn:         ahora,
        actualizadoEn:    ahora,
      });
      setDescripcion(''); setPrecio(''); setTipo('cama');
      setVista('lista');
    } catch (e: any) {
      setError('Error: ' + (e.message ?? 'intenta de nuevo'));
    } finally {
      setEnviando(false);
    }
  }

  async function handleAsignar(articulo: ArticuloMobiliario, inquilinoId: string) {
    const inq = inquilinos.find(i => i.uid === inquilinoId);
    if (!inq) return;
    try {
      await updateDoc(doc(db, 'mobiliario', articulo.id), {
        estado:           'asignado',
        inquilinoId:      inq.uid,
        inquilinoNombre:  `${inq.nombre} ${inq.apellido}`,
        habitacionId:     inq.habitacionId,
        habitacionNumero: (inq as any).habitacionNumero ?? inq.habitacionId,
        actualizadoEn:    serverTimestamp(),
      });
    } catch {
      Alert.alert('Error', 'No se pudo asignar el artículo.');
    }
  }

  async function handleLiberar(articuloId: string) {
    Alert.alert(
      'Liberar artículo',
      '¿Confirmas que este artículo ya no está asignado?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Liberar', style: 'destructive',
          onPress: async () => {
            try {
              await updateDoc(doc(db, 'mobiliario', articuloId), {
                estado:           'disponible',
                inquilinoId:      null,
                inquilinoNombre:  null,
                habitacionId:     null,
                habitacionNumero: null,
                actualizadoEn:    serverTimestamp(),
              });
            } catch {
              Alert.alert('Error', 'No se pudo liberar el artículo.');
            }
          },
        },
      ],
    );
  }

  async function handleToggleMantenimiento(articulo: ArticuloMobiliario) {
    const nuevoEstado: EstadoArticulo = articulo.estado === 'mantenimiento'
      ? 'disponible' : 'mantenimiento';
    try {
      await updateDoc(doc(db, 'mobiliario', articulo.id), {
        estado: nuevoEstado,
        actualizadoEn: serverTimestamp(),
      });
    } catch {
      Alert.alert('Error', 'No se pudo actualizar el estado.');
    }
  }

  // ── Vista nuevo artículo ──────────────────────────────────────

  if (vista === 'nuevo') {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => { setVista('lista'); setError(''); }}>
            <Ionicons name="arrow-back" size={20} color={cartasBosque.tinta} />
          </TouchableOpacity>
          <Text style={s.headerTitulo}>Nuevo artículo</Text>
          <View style={{ width: 20 }} />
        </View>

        <ScrollView contentContainerStyle={s.formContent} keyboardShouldPersistTaps="handled">
          <Text style={s.fieldLabel}>Tipo</Text>
          <View style={s.chipRow}>
            {TIPOS.map(t => (
              <TouchableOpacity
                key={t}
                style={[s.chip, tipo === t && s.chipActivo]}
                onPress={() => setTipo(t)}
              >
                <Text style={[s.chipText, tipo === t && s.chipTextActivo]}>
                  {TIPO_LABELS[t]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.fieldLabel}>Descripción</Text>
          <TextInput
            style={s.input}
            value={descripcion}
            onChangeText={setDescripcion}
            placeholder="Ej. Cama individual con base de madera"
            placeholderTextColor={cartasBosque.salvia}
          />

          <Text style={s.fieldLabel}>Precio mensual (MXN)</Text>
          <TextInput
            style={s.input}
            value={precio}
            onChangeText={setPrecio}
            placeholder="500"
            keyboardType="numeric"
            placeholderTextColor={cartasBosque.salvia}
          />

          <Text style={s.empresaNote}>Empresa: {EMPRESA}</Text>

          {error ? <Text style={s.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[s.btnPrimario, enviando && { opacity: 0.6 }]}
            onPress={handleCrear}
            disabled={enviando}
          >
            {enviando
              ? <ActivityIndicator color={cartasBosque.bruma} />
              : <Text style={s.btnPrimarioText}>Crear artículo</Text>
            }
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Vista lista ───────────────────────────────────────────────

  const disponibles   = articulos.filter(a => a.estado === 'disponible');
  const asignados     = articulos.filter(a => a.estado === 'asignado');
  const mantenimiento = articulos.filter(a => a.estado === 'mantenimiento');

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Text style={s.headerTitulo}>Mobiliario</Text>
        <TouchableOpacity style={s.btnNuevo} onPress={() => setVista('nuevo')}>
          <Ionicons name="add" size={16} color={cartasBosque.bruma} />
          <Text style={s.btnNuevoText}>Nuevo</Text>
        </TouchableOpacity>
      </View>

      {cargando ? (
        <View style={s.center}>
          <ActivityIndicator color={cartasBosque.bosque} />
        </View>
      ) : articulos.length === 0 ? (
        <View style={s.center}>
          <Ionicons name="bed-outline" size={40} color={cartasBosque.salvia} />
          <Text style={s.vacioText}>Sin artículos registrados</Text>
          <Text style={s.vacioSub}>Agrega camas, colchones, escritorios y más</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.listContent}>

          {asignados.length > 0 && (
            <>
              <Text style={s.seccionTitulo}>Asignados ({asignados.length})</Text>
              {asignados.map(a => (
                <ArticuloCard
                  key={a.id}
                  articulo={a}
                  inquilinos={inquilinos}
                  onAsignar={handleAsignar}
                  onLiberar={handleLiberar}
                  onToggleMantenimiento={handleToggleMantenimiento}
                />
              ))}
            </>
          )}

          {disponibles.length > 0 && (
            <>
              <Text style={s.seccionTitulo}>Disponibles ({disponibles.length})</Text>
              {disponibles.map(a => (
                <ArticuloCard
                  key={a.id}
                  articulo={a}
                  inquilinos={inquilinos}
                  onAsignar={handleAsignar}
                  onLiberar={handleLiberar}
                  onToggleMantenimiento={handleToggleMantenimiento}
                />
              ))}
            </>
          )}

          {mantenimiento.length > 0 && (
            <>
              <Text style={s.seccionTitulo}>En mantenimiento ({mantenimiento.length})</Text>
              {mantenimiento.map(a => (
                <ArticuloCard
                  key={a.id}
                  articulo={a}
                  inquilinos={inquilinos}
                  onAsignar={handleAsignar}
                  onLiberar={handleLiberar}
                  onToggleMantenimiento={handleToggleMantenimiento}
                />
              ))}
            </>
          )}

        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─── ArticuloCard ─────────────────────────────────────────────

function ArticuloCard({ articulo, inquilinos, onAsignar, onLiberar, onToggleMantenimiento }: {
  articulo: ArticuloMobiliario;
  inquilinos: Inquilino[];
  onAsignar: (a: ArticuloMobiliario, inquilinoId: string) => void;
  onLiberar: (id: string) => void;
  onToggleMantenimiento: (a: ArticuloMobiliario) => void;
}) {
  const [expandido, setExpandido] = useState(false);
  const [selecInq, setSelecInq] = useState('');

  const inqActivos = inquilinos.filter(i => i.estado === 'activo');

  return (
    <View style={s.card}>
      <TouchableOpacity style={s.cardHeader} onPress={() => setExpandido(v => !v)} activeOpacity={0.75}>
        <View style={[s.cardIcon, { backgroundColor: ESTADO_COLORS[articulo.estado] + '22' }]}>
          <Ionicons name={TIPO_ICONS[articulo.tipo] as any} size={18} color={ESTADO_COLORS[articulo.estado]} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.cardTipo}>{TIPO_LABELS[articulo.tipo]}</Text>
          <Text style={s.cardDesc} numberOfLines={1}>{articulo.descripcion}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 2 }}>
          <View style={[s.estadoBadge, { backgroundColor: ESTADO_COLORS[articulo.estado] + '22' }]}>
            <Text style={[s.estadoText, { color: ESTADO_COLORS[articulo.estado] }]}>
              {articulo.estado}
            </Text>
          </View>
          <Text style={s.precio}>${articulo.precioMensual}/mes</Text>
        </View>
      </TouchableOpacity>

      {expandido && (
        <View style={s.cardBody}>
          {articulo.estado === 'asignado' && (
            <>
              <Text style={s.bodyLabel}>Asignado a</Text>
              <Text style={s.bodyValor}>{articulo.inquilinoNombre} · Hab. {articulo.habitacionNumero}</Text>
              <TouchableOpacity style={s.btnLiberar} onPress={() => onLiberar(articulo.id)}>
                <Text style={s.btnLiberarText}>Liberar artículo</Text>
              </TouchableOpacity>
            </>
          )}

          {articulo.estado === 'disponible' && inqActivos.length > 0 && (
            <>
              <Text style={s.bodyLabel}>Asignar a inquilino</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing[2] }}>
                <View style={{ flexDirection: 'row', gap: spacing[1] }}>
                  {inqActivos.map(inq => (
                    <TouchableOpacity
                      key={inq.uid}
                      style={[s.inqChip, selecInq === inq.uid && s.inqChipActivo]}
                      onPress={() => setSelecInq(inq.uid)}
                    >
                      <Text style={[s.inqChipText, selecInq === inq.uid && s.inqChipTextActivo]}>
                        {inq.nombre} · Hab. {(inq as any).habitacionNumero ?? inq.habitacionId}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
              {selecInq ? (
                <TouchableOpacity
                  style={s.btnAsignar}
                  onPress={() => { onAsignar(articulo, selecInq); setSelecInq(''); setExpandido(false); }}
                >
                  <Text style={s.btnAsignarText}>Confirmar asignación</Text>
                </TouchableOpacity>
              ) : null}
            </>
          )}

          <TouchableOpacity style={s.btnMantenimiento} onPress={() => onToggleMantenimiento(articulo)}>
            <Ionicons
              name={articulo.estado === 'mantenimiento' ? 'checkmark-circle-outline' : 'construct-outline'}
              size={13}
              color={cartasBosque.acento}
            />
            <Text style={s.btnMantenimientoText}>
              {articulo.estado === 'mantenimiento' ? 'Marcar disponible' : 'Enviar a mantenimiento'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: cartasBosque.bruma },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[4], paddingVertical: spacing[3], borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro },
  headerTitulo:{ fontFamily: 'Inter_600SemiBold', fontSize: 18, color: cartasBosque.tinta },
  btnNuevo:    { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: cartasBosque.bosque, borderRadius: borderRadius.sm, paddingHorizontal: spacing[3], paddingVertical: spacing[1] + 2 },
  btnNuevoText:{ fontFamily: 'Inter_600SemiBold', fontSize: 12, color: cartasBosque.bruma },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[2] },
  vacioText:   { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: cartasBosque.tinta },
  vacioSub:    { fontFamily: 'Inter_400Regular', fontSize: 13, color: cartasBosque.helecho, textAlign: 'center' },
  listContent: { padding: spacing[4], paddingBottom: spacing[8] },
  formContent: { padding: spacing[4], paddingBottom: spacing[8] },
  seccionTitulo: { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.helecho, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: spacing[2], marginTop: spacing[3] },
  card:        { backgroundColor: cartasBosque.pergamino, borderRadius: borderRadius.md, borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro, marginBottom: spacing[2], overflow: 'hidden' },
  cardHeader:  { flexDirection: 'row', alignItems: 'center', gap: spacing[3], padding: spacing[3] },
  cardIcon:    { width: 36, height: 36, borderRadius: borderRadius.sm, alignItems: 'center', justifyContent: 'center' },
  cardTipo:    { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: cartasBosque.tinta },
  cardDesc:    { fontFamily: 'Inter_400Regular', fontSize: 11, color: cartasBosque.helecho, marginTop: 1 },
  estadoBadge: { paddingHorizontal: spacing[2], paddingVertical: 2, borderRadius: borderRadius.sm },
  estadoText:  { fontFamily: 'SpaceMono_400Regular', fontSize: 9 },
  precio:      { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.helecho },
  cardBody:    { padding: spacing[3], paddingTop: 0, borderTopWidth: 1, borderTopColor: cartasBosque.pergaminoOscuro, gap: spacing[2] },
  bodyLabel:   { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.helecho, letterSpacing: 0.5 },
  bodyValor:   { fontFamily: 'Inter_500Medium', fontSize: 13, color: cartasBosque.tinta },
  btnLiberar:  { borderWidth: 1, borderColor: cartasBosque.alertaBorde, borderRadius: borderRadius.sm, paddingVertical: spacing[2], alignItems: 'center' },
  btnLiberarText: { fontFamily: 'Inter_400Regular', fontSize: 12, color: cartasBosque.alertaBorde },
  btnAsignar:  { backgroundColor: cartasBosque.bosque, borderRadius: borderRadius.sm, paddingVertical: spacing[2] + 2, alignItems: 'center' },
  btnAsignarText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: cartasBosque.bruma },
  btnMantenimiento: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  btnMantenimientoText: { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.acento, textDecorationLine: 'underline' },
  inqChip:     { borderRadius: borderRadius.sm, borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro, paddingHorizontal: spacing[2], paddingVertical: spacing[1], backgroundColor: cartasBosque.bruma },
  inqChipActivo: { backgroundColor: cartasBosque.bosque, borderColor: cartasBosque.bosque },
  inqChipText: { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.tinta },
  inqChipTextActivo: { color: cartasBosque.bruma },
  fieldLabel:  { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.helecho, letterSpacing: 0.5, marginTop: spacing[3], marginBottom: spacing[1] },
  input:       { backgroundColor: cartasBosque.pergamino, borderRadius: borderRadius.sm, borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro, paddingHorizontal: spacing[3], paddingVertical: spacing[2] + 2, fontFamily: 'Inter_400Regular', fontSize: 14, color: cartasBosque.tinta },
  chipRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  chip:        { borderRadius: borderRadius.sm, borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro, paddingHorizontal: spacing[3], paddingVertical: spacing[1] + 2, backgroundColor: cartasBosque.pergamino },
  chipActivo:  { backgroundColor: cartasBosque.bosque, borderColor: cartasBosque.bosque },
  chipText:    { fontFamily: 'Inter_400Regular', fontSize: 12, color: cartasBosque.tinta },
  chipTextActivo: { color: cartasBosque.bruma },
  empresaNote: { fontFamily: 'SpaceMono_400Regular', fontSize: 9, color: cartasBosque.helecho, marginTop: spacing[2] },
  errorText:   { fontFamily: 'Inter_400Regular', fontSize: 12, color: cartasBosque.alertaBorde, marginTop: spacing[2] },
  btnPrimario: { marginTop: spacing[4], backgroundColor: cartasBosque.bosque, borderRadius: borderRadius.sm, paddingVertical: spacing[3], alignItems: 'center' },
  btnPrimarioText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: cartasBosque.bruma },
});
