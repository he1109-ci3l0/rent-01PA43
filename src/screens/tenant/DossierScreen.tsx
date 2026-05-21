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
  guardarFirma, registrarDescarga,
  agregarContactoEmergencia, eliminarContactoEmergencia,
  agregarMascota, eliminarMascota,
} from '@/services/firebase/expedientes';
import type {
  Inquilino, Expediente, DocumentoExpediente,
  HuespedExtra, ScoreReputacion, ContactoEmergencia, Mascota,
} from '@/types/firestore';

// ─── Helpers score ────────────────────────────────────────────

const NIVEL_COLOR: Record<string, string> = {
  pesimo: '#A63228', moroso: '#B07D2A', regular: '#7A9E7E',
  bueno: '#4A6741',  excelente: '#2C4A2E',
};
const NIVEL_LABEL: Record<string, string> = {
  pesimo: 'Pésimo', moroso: 'Moroso', regular: 'Regular',
  bueno: 'Bueno',   excelente: 'Excelente',
};

function formatFecha(ts: any): string {
  try { return ts.toDate().toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return '—'; }
}

// ─── Firma pad ────────────────────────────────────────────────

type Point  = { x: number; y: number };
type Stroke = Point[];

function FirmaPad({ onGuardar, onCancelar }: {
  onGuardar: (json: string) => void;
  onCancelar: () => void;
}) {
  const strokesRef    = useRef<Stroke[]>([]);
  const currentRef    = useRef<Stroke>([]);
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
      const dx   = p.x - prev.x;
      const dy   = p.y - prev.y;
      const len  = Math.sqrt(dx * dx + dy * dy);
      const ang  = Math.atan2(dy, dx) * (180 / Math.PI);
      const cx   = (prev.x + p.x) / 2;
      const cy   = (prev.y + p.y) / 2;
      return (
        <View
          key={`${si}-${pi}`}
          style={{
            position: 'absolute',
            left: cx - len / 2,
            top:  cy - 1.5,
            width: Math.max(len, 1),
            height: 3,
            borderRadius: 1.5,
            backgroundColor: cartasBosque.tinta,
            transform: [{ rotate: `${ang}deg` }],
          }}
        />
      );
    });
  }

  return (
    <View style={firmaStyles.container}>
      <Text style={firmaStyles.titulo}>Firma tu contrato</Text>
      <Text style={firmaStyles.sub}>Dibuja tu firma en el área de abajo</Text>

      <View
        style={firmaStyles.canvas}
        {...panResponder.panHandlers}
      >
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

// Renderiza firma guardada (preview read-only)
function FirmaPreview({ json }: { json: string }) {
  try {
    const strokes: Stroke[] = JSON.parse(json);
    if (!strokes.length) return null;
    // Bounding box
    const allPts = strokes.flat();
    const minX = Math.min(...allPts.map(p => p.x));
    const maxX = Math.max(...allPts.map(p => p.x));
    const minY = Math.min(...allPts.map(p => p.y));
    const maxY = Math.max(...allPts.map(p => p.y));
    const W = maxX - minX + 20;
    const H = maxY - minY + 20;

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

  const camposLlenos = [nombre, edad, parentesco].filter(Boolean).length +
    [telefono, redesSociales, direccion].filter(Boolean).length;
  const valido = nombre && edad && parentesco && camposLlenos >= 2;

  return (
    <View style={mStyles.sheet}>
      <Text style={mStyles.titulo}>Contacto de emergencia</Text>
      <Text style={mStyles.sub}>Mínimo nombre + parentesco + un dato de contacto</Text>
      {[
        { label: 'Nombre *', value: nombre, onChange: setNombre, kb: 'default' as const },
        { label: 'Edad *',   value: edad,   onChange: setEdad,   kb: 'numeric' as const },
        { label: 'Parentesco *', value: parentesco, onChange: setParentesco, kb: 'default' as const },
        { label: 'Teléfono', value: telefono, onChange: setTelefono, kb: 'phone-pad' as const },
        { label: 'Redes sociales', value: redesSociales, onChange: setRedesSociales, kb: 'default' as const },
        { label: 'Dirección', value: direccion, onChange: setDireccion, kb: 'default' as const },
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
  const [descripcion, setDescripcion] = useState('');
  return (
    <View style={mStyles.sheet}>
      <Text style={mStyles.titulo}>Registrar mascota</Text>
      <TextInput
        style={[mStyles.input, { height: 80, textAlignVertical: 'top' }]}
        placeholder="Descripción (especie, raza, nombre, color…)"
        placeholderTextColor={cartasBosque.helecho}
        value={descripcion}
        onChangeText={setDescripcion}
        multiline
      />
      <View style={mStyles.btnRow}>
        <TouchableOpacity style={mStyles.btnCancel} onPress={onCancelar}>
          <Text style={mStyles.btnCancelText}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[mStyles.btnOk, !descripcion.trim() && { opacity: 0.4 }]}
          disabled={!descripcion.trim()}
          onPress={() => onGuardar({ descripcion: descripcion.trim() })}
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

type Vista = 'dossier' | 'facturacion';
type ModalTipo = 'firma' | 'contacto' | 'mascota' | null;

export default function DossierScreen() {
  const { user, signOut } = useAuth();
  const uid = user?.uid ?? '';

  const [vista, setVista]               = useState<Vista>('dossier');
  const [modal, setModal]               = useState<ModalTipo>(null);
  const [inquilino, setInquilino]       = useState<Inquilino | null>(null);
  const [expediente, setExpediente]     = useState<Expediente | null>(null);
  const [documentos, setDocumentos]     = useState<DocumentoExpediente[]>([]);
  const [huespedes, setHuespedes]       = useState<HuespedExtra[]>([]);
  const [score, setScore]               = useState<ScoreReputacion | null>(null);
  const [cargando, setCargando]         = useState(true);

  // Inicializar expediente + listeners
  useEffect(() => {
    if (!uid) return;

    // Cargar inquilino
    const unsubInq = onSnapshot(doc(db, 'inquilinos', uid), snap => {
      if (snap.exists()) setInquilino({ ...snap.data(), id: snap.id } as Inquilino);
    });

    // Cargar score
    const unsubScore = onSnapshot(doc(db, 'scores', uid), snap => {
      if (snap.exists()) setScore({ ...snap.data(), id: snap.id } as ScoreReputacion);
    });

    // Cargar huéspedes activos
    const qH = query(collection(db, 'huespedes_extra'), where('inquilinoId', '==', uid), where('activo', '==', true));
    const unsubH = onSnapshot(qH, snap => {
      setHuespedes(snap.docs.map(d => ({ ...d.data(), id: d.id } as HuespedExtra)));
    }, () => {});

    // Cargar expediente + docs (inicializa si no existe)
    const unsubExp = listenExpediente(uid, async (exp) => {
      if (!exp) {
        await inicializarExpediente(uid, { habitacionId: null, habitacionNumero: null }).catch(() => {});
      } else {
        setExpediente(exp);
      }
      setCargando(false);
    });

    const unsubDocs = listenDocumentos(uid, setDocumentos);

    return () => { unsubInq(); unsubScore(); unsubH(); unsubExp(); unsubDocs(); };
  }, [uid]);

  if (vista === 'facturacion') {
    return <FacturacionScreen onBack={() => setVista('dossier')} />;
  }

  const nombreCompleto = inquilino
    ? `${inquilino.nombre} ${inquilino.apellido}`
    : user?.email ?? '—';

  const scoreColor = score ? (NIVEL_COLOR[score.nivel] ?? cartasBosque.helecho) : cartasBosque.helecho;
  const scoreLabel = score ? (NIVEL_LABEL[score.nivel] ?? '') : '—';

  const totalExtra = huespedes.reduce((s, h) => s + (h.montoMensual ?? 0), 0);

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
            {/* Score ring */}
            <View style={[s.scoreRing, { borderColor: scoreColor }]}>
              <Text style={[s.scoreNum, { color: scoreColor }]}>
                {score?.puntos ?? '—'}
              </Text>
              <Text style={s.scoreLabel}>{scoreLabel}</Text>
            </View>
          </View>
        </View>

        {cargando && <ActivityIndicator color={cartasBosque.bosque} style={{ marginVertical: spacing[4] }} />}

        {/* ── Firma digital ── */}
        <Seccion label="Firma digital" />
        <TouchableOpacity
          style={[s.firmaCard, expediente?.firmaDigital && s.firmaCardSigned]}
          onPress={() => !expediente?.firmaDigital && setModal('firma')}
          activeOpacity={expediente?.firmaDigital ? 1 : 0.75}
        >
          {expediente?.firmaDigital ? (
            <View>
              <View style={s.firmaHeaderRow}>
                <Ionicons name="checkmark-circle" size={18} color="#3A7D44" />
                <Text style={s.firmaSignedText}>
                  Firmado el {formatFecha(expediente.firmadoEn)}
                </Text>
              </View>
              <View style={s.firmaPreviewBox}>
                <FirmaPreview json={expediente.firmaDigital} />
              </View>
            </View>
          ) : (
            <View style={s.firmaVacioRow}>
              <Ionicons name="create-outline" size={20} color={cartasBosque.bosque} />
              <Text style={s.firmaVacioText}>Firmar contrato de hospedaje</Text>
              <Ionicons name="chevron-forward" size={16} color={cartasBosque.niebla} />
            </View>
          )}
        </TouchableOpacity>

        {/* ── Documentos ── */}
        <Seccion label={`Documentos (${documentos.filter(d => d.estado === 'subido').length}/${documentos.length})`} />
        {documentos.length === 0 ? (
          <View style={s.emptyCard}>
            <Text style={s.emptyText}>Los documentos serán cargados por administración</Text>
          </View>
        ) : (
          documentos.map(d => (
            <DocumentoCard
              key={d.id}
              doc={d}
              esAdmin={false}
              onDescargar={async () => {
                if (d.url) {
                  await registrarDescarga(uid, d.id).catch(() => {});
                  Linking.openURL(d.url);
                }
              }}
            />
          ))
        )}

        {/* ── Ocupantes ── */}
        <Seccion label="Ocupantes" />
        <View style={s.ocupanteCard}>
          {/* Titular */}
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
                <View style={[s.ocupanteAvatarSmall, { backgroundColor: cartasBosque.musgo }]}>
                  <Ionicons name="person-outline" size={14} color={cartasBosque.bruma} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.ocupanteNombre}>{h.nombre} {h.apellido}</Text>
                  <Text style={s.ocupanteTipo}>
                    {h.modalidad === 'mensual' ? 'Permanente' : 'Temporal'} · {formatFecha(h.fechaEntrada)}
                  </Text>
                </View>
                <Text style={s.ocupanteCosto}>
                  ${h.montoMensual.toLocaleString('es-MX')}/mes
                </Text>
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

        {/* ── Contactos de emergencia ── */}
        <View style={s.seccionHeaderRow}>
          <Seccion label={`Contactos de emergencia (${expediente?.contactosEmergencia.length ?? 0}/2)`} />
          {(expediente?.contactosEmergencia.length ?? 0) < 2 && (
            <TouchableOpacity onPress={() => setModal('contacto')}>
              <Ionicons name="add-circle-outline" size={20} color={cartasBosque.bosque} />
            </TouchableOpacity>
          )}
        </View>
        {(expediente?.contactosEmergencia ?? []).length === 0 ? (
          <TouchableOpacity style={s.emptyCard} onPress={() => setModal('contacto')}>
            <Text style={s.emptyText}>Agrega hasta 2 contactos de emergencia</Text>
          </TouchableOpacity>
        ) : (
          expediente!.contactosEmergencia.map(c => (
            <View key={c.id} style={s.contactoCard}>
              <View style={s.contactoRow}>
                <View style={s.contactoIcon}>
                  <Ionicons name="people-outline" size={16} color={cartasBosque.bosque} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.contactoNombre}>{c.nombre}</Text>
                  <Text style={s.contactoMeta}>{c.parentesco} · {c.edad} años</Text>
                  {c.telefono && <Text style={s.contactoMeta}>{c.telefono}</Text>}
                  {c.redesSociales && <Text style={s.contactoMeta}>{c.redesSociales}</Text>}
                  {c.direccion && <Text style={s.contactoMeta}>{c.direccion}</Text>}
                </View>
                <TouchableOpacity
                  onPress={() => Alert.alert('Eliminar', `¿Eliminar a ${c.nombre}?`, [
                    { text: 'Cancelar' },
                    { text: 'Eliminar', style: 'destructive', onPress: () => eliminarContactoEmergencia(uid, c.id) },
                  ])}
                >
                  <Ionicons name="trash-outline" size={16} color="#A63228" />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}

        {/* ── Mascotas ── */}
        <View style={s.seccionHeaderRow}>
          <Seccion label={`Mascotas (${expediente?.mascotas.length ?? 0}/6)`} />
          {(expediente?.mascotas.length ?? 0) < 6 && (
            <TouchableOpacity onPress={() => setModal('mascota')}>
              <Ionicons name="add-circle-outline" size={20} color={cartasBosque.bosque} />
            </TouchableOpacity>
          )}
        </View>
        {(expediente?.mascotas ?? []).length === 0 ? (
          <TouchableOpacity style={s.emptyCard} onPress={() => setModal('mascota')}>
            <Text style={s.emptyText}>Registra tus mascotas (máx 6)</Text>
          </TouchableOpacity>
        ) : (
          expediente!.mascotas.map(m => (
            <View key={m.id} style={s.mascotaRow}>
              <Ionicons name="paw-outline" size={14} color={cartasBosque.musgo} />
              <Text style={s.mascotaText}>{m.descripcion}</Text>
              <TouchableOpacity onPress={() => eliminarMascota(uid, m.id)}>
                <Ionicons name="close-circle-outline" size={16} color={cartasBosque.helecho} />
              </TouchableOpacity>
            </View>
          ))
        )}

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
      <Modal
        visible={modal === 'firma'}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModal(null)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: cartasBosque.bruma }}>
          <FirmaPad
            onGuardar={async (json) => {
              try { await guardarFirma(uid, json); setModal(null); }
              catch { Alert.alert('Error', 'No se pudo guardar la firma'); }
            }}
            onCancelar={() => setModal(null)}
          />
        </SafeAreaView>
      </Modal>

      <Modal
        visible={modal === 'contacto'}
        animationType="slide"
        transparent
        onRequestClose={() => setModal(null)}
      >
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

      <Modal
        visible={modal === 'mascota'}
        animationType="slide"
        transparent
        onRequestClose={() => setModal(null)}
      >
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
  headerTitulo: { fontFamily: 'DMSans_600SemiBold', fontSize: 18, color: cartasBosque.tinta },
  scroll: { padding: spacing[4] },

  // Perfil
  perfilCard: {
    backgroundColor: cartasBosque.pergamino,
    borderRadius: borderRadius.lg, padding: spacing[4],
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    marginBottom: spacing[5],
  },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: cartasBosque.bosque,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { fontFamily: 'DMSans_600SemiBold', fontSize: 22, color: cartasBosque.bruma },
  nombre: { fontFamily: 'DMSans_600SemiBold', fontSize: 15, color: cartasBosque.tinta },
  hab:    { fontFamily: 'DMMono_400Regular',  fontSize: 11, color: cartasBosque.musgo,   marginTop: 2 },
  meta:   { fontFamily: 'DMMono_400Regular',  fontSize: 10, color: cartasBosque.helecho, marginTop: 1 },

  // Score ring
  scoreRing: {
    width: 58, height: 58, borderRadius: 29, borderWidth: 4,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: cartasBosque.bruma,
  },
  scoreNum:   { fontFamily: 'DMSans_600SemiBold', fontSize: 16, color: cartasBosque.tinta },
  scoreLabel: { fontFamily: 'DMMono_400Regular',  fontSize: 8,  color: cartasBosque.helecho },

  // Firma
  firmaCard: {
    backgroundColor: cartasBosque.pergamino,
    borderRadius: borderRadius.md, padding: spacing[3],
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    marginBottom: spacing[5],
  },
  firmaCardSigned: { borderColor: '#3A7D44' + '80', backgroundColor: '#D6EDD9' + '44' },
  firmaVacioRow:   { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  firmaVacioText:  { flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 13, color: cartasBosque.bosque },
  firmaHeaderRow:  { flexDirection: 'row', alignItems: 'center', gap: spacing[1], marginBottom: spacing[2] },
  firmaSignedText: { fontFamily: 'DMMono_400Regular', fontSize: 11, color: '#3A7D44' },
  firmaPreviewBox: {
    height: 80, backgroundColor: cartasBosque.bruma,
    borderRadius: borderRadius.sm, overflow: 'hidden',
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
  },

  // Sección
  seccionHeaderRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 0,
  },

  // Empty state
  emptyCard: {
    backgroundColor: cartasBosque.pergamino,
    borderRadius: borderRadius.md, padding: spacing[3],
    alignItems: 'center', marginBottom: spacing[5],
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    borderStyle: 'dashed',
  },
  emptyText: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: cartasBosque.helecho },

  // Ocupantes
  ocupanteCard: {
    backgroundColor: cartasBosque.pergamino,
    borderRadius: borderRadius.md, padding: spacing[3],
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    marginBottom: spacing[5],
  },
  ocupanteRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  ocupanteAvatarSmall: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: cartasBosque.bosque,
    alignItems: 'center', justifyContent: 'center',
  },
  ocupanteNombre: { fontFamily: 'DMSans_600SemiBold', fontSize: 12, color: cartasBosque.tinta },
  ocupanteTipo:   { fontFamily: 'DMMono_400Regular',  fontSize: 10, color: cartasBosque.helecho },
  ocupanteCosto:  { fontFamily: 'DMMono_400Regular',  fontSize: 11, color: cartasBosque.musgo },
  ocupanteDivider:{ height: 1, backgroundColor: cartasBosque.pergaminoOscuro, marginVertical: spacing[2] },
  ocupanteTotalLabel: { flex: 1, fontFamily: 'DMMono_400Regular', fontSize: 10, color: cartasBosque.helecho },
  ocupanteTotal:      { fontFamily: 'DMSans_600SemiBold', fontSize: 12, color: cartasBosque.musgo },

  // Contactos
  contactoCard: {
    backgroundColor: cartasBosque.pergamino,
    borderRadius: borderRadius.md, padding: spacing[3],
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    marginBottom: spacing[2],
  },
  contactoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  contactoIcon: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: cartasBosque.niebla + '44',
    alignItems: 'center', justifyContent: 'center',
  },
  contactoNombre: { fontFamily: 'DMSans_600SemiBold', fontSize: 13, color: cartasBosque.tinta },
  contactoMeta:   { fontFamily: 'DMMono_400Regular',  fontSize: 10, color: cartasBosque.helecho, marginTop: 1 },

  // Mascotas
  mascotaRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: cartasBosque.pergamino,
    borderRadius: borderRadius.md, padding: spacing[3],
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    marginBottom: spacing[2],
  },
  mascotaText: { flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 12, color: cartasBosque.tinta },

  // Accesos rápidos
  accesoCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    backgroundColor: cartasBosque.pergamino,
    borderRadius: borderRadius.md, padding: spacing[3],
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    marginBottom: spacing[2],
  },
  accesoIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: cartasBosque.niebla + '55',
    alignItems: 'center', justifyContent: 'center',
  },
  accesoTitulo: { fontFamily: 'DMSans_600SemiBold', fontSize: 13, color: cartasBosque.tinta },
  accesoSub:    { fontFamily: 'DMSans_400Regular',  fontSize: 11, color: cartasBosque.helecho },

  // Overlay modal
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
});

const secStyles = StyleSheet.create({
  label: {
    fontFamily: 'DMMono_400Regular', fontSize: 10, color: cartasBosque.helecho,
    letterSpacing: 0.8, textTransform: 'uppercase',
    marginBottom: spacing[2], marginTop: spacing[1],
  },
});

const firmaStyles = StyleSheet.create({
  container: { flex: 1, padding: spacing[5] },
  titulo:    { fontFamily: 'DMSans_600SemiBold', fontSize: 20, color: cartasBosque.tinta, marginBottom: spacing[1] },
  sub:       { fontFamily: 'DMSans_400Regular',  fontSize: 13, color: cartasBosque.helecho, marginBottom: spacing[4] },
  canvas: {
    flex: 1, backgroundColor: cartasBosque.bruma,
    borderRadius: borderRadius.lg, borderWidth: 1,
    borderColor: cartasBosque.pergaminoOscuro,
    overflow: 'hidden', marginBottom: spacing[4],
    alignItems: 'center', justifyContent: 'center',
  },
  canvasHint: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: cartasBosque.niebla },
  btnRow:    { flexDirection: 'row', gap: spacing[2] },
  btnLimpiar: {
    paddingHorizontal: spacing[3], paddingVertical: spacing[2] + 2,
    borderRadius: borderRadius.md, borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
  },
  btnLimpiarText:   { fontFamily: 'DMSans_400Regular', fontSize: 13, color: cartasBosque.helecho },
  btnCancelar: {
    paddingHorizontal: spacing[3], paddingVertical: spacing[2] + 2,
    borderRadius: borderRadius.md, borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
  },
  btnCancelarText:  { fontFamily: 'DMSans_400Regular', fontSize: 13, color: cartasBosque.helecho },
  btnGuardar: {
    flex: 1, paddingVertical: spacing[2] + 2,
    borderRadius: borderRadius.md, backgroundColor: cartasBosque.bosque,
    alignItems: 'center',
  },
  btnGuardarText:   { fontFamily: 'DMSans_600SemiBold', fontSize: 13, color: cartasBosque.bruma },
});

const mStyles = StyleSheet.create({
  sheet: {
    backgroundColor: cartasBosque.bruma,
    borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl,
    padding: spacing[5], paddingBottom: spacing[8],
  },
  titulo: { fontFamily: 'DMSans_600SemiBold', fontSize: 17, color: cartasBosque.tinta, marginBottom: spacing[1] },
  sub:    { fontFamily: 'DMSans_400Regular',  fontSize: 12, color: cartasBosque.helecho, marginBottom: spacing[3] },
  input:  {
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    borderRadius: borderRadius.md, padding: spacing[3],
    fontFamily: 'DMSans_400Regular', fontSize: 14, color: cartasBosque.tinta,
    backgroundColor: cartasBosque.pergamino, marginBottom: spacing[2],
  },
  btnRow:       { flexDirection: 'row', gap: spacing[2], marginTop: spacing[2] },
  btnCancel: {
    flex: 1, paddingVertical: spacing[3],
    borderRadius: borderRadius.md, borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    alignItems: 'center',
  },
  btnCancelText: { fontFamily: 'DMSans_400Regular', fontSize: 14, color: cartasBosque.helecho },
  btnOk: {
    flex: 1, paddingVertical: spacing[3],
    borderRadius: borderRadius.md, backgroundColor: cartasBosque.bosque,
    alignItems: 'center',
  },
  btnOkText: { fontFamily: 'DMSans_600SemiBold', fontSize: 14, color: cartasBosque.bruma },
});
