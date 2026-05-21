import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity, Switch,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getDoc, setDoc, getDocs, updateDoc, doc, Timestamp } from 'firebase/firestore';
import { db, collections, configGlobal } from '@/services/firebase/firestore';
import { cartasBosque } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/spacing';
import { useAuth } from '@/hooks/useAuth';
import type { Configuracion, DatosFiscalesEmisor, Habitacion } from '@/types/firestore';

type TabConf = 'empresa' | 'precios' | 'modulos' | 'cfdi';

const TAB_LABELS: Record<TabConf, string> = {
  empresa:  'Empresa',
  precios:  'Precios',
  modulos:  'Módulos',
  cfdi:     'CFDI',
};

// ─── Helpers ──────────────────────────────────────────────────

function LabelInput({
  label, value, onChange, placeholder, numeric, multiline,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; numeric?: boolean; multiline?: boolean;
}) {
  return (
    <View style={li.row}>
      <Text style={li.label}>{label}</Text>
      <TextInput
        style={[li.input, multiline && { height: 80, textAlignVertical: 'top' }]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder ?? label}
        placeholderTextColor={cartasBosque.helecho}
        keyboardType={numeric ? 'numeric' : 'default'}
        multiline={multiline}
      />
    </View>
  );
}

function SwitchRow({ label, sub, value, onChange }: {
  label: string; sub?: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <View style={sw.row}>
      <View style={{ flex: 1 }}>
        <Text style={sw.label}>{label}</Text>
        {sub ? <Text style={sw.sub}>{sub}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: cartasBosque.bosque, false: cartasBosque.niebla }}
        thumbColor={cartasBosque.bruma}
      />
    </View>
  );
}

function SeccionHeader({ title }: { title: string }) {
  return <Text style={sh.titulo}>{title}</Text>;
}

// ─── Tab: Empresa ─────────────────────────────────────────────

interface EmpresaForm {
  nombrePropiedad: string;
  direccion: string;
  telefono: string;
  email: string;
  nit: string;
  cuotaLimpieza: string;
  cuotaLimpiezaActiva: boolean;
}

function TabEmpresa({ conf, uid, onSaved }: {
  conf: Configuracion | null; uid: string; onSaved: () => void;
}) {
  const [form, setForm] = useState<EmpresaForm>({
    nombrePropiedad:     conf?.nombrePropiedad     ?? '',
    direccion:           conf?.direccion           ?? '',
    telefono:            conf?.telefono            ?? '',
    email:               conf?.email               ?? '',
    nit:                 conf?.nit                 ?? '',
    cuotaLimpieza:       String(conf?.cuotaLimpieza ?? 200),
    cuotaLimpiezaActiva: conf?.cuotaLimpiezaActiva ?? true,
  });
  const [guardando, setGuardando] = useState(false);

  function f(key: keyof EmpresaForm) {
    return (v: string | boolean) => setForm(prev => ({ ...prev, [key]: v }));
  }

  async function guardar() {
    setGuardando(true);
    try {
      await setDoc(configGlobal(), {
        ...conf,
        nombrePropiedad:     form.nombrePropiedad,
        direccion:           form.direccion,
        telefono:            form.telefono,
        email:               form.email,
        nit:                 form.nit,
        cuotaLimpieza:       parseFloat(form.cuotaLimpieza) || 0,
        cuotaLimpiezaActiva: form.cuotaLimpiezaActiva,
        actualizadoEn:       Timestamp.now(),
        actualizadoPor:      uid,
      } as any, { merge: true });
      onSaved();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'No se pudo guardar');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <View>
      <SeccionHeader title="Datos de la empresa" />
      <Text style={sh.sub}>Servicios Kadamees Integrales S.A. de C.V.</Text>

      <LabelInput label="Nombre propiedad"  value={form.nombrePropiedad}     onChange={f('nombrePropiedad')} />
      <LabelInput label="Dirección"         value={form.direccion}           onChange={f('direccion')} />
      <LabelInput label="Teléfono"          value={form.telefono}            onChange={f('telefono')}    numeric />
      <LabelInput label="Email"             value={form.email}               onChange={f('email')} />
      <LabelInput label="NIT / RFC"         value={form.nit}                 onChange={f('nit')} placeholder="P.ej. KADI830512..." />

      <View style={{ height: spacing[4] }} />
      <SeccionHeader title="Cuota de limpieza" />
      <SwitchRow
        label="Cobrar cuota mensual de limpieza"
        sub="Se agrega al estado de cuenta de cada inquilino"
        value={form.cuotaLimpiezaActiva}
        onChange={v => f('cuotaLimpiezaActiva')(v)}
      />
      {form.cuotaLimpiezaActiva && (
        <LabelInput
          label="Monto cuota (MXN)"
          value={form.cuotaLimpieza}
          onChange={f('cuotaLimpieza')}
          numeric placeholder="200"
        />
      )}

      <TouchableOpacity
        style={[btn.primary, guardando && { opacity: 0.6 }]}
        onPress={guardar}
        disabled={guardando}
      >
        {guardando
          ? <ActivityIndicator color={cartasBosque.bruma} size="small" />
          : <Text style={btn.primaryText}>Guardar cambios</Text>
        }
      </TouchableOpacity>
    </View>
  );
}

// ─── Tab: Precios ─────────────────────────────────────────────

function TabPrecios() {
  const [habitaciones, setHabitaciones] = useState<Habitacion[]>([]);
  const [precios, setPrecios] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    getDocs(collections.habitaciones).then(snap => {
      const habs = snap.docs
        .map(d => ({ ...d.data(), id: d.id } as Habitacion))
        .filter(h => h.habilitada)
        .sort((a, b) => a.numero.localeCompare(b.numero, undefined, { numeric: true }));
      setHabitaciones(habs);
      const map: Record<string, string> = {};
      habs.forEach(h => { map[h.id] = String(h.precioMensual); });
      setPrecios(map);
      setCargando(false);
    });
  }, []);

  async function guardarPrecio(hab: Habitacion) {
    const nuevo = parseFloat(precios[hab.id] ?? '0');
    if (isNaN(nuevo) || nuevo <= 0) {
      Alert.alert('Error', 'Ingresa un precio válido'); return;
    }
    setGuardando(hab.id);
    try {
      await updateDoc(doc(db, 'habitaciones', hab.id), {
        precioMensual: nuevo, actualizadoEn: Timestamp.now(),
      });
    } catch {
      Alert.alert('Error', 'No se pudo actualizar');
    } finally {
      setGuardando(null);
    }
  }

  if (cargando) return <ActivityIndicator color={cartasBosque.bosque} style={{ marginTop: spacing[6] }} />;

  return (
    <View>
      <SeccionHeader title="Precios mensuales por habitación" />
      <Text style={sh.sub}>Los cambios aplican al próximo ciclo de cobro</Text>

      {habitaciones.map(hab => (
        <View key={hab.id} style={pr.row}>
          <View style={pr.habInfo}>
            <Text style={pr.habNum}>Hab {hab.numero}</Text>
            <Text style={pr.habMeta}>{hab.pisoNombre} · {hab.tipo} · {hab.tamano}</Text>
          </View>
          <View style={pr.inputWrap}>
            <Text style={pr.peso}>$</Text>
            <TextInput
              style={pr.input}
              value={precios[hab.id] ?? ''}
              onChangeText={v => setPrecios(prev => ({ ...prev, [hab.id]: v }))}
              keyboardType="numeric"
            />
            <Text style={pr.mxn}>MXN</Text>
          </View>
          <TouchableOpacity
            style={[pr.saveBtn, guardando === hab.id && { opacity: 0.5 }]}
            onPress={() => guardarPrecio(hab)}
            disabled={guardando === hab.id}
          >
            {guardando === hab.id
              ? <ActivityIndicator size="small" color={cartasBosque.bruma} />
              : <Ionicons name="checkmark" size={16} color={cartasBosque.bruma} />
            }
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

// ─── Tab: Módulos ─────────────────────────────────────────────

const MODULOS_INFO: { key: string; label: string; sub: string }[] = [
  { key: 'lavanderia',       label: 'Lavandería',          sub: 'Reservas y seguimiento de uso' },
  { key: 'almacenamiento',   label: 'Almacenamiento',       sub: 'Lockers, refrigeradores y clósets' },
  { key: 'huespedExtra',     label: 'Huéspedes extra',      sub: 'Cobro y control de ocupantes adicionales' },
  { key: 'visitas',          label: 'Visitas',              sub: 'Registro y protocolo estacionaria' },
  { key: 'facturacion',      label: 'Facturación CFDI',     sub: 'Emisión de facturas electrónicas' },
  { key: 'scoreReputacion',  label: 'Score de reputación',  sub: 'Calificación automática de inquilinos' },
];

function TabModulos({ conf, uid, onSaved }: {
  conf: Configuracion | null; uid: string; onSaved: () => void;
}) {
  const [modulos, setModulos] = useState<Record<string, boolean>>(
    (conf?.modulosHabilitados as Record<string, boolean>) ?? {
      lavanderia: true, almacenamiento: true, huespedExtra: true,
      visitas: true, facturacion: true, scoreReputacion: true,
    }
  );
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    setGuardando(true);
    try {
      await setDoc(configGlobal(), {
        modulosHabilitados: modulos, actualizadoEn: Timestamp.now(), actualizadoPor: uid,
      } as any, { merge: true });
      onSaved();
    } catch {
      Alert.alert('Error', 'No se pudo guardar');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <View>
      <SeccionHeader title="Módulos del sistema" />
      <Text style={sh.sub}>Activa o desactiva funcionalidades. Los cambios aplican de inmediato.</Text>

      {MODULOS_INFO.map(({ key, label, sub }) => (
        <SwitchRow
          key={key}
          label={label}
          sub={sub}
          value={modulos[key] ?? true}
          onChange={v => setModulos(prev => ({ ...prev, [key]: v }))}
        />
      ))}

      <TouchableOpacity
        style={[btn.primary, guardando && { opacity: 0.6 }]}
        onPress={guardar}
        disabled={guardando}
      >
        {guardando
          ? <ActivityIndicator color={cartasBosque.bruma} size="small" />
          : <Text style={btn.primaryText}>Guardar módulos</Text>
        }
      </TouchableOpacity>
    </View>
  );
}

// ─── Tab: CFDI ────────────────────────────────────────────────

type EmisorKey = 'emisorFisico' | 'emisorEmpresa';

const EMISOR_LABELS: Record<EmisorKey, string> = {
  emisorFisico:  'Persona física (RESICO, exento IVA)',
  emisorEmpresa: 'Empresa con IVA 16%',
};

function EmisorForm({ titulo, data, onChange }: {
  titulo: string;
  data: DatosFiscalesEmisor;
  onChange: (d: DatosFiscalesEmisor) => void;
}) {
  function f(key: keyof DatosFiscalesEmisor) {
    return (v: string) => onChange({ ...data, [key]: v });
  }
  return (
    <View style={{ marginBottom: spacing[5] }}>
      <Text style={sh.subseccion}>{titulo}</Text>
      <LabelInput label="Razón social"    value={data.razonSocial}     onChange={f('razonSocial')} />
      <LabelInput label="RFC"             value={data.rfc}             onChange={f('rfc')} />
      <LabelInput label="Régimen fiscal"  value={data.regimenFiscal}   onChange={f('regimenFiscal')} placeholder="601 General de Ley..." />
      <LabelInput label="Domicilio fiscal" value={data.domicilioFiscal} onChange={f('domicilioFiscal')} />
      <LabelInput label="Código postal"   value={data.codigoPostal}    onChange={f('codigoPostal')} numeric />
      <LabelInput label="Email fiscal"    value={data.email}           onChange={f('email')} />
    </View>
  );
}

const EMISOR_VACIO: DatosFiscalesEmisor = {
  razonSocial: '', rfc: '', regimenFiscal: '',
  domicilioFiscal: '', codigoPostal: '', email: '',
};

function TabCFDI({ conf, uid, onSaved }: {
  conf: Configuracion | null; uid: string; onSaved: () => void;
}) {
  const [fisica,  setFisica]   = useState<DatosFiscalesEmisor>(conf?.emisorFisico  ?? EMISOR_VACIO);
  const [empresa, setEmpresa]  = useState<DatosFiscalesEmisor>(conf?.emisorEmpresa ?? EMISOR_VACIO);
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    setGuardando(true);
    try {
      await setDoc(configGlobal(), {
        emisorFisico: fisica, emisorEmpresa: empresa,
        actualizadoEn: Timestamp.now(), actualizadoPor: uid,
      } as any, { merge: true });
      onSaved();
    } catch {
      Alert.alert('Error', 'No se pudieron guardar los emisores');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <View>
      <SeccionHeader title="Emisores CFDI" />
      <Text style={sh.sub}>Configuración de los emisores para facturación electrónica</Text>

      <EmisorForm titulo="Persona física (RESICO)" data={fisica} onChange={setFisica} />
      <EmisorForm titulo="Empresa con IVA 16%"     data={empresa} onChange={setEmpresa} />

      <TouchableOpacity
        style={[btn.primary, guardando && { opacity: 0.6 }]}
        onPress={guardar}
        disabled={guardando}
      >
        {guardando
          ? <ActivityIndicator color={cartasBosque.bruma} size="small" />
          : <Text style={btn.primaryText}>Guardar emisores</Text>
        }
      </TouchableOpacity>
    </View>
  );
}

// ─── ConfiguracionWebScreen ───────────────────────────────────

export default function ConfiguracionWebScreen() {
  const { user } = useAuth();
  const uid = user?.uid ?? '';
  const [tab, setTab]       = useState<TabConf>('empresa');
  const [conf, setConf]     = useState<Configuracion | null>(null);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    const snap = await getDoc(configGlobal());
    if (snap.exists()) setConf({ ...snap.data(), id: 'global' } as Configuracion);
    setCargando(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  function onSaved() {
    Alert.alert('✓ Guardado', 'Los cambios han sido aplicados.');
    cargar();
  }

  if (cargando) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={cartasBosque.bosque} size="large" />
      </View>
    );
  }

  return (
    <View style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitulo}>Configuración</Text>
        <Text style={s.headerSub}>Servicios Kadamees Integrales · Panel admin</Text>
      </View>

      {/* Tabs */}
      <View style={s.tabRow}>
        {(Object.keys(TAB_LABELS) as TabConf[]).map(t => (
          <TouchableOpacity
            key={t}
            style={[s.tabBtn, tab === t && s.tabBtnActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[s.tabLabel, tab === t && s.tabLabelActive]}>
              {TAB_LABELS[t]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
        {tab === 'empresa'  && <TabEmpresa  conf={conf} uid={uid} onSaved={onSaved} />}
        {tab === 'precios'  && <TabPrecios />}
        {tab === 'modulos'  && <TabModulos  conf={conf} uid={uid} onSaved={onSaved} />}
        {tab === 'cfdi'     && <TabCFDI     conf={conf} uid={uid} onSaved={onSaved} />}
        <View style={{ height: spacing[10] }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F0EEE8' },
  header: {
    paddingHorizontal: spacing[5], paddingTop: spacing[5], paddingBottom: spacing[3],
    borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro,
  },
  headerTitulo: { fontFamily: 'DMSans_700Bold', fontSize: 24, color: cartasBosque.tinta },
  headerSub:    { fontFamily: 'DMMono_400Regular', fontSize: 11, color: cartasBosque.helecho, marginTop: 2 },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro,
    paddingHorizontal: spacing[4],
  },
  tabBtn: {
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabBtnActive: { borderBottomColor: cartasBosque.bosque },
  tabLabel:     { fontFamily: 'DMSans_400Regular', fontSize: 13, color: cartasBosque.helecho },
  tabLabelActive: { fontFamily: 'DMSans_600SemiBold', color: cartasBosque.bosque },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing[5], maxWidth: 720 },
});

const sh = StyleSheet.create({
  titulo:     { fontFamily: 'DMSans_600SemiBold', fontSize: 17, color: cartasBosque.tinta, marginBottom: 6 },
  sub:        { fontFamily: 'DMSans_400Regular',  fontSize: 13, color: cartasBosque.helecho, marginBottom: spacing[4] },
  subseccion: { fontFamily: 'DMSans_600SemiBold', fontSize: 14, color: cartasBosque.tinta, marginBottom: spacing[2] },
});

const li = StyleSheet.create({
  row:   { marginBottom: spacing[3] },
  label: { fontFamily: 'DMMono_400Regular', fontSize: 10, color: cartasBosque.helecho, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 5 },
  input: {
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    borderRadius: borderRadius.md, padding: spacing[3],
    fontFamily: 'DMSans_400Regular', fontSize: 14, color: cartasBosque.tinta,
    backgroundColor: cartasBosque.bruma,
  },
});

const sw = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing[3], borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro },
  label: { fontFamily: 'DMSans_400Regular', fontSize: 14, color: cartasBosque.tinta },
  sub:   { fontFamily: 'DMSans_400Regular', fontSize: 11, color: cartasBosque.helecho, marginTop: 2 },
});

const btn = StyleSheet.create({
  primary: {
    backgroundColor: cartasBosque.bosque,
    borderRadius: borderRadius.md, paddingVertical: spacing[3] + 2,
    alignItems: 'center', marginTop: spacing[5],
  },
  primaryText: { fontFamily: 'DMSans_600SemiBold', fontSize: 15, color: cartasBosque.bruma },
});

const pr = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro,
  },
  habInfo: { flex: 1 },
  habNum:  { fontFamily: 'DMSans_600SemiBold', fontSize: 13, color: cartasBosque.tinta },
  habMeta: { fontFamily: 'DMMono_400Regular',  fontSize: 10, color: cartasBosque.helecho },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    borderRadius: borderRadius.md, paddingHorizontal: spacing[2],
    backgroundColor: cartasBosque.bruma,
  },
  peso:  { fontFamily: 'DMSans_400Regular', fontSize: 13, color: cartasBosque.helecho },
  input: { width: 80, paddingVertical: spacing[2], fontFamily: 'DMSans_400Regular', fontSize: 14, color: cartasBosque.tinta },
  mxn:   { fontFamily: 'DMMono_400Regular', fontSize: 10, color: cartasBosque.helecho },
  saveBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: cartasBosque.bosque,
    alignItems: 'center', justifyContent: 'center',
  },
});
