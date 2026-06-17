import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, Pressable, PanResponder, TextInput, Alert,
  ActivityIndicator, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { onSnapshot, doc, query, collection, where } from 'firebase/firestore';
import { db } from '@/services/firebase/firestore';
import { cartasBosque } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/spacing';
import { useAuth } from '@/hooks/useAuth';
import DocumentoCard from '@/components/common/DocumentoCard';
import FacturacionScreen from './FacturacionScreen';
import {
  listenExpediente, listenDocumentos, inicializarExpediente,
  registrarDescarga, firmarDocumento,
  agregarContactoEmergencia, eliminarContactoEmergencia,
  agregarMascota, eliminarMascota,
} from '@/services/firebase/expedientes';
import { listenDocumentosPlantillas } from '@/services/firebase/documentosPlantillas';
import { listenMisPagos } from '@/services/firebase/pagos';
import { listenMisSesiones, cerrarSesion } from '@/services/firebase/sesiones';
import { useSessionManager } from '@/hooks/useSessionManager';
import type {
  Inquilino, Expediente, DocumentoExpediente, Pago,
  HuespedExtra, ScoreReputacion, ContactoEmergencia, Mascota, Sesion,
  DocumentoPlantilla,
} from '@/types/firestore';

// ─── Constantes ───────────────────────────────────────────────

const NIVEL_COLOR: Record<string, string> = {
  pesimo: '#960018', moroso: '#8A6A72', regular: '#8A9E80',
  bueno: '#4A6741', excelente: '#2C4A2E',
};
const NIVEL_LABEL: Record<string, string> = {
  pesimo: 'Pésimo', moroso: 'Moroso', regular: 'Regular',
  bueno: 'Bueno', excelente: 'Excelente',
};
const GRAD_SEGS = ['#960018', '#8A6A72', '#8A6A72', '#8A9E80', '#2E3C2C'];
const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

// ─── Helpers ──────────────────────────────────────────────────

function formatFecha(ts: any): string {
  try { return ts.toDate().toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return '—'; }
}

function tiempoDesde(ts: any): string {
  try {
    const diff = Date.now() - ts.toDate().getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 2)  return 'justo ahora';
    if (mins < 60) return `hace ${mins} min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `hace ${hrs} h`;
    return `hace ${Math.floor(hrs / 24)} días`;
  } catch { return '—'; }
}

function pagoEstadoBg(p: Pago): string {
  if (p.estado === 'pagado') {
    const tardio = p.fechaPago && p.fechaPago.toMillis() > p.fechaVencimiento.toMillis();
    return tardio ? 'rgba(138,106,114,0.1)' : '#E8EBE0';
  }
  if (p.estado === 'en_revision') return 'rgba(138,106,114,0.1)';
  if (p.estado === 'vencido')     return 'rgba(103,0,16,0.15)';
  return cartasBosque.pergamino;
}

function pagoEstadoTextColor(p: Pago): string {
  if (p.estado === 'pagado') {
    const tardio = p.fechaPago && p.fechaPago.toMillis() > p.fechaVencimiento.toMillis();
    return tardio ? '#8A6A72' : '#4A5E48';
  }
  if (p.estado === 'en_revision') return '#8A6A72';
  if (p.estado === 'vencido')     return '#960018';
  return cartasBosque.helecho;
}

function pagoEtiqueta(p: Pago): string {
  if (p.estado === 'pagado') {
    const tardio = p.fechaPago && p.fechaPago.toMillis() > p.fechaVencimiento.toMillis();
    return tardio
      ? `Tardío · $${p.monto.toLocaleString('es-MX')}`
      : `Completo · $${p.monto.toLocaleString('es-MX')}`;
  }
  if (p.estado === 'en_revision') return 'En verificación';
  if (p.estado === 'vencido')     return 'Adeudo';
  return 'Pendiente';
}

function barColorMes(p: Pago | undefined): string {
  if (!p) return cartasBosque.pergaminoOscuro;
  if (p.estado === 'pagado') {
    const tardio = p.fechaPago && p.fechaPago.toMillis() > p.fechaVencimiento.toMillis();
    return tardio ? '#CDB29D' : '#E8EBE0';
  }
  if (p.estado === 'vencido')     return 'rgba(103,0,16,0.15)';
  if (p.estado === 'en_revision') return 'rgba(138,106,114,0.1)';
  return '#E0DDD5';
}

function getMonthBars(pagos: Pago[]) {
  const now = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    const yr = d.getFullYear(); const mo = d.getMonth();
    const pago = pagos.find(p => {
      const pd = p.fechaVencimiento.toDate();
      return pd.getFullYear() === yr && pd.getMonth() === mo && p.concepto === 'arriendo';
    });
    return { label: MESES[mo], color: barColorMes(pago), pago };
  });
}

// ─── Firma pad ────────────────────────────────────────────────

type Point  = { x: number; y: number };
type Stroke = Point[];

function FirmaPad({ titulo, onGuardar, onCancelar }: {
  titulo: string;
  onGuardar: (json: string) => void;
  onCancelar: () => void;
}) {
  const strokesRef = useRef<Stroke[]>([]);
  const currentRef = useRef<Stroke>([]);
  const [tick, setTick] = useState(0);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: (e) => {
        const { locationX: x, locationY: y } = e.nativeEvent;
        currentRef.current = [{ x, y }];
      },
      onPanResponderMove: (e) => {
        const { locationX: x, locationY: y } = e.nativeEvent;
        const prev = currentRef.current[currentRef.current.length - 1];
        if (!prev || Math.hypot(x - prev.x, y - prev.y) > 2) {
          currentRef.current = [...currentRef.current, { x, y }];
          setTick(t => t + 1);
        }
      },
      onPanResponderRelease: () => {
        strokesRef.current = [...strokesRef.current, [...currentRef.current]];
        currentRef.current = [];
        setTick(t => t + 1);
      },
    })
  ).current;

  const allStrokes = [...strokesRef.current, currentRef.current].filter(s => s.length > 0);

  function renderStroke(stroke: Stroke, si: number) {
    return stroke.slice(1).map((p, pi) => {
      const prev = stroke[pi];
      const dx = p.x - prev.x; const dy = p.y - prev.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      const ang = Math.atan2(dy, dx) * (180 / Math.PI);
      const cx = (prev.x + p.x) / 2; const cy = (prev.y + p.y) / 2;
      return (
        <View key={`${si}-${pi}`} style={{
          position: 'absolute', left: cx - len / 2, top: cy - 1.5,
          width: Math.max(len, 1), height: 3, borderRadius: 1.5,
          backgroundColor: cartasBosque.tinta,
          transform: [{ rotate: `${ang}deg` }],
        }} />
      );
    });
  }

  return (
    <View style={firmaStyles.container}>
      <Text style={firmaStyles.titulo}>{titulo}</Text>
      <Text style={firmaStyles.sub}>Dibuja tu firma en el área de abajo</Text>
      <View style={firmaStyles.canvas} {...panResponder.panHandlers}>
        {allStrokes.map((s, i) => renderStroke(s, i))}
        {allStrokes.length === 0 && (
          <Text style={firmaStyles.canvasHint}>← Dibuja aquí →</Text>
        )}
      </View>
      <View style={firmaStyles.btnRow}>
        <TouchableOpacity
          style={firmaStyles.btnLimpiar}
          onPress={() => { strokesRef.current = []; currentRef.current = []; setTick(t => t + 1); }}
        >
          <Text style={firmaStyles.btnLimpiarText}>Limpiar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={firmaStyles.btnCancelar} onPress={onCancelar}>
          <Text style={firmaStyles.btnCancelarText}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[firmaStyles.btnGuardar, strokesRef.current.length === 0 && { opacity: 0.4 }]}
          disabled={strokesRef.current.length === 0}
          onPress={() => onGuardar(JSON.stringify(strokesRef.current))}
        >
          <Text style={firmaStyles.btnGuardarText}>Guardar firma</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function FirmaPreview({ json }: { json: string }) {
  try {
    const strokes: Stroke[] = JSON.parse(json);
    if (!strokes.length) return null;
    const allPts = strokes.flat();
    const minX = Math.min(...allPts.map(p => p.x));
    const maxX = Math.max(...allPts.map(p => p.x));
    const minY = Math.min(...allPts.map(p => p.y));
    const maxY = Math.max(...allPts.map(p => p.y));
    const H    = maxY - minY + 20;
    return (
      <View style={{ height: Math.min(H, 80), width: '100%', overflow: 'hidden' }}>
        {strokes.map((stroke, si) =>
          stroke.slice(1).map((p, pi) => {
            const prev = stroke[pi];
            const dx = p.x - prev.x; const dy = p.y - prev.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            const ang = Math.atan2(dy, dx) * (180 / Math.PI);
            const cx = (prev.x + p.x) / 2 - minX + 10;
            const cy = (prev.y + p.y) / 2 - minY + 10;
            return (
              <View key={`${si}-${pi}`} style={{
                position: 'absolute', left: cx - len / 2, top: cy - 1,
                width: Math.max(len, 1), height: 2, borderRadius: 1,
                backgroundColor: cartasBosque.bosque,
                transform: [{ rotate: `${ang}deg` }],
              }} />
            );
          })
        )}
      </View>
    );
  } catch { return null; }
}

// ─── Modal Contacto ───────────────────────────────────────────

function ModalContacto({ onGuardar, onCancelar }: {
  onGuardar: (c: Omit<ContactoEmergencia, 'id'>) => void;
  onCancelar: () => void;
}) {
  const [nombre,        setNombre]        = useState('');
  const [edad,          setEdad]          = useState('');
  const [parentesco,    setParentesco]    = useState('');
  const [telefono,      setTelefono]      = useState('');
  const [redesSociales, setRedesSociales] = useState('');
  const [direccion,     setDireccion]     = useState('');

  const valido = nombre && edad && parentesco &&
    [telefono, redesSociales, direccion].filter(Boolean).length >= 1;

  return (
    <View style={mStyles.sheet}>
      <Text style={mStyles.titulo}>Contacto de emergencia</Text>
      <Text style={mStyles.sub}>Mínimo nombre + parentesco + un dato de contacto</Text>
      {[
        { label: 'Nombre *',      value: nombre,        onChange: setNombre,        kb: 'default'    as const },
        { label: 'Edad *',        value: edad,          onChange: setEdad,          kb: 'numeric'    as const },
        { label: 'Parentesco *',  value: parentesco,    onChange: setParentesco,    kb: 'default'    as const },
        { label: 'Teléfono',      value: telefono,      onChange: setTelefono,      kb: 'phone-pad'  as const },
        { label: 'Redes sociales',value: redesSociales, onChange: setRedesSociales, kb: 'default'    as const },
        { label: 'Dirección',     value: direccion,     onChange: setDireccion,     kb: 'default'    as const },
      ].map(f => (
        <TextInput
          key={f.label}
          style={mStyles.input}
          placeholder={f.label}
          placeholderTextColor={cartasBosque.helecho}
          value={f.value}
          onChangeText={f.onChange}
          keyboardType={f.kb}
        />
      ))}
      <View style={mStyles.btnRow}>
        <TouchableOpacity style={mStyles.btnCancel} onPress={onCancelar}>
          <Text style={mStyles.btnCancelText}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[mStyles.btnOk, !valido && { opacity: 0.4 }]}
          disabled={!valido}
          onPress={() => onGuardar({
            nombre, edad: parseInt(edad, 10), parentesco,
            telefono: telefono || undefined,
            redesSociales: redesSociales || undefined,
            direccion: direccion || undefined,
          })}
        >
          <Text style={mStyles.btnOkText}>Guardar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Modal Mascota ────────────────────────────────────────────

function ModalMascota({ onGuardar, onCancelar }: {
  onGuardar: (m: Omit<Mascota, 'id'>) => void;
  onCancelar: () => void;
}) {
  const [nombre,              setNombre]              = useState('');
  const [especie,             setEspecie]             = useState('');
  const [raza,                setRaza]                = useState('');
  const [color,               setColor]               = useState('');
  const [edad,                setEdad]                = useState('');
  const [vacunas,             setVacunas]             = useState('');
  const [curp,                setCurp]                = useState('');
  const [senasParticulares,   setSenasParticulares]   = useState('');
  const [comidaFavorita,      setComidaFavorita]      = useState('');
  const [actividadFavorita,   setActividadFavorita]   = useState('');
  const [condicionParticular, setCondicionParticular] = useState('');
  const [temperamento,        setTemperamento]        = useState<'dormilon' | 'activo' | undefined>(undefined);
  const [nivelRuido,          setNivelRuido]          = useState<'bajo' | 'medio' | 'alto' | undefined>(undefined);
  const [ritmo,               setRitmo]               = useState<'nocturno' | 'diurno' | undefined>(undefined);

  const valido = nombre.trim() !== '' && especie.trim() !== '';

  function handleGuardar() {
    onGuardar({
      nombre:  nombre.trim(),
      especie: especie.trim(),
      ...(raza.trim()                && { raza:                raza.trim() }),
      ...(color.trim()               && { color:               color.trim() }),
      ...(edad.trim()                && { edad:                edad.trim() }),
      ...(vacunas.trim()             && { vacunas:             vacunas.trim() }),
      ...(curp.trim()                && { curp:                curp.trim() }),
      ...(senasParticulares.trim()   && { senasParticulares:   senasParticulares.trim() }),
      ...(comidaFavorita.trim()      && { comidaFavorita:      comidaFavorita.trim() }),
      ...(actividadFavorita.trim()   && { actividadFavorita:   actividadFavorita.trim() }),
      ...(temperamento               && { temperamento }),
      ...(nivelRuido                 && { nivelRuido }),
      ...(ritmo                      && { ritmo }),
      ...(condicionParticular.trim() && { condicionParticular: condicionParticular.trim() }),
    });
  }

  return (
    <View style={mStyles.sheet}>
      <Text style={mStyles.titulo}>Registrar mascota</Text>
      <ScrollView style={{ maxHeight: 420 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
        {[
          { label: 'Nombre *',            value: nombre,              onChange: setNombre },
          { label: 'Especie *',           value: especie,             onChange: setEspecie },
          { label: 'Raza',                value: raza,                onChange: setRaza },
          { label: 'Color',               value: color,               onChange: setColor },
          { label: 'Edad',                value: edad,                onChange: setEdad },
          { label: 'Vacunas',             value: vacunas,             onChange: setVacunas },
          { label: 'CURP',                value: curp,                onChange: setCurp },
          { label: 'Señas particulares',  value: senasParticulares,   onChange: setSenasParticulares },
          { label: 'Comida favorita',     value: comidaFavorita,      onChange: setComidaFavorita },
          { label: 'Actividad favorita',  value: actividadFavorita,   onChange: setActividadFavorita },
          { label: 'Cond. particular',    value: condicionParticular, onChange: setCondicionParticular },
        ].map(f => (
          <TextInput
            key={f.label}
            style={mStyles.input}
            placeholder={f.label}
            placeholderTextColor={cartasBosque.helecho}
            value={f.value}
            onChangeText={f.onChange}
          />
        ))}

        <Text style={mStyles.chipLabel}>Temperamento</Text>
        <View style={mStyles.chipRow}>
          {(['dormilon', 'activo'] as const).map(v => (
            <TouchableOpacity
              key={v}
              style={[mStyles.chip, temperamento === v && mStyles.chipActive]}
              onPress={() => setTemperamento(temperamento === v ? undefined : v)}
            >
              <Text style={[mStyles.chipText, temperamento === v && mStyles.chipTextActive]}>
                {v === 'dormilon' ? 'Dormilón' : 'Activo'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={mStyles.chipLabel}>Nivel de ruido</Text>
        <View style={mStyles.chipRow}>
          {(['bajo', 'medio', 'alto'] as const).map(v => (
            <TouchableOpacity
              key={v}
              style={[mStyles.chip, nivelRuido === v && mStyles.chipActive]}
              onPress={() => setNivelRuido(nivelRuido === v ? undefined : v)}
            >
              <Text style={[mStyles.chipText, nivelRuido === v && mStyles.chipTextActive]}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={mStyles.chipLabel}>Ritmo</Text>
        <View style={[mStyles.chipRow, { marginBottom: spacing[2] }]}>
          {(['nocturno', 'diurno'] as const).map(v => (
            <TouchableOpacity
              key={v}
              style={[mStyles.chip, ritmo === v && mStyles.chipActive]}
              onPress={() => setRitmo(ritmo === v ? undefined : v)}
            >
              <Text style={[mStyles.chipText, ritmo === v && mStyles.chipTextActive]}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <View style={mStyles.btnRow}>
        <TouchableOpacity style={mStyles.btnCancel} onPress={onCancelar}>
          <Text style={mStyles.btnCancelText}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[mStyles.btnOk, !valido && { opacity: 0.4 }]}
          disabled={!valido}
          onPress={handleGuardar}
        >
          <Text style={mStyles.btnOkText}>Guardar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Sección label ────────────────────────────────────────────

function Seccion({ label }: { label: string }) {
  return <Text style={secStyles.label}>{label}</Text>;
}

// ─── DossierScreen ────────────────────────────────────────────

type Vista    = 'dossier' | 'facturacion';
type ModalTipo = 'contacto' | 'mascota' | null;

export default function DossierScreen() {
  const { user, signOut } = useAuth();
  const uid = user?.uid ?? '';

  const [vista, setVista]             = useState<Vista>('dossier');
  const [modal, setModal]             = useState<ModalTipo>(null);
  const [inquilino, setInquilino]     = useState<Inquilino | null>(null);
  const [expediente, setExpediente]   = useState<Expediente | null>(null);
  const [documentos, setDocumentos]   = useState<DocumentoExpediente[]>([]);
  const [plantillas, setPlantillas]   = useState<DocumentoPlantilla[]>([]);
  const [huespedes, setHuespedes]     = useState<HuespedExtra[]>([]);
  const [score, setScore]             = useState<ScoreReputacion | null>(null);
  const [pagos, setPagos]             = useState<Pago[]>([]);
  const [sesiones, setSesiones]       = useState<Sesion[]>([]);
  const [firmandoDoc, setFirmandoDoc] = useState<DocumentoExpediente | null>(null);
  const [cargando, setCargando]       = useState(true);
  const { sesionId, reportarDispositivoPerdido } = useSessionManager();

  useEffect(() => {
    if (!uid) return;

    const unsubInq = onSnapshot(doc(db, 'inquilinos', uid), snap => {
      if (snap.exists()) setInquilino({ ...snap.data(), id: snap.id } as Inquilino);
    });
    const unsubScore = onSnapshot(doc(db, 'scores', uid), snap => {
      if (snap.exists()) setScore({ ...snap.data(), id: snap.id } as ScoreReputacion);
    });
    const qH = query(collection(db, 'huespedes_extra'), where('inquilinoId', '==', uid), where('activo', '==', true));
    const unsubH = onSnapshot(qH, snap => {
      setHuespedes(snap.docs.map(d => ({ ...d.data(), id: d.id } as HuespedExtra)));
    }, () => {});
    const unsubExp = listenExpediente(uid, async (exp) => {
      if (!exp) {
        await inicializarExpediente(uid, { habitacionId: null, habitacionNumero: null }).catch(() => {});
      } else {
        setExpediente(exp);
      }
      setCargando(false);
    });
    const unsubDocs       = listenDocumentos(uid, setDocumentos);
    const unsubPlantillas = listenDocumentosPlantillas(setPlantillas);
    const unsubSes        = listenMisSesiones(uid, setSesiones);
    const unsubPagos      = listenMisPagos(uid, setPagos);

    return () => { unsubInq(); unsubScore(); unsubH(); unsubExp(); unsubDocs(); unsubPlantillas(); unsubSes(); unsubPagos(); };
  }, [uid]);

  if (vista === 'facturacion') {
    return <FacturacionScreen onBack={() => setVista('dossier')} />;
  }

  const nombreCompleto = inquilino ? `${inquilino.nombre} ${inquilino.apellido}` : user?.email ?? '—';
  const scoreColor     = score ? (NIVEL_COLOR[score.nivel] ?? cartasBosque.helecho) : cartasBosque.helecho;
  const scoreLabel     = score ? (NIVEL_LABEL[score.nivel] ?? '') : '—';
  const totalExtra     = huespedes.reduce((s, h) => s + (h.montoMensual ?? 0), 0);

  const plantillaMap = new Map<string, { url: string; requiereFirma: boolean }>();
  plantillas.forEach(p => {
    if (p.url) plantillaMap.set(p.tipo.toUpperCase(), { url: p.url, requiereFirma: p.requiereFirma });
  });

  const pagosCompletos = pagos.filter(p => p.estado === 'pagado').length;
  const pagosTardios   = pagos.filter(p =>
    p.estado === 'pagado' && p.fechaPago != null &&
    p.fechaPago.toMillis() > p.fechaVencimiento.toMillis()
  ).length;
  const adeudos  = pagos.filter(p => p.estado === 'vencido').length;
  const monthBars = getMonthBars(pagos);
  const historial = pagos.filter(p => p.concepto === 'arriendo').slice(0, 12);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitulo}>Mi expediente</Text>
        <TouchableOpacity onPress={signOut}>
          <Ionicons name="log-out-outline" size={22} color={cartasBosque.helecho} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Perfil ── */}
        <View style={s.perfilCard}>
          <View style={s.avatarRow}>
            <View style={s.avatar}>
              <Text style={s.avatarInitial}>
                {(inquilino?.nombre?.[0] ?? user?.email?.[0] ?? '?').toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.nombre}>{nombreCompleto}</Text>
              {inquilino?.habitacionId && (
                <Text style={s.hab}>Hab {inquilino.habitacionId.replace('hab_', '')}</Text>
              )}
              {inquilino?.fechaIngreso && (
                <Text style={s.meta}>Desde {formatFecha(inquilino.fechaIngreso)}</Text>
              )}
            </View>
            <View style={[s.scoreRing, { borderColor: scoreColor }]}>
              <Text style={[s.scoreNum, { color: scoreColor }]}>{score?.puntos ?? '—'}</Text>
              <Text style={s.scoreLabel}>{scoreLabel}</Text>
            </View>
          </View>
        </View>

        {cargando && <ActivityIndicator color={cartasBosque.bosque} style={{ marginVertical: spacing[4] }} />}

        {/* ── Documentos ── */}
        <Seccion label={`Documentos (${documentos.filter(d => d.estado === 'subido' || d.estado === 'firmado').length}/${documentos.length})`} />
        {documentos.length === 0 ? (
          <View style={s.emptyCard}>
            <Text style={s.emptyText}>Los documentos serán cargados por administración</Text>
          </View>
        ) : (
          documentos.map(d => {
            const pl = (!d.url && d.estado !== 'firmado') ? plantillaMap.get(d.tipo) : undefined;
            const ef: DocumentoExpediente = pl
              ? { ...d, url: pl.url, requiereFirma: pl.requiereFirma, estado: (pl.requiereFirma ? 'pendiente_firma' : 'subido') as DocumentoExpediente['estado'] }
              : d;
            return (
              <View key={d.id}>
                <DocumentoCard
                  doc={ef}
                  esAdmin={false}
                  onDescargar={async () => {
                    if (ef.url) {
                      await registrarDescarga(uid, d.id).catch(() => {});
                      Linking.openURL(ef.url);
                    }
                  }}
                  onFirmar={() => setFirmandoDoc(ef)}
                />
                {ef.estado === 'firmado' && ef.firmaDigital != null && (
                  <View style={s.firmaPreviewBox}>
                    <FirmaPreview json={ef.firmaDigital} />
                  </View>
                )}
              </View>
            );
          })
        )}

        {/* ── REPUTACIÓN ── */}
        <Seccion label="Reputación" />
        <View style={s.repCard}>
          {/* Porcentaje + badge */}
          <View style={s.repTopRow}>
            <Text style={[s.repPct, { color: scoreColor }]}>{score?.puntos ?? 0}%</Text>
            <View style={[s.repBadge, { backgroundColor: scoreColor + '22', borderColor: scoreColor + '55' }]}>
              <Text style={[s.repBadgeText, { color: scoreColor }]}>{scoreLabel || 'Sin datos'}</Text>
            </View>
          </View>

          {/* Barra gradiente 5 segmentos */}
          <View style={s.gradBar}>
            {GRAD_SEGS.map((color, i) => {
              const segStart = i * 20;
              const puntos = score?.puntos ?? 0;
              const filled  = Math.min(Math.max(puntos - segStart, 0), 20) / 20;
              return (
                <View key={i} style={[s.gradSeg, { backgroundColor: cartasBosque.pergaminoOscuro }]}>
                  <View style={{ width: `${filled * 100}%`, height: '100%', backgroundColor: color }} />
                </View>
              );
            })}
          </View>

          {/* Estadísticas texto */}
          <Text style={s.repStats}>
            {pagosCompletos} pagos completos · {pagosTardios} tardíos · {adeudos} adeudos
          </Text>

          {/* Gráfica barras mensual */}
          <View style={s.chartWrap}>
            {monthBars.map((mb, i) => (
              <View key={i} style={s.barCol}>
                <View style={[s.bar, { backgroundColor: mb.color }]} />
                <Text style={s.barLabel}>{mb.label}</Text>
              </View>
            ))}
          </View>
          {/* Leyenda */}
          <View style={s.leyendaRow}>
            {[['#E8EBE0','Completo'],['#CDB29D','Tardío'],['#E0DDD5','Pendiente']].map(([bg,lbl]) => (
              <View key={lbl} style={s.leyendaItem}>
                <View style={[s.leyendaDot, { backgroundColor: bg as string }]} />
                <Text style={s.leyendaText}>{lbl}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── HISTORIAL DE PAGOS ── */}
        <Seccion label="Historial de pagos" />
        {historial.length === 0 ? (
          <View style={s.emptyCard}>
            <Text style={s.emptyText}>Sin historial de pagos aún</Text>
          </View>
        ) : (
          <View style={s.histCard}>
            {historial.map((p, i) => {
              const bg   = pagoEstadoBg(p);
              const clr  = pagoEstadoTextColor(p);
              const etiq = pagoEtiqueta(p);
              const d    = p.fechaVencimiento.toDate();
              return (
                <View key={p.id}>
                  {i > 0 && <View style={s.histDivider} />}
                  <View style={s.histRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.histMes}>
                        {d.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
                      </Text>
                    </View>
                    <View style={[s.histBadge, { backgroundColor: bg, borderColor: clr + '55' }]}>
                      <Text style={[s.histBadgeText, { color: clr }]}>{etiq}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ── Ocupantes ── */}
        <Seccion label="Ocupantes" />
        <View style={s.ocupanteCard}>
          <View style={s.ocupanteRow}>
            <View style={s.ocupanteAvatarSmall}>
              <Ionicons name="person" size={14} color={cartasBosque.bruma} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.ocupanteNombre}>{nombreCompleto}</Text>
              <Text style={s.ocupanteTipo}>Titular</Text>
            </View>
          </View>
          {huespedes.map((h, i) => (
            <View key={h.id}>
              <View style={s.ocupanteDivider} />
              <View style={s.ocupanteRow}>
                <View style={[s.ocupanteAvatarSmall, { backgroundColor: cartasBosque.helecho }]}>
                  <Ionicons name="person-outline" size={14} color={cartasBosque.bruma} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.ocupanteNombre}>{h.nombre} {h.apellido}</Text>
                  <Text style={s.ocupanteTipo}>
                    {h.modalidad === 'mensual' ? 'Permanente' : 'Temporal'} · {formatFecha(h.fechaEntrada)}
                  </Text>
                </View>
                <Text style={s.ocupanteCosto}>${h.montoMensual.toLocaleString('es-MX')}/mes</Text>
              </View>
            </View>
          ))}
          {huespedes.length > 0 && (
            <>
              <View style={s.ocupanteDivider} />
              <View style={[s.ocupanteRow, { paddingTop: spacing[1] }]}>
                <Text style={s.ocupanteTotalLabel}>Extra por ocupantes</Text>
                <Text style={s.ocupanteTotal}>+${totalExtra.toLocaleString('es-MX')}/mes</Text>
              </View>
            </>
          )}
        </View>

        {/* ── MASCOTAS REGISTRADAS ── */}
        <View style={s.seccionHeaderRow}>
          <Seccion label={`Mascotas registradas (${expediente?.mascotas.length ?? 0}/6)`} />
        </View>
        {(expediente?.mascotas ?? []).length === 0 ? (
          <View style={s.emptyCard}>
            <Text style={s.emptyText}>Registra tus mascotas (máx 6)</Text>
          </View>
        ) : (
          expediente!.mascotas.map(m => (
            <View key={m.id} style={s.mascotaCard}>
              <Text style={s.mascotaEmoji}>🐾</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.mascotaDesc}>{m.nombre ?? m.descripcion ?? '—'}</Text>
                {(m.especie || m.raza) && (
                  <Text style={s.mascotaMeta}>
                    {[m.especie, m.raza].filter(Boolean).join(' · ')}
                  </Text>
                )}
              </View>
              <TouchableOpacity onPress={() => eliminarMascota(uid, m.id)}>
                <Ionicons name="close-circle-outline" size={18} color={cartasBosque.helecho} />
              </TouchableOpacity>
            </View>
          ))
        )}
        {(expediente?.mascotas.length ?? 0) < 6 && (
          <TouchableOpacity style={s.agregarBtn} onPress={() => setModal('mascota')}>
            <Ionicons name="add-circle-outline" size={16} color={cartasBosque.bosque} />
            <Text style={s.agregarBtnText}>+ Registrar mascota</Text>
          </TouchableOpacity>
        )}

        {/* ── CONTACTO DE EMERGENCIA ── */}
        <Seccion label={`Contacto de emergencia (${expediente?.contactosEmergencia.length ?? 0}/2)`} />
        {(expediente?.contactosEmergencia ?? []).length === 0 ? (
          <View style={s.emptyCard}>
            <Text style={s.emptyText}>Agrega hasta 2 contactos de emergencia</Text>
          </View>
        ) : (
          expediente!.contactosEmergencia.map(c => (
            <View key={c.id} style={s.contactoCard2}>
              {/* Avatar con iniciales */}
              <View style={s.contactoAvatar2}>
                <Text style={s.contactoAvatarInitial}>
                  {c.nombre.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.contactoNombre2}>{c.nombre}</Text>
                <Text style={s.contactoMeta2}>{c.parentesco} · {c.edad} años</Text>
                {c.telefono   && <Text style={s.contactoMeta2}>{c.telefono}</Text>}
                {c.direccion  && <Text style={s.contactoMeta2}>{c.direccion}</Text>}
                {c.redesSociales && (
                  <Text style={s.contactoNota}>{c.redesSociales}</Text>
                )}
              </View>
              <TouchableOpacity onPress={() => Alert.alert('Eliminar', `¿Eliminar a ${c.nombre}?`, [
                { text: 'Cancelar' },
                { text: 'Eliminar', style: 'destructive', onPress: () => eliminarContactoEmergencia(uid, c.id) },
              ])}>
                <Ionicons name="trash-outline" size={16} color="#960018" />
              </TouchableOpacity>
            </View>
          ))
        )}
        {(expediente?.contactosEmergencia.length ?? 0) < 2 && (
          <TouchableOpacity style={s.agregarBtn} onPress={() => setModal('contacto')}>
            <Ionicons name="person-add-outline" size={16} color={cartasBosque.bosque} />
            <Text style={s.agregarBtnText}>Editar contacto</Text>
          </TouchableOpacity>
        )}

        {/* ── SESIONES ACTIVAS ── */}
        <Seccion label={`Sesiones activas (${sesiones.filter(se => se.activa).length})`} />
        {sesiones.filter(se => se.activa).map(ses => {
          const esActual  = ses.id === sesionId;
          const ubicacion = [ses.colonia, ses.ciudad].filter(Boolean).join(' · ');
          const platformIcon = ses.plataforma === 'web'
            ? 'globe-outline'
            : 'phone-portrait-outline';
          return (
            <View key={ses.id} style={s.sesionCard}>
              <View style={s.sesionIconWrap}>
                <Ionicons name={platformIcon} size={18} color={cartasBosque.bosque} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
                  <Text style={s.sesionDispositivo} numberOfLines={1}>{ses.dispositivo}</Text>
                  {esActual && (
                    <View style={s.esteDispositivoBadge}>
                      <Text style={s.esteDispositivoText}>este dispositivo</Text>
                    </View>
                  )}
                </View>
                {!!ubicacion && <Text style={s.sesionUbicacion}>{ubicacion}</Text>}
                <Text style={s.sesionTiempo}>{tiempoDesde(ses.fechaUltimaActividad)}</Text>
              </View>
              {!esActual && (
                <TouchableOpacity
                  style={s.cerrarSesBtn}
                  onPress={() => Alert.alert('Cerrar sesión', `¿Cerrar sesión en ${ses.dispositivo}?`, [
                    { text: 'Cancelar' },
                    { text: 'Cerrar', style: 'destructive', onPress: () => cerrarSesion(ses.id).catch(() => {}) },
                  ])}
                >
                  <Text style={s.cerrarSesBtnText}>Cerrar</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
        <TouchableOpacity
          style={s.roboBtn}
          onPress={() => Alert.alert(
            'Reportar robo / extravío',
            'Se notificará al administrador y tu cuenta quedará protegida.',
            [
              { text: 'Cancelar' },
              { text: 'Continuar', style: 'destructive', onPress: () => reportarDispositivoPerdido().catch(() => {}) },
            ],
          )}
          activeOpacity={0.75}
        >
          <Ionicons name="warning-outline" size={16} color="#960018" />
          <Text style={s.roboBtnText}>Reportar robo / extravío</Text>
        </TouchableOpacity>

        {/* ── Accesos rápidos ── */}
        <Seccion label="Accesos rápidos" />
        <TouchableOpacity style={s.accesoCard} onPress={() => setVista('facturacion')}>
          <View style={s.accesoIcon}>
            <Ionicons name="receipt-outline" size={20} color={cartasBosque.bosque} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.accesoTitulo}>Facturación CFDI</Text>
            <Text style={s.accesoSub}>Solicita tus facturas electrónicas</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={cartasBosque.niebla} />
        </TouchableOpacity>

        <View style={{ height: spacing[8] }} />
      </ScrollView>

      {/* ── Modales ── */}
      <Modal visible={firmandoDoc !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setFirmandoDoc(null)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: cartasBosque.bruma }}>
          {firmandoDoc && (
            <FirmaPad
              titulo={firmandoDoc.nombre}
              onGuardar={async (json) => {
                try { await firmarDocumento(uid, firmandoDoc.id, json); setFirmandoDoc(null); }
                catch { Alert.alert('Error', 'No se pudo guardar la firma'); }
              }}
              onCancelar={() => setFirmandoDoc(null)}
            />
          )}
        </SafeAreaView>
      </Modal>

      <Modal visible={modal === 'contacto'} animationType="slide" transparent onRequestClose={() => setModal(null)}>
        <Pressable style={s.overlay} onPress={() => setModal(null)}>
          <Pressable onPress={e => e.stopPropagation()}>
            <ModalContacto
              onGuardar={async (c) => {
                try { await agregarContactoEmergencia(uid, c); setModal(null); }
                catch (e: any) { Alert.alert('Error', e.message ?? 'Error al guardar'); }
              }}
              onCancelar={() => setModal(null)}
            />
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={modal === 'mascota'} animationType="slide" transparent onRequestClose={() => setModal(null)}>
        <Pressable style={s.overlay} onPress={() => setModal(null)}>
          <Pressable onPress={e => e.stopPropagation()}>
            <ModalMascota
              onGuardar={async (m) => {
                try { await agregarMascota(uid, m); setModal(null); }
                catch (e: any) { Alert.alert('Error', e.message ?? 'Error al guardar'); }
              }}
              onCancelar={() => setModal(null)}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: cartasBosque.bruma },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro,
  },
  headerTitulo: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 18, color: cartasBosque.tinta },
  scroll: { padding: spacing[4] },

  // Perfil
  perfilCard: {
    backgroundColor: cartasBosque.pergamino,
    borderRadius: borderRadius.lg, padding: spacing[4],
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro, marginBottom: spacing[5],
  },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: cartasBosque.bosque, alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 22, color: cartasBosque.bruma },
  nombre: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 15, color: cartasBosque.tinta },
  hab:    { fontFamily: 'MonaSans_400Regular',  fontSize: 11, color: cartasBosque.helecho,   marginTop: 2 },
  meta:   { fontFamily: 'MonaSans_400Regular',  fontSize: 10, color: cartasBosque.helecho, marginTop: 1 },
  scoreRing: {
    width: 58, height: 58, borderRadius: 29, borderWidth: 4,
    alignItems: 'center', justifyContent: 'center', backgroundColor: cartasBosque.bruma,
  },
  scoreNum:   { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 16, color: cartasBosque.tinta },
  scoreLabel: { fontFamily: 'MonaSans_400Regular',  fontSize: 8,  color: cartasBosque.helecho },

  // Firma
  firmaCard: {
    backgroundColor: cartasBosque.pergamino,
    borderRadius: borderRadius.md, padding: spacing[3],
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro, marginBottom: spacing[5],
  },
  firmaCardSigned: { borderColor: '#4A5E48' + '80', backgroundColor: '#E8EBE0' + '44' },
  firmaVacioRow:   { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  firmaVacioText:  { flex: 1, fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: cartasBosque.bosque },
  firmaHeaderRow:  { flexDirection: 'row', alignItems: 'center', gap: spacing[1], marginBottom: spacing[2] },
  firmaSignedText: { fontFamily: 'MonaSans_400Regular', fontSize: 11, color: '#4A5E48' },
  firmaPreviewBox: {
    height: 80, backgroundColor: cartasBosque.bruma,
    borderRadius: borderRadius.sm, overflow: 'hidden',
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
  },

  // Sección header row
  seccionHeaderRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 0,
  },

  // Empty state
  emptyCard: {
    backgroundColor: cartasBosque.pergamino,
    borderRadius: borderRadius.md, padding: spacing[3],
    alignItems: 'center', marginBottom: spacing[5],
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro, borderStyle: 'dashed',
  },
  emptyText: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: cartasBosque.helecho },

  // ── REPUTACIÓN ──
  repCard: {
    backgroundColor: cartasBosque.pergamino,
    borderRadius: borderRadius.lg, padding: spacing[4],
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro, marginBottom: spacing[5],
  },
  repTopRow:  { flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginBottom: spacing[3] },
  repPct:     { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 42, lineHeight: 44 },
  repBadge: {
    paddingHorizontal: spacing[3], paddingVertical: spacing[1],
    borderRadius: borderRadius.xl, borderWidth: 1,
  },
  repBadgeText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13 },
  gradBar: {
    flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden',
    gap: 2, marginBottom: spacing[3],
  },
  gradSeg: { flex: 1, overflow: 'hidden', borderRadius: 2 },
  repStats: {
    fontFamily: 'MonaSans_400Regular', fontSize: 10,
    color: cartasBosque.helecho, marginBottom: spacing[4], letterSpacing: 0.2,
  },
  chartWrap: {
    flexDirection: 'row', alignItems: 'flex-end',
    gap: 3, height: 52, marginBottom: spacing[2],
  },
  barCol:  { flex: 1, alignItems: 'center', gap: 3 },
  bar:     { flex: 1, width: '100%', borderRadius: 2, minHeight: 6 },
  barLabel:{ fontFamily: 'MonaSans_400Regular', fontSize: 7, color: cartasBosque.niebla, textAlign: 'center' },
  leyendaRow: { flexDirection: 'row', gap: spacing[3], marginTop: spacing[1] },
  leyendaItem:{ flexDirection: 'row', alignItems: 'center', gap: 4 },
  leyendaDot: { width: 8, height: 8, borderRadius: 4 },
  leyendaText:{ fontFamily: 'MonaSans_400Regular', fontSize: 9, color: cartasBosque.helecho },

  // ── HISTORIAL ──
  histCard: {
    backgroundColor: cartasBosque.pergamino,
    borderRadius: borderRadius.md, padding: spacing[3],
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro, marginBottom: spacing[5],
  },
  histRow:    { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: spacing[2] },
  histDivider:{ height: 1, backgroundColor: cartasBosque.pergaminoOscuro },
  histMes:    { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: cartasBosque.tinta },
  histBadge: {
    paddingHorizontal: spacing[2], paddingVertical: 3,
    borderRadius: borderRadius.sm, borderWidth: 1,
  },
  histBadgeText: { fontFamily: 'MonaSans_400Regular', fontSize: 10 },

  // Ocupantes
  ocupanteCard: {
    backgroundColor: cartasBosque.pergamino,
    borderRadius: borderRadius.md, padding: spacing[3],
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro, marginBottom: spacing[5],
  },
  ocupanteRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  ocupanteAvatarSmall: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: cartasBosque.bosque, alignItems: 'center', justifyContent: 'center',
  },
  ocupanteNombre:    { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 12, color: cartasBosque.tinta },
  ocupanteTipo:      { fontFamily: 'MonaSans_400Regular',  fontSize: 10, color: cartasBosque.helecho },
  ocupanteCosto:     { fontFamily: 'MonaSans_400Regular',  fontSize: 11, color: cartasBosque.helecho },
  ocupanteDivider:   { height: 1, backgroundColor: cartasBosque.pergaminoOscuro, marginVertical: spacing[2] },
  ocupanteTotalLabel:{ flex: 1, fontFamily: 'MonaSans_400Regular', fontSize: 10, color: cartasBosque.helecho },
  ocupanteTotal:     { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 12, color: cartasBosque.helecho },

  // ── MASCOTAS ──
  mascotaCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    backgroundColor: cartasBosque.pergamino,
    borderRadius: borderRadius.md, padding: spacing[3],
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro, marginBottom: spacing[2],
  },
  mascotaEmoji: { fontSize: 24 },
  mascotaDesc:  { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: cartasBosque.tinta },
  mascotaMeta:  { fontFamily: 'MonaSans_400Regular', fontSize: 10, color: cartasBosque.helecho, marginTop: 1 },

  // ── CONTACTO ──
  contactoCard2: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3],
    backgroundColor: cartasBosque.pergamino,
    borderRadius: borderRadius.md, padding: spacing[3],
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro, marginBottom: spacing[2],
  },
  contactoAvatar2: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: cartasBosque.bosque,
    alignItems: 'center', justifyContent: 'center',
  },
  contactoAvatarInitial: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 15, color: cartasBosque.bruma },
  contactoNombre2: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: cartasBosque.tinta },
  contactoMeta2:   { fontFamily: 'MonaSans_400Regular',  fontSize: 10, color: cartasBosque.helecho, marginTop: 1 },
  contactoNota:    { fontFamily: 'BricolageGrotesque_400Regular',  fontSize: 11, color: cartasBosque.helecho, fontStyle: 'italic', marginTop: 2 },

  // ── BOTÓN AGREGAR / EDITAR ──
  agregarBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: cartasBosque.pergamino,
    borderRadius: borderRadius.md, padding: spacing[3],
    borderWidth: 1, borderColor: cartasBosque.bosque + '55',
    borderStyle: 'dashed', marginBottom: spacing[5],
    justifyContent: 'center',
  },
  agregarBtnText: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: cartasBosque.bosque },

  // ── SESIONES ──
  sesionCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    backgroundColor: cartasBosque.pergamino,
    borderRadius: borderRadius.md, padding: spacing[3],
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro, marginBottom: spacing[2],
  },
  sesionIconWrap: {
    width: 36, height: 36, borderRadius: borderRadius.sm,
    backgroundColor: cartasBosque.niebla + '44',
    alignItems: 'center', justifyContent: 'center',
  },
  sesionDispositivo:    { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 12, color: cartasBosque.tinta, flex: 1 },
  sesionUbicacion:      { fontFamily: 'MonaSans_400Regular',  fontSize: 10, color: cartasBosque.helecho },
  sesionTiempo:         { fontFamily: 'MonaSans_400Regular',  fontSize: 10, color: cartasBosque.niebla },
  esteDispositivoBadge: {
    paddingHorizontal: spacing[2], paddingVertical: 1,
    borderRadius: borderRadius.sm, backgroundColor: cartasBosque.niebla + '55',
  },
  esteDispositivoText: { fontFamily: 'MonaSans_400Regular', fontSize: 9, color: cartasBosque.helecho },
  cerrarSesBtn: {
    paddingHorizontal: spacing[3], paddingVertical: spacing[1] + 1,
    borderRadius: borderRadius.sm, borderWidth: 1, borderColor: '#960018' + '55',
    backgroundColor: 'rgba(103,0,16,0.15)' + '55',
  },
  cerrarSesBtnText: { fontFamily: 'MonaSans_400Regular', fontSize: 10, color: '#960018' },
  roboBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    borderRadius: borderRadius.md, padding: spacing[3],
    borderWidth: 1, borderColor: '#960018' + '50',
    backgroundColor: 'rgba(103,0,16,0.15)' + '33', marginBottom: spacing[5],
  },
  roboBtnText: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: '#960018' },

  // Accesos rápidos
  accesoCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    backgroundColor: cartasBosque.pergamino,
    borderRadius: borderRadius.md, padding: spacing[3],
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro, marginBottom: spacing[2],
  },
  accesoIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: cartasBosque.niebla + '55', alignItems: 'center', justifyContent: 'center',
  },
  accesoTitulo: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: cartasBosque.tinta },
  accesoSub:    { fontFamily: 'BricolageGrotesque_400Regular',  fontSize: 11, color: cartasBosque.helecho },

  // Overlay modal
  overlay: { flex: 1, backgroundColor: 'rgba(18,42,31,0.45)', justifyContent: 'flex-end' },
});

const secStyles = StyleSheet.create({
  label: {
    fontFamily: 'MonaSans_400Regular', fontSize: 10, color: cartasBosque.helecho,
    letterSpacing: 0.8, textTransform: 'uppercase',
    marginBottom: spacing[2], marginTop: spacing[1],
  },
});

const firmaStyles = StyleSheet.create({
  container: { flex: 1, padding: spacing[5] },
  titulo:    { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 20, color: cartasBosque.tinta, marginBottom: spacing[1] },
  sub:       { fontFamily: 'BricolageGrotesque_400Regular',  fontSize: 13, color: cartasBosque.helecho, marginBottom: spacing[4] },
  canvas: {
    flex: 1, backgroundColor: cartasBosque.bruma,
    borderRadius: borderRadius.lg, borderWidth: 1,
    borderColor: cartasBosque.pergaminoOscuro,
    overflow: 'hidden', marginBottom: spacing[4],
    alignItems: 'center', justifyContent: 'center',
  },
  canvasHint: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: cartasBosque.niebla },
  btnRow:    { flexDirection: 'row', gap: spacing[2] },
  btnLimpiar: {
    paddingHorizontal: spacing[3], paddingVertical: spacing[2] + 2,
    borderRadius: borderRadius.md, borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
  },
  btnLimpiarText:  { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: cartasBosque.helecho },
  btnCancelar: {
    paddingHorizontal: spacing[3], paddingVertical: spacing[2] + 2,
    borderRadius: borderRadius.md, borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
  },
  btnCancelarText: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: cartasBosque.helecho },
  btnGuardar: {
    flex: 1, paddingVertical: spacing[2] + 2,
    borderRadius: borderRadius.md, backgroundColor: cartasBosque.bosque, alignItems: 'center',
  },
  btnGuardarText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: cartasBosque.bruma },
});

const mStyles = StyleSheet.create({
  sheet: {
    backgroundColor: cartasBosque.bruma,
    borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl,
    padding: spacing[5], paddingBottom: spacing[8],
  },
  titulo: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 17, color: cartasBosque.tinta, marginBottom: spacing[1] },
  sub:    { fontFamily: 'BricolageGrotesque_400Regular',  fontSize: 12, color: cartasBosque.helecho, marginBottom: spacing[3] },
  input:  {
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    borderRadius: borderRadius.md, padding: spacing[3],
    fontFamily: 'BricolageGrotesque_400Regular', fontSize: 14, color: cartasBosque.tinta,
    backgroundColor: cartasBosque.pergamino, marginBottom: spacing[2],
  },
  btnRow:       { flexDirection: 'row', gap: spacing[2], marginTop: spacing[2] },
  btnCancel: {
    flex: 1, paddingVertical: spacing[3],
    borderRadius: borderRadius.md, borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    alignItems: 'center',
  },
  btnCancelText: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 14, color: cartasBosque.helecho },
  btnOk: {
    flex: 1, paddingVertical: spacing[3],
    borderRadius: borderRadius.md, backgroundColor: cartasBosque.bosque, alignItems: 'center',
  },
  btnOkText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 14, color: cartasBosque.bruma },
  chipLabel: {
    fontFamily: 'MonaSans_400Regular', fontSize: 10, color: cartasBosque.helecho,
    marginBottom: spacing[1], marginTop: spacing[1],
  },
  chipRow: { flexDirection: 'row', gap: spacing[1] + 1, flexWrap: 'wrap', marginBottom: spacing[2] },
  chip: {
    paddingHorizontal: spacing[3], paddingVertical: spacing[1] + 1,
    borderRadius: borderRadius.sm, borderWidth: 1,
    borderColor: cartasBosque.pergaminoOscuro, backgroundColor: cartasBosque.pergamino,
  },
  chipActive:    { borderColor: cartasBosque.bosque, backgroundColor: cartasBosque.bosque },
  chipText:      { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: cartasBosque.helecho },
  chipTextActive:{ color: cartasBosque.bruma },
});
