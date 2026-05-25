import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Modal, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import { setDoc, doc, getDocs, Timestamp } from 'firebase/firestore';
import { cartasBosque } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/spacing';
import { db, collections } from '@/services/firebase/firestore';
import ServiciosAdminScreen from '@/screens/admin/ServiciosAdminScreen';
import { inicializarExpediente } from '@/services/firebase/expedientes';
import {
  PLANTILLAS_META, listenDocumentosPlantillas, actualizarPlantillaUrl,
} from '@/services/firebase/documentosPlantillas';
import { useAuth } from '@/hooks/useAuth';
import type { Habitacion, Inquilino, DocumentoPlantilla } from '@/types/firestore';

type Tab = 'lista' | 'nuevo' | 'plantillas';

// ─── Formulario de registro ────────────────────────────────────

interface RegistroForm {
  nombre:       string;
  apellido:     string;
  curp:         string;
  telefono:     string;
  habitacionId: string;
  fechaIngreso: string;   // 'YYYY-MM-DD'
  rentaMensual: string;
  deposito:     string;
}

const BLANK: RegistroForm = {
  nombre: '', apellido: '', curp: '', telefono: '',
  habitacionId: '', fechaIngreso: '', rentaMensual: '', deposito: '',
};

function campo(id: string, hab: Habitacion) {
  return `${id.slice(0, 6)}_${hab.numero}`;
}

function NuevoInquilinoForm({ onDone }: { onDone: () => void }) {
  const [form, setForm]           = useState<RegistroForm>(BLANK);
  const [habs, setHabs]           = useState<Habitacion[]>([]);
  const [saving, setSaving]       = useState(false);
  const [preview, setPreview]     = useState<{ username: string; password: string } | null>(null);

  useEffect(() => {
    getDocs(collections.habitaciones).then(snap => {
      setHabs(
        snap.docs
          .map(d => ({ ...d.data(), id: d.id } as Habitacion))
          .filter(h => h.habilitada && h.estado !== 'ocupada')
          .sort((a, b) => a.numero.localeCompare(b.numero, undefined, { numeric: true }))
      );
    });
  }, []);

  function set(k: keyof RegistroForm, v: string) {
    setForm(f => ({ ...f, [k]: v }));
    setPreview(null);
  }

  function generarCredenciales(): { username: string; password: string; email: string } | null {
    const curp = form.curp.trim().toUpperCase();
    const hab  = habs.find(h => h.id === form.habitacionId);
    if (!curp || !hab || !form.nombre || !form.apellido) return null;
    const shortId = Date.now().toString(36).slice(-4).toUpperCase();
    const username = `tenant_${hab.numero.padStart(2, '0')}_${shortId}`.toLowerCase();
    return { username, password: curp, email: `${username}@antioquia43.app` };
  }

  function handlePreview() {
    const creds = generarCredenciales();
    if (!creds) {
      Alert.alert('Faltan datos', 'Completa nombre, apellido, CURP y habitación antes de previsualizar.');
      return;
    }
    setPreview({ username: creds.username, password: creds.password });
  }

  async function handleGuardar() {
    if (!form.nombre || !form.apellido || !form.curp || !form.habitacionId || !form.fechaIngreso) {
      Alert.alert('Faltan campos', 'Nombre, apellido, CURP, habitación y fecha de ingreso son obligatorios.');
      return;
    }
    const creds = generarCredenciales();
    if (!creds) return;
    setSaving(true);
    try {
      const auth = getAuth();
      const { user } = await createUserWithEmailAndPassword(auth, creds.email, creds.password);
      const hab = habs.find(h => h.id === form.habitacionId)!;
      const ahora = Timestamp.now();
      const [y, m, d] = form.fechaIngreso.split('-').map(Number);
      const fechaIngreso = Timestamp.fromDate(new Date(y, m - 1, d));

      await setDoc(doc(db, 'inquilinos', user.uid), {
        id:              user.uid,
        uid:             user.uid,
        nombre:          form.nombre.trim(),
        apellido:        form.apellido.trim(),
        email:           creds.email,
        telefono:        form.telefono.trim(),
        documentoTipo:   'CC',
        documentoNumero: form.curp.trim().toUpperCase(),
        habitacionId:    hab.id,
        fechaIngreso,
        fechaSalida:     null,
        estado:          'activo',
        rol:             'inquilino',
        requiresAdminAuth: false,
        rentaMensual:    form.rentaMensual ? Number(form.rentaMensual) : undefined,
        creadoEn:        ahora,
        actualizadoEn:   ahora,
      });

      // Inicializar expediente + copiar plantillas legales
      await inicializarExpediente(user.uid, {
        habitacionId:    hab.id,
        habitacionNumero: hab.numero,
      }).catch(() => {});

      Alert.alert(
        '¡Inquilino registrado!',
        `Username: ${creds.username}\nPassword (CURP): ${creds.password}\n\nComparte estas credenciales con el inquilino.`,
        [{ text: 'OK', onPress: onDone }],
      );
      setForm(BLANK);
      setPreview(null);
    } catch (err: any) {
      const msg = err?.code === 'auth/email-already-in-use'
        ? 'Ya existe una cuenta con ese CURP y habitación. Prueba con un username diferente.'
        : err?.message ?? 'Error al crear la cuenta.';
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={f.scroll} contentContainerStyle={f.content}>
      <Text style={f.heading}>Registro de nuevo inquilino</Text>
      <Text style={f.sub}>El sistema generará username y password automáticamente. La contraseña es el CURP.</Text>

      <Row label="Nombre *">
        <TextInput style={f.input} value={form.nombre} onChangeText={v => set('nombre', v)} placeholder="Nombre" />
      </Row>
      <Row label="Apellido *">
        <TextInput style={f.input} value={form.apellido} onChangeText={v => set('apellido', v)} placeholder="Apellido" />
      </Row>
      <Row label="CURP *">
        <TextInput
          style={f.input}
          value={form.curp}
          onChangeText={v => set('curp', v.toUpperCase())}
          placeholder="18 caracteres"
          autoCapitalize="characters"
          maxLength={18}
        />
      </Row>
      <Row label="Teléfono">
        <TextInput style={f.input} value={form.telefono} onChangeText={v => set('telefono', v)} placeholder="10 dígitos" keyboardType="phone-pad" />
      </Row>
      <Row label="Habitación *">
        <View style={f.habsGrid}>
          {habs.map(h => (
            <TouchableOpacity
              key={h.id}
              style={[f.habChip, form.habitacionId === h.id && f.habChipActivo]}
              onPress={() => set('habitacionId', h.id)}
              activeOpacity={0.7}
            >
              <Text style={[f.habChipText, form.habitacionId === h.id && f.habChipTextActivo]}>
                {h.numero}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Row>
      <Row label="Fecha ingreso *">
        <TextInput style={f.input} value={form.fechaIngreso} onChangeText={v => set('fechaIngreso', v)} placeholder="YYYY-MM-DD" />
      </Row>
      <Row label="Renta mensual">
        <TextInput style={f.input} value={form.rentaMensual} onChangeText={v => set('rentaMensual', v)} placeholder="$" keyboardType="numeric" />
      </Row>
      <Row label="Depósito">
        <TextInput style={f.input} value={form.deposito} onChangeText={v => set('deposito', v)} placeholder="$" keyboardType="numeric" />
      </Row>

      {/* Preview */}
      {preview && (
        <View style={f.previewBox}>
          <Text style={f.previewTitle}>Credenciales generadas</Text>
          <Text style={f.previewRow}>Username: <Text style={f.previewVal}>{preview.username}</Text></Text>
          <Text style={f.previewRow}>Password (CURP): <Text style={f.previewVal}>{preview.password}</Text></Text>
          <Text style={f.previewNote}>
            El inquilino podrá iniciar sesión con su CURP como contraseña. Recomiéndale cambiarla después del primer acceso.
          </Text>
        </View>
      )}

      <View style={f.btnRow}>
        <TouchableOpacity style={f.btnSecundario} onPress={handlePreview} activeOpacity={0.75}>
          <Ionicons name="eye-outline" size={16} color={cartasBosque.bosque} />
          <Text style={f.btnSecundarioText}>Previsualizar credenciales</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[f.btnPrimario, saving && { opacity: 0.5 }]}
          onPress={handleGuardar}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving
            ? <ActivityIndicator size="small" color="#FFFFFF" />
            : <>
                <Ionicons name="person-add-outline" size={16} color="#FFFFFF" />
                <Text style={f.btnPrimarioText}>Crear cuenta</Text>
              </>
          }
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={f.row}>
      <Text style={f.rowLabel}>{label}</Text>
      {children}
    </View>
  );
}

// ─── PlantillasPanel ──────────────────────────────────────────

function PlantillasPanel() {
  const { user } = useAuth();
  const [plantillas, setPlantillas] = useState<DocumentoPlantilla[]>([]);
  const [editando, setEditando]     = useState<string | null>(null);
  const [nuevaUrl, setNuevaUrl]     = useState('');
  const [nuevaVer, setNuevaVer]     = useState('');
  const [saving, setSaving]         = useState(false);

  useEffect(() => listenDocumentosPlantillas(setPlantillas), []);

  const metaMap = Object.fromEntries(PLANTILLAS_META.map(m => [m.tipo, m]));

  async function guardar(tipo: string) {
    if (!nuevaUrl.trim()) return;
    setSaving(true);
    try {
      await actualizarPlantillaUrl(
        tipo,
        nuevaUrl.trim(),
        `documentos/plantillas/${metaMap[tipo]?.nombreArchivo ?? tipo}`,
        nuevaVer.trim() || 'v1',
        user?.uid ?? '',
      );
      setEditando(null);
      setNuevaUrl('');
      setNuevaVer('');
    } catch {
      Alert.alert('Error', 'No se pudo actualizar la plantilla.');
    } finally {
      setSaving(false);
    }
  }

  const plantillaMap = Object.fromEntries(plantillas.map(p => [p.tipo, p]));

  return (
    <ScrollView style={p.scroll} contentContainerStyle={p.content}>
      <Text style={p.heading}>Documentos plantilla</Text>
      <Text style={p.sub}>
        Sube los archivos a Firebase Storage, copia la URL de descarga y pégala aquí.{'\n'}
        Ruta en Storage: <Text style={p.mono}>documentos/plantillas/[archivo]</Text>
      </Text>

      {PLANTILLAS_META.map(meta => {
        const actual = plantillaMap[meta.tipo];
        return (
          <View key={meta.tipo} style={p.card}>
            <View style={p.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={p.cardNombre}>{meta.nombre}</Text>
                <Text style={p.cardMeta}>
                  {meta.nombreArchivo}
                  {actual && <Text style={p.cardVer}> · {actual.version}</Text>}
                  {meta.requiereFirma && <Text style={p.cardFirma}> · Requiere firma</Text>}
                </Text>
                {actual?.url ? (
                  <Text style={p.cardUrl} numberOfLines={1}>{actual.url}</Text>
                ) : (
                  <Text style={p.cardUrlEmpty}>Sin URL — pendiente de subida</Text>
                )}
              </View>
              <TouchableOpacity
                style={p.editBtn}
                onPress={() => {
                  setEditando(meta.tipo);
                  setNuevaUrl(actual?.url ?? '');
                  setNuevaVer(actual?.version ?? meta.version);
                }}
              >
                <Ionicons name="cloud-upload-outline" size={16} color={cartasBosque.bosque} />
              </TouchableOpacity>
            </View>
          </View>
        );
      })}

      {/* Modal para editar URL de plantilla */}
      <Modal visible={!!editando} transparent animationType="fade" onRequestClose={() => setEditando(null)}>
        <Pressable style={p.overlay} onPress={() => setEditando(null)}>
          <Pressable onPress={e => e.stopPropagation()}>
            <View style={p.sheet}>
              <Text style={p.sheetTitulo}>Actualizar plantilla</Text>
              <Text style={p.sheetSub}>{editando ? metaMap[editando]?.nombre : ''}</Text>
              <Text style={p.sheetLabel}>Versión</Text>
              <TextInput
                style={p.sheetInput}
                value={nuevaVer}
                onChangeText={setNuevaVer}
                placeholder="ej. v5"
                placeholderTextColor={cartasBosque.helecho}
              />
              <Text style={p.sheetLabel}>URL de descarga (Firebase Storage)</Text>
              <TextInput
                style={[p.sheetInput, { height: 72, textAlignVertical: 'top' }]}
                value={nuevaUrl}
                onChangeText={setNuevaUrl}
                placeholder="https://firebasestorage.googleapis.com/..."
                placeholderTextColor={cartasBosque.helecho}
                multiline
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View style={p.sheetBtns}>
                <TouchableOpacity style={p.sheetCancel} onPress={() => setEditando(null)}>
                  <Text style={p.sheetCancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[p.sheetOk, (!nuevaUrl.trim() || saving) && { opacity: 0.4 }]}
                  disabled={!nuevaUrl.trim() || saving}
                  onPress={() => editando && guardar(editando)}
                >
                  {saving
                    ? <ActivityIndicator size="small" color="#FFF" />
                    : <Text style={p.sheetOkText}>Guardar</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

// ─── InquilinosWebScreen ──────────────────────────────────────

export default function InquilinosWebScreen() {
  const [tab, setTab] = useState<Tab>('lista');
  const [inquilinos, setInquilinos] = useState<Inquilino[]>([]);
  const [pagosMorosos, setPagosMorosos] = useState<
    Record<string, 'vencido' | 'por_verificar'>
  >({});

  useEffect(() => {
    getDocs(collections.inquilinos).then(snap => {
      setInquilinos(
        snap.docs
          .map(d => ({ ...d.data(), id: d.id } as Inquilino))
          .filter(i => i.estado !== 'inactivo')
          .sort((a, b) =>
            `${a.nombre} ${a.apellido}`.localeCompare(`${b.nombre} ${b.apellido}`)
          )
      );
    }).catch(() => {});
  }, []);

  useEffect(() => {
    getDocs(collections.pagos).then(snap => {
      const map: Record<string, 'vencido' | 'por_verificar'> = {};
      snap.docs.forEach(d => {
        const p = d.data() as any;
        if (p.estado === 'vencido' || p.estado === 'por_verificar') {
          map[p.inquilinoId] = p.estado;
        }
      });
      setPagosMorosos(map);
    }).catch(() => {});
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: cartasBosque.bruma }}>
      <View style={s.tabBar}>
        <TouchableOpacity style={[s.tab, tab === 'lista' && s.tabActivo]} onPress={() => setTab('lista')}>
          <Text style={[s.tabText, tab === 'lista' && s.tabTextActivo]}>Expedientes y servicios</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tab, tab === 'nuevo' && s.tabActivo]} onPress={() => setTab('nuevo')}>
          <Ionicons name="person-add-outline" size={14} color={tab === 'nuevo' ? cartasBosque.bosque : cartasBosque.helecho} />
          <Text style={[s.tabText, tab === 'nuevo' && s.tabTextActivo]}>Nuevo inquilino</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tab, tab === 'plantillas' && s.tabActivo]} onPress={() => setTab('plantillas')}>
          <Ionicons name="document-text-outline" size={14} color={tab === 'plantillas' ? cartasBosque.bosque : cartasBosque.helecho} />
          <Text style={[s.tabText, tab === 'plantillas' && s.tabTextActivo]}>Plantillas legales</Text>
        </TouchableOpacity>
      </View>

      {tab === 'lista' && (
        <ScrollView contentContainerStyle={il.listContent}>
          {inquilinos.length === 0 ? (
            <Text style={il.vacio}>Cargando inquilinos…</Text>
          ) : (
            inquilinos.map(inq => (
              <View key={inq.id} style={il.row}>
                <View style={il.rowNombreWrap}>
                  <Text style={il.nombre}>{inq.nombre} {inq.apellido}</Text>
                  {pagosMorosos[inq.uid ?? inq.id] === 'vencido' && (
                    <View style={il.moroBadge}>
                      <Text style={il.moroBadgeText}>VENCIDO</Text>
                    </View>
                  )}
                  {pagosMorosos[inq.uid ?? inq.id] === 'por_verificar' && (
                    <View style={[il.moroBadge, { backgroundColor: '#E8A83822', borderColor: '#E8A83866' }]}>
                      <Text style={[il.moroBadgeText, { color: '#E8A838' }]}>POR VERIFICAR</Text>
                    </View>
                  )}
                </View>
                <Text style={il.hab}>Hab. {inq.habitacionId ?? '—'}</Text>
                <Text style={il.estado}>{inq.estado}</Text>
              </View>
            ))
          )}
        </ScrollView>
      )}
      {tab === 'nuevo'      && <NuevoInquilinoForm onDone={() => setTab('lista')} />}
      {tab === 'plantillas' && <PlantillasPanel />}
    </View>
  );
}

const s = StyleSheet.create({
  tabBar: {
    flexDirection: 'row', borderBottomWidth: 1,
    borderBottomColor: cartasBosque.pergaminoOscuro,
    backgroundColor: cartasBosque.pergamino,
    paddingHorizontal: spacing[5],
  },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[1.5],
    paddingVertical: spacing[3], paddingHorizontal: spacing[4],
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActivo:      { borderBottomColor: cartasBosque.bosque },
  tabText:        { fontFamily: 'Inter_500Medium', fontSize: 13, color: cartasBosque.helecho },
  tabTextActivo:  { color: cartasBosque.bosque },
});

const p = StyleSheet.create({
  scroll:   { flex: 1, backgroundColor: cartasBosque.bruma },
  content:  { maxWidth: 620, padding: spacing[6], paddingBottom: spacing[12] },
  heading:  { fontFamily: 'Inter_700Bold', fontSize: 22, color: cartasBosque.tinta, marginBottom: spacing[1] },
  sub:      { fontFamily: 'Inter_400Regular', fontSize: 13, color: cartasBosque.musgo, marginBottom: spacing[6], lineHeight: 20 },
  mono:     { fontFamily: 'SpaceMono_400Regular', fontSize: 12, color: cartasBosque.bosque },

  card:       { backgroundColor: cartasBosque.pergamino, borderRadius: borderRadius.md, borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro, padding: spacing[4], marginBottom: spacing[3] },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  cardNombre: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: cartasBosque.tinta, marginBottom: 2 },
  cardMeta:   { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.helecho },
  cardVer:    { color: cartasBosque.musgo },
  cardFirma:  { color: '#960018' },
  cardUrl:    { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.bosque, marginTop: 4 },
  cardUrlEmpty:{ fontFamily: 'Inter_400Regular', fontSize: 11, color: '#960018', fontStyle: 'italic', marginTop: 4 },
  editBtn:    { width: 36, height: 36, borderRadius: 18, backgroundColor: cartasBosque.pergaminoOscuro, alignItems: 'center', justifyContent: 'center' },

  overlay:    { flex: 1, backgroundColor: 'rgba(18,42,31,0.5)', alignItems: 'center', justifyContent: 'center', padding: spacing[6] },
  sheet:      { backgroundColor: cartasBosque.bruma, borderRadius: borderRadius.xl, padding: spacing[6], width: '100%', maxWidth: 480 },
  sheetTitulo:{ fontFamily: 'Inter_700Bold', fontSize: 18, color: cartasBosque.tinta, marginBottom: 2 },
  sheetSub:   { fontFamily: 'Inter_400Regular', fontSize: 13, color: cartasBosque.musgo, marginBottom: spacing[4] },
  sheetLabel: { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.helecho, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: spacing[1], marginTop: spacing[3] },
  sheetInput: { backgroundColor: cartasBosque.pergamino, borderRadius: borderRadius.md, borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro, paddingHorizontal: spacing[3], paddingVertical: spacing[2] + 2, fontFamily: 'Inter_400Regular', fontSize: 13, color: cartasBosque.tinta },
  sheetBtns:  { flexDirection: 'row', gap: spacing[3], marginTop: spacing[5] },
  sheetCancel:{ flex: 1, paddingVertical: spacing[3], borderRadius: borderRadius.md, borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro, alignItems: 'center' },
  sheetCancelText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: cartasBosque.helecho },
  sheetOk:    { flex: 1, paddingVertical: spacing[3], borderRadius: borderRadius.md, backgroundColor: cartasBosque.bosque, alignItems: 'center' },
  sheetOkText:{ fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#FFF' },
});

const f = StyleSheet.create({
  scroll:   { flex: 1, backgroundColor: cartasBosque.bruma },
  content:  { maxWidth: 620, padding: spacing[6], paddingBottom: spacing[12] },

  heading: { fontFamily: 'Inter_700Bold', fontSize: 22, color: cartasBosque.tinta, marginBottom: spacing[1] },
  sub:     { fontFamily: 'Inter_400Regular', fontSize: 13, color: cartasBosque.musgo, marginBottom: spacing[6], lineHeight: 20 },

  row:       { marginBottom: spacing[4] },
  rowLabel:  { fontFamily: 'SpaceMono_400Regular', fontSize: 11, color: cartasBosque.musgo, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: spacing[1.5] },
  input: {
    backgroundColor: cartasBosque.pergamino, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2] + 2,
    fontFamily: 'Inter_400Regular', fontSize: 14, color: cartasBosque.tinta,
  },

  habsGrid:        { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  habChip:         { paddingHorizontal: spacing[3], paddingVertical: spacing[1.5], borderRadius: borderRadius.sm, borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro, backgroundColor: cartasBosque.pergamino },
  habChipActivo:   { backgroundColor: cartasBosque.bosque, borderColor: cartasBosque.bosque },
  habChipText:     { fontFamily: 'SpaceMono_400Regular', fontSize: 12, color: cartasBosque.musgo },
  habChipTextActivo:{ color: '#FFFFFF' },

  previewBox:   { backgroundColor: cartasBosque.pergamino, borderRadius: borderRadius.md, borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro, padding: spacing[4], marginBottom: spacing[4] },
  previewTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: cartasBosque.tinta, marginBottom: spacing[2] },
  previewRow:   { fontFamily: 'Inter_400Regular', fontSize: 13, color: cartasBosque.musgo, marginBottom: spacing[1] },
  previewVal:   { fontFamily: 'SpaceMono_400Regular', color: cartasBosque.bosque },
  previewNote:  { fontFamily: 'Inter_400Regular', fontSize: 11, color: cartasBosque.helecho, marginTop: spacing[2], lineHeight: 16 },

  btnRow:        { flexDirection: 'row', gap: spacing[3], marginTop: spacing[4] },
  btnSecundario: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2], paddingVertical: spacing[3], borderRadius: borderRadius.md, borderWidth: 1, borderColor: cartasBosque.bosque, backgroundColor: 'transparent' },
  btnSecundarioText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: cartasBosque.bosque },
  btnPrimario:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2], paddingVertical: spacing[3], borderRadius: borderRadius.md, backgroundColor: cartasBosque.bosque },
  btnPrimarioText:{ fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#FFFFFF' },
});

const il = StyleSheet.create({
  listContent: { padding: spacing[4], paddingBottom: spacing[10] },
  vacio: { fontFamily: 'Inter_400Regular', fontSize: 13, color: cartasBosque.helecho, textAlign: 'center', marginTop: spacing[8] },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro,
    gap: spacing[3],
  },
  rowNombreWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing[1] },
  nombre: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: cartasBosque.tinta },
  hab:    { fontFamily: 'SpaceMono_400Regular', fontSize: 11, color: cartasBosque.helecho, width: 64 },
  estado: { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.helecho, width: 72, textAlign: 'right' },
  moroBadge: {
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    backgroundColor: '#C0392B22',
    borderWidth: 1,
    borderColor: '#C0392B55',
    marginLeft: spacing[2],
  },
  moroBadgeText: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 9,
    color: '#C0392B',
    letterSpacing: 0.5,
  },
});
