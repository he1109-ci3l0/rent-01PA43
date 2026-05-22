import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Alert, Modal, Pressable, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { onSnapshot, collection, query, where, doc as fsDoc } from 'firebase/firestore';
import { db } from '@/services/firebase/firestore';
import { cartasBosque } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/spacing';
import { useAuth } from '@/hooks/useAuth';
import DocumentoCard from '@/components/common/DocumentoCard';
import {
  listenExpediente, listenDocumentos,
  actualizarNotasAdmin, congelarCuenta, cambiarHabitacion,
  resetearContador, subirDocumento,
} from '@/services/firebase/expedientes';
import type {
  Inquilino, Expediente, DocumentoExpediente,
  HuespedExtra, ScoreReputacion, SolicitudFactura,
} from '@/types/firestore';

// ─── Helpers ──────────────────────────────────────────────────

function formatFecha(ts: any): string {
  try { return ts.toDate().toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return '—'; }
}

const NIVEL_COLOR: Record<string, string> = {
  pesimo: '#A63228', moroso: '#B07D2A', regular: '#7A9E7E',
  bueno: cartasBosque.musgo,  excelente: cartasBosque.bosque,
};
const NIVEL_LABEL: Record<string, string> = {
  pesimo: 'Pésimo', moroso: 'Moroso', regular: 'Regular',
  bueno: 'Bueno',   excelente: 'Excelente',
};

function Seccion({ label }: { label: string }) {
  return <Text style={secStyles.label}>{label}</Text>;
}

// ─── SubirUrlModal ─────────────────────────────────────────────

function SubirUrlModal({ docNombre, onGuardar, onCancelar }: {
  docNombre: string;
  onGuardar: (url: string) => void;
  onCancelar: () => void;
}) {
  const [url, setUrl] = useState('');
  return (
    <View style={urlStyles.sheet}>
      <Text style={urlStyles.titulo}>Subir documento</Text>
      <Text style={urlStyles.sub}>{docNombre}</Text>
      <TextInput
        style={urlStyles.input}
        placeholder="URL del archivo en Storage"
        placeholderTextColor={cartasBosque.helecho}
        value={url}
        onChangeText={setUrl}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <View style={urlStyles.btnRow}>
        <TouchableOpacity style={urlStyles.btnCancel} onPress={onCancelar}>
          <Text style={urlStyles.btnCancelText}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[urlStyles.btnOk, !url.trim() && { opacity: 0.4 }]}
          disabled={!url.trim()}
          onPress={() => onGuardar(url.trim())}
        >
          <Text style={urlStyles.btnOkText}>Guardar URL</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── DetalleExpediente ─────────────────────────────────────────

function DetalleExpediente({
  inquilino, onBack,
}: {
  inquilino: Inquilino;
  onBack: () => void;
}) {
  const { user } = useAuth();
  const uid = inquilino.uid;

  const [expediente, setExpediente]   = useState<Expediente | null>(null);
  const [documentos, setDocumentos]   = useState<DocumentoExpediente[]>([]);
  const [huespedes, setHuespedes]     = useState<HuespedExtra[]>([]);
  const [score, setScore]             = useState<ScoreReputacion | null>(null);
  const [solicitudes, setSolicitudes] = useState<SolicitudFactura[]>([]);
  const [notas, setNotas]             = useState('');
  const [notasDirty, setNotasDirty]   = useState(false);
  const [subirModal, setSubirModal]   = useState<DocumentoExpediente | null>(null);

  useEffect(() => {
    const unsubExp  = listenExpediente(uid, e => {
      setExpediente(e);
      if (e && !notasDirty) setNotas(e.notasAdmin ?? '');
    });
    const unsubDocs = listenDocumentos(uid, setDocumentos);

    const unsubScore = onSnapshot(
      fsDoc(db, 'scores', uid),
      (snap) => { if (snap.exists()) setScore({ ...snap.data(), id: snap.id } as ScoreReputacion); },
    );
    const qH = query(collection(db, 'huespedes_extra'), where('inquilinoId', '==', uid), where('activo', '==', true));
    const unsubH = onSnapshot(qH, snap => {
      setHuespedes(snap.docs.map(d => ({ ...d.data(), id: d.id } as HuespedExtra)));
    }, () => {});

    const qS = query(collection(db, 'solicitudes_factura'), where('inquilinoId', '==', uid), where('estado', '==', 'pendiente'));
    const unsubS = onSnapshot(qS, snap => {
      setSolicitudes(snap.docs.map(d => ({ ...d.data(), id: d.id } as SolicitudFactura)));
    }, () => {});

    return () => { unsubExp(); unsubDocs(); unsubScore(); unsubH(); unsubS(); };
  }, [uid]);

  const nombreCompleto = `${inquilino.nombre} ${inquilino.apellido}`;
  const scoreColor = score ? (NIVEL_COLOR[score.nivel] ?? cartasBosque.helecho) : cartasBosque.helecho;
  const scoreLabel = score ? (NIVEL_LABEL[score.nivel] ?? '') : '—';

  async function guardarNotas() {
    try {
      await actualizarNotasAdmin(uid, notas);
      setNotasDirty(false);
    } catch { Alert.alert('Error', 'No se pudieron guardar las notas'); }
  }

  async function toggleCongelar() {
    if (!expediente) return;
    const nuevo = !expediente.congelado;
    Alert.alert(
      nuevo ? 'Congelar cuenta' : 'Descongelar cuenta',
      `¿${nuevo ? 'Congelar' : 'Descongelar'} la cuenta de ${nombreCompleto}?`,
      [
        { text: 'Cancelar' },
        { text: nuevo ? 'Congelar' : 'Activar', onPress: () => congelarCuenta(uid, nuevo) },
      ],
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Header detalle */}
      <View style={d.header}>
        <TouchableOpacity onPress={onBack} style={d.backBtn}>
          <Ionicons name="arrow-back" size={22} color={cartasBosque.tinta} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={d.headerNombre}>{nombreCompleto}</Text>
          <Text style={d.headerHab}>Hab {inquilino.habitacionId ?? '—'}</Text>
        </View>
        <TouchableOpacity
          style={[d.congelarBtn, expediente?.congelado && d.congelarBtnActivo]}
          onPress={toggleCongelar}
        >
          <Ionicons
            name={expediente?.congelado ? 'lock-closed' : 'lock-open-outline'}
            size={16}
            color={expediente?.congelado ? '#A63228' : cartasBosque.helecho}
          />
          <Text style={[d.congelarText, expediente?.congelado && { color: '#A63228' }]}>
            {expediente?.congelado ? 'Congelada' : 'Congelar'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={d.scroll}>

        {/* Score */}
        <Seccion label="Score de reputación" />
        <View style={d.scoreCard}>
          <View style={[d.scoreRing, { borderColor: scoreColor }]}>
            <Text style={[d.scoreNum, { color: scoreColor }]}>{score?.puntos ?? '—'}</Text>
          </View>
          <View>
            <Text style={d.scoreLabel}>{scoreLabel}</Text>
            {score?.ajusteManual && (
              <Text style={d.scoreMeta}>Ajuste manual · {formatFecha(score.ajustadoEn)}</Text>
            )}
          </View>
        </View>

        {/* Notas internas */}
        <Seccion label="Notas internas (invisible al inquilino)" />
        <View style={d.notasCard}>
          <TextInput
            style={d.notasInput}
            multiline
            value={notas}
            onChangeText={t => { setNotas(t); setNotasDirty(true); }}
            placeholder="Agrega notas privadas sobre este inquilino…"
            placeholderTextColor={cartasBosque.helecho}
          />
          {notasDirty && (
            <TouchableOpacity style={d.notasGuardarBtn} onPress={guardarNotas}>
              <Text style={d.notasGuardarText}>Guardar notas</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Solicitudes CFDI pendientes */}
        {solicitudes.length > 0 && (
          <>
            <Seccion label={`CFDI pendientes (${solicitudes.length})`} />
            {solicitudes.map(sf => (
              <View key={sf.id} style={d.cfdiCard}>
                <View style={{ flex: 1 }}>
                  <Text style={d.cfdiTitulo}>
                    {sf.concepto} · {sf.mes}/{sf.anio}
                  </Text>
                  <Text style={d.cfdiMeta}>
                    {sf.emisor === 'fisica' ? 'Persona física' : 'Empresa'} · {sf.datosFiscales?.rfc}
                  </Text>
                </View>
                <TouchableOpacity
                  style={d.cfdiBtn}
                  onPress={() => Alert.alert(
                    'Subir CFDI',
                    'Usa el panel web de administración para subir el PDF y actualizar el estado de la solicitud.',
                    [{ text: 'Entendido' }],
                  )}
                >
                  <Ionicons name="cloud-upload-outline" size={14} color={cartasBosque.bruma} />
                  <Text style={d.cfdiBtnText}>Subir CFDI</Text>
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}

        {/* Documentos */}
        <Seccion label={`Documentos (${documentos.filter(d2 => d2.estado === 'subido').length}/${documentos.length})`} />
        {documentos.map(dc => (
          <DocumentoCard
            key={dc.id}
            doc={dc}
            esAdmin
            onDescargar={() => {}}
            onSubir={() => setSubirModal(dc)}
            onResetContador={() => resetearContador(uid, dc.id).catch(() => {})}
          />
        ))}

        {/* Ocupantes */}
        <Seccion label="Ocupantes activos" />
        <View style={d.ocupantesCard}>
          <View style={d.ocupanteRow}>
            <Ionicons name="star" size={12} color={cartasBosque.bosque} />
            <Text style={d.ocupanteNombre}>{nombreCompleto}</Text>
            <Text style={d.ocupanteTipo}>Titular</Text>
          </View>
          {huespedes.map(h => (
            <View key={h.id}>
              <View style={d.divider} />
              <View style={d.ocupanteRow}>
                <Ionicons name="person-outline" size={12} color={cartasBosque.musgo} />
                <Text style={d.ocupanteNombre}>{h.nombre} {h.apellido}</Text>
                <Text style={d.ocupanteTipo}>
                  {h.modalidad === 'mensual' ? 'Permanente' : 'Temporal'} · ${h.montoMensual.toLocaleString('es-MX')}/mes
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Contactos de emergencia */}
        {(expediente?.contactosEmergencia ?? []).length > 0 && (
          <>
            <Seccion label="Contactos de emergencia" />
            {expediente!.contactosEmergencia.map(c => (
              <View key={c.id} style={d.contactoCard}>
                <Text style={d.contactoNombre}>{c.nombre} · {c.parentesco} · {c.edad} años</Text>
                {c.telefono && <Text style={d.contactoMeta}>{c.telefono}</Text>}
                {c.redesSociales && <Text style={d.contactoMeta}>{c.redesSociales}</Text>}
                {c.direccion && <Text style={d.contactoMeta}>{c.direccion}</Text>}
              </View>
            ))}
          </>
        )}

        {/* Mascotas */}
        {(expediente?.mascotas ?? []).length > 0 && (
          <>
            <Seccion label="Mascotas" />
            {expediente!.mascotas.map(m => (
              <View key={m.id} style={d.mascotaRow}>
                <Ionicons name="paw-outline" size={13} color={cartasBosque.musgo} />
                <Text style={d.mascotaText}>{m.descripcion}</Text>
              </View>
            ))}
          </>
        )}

        {/* Firma */}
        <Seccion label="Firma digital" />
        <View style={d.firmaCard}>
          {expediente?.firmaDigital ? (
            <View style={d.firmaSignedRow}>
              <Ionicons name="checkmark-circle" size={16} color="#3A7D44" />
              <Text style={d.firmaSignedText}>Firmado el {formatFecha(expediente.firmadoEn)}</Text>
            </View>
          ) : (
            <Text style={d.firmaPendiente}>Sin firma digital</Text>
          )}
        </View>

        <View style={{ height: spacing[8] }} />
      </ScrollView>

      {/* Modal subir URL */}
      <Modal
        visible={!!subirModal}
        animationType="slide"
        transparent
        onRequestClose={() => setSubirModal(null)}
      >
        <Pressable style={d.overlay} onPress={() => setSubirModal(null)}>
          <Pressable onPress={e => e.stopPropagation()}>
            {subirModal && (
              <SubirUrlModal
                docNombre={subirModal.nombre}
                onGuardar={async (url) => {
                  try {
                    await subirDocumento(uid, subirModal.id, url, user?.uid ?? '');
                    setSubirModal(null);
                  } catch { Alert.alert('Error', 'No se pudo guardar'); }
                }}
                onCancelar={() => setSubirModal(null)}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ─── Lista de inquilinos ───────────────────────────────────────

export default function ExpedienteAdminScreen() {
  const [inquilinos, setInquilinos]         = useState<Inquilino[]>([]);
  const [seleccionado, setSeleccionado]     = useState<Inquilino | null>(null);
  const [cargando, setCargando]             = useState(true);
  const [busqueda, setBusqueda]             = useState('');

  useEffect(() => {
    const q = query(collection(db, 'inquilinos'), where('estado', '!=', 'inactivo'));
    const unsub = onSnapshot(q, snap => {
      const lista = snap.docs.map(d => ({ ...d.data(), id: d.id } as Inquilino));
      lista.sort((a, b) => (a.habitacionId ?? '').localeCompare(b.habitacionId ?? ''));
      setInquilinos(lista);
      setCargando(false);
    }, () => setCargando(false));
    return unsub;
  }, []);

  if (seleccionado) {
    return (
      <DetalleExpediente
        inquilino={seleccionado}
        onBack={() => setSeleccionado(null)}
      />
    );
  }

  const filtrados = inquilinos.filter(i => {
    const q = busqueda.toLowerCase();
    return !q
      || `${i.nombre} ${i.apellido}`.toLowerCase().includes(q)
      || (i.habitacionId ?? '').includes(q);
  });

  return (
    <View style={{ flex: 1, backgroundColor: cartasBosque.bruma }}>
      {/* Buscador */}
      <View style={l.searchWrap}>
        <Ionicons name="search-outline" size={16} color={cartasBosque.helecho} />
        <TextInput
          style={l.searchInput}
          placeholder="Buscar inquilino o habitación…"
          placeholderTextColor={cartasBosque.helecho}
          value={busqueda}
          onChangeText={setBusqueda}
        />
      </View>

      {cargando ? (
        <ActivityIndicator color={cartasBosque.bosque} style={{ marginTop: spacing[8] }} />
      ) : filtrados.length === 0 ? (
        <View style={l.empty}>
          <Text style={l.emptyText}>Sin resultados</Text>
        </View>
      ) : (
        <ScrollView>
          {filtrados.map(inq => (
            <TouchableOpacity
              key={inq.id}
              style={l.card}
              onPress={() => setSeleccionado(inq)}
            >
              <View style={l.avatar}>
                <Text style={l.avatarInitial}>
                  {(inq.nombre?.[0] ?? '?').toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={l.nombre}>{inq.nombre} {inq.apellido}</Text>
                <Text style={l.meta}>
                  Hab {inq.habitacionId ?? '—'} · {inq.email}
                </Text>
              </View>
              <View style={[l.estadoChip,
                inq.estado === 'moroso' && { backgroundColor: '#F5E8C8' }]}>
                <Text style={[l.estadoText,
                  inq.estado === 'moroso' && { color: '#B07D2A' }]}>
                  {inq.estado}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={cartasBosque.niebla} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const secStyles = StyleSheet.create({
  label: {
    fontFamily: 'DMMono_400Regular', fontSize: 10, color: cartasBosque.helecho,
    letterSpacing: 0.8, textTransform: 'uppercase',
    marginBottom: spacing[2], marginTop: spacing[1],
  },
});

const d = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro,
    backgroundColor: cartasBosque.bruma,
  },
  backBtn: { padding: spacing[1] },
  headerNombre: { fontFamily: 'DMSans_600SemiBold', fontSize: 15, color: cartasBosque.tinta },
  headerHab:    { fontFamily: 'DMMono_400Regular',  fontSize: 11, color: cartasBosque.helecho },
  congelarBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing[2] + 2, paddingVertical: spacing[1] + 2,
    borderRadius: borderRadius.full, borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
  },
  congelarBtnActivo: { borderColor: '#A63228', backgroundColor: '#F5DAD8' },
  congelarText: { fontFamily: 'DMMono_400Regular', fontSize: 10, color: cartasBosque.helecho },
  scroll: { padding: spacing[4] },

  scoreCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    backgroundColor: cartasBosque.pergamino, borderRadius: borderRadius.md,
    padding: spacing[3], borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    marginBottom: spacing[5],
  },
  scoreRing: {
    width: 52, height: 52, borderRadius: 26, borderWidth: 4,
    alignItems: 'center', justifyContent: 'center',
  },
  scoreNum:   { fontFamily: 'DMSans_600SemiBold', fontSize: 16, color: cartasBosque.tinta },
  scoreLabel: { fontFamily: 'DMSans_600SemiBold', fontSize: 13, color: cartasBosque.tinta },
  scoreMeta:  { fontFamily: 'DMMono_400Regular',  fontSize: 10, color: cartasBosque.helecho },

  notasCard: {
    backgroundColor: cartasBosque.pergamino, borderRadius: borderRadius.md,
    padding: spacing[3], borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    marginBottom: spacing[5],
  },
  notasInput: {
    fontFamily: 'DMSans_400Regular', fontSize: 13, color: cartasBosque.tinta,
    minHeight: 72, textAlignVertical: 'top',
  },
  notasGuardarBtn: {
    alignSelf: 'flex-end', marginTop: spacing[2],
    paddingHorizontal: spacing[3], paddingVertical: spacing[1] + 2,
    backgroundColor: cartasBosque.bosque, borderRadius: borderRadius.full,
  },
  notasGuardarText: { fontFamily: 'DMSans_600SemiBold', fontSize: 11, color: cartasBosque.bruma },

  cfdiCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    backgroundColor: '#F5E8C8', borderRadius: borderRadius.md,
    padding: spacing[3], marginBottom: spacing[2],
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
  },
  cfdiTitulo: { fontFamily: 'DMSans_600SemiBold', fontSize: 12, color: cartasBosque.tinta },
  cfdiMeta:   { fontFamily: 'DMMono_400Regular',  fontSize: 10, color: '#B07D2A' },
  cfdiBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: cartasBosque.bosque, borderRadius: borderRadius.md,
    paddingHorizontal: spacing[2] + 2, paddingVertical: spacing[1] + 2,
  },
  cfdiBtnText: { fontFamily: 'DMSans_600SemiBold', fontSize: 11, color: cartasBosque.bruma },

  ocupantesCard: {
    backgroundColor: cartasBosque.pergamino, borderRadius: borderRadius.md,
    padding: spacing[3], borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    marginBottom: spacing[5],
  },
  ocupanteRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  ocupanteNombre: { flex: 1, fontFamily: 'DMSans_600SemiBold', fontSize: 12, color: cartasBosque.tinta },
  ocupanteTipo:   { fontFamily: 'DMMono_400Regular', fontSize: 10, color: cartasBosque.helecho },
  divider: { height: 1, backgroundColor: cartasBosque.pergaminoOscuro, marginVertical: spacing[2] },

  contactoCard: {
    backgroundColor: cartasBosque.pergamino, borderRadius: borderRadius.md,
    padding: spacing[3], marginBottom: spacing[2],
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
  },
  contactoNombre: { fontFamily: 'DMSans_600SemiBold', fontSize: 12, color: cartasBosque.tinta },
  contactoMeta:   { fontFamily: 'DMMono_400Regular',  fontSize: 10, color: cartasBosque.helecho, marginTop: 2 },

  mascotaRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingVertical: spacing[2],
  },
  mascotaText: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: cartasBosque.tinta },

  firmaCard: {
    backgroundColor: cartasBosque.pergamino, borderRadius: borderRadius.md,
    padding: spacing[3], borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    marginBottom: spacing[5],
  },
  firmaSignedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  firmaSignedText:{ fontFamily: 'DMMono_400Regular', fontSize: 11, color: '#3A7D44' },
  firmaPendiente: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: cartasBosque.helecho, fontStyle: 'italic' },

  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end',
  },
});

const l = StyleSheet.create({
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    margin: spacing[4], paddingHorizontal: spacing[3], paddingVertical: spacing[2] + 2,
    backgroundColor: cartasBosque.pergamino, borderRadius: borderRadius.full,
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
  },
  searchInput: {
    flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 13, color: cartasBosque.tinta,
  },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro,
    backgroundColor: cartasBosque.bruma,
  },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: cartasBosque.bosque,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { fontFamily: 'DMSans_600SemiBold', fontSize: 16, color: cartasBosque.bruma },
  nombre: { fontFamily: 'DMSans_600SemiBold', fontSize: 13, color: cartasBosque.tinta },
  meta:   { fontFamily: 'DMMono_400Regular',  fontSize: 10, color: cartasBosque.helecho },
  estadoChip: {
    paddingHorizontal: spacing[2], paddingVertical: 2,
    borderRadius: borderRadius.full,
    backgroundColor: '#D6EDD9',
  },
  estadoText: { fontFamily: 'DMMono_400Regular', fontSize: 9, color: '#3A7D44' },
  empty:     { alignItems: 'center', marginTop: spacing[12] },
  emptyText: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: cartasBosque.helecho },
});

const urlStyles = StyleSheet.create({
  sheet: {
    backgroundColor: cartasBosque.bruma,
    borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl,
    padding: spacing[5], paddingBottom: spacing[8],
  },
  titulo:      { fontFamily: 'DMSans_600SemiBold', fontSize: 17, color: cartasBosque.tinta, marginBottom: spacing[1] },
  sub:         { fontFamily: 'DMSans_400Regular',  fontSize: 12, color: cartasBosque.helecho, marginBottom: spacing[3] },
  input: {
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    borderRadius: borderRadius.md, padding: spacing[3],
    fontFamily: 'DMSans_400Regular', fontSize: 14, color: cartasBosque.tinta,
    backgroundColor: cartasBosque.pergamino, marginBottom: spacing[2],
  },
  btnRow:       { flexDirection: 'row', gap: spacing[2], marginTop: spacing[2] },
  btnCancel: {
    flex: 1, paddingVertical: spacing[3], borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro, alignItems: 'center',
  },
  btnCancelText:{ fontFamily: 'DMSans_400Regular',  fontSize: 14, color: cartasBosque.helecho },
  btnOk: {
    flex: 1, paddingVertical: spacing[3],
    borderRadius: borderRadius.md, backgroundColor: cartasBosque.bosque, alignItems: 'center',
  },
  btnOkText:    { fontFamily: 'DMSans_600SemiBold', fontSize: 14, color: cartasBosque.bruma },
});
