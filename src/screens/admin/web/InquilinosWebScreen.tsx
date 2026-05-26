import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Modal, Pressable, Switch, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import {
  setDoc, doc, getDocs, getDoc, onSnapshot,
  updateDoc, query, where, Timestamp,
} from 'firebase/firestore';
import { cartasBosque } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/spacing';
import { db, collections, configGlobal } from '@/services/firebase/firestore';
import {
  inicializarExpediente, actualizarNotasAdmin,
  listenDocumentos, registrarDescarga, resetearContador,
} from '@/services/firebase/expedientes';
import {
  PLANTILLAS_META, listenDocumentosPlantillas, actualizarPlantillaUrl,
} from '@/services/firebase/documentosPlantillas';
import { useAuth } from '@/hooks/useAuth';
import type {
  Habitacion, Inquilino, Pago, HuespedExtra, EspacioAlmacenamiento,
  ReservaLavanderia, DocumentoPlantilla, EstadoPago, DocumentoExpediente,
} from '@/types/firestore';

type Tab = 'lista' | 'nuevo' | 'plantillas';

// ─── Módulos ──────────────────────────────────────────────────

const MODULOS = [
  { key: 'lavanderia',     label: 'Lavandería',     icon: 'water-outline'   },
  { key: 'almacenamiento', label: 'Almacenamiento', icon: 'archive-outline' },
  { key: 'huespedExtra',   label: 'Huésped extra',  icon: 'people-outline'  },
  { key: 'visitas',        label: 'Visitas',         icon: 'walk-outline'    },
  { key: 'facturacion',    label: 'Facturación',     icon: 'receipt-outline' },
] as const;

type ModuloKey = typeof MODULOS[number]['key'];

// ─── Helpers ──────────────────────────────────────────────────

function formatFecha(ts: any): string {
  if (!ts || typeof ts.toDate !== 'function') return '—';
  const d = ts.toDate() as Date;
  const M = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return `${d.getDate()} ${M[d.getMonth()]} ${d.getFullYear()}`;
}

function avatarBg(estado: Inquilino['estado']): string {
  if (estado === 'activo')   return cartasBosque.bosque;
  if (estado === 'inactivo') return cartasBosque.niebla;
  return cartasBosque.helecho;
}

function pagoColor(estado: EstadoPago): string {
  if (estado === 'pagado')      return '#4A9B6F';
  if (estado === 'pendiente')   return '#E8A838';
  if (estado === 'vencido')     return '#C0392B';
  if (estado === 'en_revision') return '#3B82F6';
  return cartasBosque.helecho;
}

function pagoLabel(estado: EstadoPago): string {
  const map: Partial<Record<EstadoPago, string>> = {
    pagado:      'PAGADO',
    pendiente:   'PENDIENTE',
    vencido:     'VENCIDO',
    en_revision: 'POR VERIFICAR',
    rechazado:   'RECHAZADO',
    parcial:     'PARCIAL',
    anulado:     'ANULADO',
  };
  return map[estado] ?? estado.toUpperCase();
}

// ─── Formulario de registro ────────────────────────────────────

interface RegistroForm {
  nombre:       string;
  apellido:     string;
  curp:         string;
  telefono:     string;
  habitacionId: string;
  fechaIngreso: string;
  rentaMensual: string;
  deposito:     string;
}

const BLANK: RegistroForm = {
  nombre: '', apellido: '', curp: '', telefono: '',
  habitacionId: '', fechaIngreso: '', rentaMensual: '', deposito: '',
};

function NuevoInquilinoForm({ onDone }: { onDone: () => void }) {
  const [form, setForm]       = useState<RegistroForm>(BLANK);
  const [habs, setHabs]       = useState<Habitacion[]>([]);
  const [saving, setSaving]   = useState(false);
  const [preview, setPreview] = useState<{ username: string; password: string } | null>(null);

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

      await inicializarExpediente(user.uid, {
        habitacionId:     hab.id,
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
        ? 'Ya existe una cuenta con ese CURP y habitación.'
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
        <TextInput style={f.input} value={form.curp} onChangeText={v => set('curp', v.toUpperCase())}
          placeholder="18 caracteres" autoCapitalize="characters" maxLength={18} />
      </Row>
      <Row label="Teléfono">
        <TextInput style={f.input} value={form.telefono} onChangeText={v => set('telefono', v)} placeholder="10 dígitos" keyboardType="phone-pad" />
      </Row>
      <Row label="Habitación *">
        <View style={f.habsGrid}>
          {habs.map(h => (
            <TouchableOpacity key={h.id} style={[f.habChip, form.habitacionId === h.id && f.habChipActivo]}
              onPress={() => set('habitacionId', h.id)} activeOpacity={0.7}>
              <Text style={[f.habChipText, form.habitacionId === h.id && f.habChipTextActivo]}>{h.numero}</Text>
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
        <TouchableOpacity style={[f.btnPrimario, saving && { opacity: 0.5 }]} onPress={handleGuardar}
          disabled={saving} activeOpacity={0.8}>
          {saving
            ? <ActivityIndicator size="small" color="#FFFFFF" />
            : <><Ionicons name="person-add-outline" size={16} color="#FFFFFF" /><Text style={f.btnPrimarioText}>Crear cuenta</Text></>
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

  const plantillaMap = Object.fromEntries(plantillas.map(pl => [pl.tipo, pl]));

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
                {actual?.url
                  ? <Text style={p.cardUrl} numberOfLines={1}>{actual.url}</Text>
                  : <Text style={p.cardUrlEmpty}>Sin URL — pendiente de subida</Text>}
              </View>
              <TouchableOpacity style={p.editBtn}
                onPress={() => { setEditando(meta.tipo); setNuevaUrl(actual?.url ?? ''); setNuevaVer(actual?.version ?? meta.version); }}>
                <Ionicons name="cloud-upload-outline" size={16} color={cartasBosque.bosque} />
              </TouchableOpacity>
            </View>
          </View>
        );
      })}

      <Modal visible={!!editando} transparent animationType="fade" onRequestClose={() => setEditando(null)}>
        <Pressable style={p.overlay} onPress={() => setEditando(null)}>
          <Pressable onPress={e => e.stopPropagation()}>
            <View style={p.sheet}>
              <Text style={p.sheetTitulo}>Actualizar plantilla</Text>
              <Text style={p.sheetSub}>{editando ? metaMap[editando]?.nombre : ''}</Text>
              <Text style={p.sheetLabel}>Versión</Text>
              <TextInput style={p.sheetInput} value={nuevaVer} onChangeText={setNuevaVer}
                placeholder="ej. v5" placeholderTextColor={cartasBosque.helecho} />
              <Text style={p.sheetLabel}>URL de descarga (Firebase Storage)</Text>
              <TextInput style={[p.sheetInput, { height: 72, textAlignVertical: 'top' }]}
                value={nuevaUrl} onChangeText={setNuevaUrl}
                placeholder="https://firebasestorage.googleapis.com/..."
                placeholderTextColor={cartasBosque.helecho} multiline
                autoCapitalize="none" autoCorrect={false} />
              <View style={p.sheetBtns}>
                <TouchableOpacity style={p.sheetCancel} onPress={() => setEditando(null)}>
                  <Text style={p.sheetCancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[p.sheetOk, (!nuevaUrl.trim() || saving) && { opacity: 0.4 }]}
                  disabled={!nuevaUrl.trim() || saving}
                  onPress={() => editando && guardar(editando)}>
                  {saving ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={p.sheetOkText}>Guardar</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

// ─── AccesosTab ───────────────────────────────────────────────

function AccesosTab({ uid, habitacionId }: { uid: string; habitacionId: string | null }) {
  const [cargando, setCargando]   = useState(true);
  const [globalMods, setGlobalMods] = useState<Record<ModuloKey, boolean>>({} as any);
  const [hab, setHab]             = useState<Habitacion | null>(null);
  const [overrideMods, setOverrideMods] = useState<Record<ModuloKey, boolean | undefined>>({} as any);
  const [saving, setSaving]       = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function cargar() {
      const [configSnap, inqSnap] = await Promise.all([
        getDoc(configGlobal()),
        getDoc(doc(db, 'inquilinos', uid)),
      ]);
      const config = configSnap.data();
      const gMods = {} as Record<ModuloKey, boolean>;
      const oMods = {} as Record<ModuloKey, boolean | undefined>;
      const override = (inqSnap.data() as any)?.modulosOverride ?? {};
      MODULOS.forEach(m => {
        gMods[m.key] = config?.modulosHabilitados?.[m.key] ?? true;
        oMods[m.key] = override[m.key]; // may be undefined
      });
      setGlobalMods(gMods);
      setOverrideMods(oMods);

      if (habitacionId) {
        const habSnap = await getDoc(doc(db, 'habitaciones', habitacionId));
        if (habSnap.exists()) setHab({ ...habSnap.data(), id: habSnap.id } as Habitacion);
      }
      setCargando(false);
    }
    cargar().catch(() => setCargando(false));
  }, [uid, habitacionId]);

  async function updateHab(key: ModuloKey, value: boolean) {
    if (!hab) return;
    setSaving(s => ({ ...s, [`h_${key}`]: true }));
    try {
      await updateDoc(doc(db, 'habitaciones', hab.id), {
        [`modulosHabilitados.${key}`]: value,
        actualizadoEn: Timestamp.now(),
      });
      setHab(h => h ? { ...h, modulosHabilitados: { ...h.modulosHabilitados, [key]: value } } : h);
    } catch { Alert.alert('Error', 'No se pudo actualizar el módulo'); }
    finally { setSaving(s => ({ ...s, [`h_${key}`]: false })); }
  }

  async function updateOverride(key: ModuloKey, value: boolean) {
    setSaving(s => ({ ...s, [`o_${key}`]: true }));
    try {
      await updateDoc(doc(db, 'inquilinos', uid), {
        [`modulosOverride.${key}`]: value,
        actualizadoEn: Timestamp.now(),
      });
      setOverrideMods(o => ({ ...o, [key]: value }));
    } catch { Alert.alert('Error', 'No se pudo actualizar el módulo'); }
    finally { setSaving(s => ({ ...s, [`o_${key}`]: false })); }
  }

  if (cargando) return <ActivityIndicator color={cartasBosque.bosque} style={{ marginTop: spacing[8] }} />;

  return (
    <View style={acc.container}>
      {MODULOS.map(m => {
        const globalON   = globalMods[m.key] ?? true;
        const habON      = hab?.modulosHabilitados?.[m.key] ?? true;
        const overrideON = overrideMods[m.key] ?? true;
        const resultado  = globalON && habON && overrideON;

        return (
          <View key={m.key} style={acc.card}>
            {/* Nombre + resultado */}
            <View style={acc.cardHead}>
              <Ionicons name={m.icon as any} size={16} color={cartasBosque.helecho} />
              <Text style={acc.cardLabel}>{m.label}</Text>
              <View style={[acc.resultBadge, { backgroundColor: resultado ? '#4A9B6F22' : '#C0392B22' }]}>
                <Text style={[acc.resultText, { color: resultado ? '#4A9B6F' : '#C0392B' }]}>
                  {resultado ? 'ACTIVO' : 'BLOQUEADO'}
                </Text>
              </View>
            </View>
            {/* 3 switches */}
            <View style={acc.switchRow}>
              <View style={acc.switchCol}>
                <Text style={acc.switchLabel}>GLOBAL</Text>
                <Switch value={globalON} disabled
                  trackColor={{ true: cartasBosque.bosque, false: cartasBosque.pergaminoOscuro }}
                  thumbColor={cartasBosque.bruma} />
                <Text style={acc.switchHint}>{globalON ? 'ON' : 'OFF'}</Text>
              </View>
              <View style={acc.switchDivider} />
              <View style={acc.switchCol}>
                <Text style={acc.switchLabel}>HABITACIÓN</Text>
                <Switch
                  value={habON}
                  disabled={!globalON || saving[`h_${m.key}`]}
                  onValueChange={v => updateHab(m.key, v)}
                  trackColor={{ true: cartasBosque.bosque, false: cartasBosque.pergaminoOscuro }}
                  thumbColor={cartasBosque.bruma}
                />
                {saving[`h_${m.key}`] && <ActivityIndicator size="small" color={cartasBosque.bosque} />}
              </View>
              <View style={acc.switchDivider} />
              <View style={acc.switchCol}>
                <Text style={acc.switchLabel}>PERSONAL</Text>
                <Switch
                  value={overrideON}
                  disabled={!globalON || !habON || saving[`o_${m.key}`]}
                  onValueChange={v => updateOverride(m.key, v)}
                  trackColor={{ true: cartasBosque.bosque, false: cartasBosque.pergaminoOscuro }}
                  thumbColor={cartasBosque.bruma}
                />
                {saving[`o_${m.key}`] && <ActivityIndicator size="small" color={cartasBosque.bosque} />}
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const acc = StyleSheet.create({
  container:   { padding: spacing[4], gap: spacing[3] },
  card:        { backgroundColor: cartasBosque.pergamino, borderRadius: borderRadius.md, borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro, padding: spacing[3] },
  cardHead:    { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[3] },
  cardLabel:   { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: cartasBosque.tinta, flex: 1 },
  resultBadge: { paddingHorizontal: spacing[2], paddingVertical: 3, borderRadius: borderRadius.full },
  resultText:  { fontFamily: 'SpaceMono_400Regular', fontSize: 9, letterSpacing: 0.5 },
  switchRow:   { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  switchCol:   { flex: 1, alignItems: 'center', gap: spacing[1] },
  switchLabel: { fontFamily: 'SpaceMono_400Regular', fontSize: 9, color: cartasBosque.helecho, letterSpacing: 0.5 },
  switchHint:  { fontFamily: 'SpaceMono_400Regular', fontSize: 9, color: cartasBosque.niebla },
  switchDivider:{ width: 1, height: 40, backgroundColor: cartasBosque.pergaminoOscuro },
});

// ─── PagosTab ─────────────────────────────────────────────────

function PagosTab({ uid }: { uid: string }) {
  const [pagos, setPagos] = useState<Pago[]>([]);

  useEffect(() => {
    const q = query(collections.pagos, where('inquilinoId', '==', uid));
    return onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ ...d.data(), id: d.id } as Pago));
      list.sort((a, b) => b.fechaVencimiento.toMillis() - a.fechaVencimiento.toMillis());
      setPagos(list);
    }, () => {});
  }, [uid]);

  if (pagos.length === 0) {
    return <Text style={pag.vacio}>Sin pagos registrados</Text>;
  }

  return (
    <View style={pag.container}>
      {pagos.map(pg => {
        const color = pagoColor(pg.estado);
        return (
          <View key={pg.id} style={pag.row}>
            <View style={{ flex: 1 }}>
              <Text style={pag.concepto}>{pg.concepto} {pg.descripcion ? `· ${pg.descripcion}` : ''}</Text>
              <Text style={pag.fecha}>{formatFecha(pg.fechaVencimiento)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: spacing[1] }}>
              <Text style={pag.monto}>${pg.monto.toLocaleString('es-MX')}</Text>
              <View style={[pag.badge, { backgroundColor: color + '22' }]}>
                <Text style={[pag.badgeText, { color }]}>{pagoLabel(pg.estado)}</Text>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const pag = StyleSheet.create({
  container: { padding: spacing[4] },
  vacio:     { fontFamily: 'Inter_400Regular', fontSize: 13, color: cartasBosque.helecho, textAlign: 'center', marginTop: spacing[8] },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro,
    gap: spacing[3],
  },
  concepto: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: cartasBosque.tinta },
  fecha:    { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.helecho, marginTop: 2 },
  monto:    { fontFamily: 'SpaceMono_400Regular', fontSize: 13, color: '#4A9B6F' },
  badge:    { paddingHorizontal: spacing[2], paddingVertical: 2, borderRadius: borderRadius.full },
  badgeText:{ fontFamily: 'SpaceMono_400Regular', fontSize: 9, letterSpacing: 0.5 },
});

// ─── ServiciosTab ─────────────────────────────────────────────

function ServiciosTab({ uid }: { uid: string }) {
  const [cargando, setCargando]   = useState(true);
  const [huespedes, setHuespedes] = useState<HuespedExtra[]>([]);
  const [casillero, setCasillero] = useState<EspacioAlmacenamiento | null>(null);
  const [cargasMes, setCargasMes] = useState(0);

  useEffect(() => {
    const now    = new Date();
    const inicio = new Date(now.getFullYear(), now.getMonth(), 1);
    const fin    = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    Promise.all([
      getDocs(query(collections.huespedesExtra, where('inquilinoId', '==', uid), where('activo', '==', true))),
      getDocs(query(collections.espaciosAlmacenamiento, where('inquilinoId', '==', uid))),
      getDocs(query(collections.reservasLavanderia, where('inquilinoId', '==', uid))),
    ]).then(([hSnap, almSnap, lavSnap]) => {
      setHuespedes(hSnap.docs.map(d => ({ ...d.data(), id: d.id } as HuespedExtra)));
      setCasillero(almSnap.empty ? null : { ...almSnap.docs[0].data(), id: almSnap.docs[0].id } as EspacioAlmacenamiento);
      const cargas = lavSnap.docs.filter(d => {
        const data = d.data() as ReservaLavanderia;
        if (data.esCargaExtra) return false;
        const f = data.fechaReserva.toDate();
        return f >= inicio && f <= fin;
      }).length;
      setCargasMes(cargas);
    }).catch(() => {}).finally(() => setCargando(false));
  }, [uid]);

  if (cargando) return <ActivityIndicator color={cartasBosque.bosque} style={{ marginTop: spacing[8] }} />;

  return (
    <View style={srv.container}>
      {/* Huéspedes extra */}
      <Text style={srv.secLabel}>HUÉSPEDES EXTRA</Text>
      {huespedes.length === 0 ? (
        <Text style={srv.vacio}>Sin huéspedes activos</Text>
      ) : huespedes.map(h => (
        <View key={h.id} style={srv.row}>
          <View style={{ flex: 1 }}>
            <Text style={srv.rowTitle}>{h.nombre} {h.apellido}</Text>
            {h.parentesco ? <Text style={srv.rowSub}>{h.parentesco}</Text> : null}
            <Text style={srv.rowSub}>{formatFecha(h.fechaEntrada)}</Text>
          </View>
          <View style={srv.activoBadge}>
            <Text style={srv.activoBadgeText}>ACTIVO</Text>
          </View>
        </View>
      ))}

      {/* Almacenamiento */}
      <Text style={[srv.secLabel, { marginTop: spacing[4] }]}>CASILLERO ASIGNADO</Text>
      {casillero ? (
        <View style={srv.row}>
          <Ionicons name="archive-outline" size={16} color={cartasBosque.helecho} />
          <View style={{ flex: 1 }}>
            <Text style={srv.rowTitle}>Casillero #{casillero.numero}</Text>
            <Text style={srv.rowSub}>{casillero.tipo} · {casillero.modalidad ?? '—'}</Text>
          </View>
          <View style={srv.activoBadge}>
            <Text style={srv.activoBadgeText}>OCUPADO</Text>
          </View>
        </View>
      ) : (
        <Text style={srv.vacio}>Sin casillero asignado</Text>
      )}

      {/* Lavandería */}
      <Text style={[srv.secLabel, { marginTop: spacing[4] }]}>LAVANDERÍA — MES ACTUAL</Text>
      <View style={srv.lavRow}>
        <Ionicons name="water-outline" size={16} color={cartasBosque.helecho} />
        <Text style={srv.lavText}>
          <Text style={srv.lavNum}>{cargasMes}</Text>
          <Text style={srv.rowSub}> / 3 cargas incluidas</Text>
        </Text>
        {cargasMes >= 3 && (
          <View style={[srv.activoBadge, { backgroundColor: '#E8A83822', borderColor: '#E8A83866' }]}>
            <Text style={[srv.activoBadgeText, { color: '#E8A838' }]}>LÍMITE</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const srv = StyleSheet.create({
  container: { padding: spacing[4] },
  secLabel:  { fontFamily: 'SpaceMono_400Regular', fontSize: 9, color: cartasBosque.helecho, letterSpacing: 1, textTransform: 'uppercase', marginBottom: spacing[2] },
  vacio:     { fontFamily: 'Inter_400Regular', fontSize: 13, color: cartasBosque.niebla, fontStyle: 'italic', marginBottom: spacing[2] },
  row:       { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: spacing[2], borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro },
  rowTitle:  { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: cartasBosque.tinta },
  rowSub:    { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.helecho, marginTop: 1 },
  activoBadge:     { paddingHorizontal: spacing[2], paddingVertical: 2, borderRadius: borderRadius.full, backgroundColor: '#4A9B6F22', borderWidth: 1, borderColor: '#4A9B6F55' },
  activoBadgeText: { fontFamily: 'SpaceMono_400Regular', fontSize: 9, color: '#4A9B6F', letterSpacing: 0.5 },
  lavRow:    { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: spacing[2] },
  lavText:   { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 13, color: cartasBosque.tinta },
  lavNum:    { fontFamily: 'Inter_700Bold', fontSize: 18, color: cartasBosque.bosque },
});

// ─── DocumentosTab ────────────────────────────────────────────

const DOC_ESTADO_COLOR: Record<DocumentoExpediente['estado'], string> = {
  pendiente:       '#8A9E80',
  pendiente_firma: '#E8A838',
  subido:          '#3B82F6',
  firmado:         '#4A9B6F',
  rechazado:       '#C0392B',
};

const DOC_ESTADO_LABEL: Record<DocumentoExpediente['estado'], string> = {
  pendiente:       'PENDIENTE',
  pendiente_firma: 'REQUIERE FIRMA',
  subido:          'SUBIDO',
  firmado:         'FIRMADO',
  rechazado:       'RECHAZADO',
};

const TIPOS_IDENTIFICACION = [
  'INE_FRENTE', 'INE_REVERSO', 'CURP', 'COMPROBANTE_DOMICILIO', 'PRENDA_1_1', 'PRENDA_1_2',
];
const TIPOS_LEGALES_DOCS = [
  'CONTRATO', 'REGLAMENTO', 'AVISO_PRIVACIDAD',
  'ADDENDUM_SERVICIOS', 'CONTRATO_MOBILIARIO', 'CLAUSULA_CUPONES',
];

function DocCard({ d, uid }: { d: DocumentoExpediente; uid: string }) {
  const color = DOC_ESTADO_COLOR[d.estado] ?? cartasBosque.helecho;
  const contadorColor = d.descargas >= d.maxDescargas ? '#C0392B' : cartasBosque.helecho;

  async function descargar() {
    if (!d.url) return;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(d.url, '_blank');
    }
    await registrarDescarga(uid, d.id).catch(() => {});
    if (d.descargas + 1 >= d.maxDescargas) {
      Alert.alert('Límite alcanzado', 'Límite de descargas alcanzado. Resetea el contador si necesitas más.');
    }
  }

  function confirmarReset() {
    Alert.alert(
      'Resetear contador',
      `¿Resetear el contador de descargas de ${d.nombre}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Resetear', onPress: () => resetearContador(uid, d.id).catch(() => {}) },
      ],
    );
  }

  return (
    <View style={ds.card}>
      <Text style={ds.nombre}>{d.nombre}</Text>
      <View style={[ds.badge, { backgroundColor: color + '22', borderColor: color + '66' }]}>
        <Text style={[ds.badgeText, { color }]}>{DOC_ESTADO_LABEL[d.estado]}</Text>
      </View>
      {d.requiereFirma && d.estado === 'firmado' && d.firmadoEn ? (
        <Text style={[ds.meta, { color: '#4A9B6F' }]}>Firmado el {formatFecha(d.firmadoEn)}</Text>
      ) : d.requiereFirma && d.estado !== 'firmado' ? (
        <Text style={[ds.meta, { color: '#E8A838' }]}>Pendiente de firma del inquilino</Text>
      ) : null}
      <Text style={[ds.meta, { color: contadorColor }]}>{d.descargas}/{d.maxDescargas} descargas</Text>
      <View style={ds.btnRow}>
        <TouchableOpacity
          style={[ds.btnDescargar, !d.url && { opacity: 0.4 }]}
          onPress={descargar}
          disabled={!d.url}
          activeOpacity={0.7}
        >
          <Ionicons name="download-outline" size={13} color={cartasBosque.bosque} />
          <Text style={ds.btnDescargarText}>Descargar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={ds.btnReset} onPress={confirmarReset} activeOpacity={0.7}>
          <Ionicons name="refresh-outline" size={13} color={cartasBosque.helecho} />
          <Text style={ds.btnResetText}>Resetear</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function DocumentosTab({ uid }: { uid: string }) {
  const [documentos, setDocumentos] = useState<DocumentoExpediente[]>([]);

  useEffect(() => {
    return listenDocumentos(uid, setDocumentos);
  }, [uid]);

  const docsId     = documentos.filter(d => TIPOS_IDENTIFICACION.includes(d.tipo));
  const docsLegales = documentos.filter(d => TIPOS_LEGALES_DOCS.includes(d.tipo));

  return (
    <View style={ds.container}>
      <Text style={ds.titulo}>DOCUMENTOS DEL EXPEDIENTE</Text>

      <Text style={ds.seccionHeader}>IDENTIFICACIÓN Y GARANTÍAS</Text>
      {docsId.length === 0
        ? <Text style={srv.vacio}>Sin documentos</Text>
        : docsId.map(d => <DocCard key={d.id} d={d} uid={uid} />)}

      <Text style={ds.seccionHeader}>DOCUMENTOS LEGALES Y CONTRATOS</Text>
      {docsLegales.length === 0
        ? <Text style={srv.vacio}>Sin documentos</Text>
        : docsLegales.map(d => <DocCard key={d.id} d={d} uid={uid} />)}
    </View>
  );
}

const ds = StyleSheet.create({
  container: { padding: spacing[4] },
  titulo: {
    fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.helecho,
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: spacing[3],
  },
  seccionHeader: {
    fontFamily: 'SpaceMono_400Regular', fontSize: 9, color: cartasBosque.helecho,
    letterSpacing: 1, textTransform: 'uppercase',
    marginTop: spacing[4], marginBottom: spacing[2],
    paddingBottom: spacing[1],
    borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro,
  },
  card: {
    backgroundColor: cartasBosque.pergamino, borderRadius: borderRadius.md,
    padding: spacing[3], marginBottom: spacing[2],
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
  },
  nombre: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: cartasBosque.tinta, marginBottom: spacing[1] },
  badge: {
    alignSelf: 'flex-start', paddingHorizontal: spacing[2], paddingVertical: 2,
    borderRadius: borderRadius.sm, borderWidth: 1, marginBottom: spacing[1],
  },
  badgeText:      { fontFamily: 'SpaceMono_400Regular', fontSize: 9, letterSpacing: 0.5 },
  meta:           { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.helecho, marginBottom: spacing[2] },
  btnRow:         { flexDirection: 'row', gap: spacing[2], marginTop: spacing[1] },
  btnDescargar: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing[3], paddingVertical: spacing[1] + 2,
    borderRadius: borderRadius.sm, borderWidth: 1,
    borderColor: cartasBosque.pergaminoOscuro, backgroundColor: cartasBosque.pergamino,
  },
  btnDescargarText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: cartasBosque.bosque },
  btnReset:         { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing[2], paddingVertical: spacing[1] + 2 },
  btnResetText:     { fontFamily: 'Inter_400Regular', fontSize: 11, color: cartasBosque.helecho },
});

// ─── NotasTab ─────────────────────────────────────────────────

function NotasTab({ uid }: { uid: string }) {
  const [notas, setNotas]       = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    return onSnapshot(doc(db, 'expedientes', uid), snap => {
      setNotas(snap.data()?.notasAdmin ?? '');
    }, () => {});
  }, [uid]);

  async function guardar() {
    setGuardando(true);
    try {
      await actualizarNotasAdmin(uid, notas);
    } catch {
      Alert.alert('Error', 'No se pudieron guardar las notas');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <View style={not.container}>
      <TextInput
        style={not.textArea}
        multiline
        value={notas}
        onChangeText={setNotas}
        placeholder="Notas internas del inquilino…"
        placeholderTextColor={cartasBosque.helecho}
        textAlignVertical="top"
      />
      <TouchableOpacity style={[not.btn, guardando && { opacity: 0.6 }]} onPress={guardar} disabled={guardando}>
        {guardando
          ? <ActivityIndicator size="small" color={cartasBosque.bruma} />
          : <Text style={not.btnText}>Guardar notas</Text>}
      </TouchableOpacity>
    </View>
  );
}

const not = StyleSheet.create({
  container: { padding: spacing[4] },
  textArea: {
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro, borderRadius: borderRadius.md,
    backgroundColor: cartasBosque.pergamino,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    fontFamily: 'Inter_400Regular', fontSize: 14, color: cartasBosque.tinta,
    minHeight: 180,
  },
  btn: {
    marginTop: spacing[4], backgroundColor: cartasBosque.bosque,
    borderRadius: borderRadius.full, paddingVertical: spacing[3], alignItems: 'center',
  },
  btnText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: cartasBosque.bruma },
});

// ─── PerfilInquilino ──────────────────────────────────────────

type PerfTab = 'accesos' | 'pagos' | 'servicios' | 'documentos' | 'notas';

const PERF_TABS: { id: PerfTab; label: string }[] = [
  { id: 'accesos',    label: 'ACCESOS' },
  { id: 'pagos',      label: 'PAGOS' },
  { id: 'servicios',  label: 'SERVICIOS' },
  { id: 'documentos', label: 'DOCUMENTOS' },
  { id: 'notas',      label: 'NOTAS' },
];

function PerfilInquilino({ inquilino }: { inquilino: Inquilino }) {
  const [perfTab, setPerfTab] = useState<PerfTab>('accesos');
  const uid = inquilino.uid ?? inquilino.id;
  const avatarColor = avatarBg(inquilino.estado);

  return (
    <View style={prof.root}>
      {/* Header */}
      <View style={prof.header}>
        <View style={[prof.avatar, { backgroundColor: avatarColor }]}>
          <Text style={prof.avatarText}>{inquilino.nombre.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={prof.nombre}>{inquilino.nombre} {inquilino.apellido}</Text>
          <Text style={prof.email}>{inquilino.email}</Text>
          <View style={prof.metaRow}>
            <Text style={prof.meta}>Hab. {inquilino.habitacionId ?? '—'}</Text>
            <View style={[prof.estadoBadge, { backgroundColor: avatarColor + '22' }]}>
              <Text style={[prof.estadoText, { color: avatarColor }]}>{inquilino.estado.toUpperCase()}</Text>
            </View>
            {inquilino.fechaIngreso ? (
              <Text style={prof.meta}>Ingreso: {formatFecha(inquilino.fechaIngreso)}</Text>
            ) : null}
          </View>
        </View>
      </View>

      {/* Tab bar */}
      <View style={prof.tabBar}>
        {PERF_TABS.map(t => (
          <TouchableOpacity key={t.id} style={[prof.tabBtn, perfTab === t.id && prof.tabBtnActive]}
            onPress={() => setPerfTab(t.id)}>
            <Text style={[prof.tabBtnText, perfTab === t.id && prof.tabBtnTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {perfTab === 'accesos'    && <AccesosTab    uid={uid} habitacionId={inquilino.habitacionId} />}
        {perfTab === 'pagos'      && <PagosTab      uid={uid} />}
        {perfTab === 'servicios'  && <ServiciosTab  uid={uid} />}
        {perfTab === 'documentos' && <DocumentosTab uid={uid} />}
        {perfTab === 'notas'      && <NotasTab      uid={uid} />}
      </ScrollView>
    </View>
  );
}

const prof = StyleSheet.create({
  root:   { flex: 1, backgroundColor: cartasBosque.bruma },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[4], padding: spacing[5], borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro, backgroundColor: cartasBosque.pergamino },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: 'Inter_700Bold', fontSize: 22, color: '#FFFFFF' },
  nombre: { fontFamily: 'Inter_700Bold', fontSize: 20, color: cartasBosque.tinta, marginBottom: 2 },
  email:  { fontFamily: 'SpaceMono_400Regular', fontSize: 11, color: cartasBosque.helecho, marginBottom: spacing[2] },
  metaRow:    { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing[2] },
  meta:       { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.helecho },
  estadoBadge:{ paddingHorizontal: spacing[2], paddingVertical: 2, borderRadius: borderRadius.full },
  estadoText: { fontFamily: 'SpaceMono_400Regular', fontSize: 9, letterSpacing: 0.5 },

  tabBar:          { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro, backgroundColor: cartasBosque.pergamino },
  tabBtn:          { flex: 1, alignItems: 'center', paddingVertical: spacing[2] + 2 },
  tabBtnActive:    { borderBottomWidth: 2, borderBottomColor: cartasBosque.bosque },
  tabBtnText:      { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.helecho, letterSpacing: 0.5 },
  tabBtnTextActive:{ color: cartasBosque.bosque, fontFamily: 'Inter_600SemiBold' },
});

// ─── InquilinosWebScreen ──────────────────────────────────────

export default function InquilinosWebScreen() {
  const [tab, setTab]                     = useState<Tab>('lista');
  const [inquilinos, setInquilinos]       = useState<Inquilino[]>([]);
  const [pagosMorosos, setPagosMorosos]   = useState<Record<string, 'vencido' | 'por_verificar'>>({});
  const [seleccionado, setSeleccionado]   = useState<Inquilino | null>(null);
  const [busqueda, setBusqueda]           = useState('');

  // Real-time inquilinos
  useEffect(() => {
    return onSnapshot(collections.inquilinos, snap => {
      const list = snap.docs
        .map(d => ({ ...d.data(), id: d.id } as Inquilino))
        .filter(i => i.estado !== 'inactivo')
        .sort((a, b) => `${a.nombre} ${a.apellido}`.localeCompare(`${b.nombre} ${b.apellido}`));
      setInquilinos(list);
    }, () => {});
  }, []);

  // Morosos badge (one-time load)
  useEffect(() => {
    getDocs(collections.pagos).then(snap => {
      const map: Record<string, 'vencido' | 'por_verificar'> = {};
      snap.docs.forEach(d => {
        const pg = d.data() as any;
        if (pg.estado === 'vencido' || pg.estado === 'por_verificar') {
          map[pg.inquilinoId] = pg.estado;
        }
      });
      setPagosMorosos(map);
    }).catch(() => {});
  }, []);

  const filtrados = inquilinos.filter(i => {
    if (!busqueda.trim()) return true;
    const q = busqueda.toLowerCase();
    return (
      `${i.nombre} ${i.apellido}`.toLowerCase().includes(q) ||
      (i.habitacionId ?? '').toLowerCase().includes(q)
    );
  });

  return (
    <View style={{ flex: 1, backgroundColor: cartasBosque.bruma }}>
      {/* ── Top tab bar ── */}
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

      {/* ── Lista (dos columnas) ── */}
      {tab === 'lista' && (
        <View style={cr.root}>
          {/* Columna izquierda */}
          <View style={cr.leftCol}>
            {/* Buscador */}
            <View style={lil.searchWrap}>
              <Ionicons name="search-outline" size={14} color={cartasBosque.helecho} />
              <TextInput
                style={lil.searchInput}
                value={busqueda}
                onChangeText={setBusqueda}
                placeholder="Buscar inquilino…"
                placeholderTextColor={cartasBosque.niebla}
              />
              {busqueda.length > 0 && (
                <TouchableOpacity onPress={() => setBusqueda('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={14} color={cartasBosque.helecho} />
                </TouchableOpacity>
              )}
            </View>

            {/* Lista */}
            <ScrollView showsVerticalScrollIndicator={false}>
              {filtrados.length === 0 ? (
                <Text style={lil.vacio}>
                  {inquilinos.length === 0 ? 'Cargando…' : 'Sin resultados'}
                </Text>
              ) : filtrados.map(inq => {
                const uid = inq.uid ?? inq.id;
                const moroso = pagosMorosos[uid];
                const activo = seleccionado?.id === inq.id;
                return (
                  <TouchableOpacity
                    key={inq.id}
                    style={[lil.row, activo && lil.rowActivo]}
                    onPress={() => setSeleccionado(inq)}
                    activeOpacity={0.7}
                  >
                    {/* Avatar */}
                    <View style={[lil.avatar, { backgroundColor: avatarBg(inq.estado) }]}>
                      <Text style={lil.avatarText}>{inq.nombre.charAt(0).toUpperCase()}</Text>
                    </View>
                    {/* Info */}
                    <View style={{ flex: 1 }}>
                      <View style={lil.nameRow}>
                        <Text style={lil.nombre} numberOfLines={1}>{inq.nombre} {inq.apellido}</Text>
                        {moroso === 'vencido' && (
                          <View style={lil.moroBadge}>
                            <Text style={lil.moroBadgeText}>VENCIDO</Text>
                          </View>
                        )}
                        {moroso === 'por_verificar' && (
                          <View style={[lil.moroBadge, { backgroundColor: '#E8A83822', borderColor: '#E8A83866' }]}>
                            <Text style={[lil.moroBadgeText, { color: '#E8A838' }]}>POR VERIFICAR</Text>
                          </View>
                        )}
                      </View>
                      <Text style={lil.hab}>Hab. {inq.habitacionId ?? '—'}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={14} color={cartasBosque.niebla} />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Columna derecha */}
          <View style={cr.rightCol}>
            {seleccionado ? (
              <PerfilInquilino key={seleccionado.id} inquilino={seleccionado} />
            ) : (
              <View style={cr.empty}>
                <Ionicons name="person-outline" size={48} color={cartasBosque.niebla} />
                <Text style={cr.emptyText}>Selecciona un inquilino</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {tab === 'nuevo'      && <NuevoInquilinoForm onDone={() => setTab('lista')} />}
      {tab === 'plantillas' && <PlantillasPanel />}
    </View>
  );
}

// ─── StyleSheets ──────────────────────────────────────────────

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
  tabActivo:     { borderBottomColor: cartasBosque.bosque },
  tabText:       { fontFamily: 'Inter_500Medium', fontSize: 13, color: cartasBosque.helecho },
  tabTextActivo: { color: cartasBosque.bosque },
});

const cr = StyleSheet.create({
  root:     { flex: 1, flexDirection: 'row' },
  leftCol:  { width: 280, borderRightWidth: 1, borderRightColor: cartasBosque.pergaminoOscuro, backgroundColor: cartasBosque.pergamino },
  rightCol: { flex: 1 },
  empty:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[3] },
  emptyText:{ fontFamily: 'Inter_400Regular', fontSize: 14, color: cartasBosque.niebla },
});

const lil = StyleSheet.create({
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    margin: spacing[3], paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    backgroundColor: cartasBosque.bruma, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
  },
  searchInput: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 13, color: cartasBosque.tinta },
  vacio:       { fontFamily: 'Inter_400Regular', fontSize: 13, color: cartasBosque.niebla, textAlign: 'center', marginTop: spacing[8] },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingHorizontal: spacing[3], paddingVertical: spacing[2] + 2,
    borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro,
  },
  rowActivo: { backgroundColor: '#1A423322' },

  avatar:     { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: 'Inter_700Bold', fontSize: 16, color: '#FFFFFF' },

  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], flexWrap: 'wrap' },
  nombre:  { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: cartasBosque.tinta },
  hab:     { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.helecho, marginTop: 2 },

  moroBadge: {
    paddingHorizontal: spacing[1] + 1, paddingVertical: 1,
    borderRadius: borderRadius.sm,
    backgroundColor: '#C0392B22', borderWidth: 1, borderColor: '#C0392B55',
  },
  moroBadgeText: { fontFamily: 'SpaceMono_400Regular', fontSize: 8, color: '#C0392B', letterSpacing: 0.5 },
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
  sheetCancelText:{ fontFamily: 'Inter_400Regular', fontSize: 14, color: cartasBosque.helecho },
  sheetOk:    { flex: 1, paddingVertical: spacing[3], borderRadius: borderRadius.md, backgroundColor: cartasBosque.bosque, alignItems: 'center' },
  sheetOkText:{ fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#FFF' },
});

const f = StyleSheet.create({
  scroll:  { flex: 1, backgroundColor: cartasBosque.bruma },
  content: { maxWidth: 620, padding: spacing[6], paddingBottom: spacing[12] },
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
  habsGrid:         { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  habChip:          { paddingHorizontal: spacing[3], paddingVertical: spacing[1.5], borderRadius: borderRadius.sm, borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro, backgroundColor: cartasBosque.pergamino },
  habChipActivo:    { backgroundColor: cartasBosque.bosque, borderColor: cartasBosque.bosque },
  habChipText:      { fontFamily: 'SpaceMono_400Regular', fontSize: 12, color: cartasBosque.musgo },
  habChipTextActivo:{ color: '#FFFFFF' },
  previewBox:   { backgroundColor: cartasBosque.pergamino, borderRadius: borderRadius.md, borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro, padding: spacing[4], marginBottom: spacing[4] },
  previewTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: cartasBosque.tinta, marginBottom: spacing[2] },
  previewRow:   { fontFamily: 'Inter_400Regular', fontSize: 13, color: cartasBosque.musgo, marginBottom: spacing[1] },
  previewVal:   { fontFamily: 'SpaceMono_400Regular', color: cartasBosque.bosque },
  previewNote:  { fontFamily: 'Inter_400Regular', fontSize: 11, color: cartasBosque.helecho, marginTop: spacing[2], lineHeight: 16 },
  btnRow:           { flexDirection: 'row', gap: spacing[3], marginTop: spacing[4] },
  btnSecundario:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2], paddingVertical: spacing[3], borderRadius: borderRadius.md, borderWidth: 1, borderColor: cartasBosque.bosque },
  btnSecundarioText:{ fontFamily: 'Inter_600SemiBold', fontSize: 14, color: cartasBosque.bosque },
  btnPrimario:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2], paddingVertical: spacing[3], borderRadius: borderRadius.md, backgroundColor: cartasBosque.bosque },
  btnPrimarioText:  { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#FFFFFF' },
});

const il = StyleSheet.create({
  listContent: { padding: spacing[4], paddingBottom: spacing[10] },
  vacio: { fontFamily: 'Inter_400Regular', fontSize: 13, color: cartasBosque.helecho, textAlign: 'center', marginTop: spacing[8] },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing[3], borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro, gap: spacing[3],
  },
  rowNombreWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing[1] },
  nombre: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: cartasBosque.tinta },
  hab:    { fontFamily: 'SpaceMono_400Regular', fontSize: 11, color: cartasBosque.helecho, width: 64 },
  estado: { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.helecho, width: 72, textAlign: 'right' },
  moroBadge: { paddingHorizontal: spacing[2], paddingVertical: 2, borderRadius: borderRadius.sm, backgroundColor: '#C0392B22', borderWidth: 1, borderColor: '#C0392B55', marginLeft: spacing[2] },
  moroBadgeText: { fontFamily: 'SpaceMono_400Regular', fontSize: 9, color: '#C0392B', letterSpacing: 0.5 },
});
