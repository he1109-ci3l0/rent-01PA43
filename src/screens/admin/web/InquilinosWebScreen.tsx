import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import { setDoc, doc, getDocs, Timestamp } from 'firebase/firestore';
import { cartasBosque } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/spacing';
import { db, collections } from '@/services/firebase/firestore';
import ServiciosAdminScreen from '@/screens/admin/ServiciosAdminScreen';
import type { Habitacion } from '@/types/firestore';

type Tab = 'lista' | 'nuevo';

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
        creadoEn:        ahora,
        actualizadoEn:   ahora,
      });

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

// ─── InquilinosWebScreen ──────────────────────────────────────

export default function InquilinosWebScreen() {
  const [tab, setTab] = useState<Tab>('lista');

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
      </View>

      {tab === 'lista'
        ? <ServiciosAdminScreen />
        : <NuevoInquilinoForm onDone={() => setTab('lista')} />
      }
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
  tabText:        { fontFamily: 'DMSans_500Medium', fontSize: 13, color: cartasBosque.helecho },
  tabTextActivo:  { color: cartasBosque.bosque },
});

const f = StyleSheet.create({
  scroll:   { flex: 1, backgroundColor: cartasBosque.bruma },
  content:  { maxWidth: 620, padding: spacing[6], paddingBottom: spacing[12] },

  heading: { fontFamily: 'DMSans_700Bold', fontSize: 22, color: cartasBosque.tinta, marginBottom: spacing[1] },
  sub:     { fontFamily: 'DMSans_400Regular', fontSize: 13, color: cartasBosque.musgo, marginBottom: spacing[6], lineHeight: 20 },

  row:       { marginBottom: spacing[4] },
  rowLabel:  { fontFamily: 'DMMono_400Regular', fontSize: 11, color: cartasBosque.musgo, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: spacing[1.5] },
  input: {
    backgroundColor: cartasBosque.pergamino, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2] + 2,
    fontFamily: 'DMSans_400Regular', fontSize: 14, color: cartasBosque.tinta,
  },

  habsGrid:        { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  habChip:         { paddingHorizontal: spacing[3], paddingVertical: spacing[1.5], borderRadius: borderRadius.sm, borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro, backgroundColor: cartasBosque.pergamino },
  habChipActivo:   { backgroundColor: cartasBosque.bosque, borderColor: cartasBosque.bosque },
  habChipText:     { fontFamily: 'DMMono_400Regular', fontSize: 12, color: cartasBosque.musgo },
  habChipTextActivo:{ color: '#FFFFFF' },

  previewBox:   { backgroundColor: cartasBosque.pergamino, borderRadius: borderRadius.md, borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro, padding: spacing[4], marginBottom: spacing[4] },
  previewTitle: { fontFamily: 'DMSans_600SemiBold', fontSize: 14, color: cartasBosque.tinta, marginBottom: spacing[2] },
  previewRow:   { fontFamily: 'DMSans_400Regular', fontSize: 13, color: cartasBosque.musgo, marginBottom: spacing[1] },
  previewVal:   { fontFamily: 'DMMono_400Regular', color: cartasBosque.bosque },
  previewNote:  { fontFamily: 'DMSans_400Regular', fontSize: 11, color: cartasBosque.helecho, marginTop: spacing[2], lineHeight: 16 },

  btnRow:        { flexDirection: 'row', gap: spacing[3], marginTop: spacing[4] },
  btnSecundario: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2], paddingVertical: spacing[3], borderRadius: borderRadius.md, borderWidth: 1, borderColor: cartasBosque.bosque, backgroundColor: 'transparent' },
  btnSecundarioText: { fontFamily: 'DMSans_600SemiBold', fontSize: 14, color: cartasBosque.bosque },
  btnPrimario:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2], paddingVertical: spacing[3], borderRadius: borderRadius.md, backgroundColor: cartasBosque.bosque },
  btnPrimarioText:{ fontFamily: 'DMSans_600SemiBold', fontSize: 14, color: '#FFFFFF' },
});
