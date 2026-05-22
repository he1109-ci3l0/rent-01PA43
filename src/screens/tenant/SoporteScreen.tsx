import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, TextInput, Image,
  KeyboardAvoidingView, Platform, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { cartasBosque } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/spacing';
import { useAuth } from '@/hooks/useAuth';
import TicketCard from '@/components/common/TicketCard';
import {
  crearTicket, listenMisTickets,
  CATEGORIA_LABELS, CATEGORIA_ICONS, SUBCATEGORIA_LABELS, SUBCATEGORIAS,
  FOTO_OBLIGATORIA,
} from '@/services/firebase/tickets';
import { getDocs, query, where } from 'firebase/firestore';
import { collections } from '@/services/firebase/firestore';
import type { CategoriaTicket, SubcategoriaTicket, Ticket, Inquilino } from '@/types/firestore';

// ─── Config visual ────────────────────────────────────────────

type Paso = 'lista' | 'formulario' | 'confirmacion';

const CATEGORIAS = Object.keys(CATEGORIA_LABELS) as CategoriaTicket[];

const CATEGORIA_EMOJI: Record<CategoriaTicket, string> = {
  internet:          '📶',
  pago:              '💳',
  reporte_limpieza:  '🧹',
  reporte_inquilino: '👤',
  lavadora:          '🫧',
  almacenamiento:    '🔒',
  mantenimiento:     '🔧',
};

const CATEGORIA_SUBTITULO: Record<CategoriaTicket, string> = {
  internet:          'Describe el problema con la conectividad',
  pago:              'Reporta cualquier inconsistencia con tu pago',
  reporte_limpieza:  'Indica el área que necesita atención',
  reporte_inquilino: 'Mantén la convivencia sana en Antioquia 43',
  lavadora:          'Cuéntanos qué pasó con el equipo',
  almacenamiento:    'Reporta incidentes con tu espacio asignado',
  mantenimiento:     'Reporta desperfectos en tu habitación o áreas',
};

const ESTADO_COLORES: Record<string, { bg: string; text: string }> = {
  en_revision: { bg: '#D6E8F5', text: '#2A5EB0' },
  en_proceso:  { bg: '#FFF0E0', text: '#C05A00' },
  resuelto:    { bg: '#D6EDD9', text: '#3A7D44' },
};

const PASOS_CONFIRMACION = [
  { key: 'enviado',     label: 'Ticket enviado' },
  { key: 'en_revision', label: 'En revisión'   },
  { key: 'en_proceso',  label: 'En proceso'    },
  { key: 'resuelto',    label: 'Resuelto'      },
];

// ─── Helpers ──────────────────────────────────────────────────

function esSuciRota15Dias(inquilino: Inquilino | null): boolean {
  if (!inquilino?.fechaIngreso) return false;
  return (Date.now() - inquilino.fechaIngreso.toMillis()) / 86_400_000 <= 15;
}

function necesitaDescripcion(sub: SubcategoriaTicket | null): boolean {
  return sub === 'otro';
}

function fotoEsObligatoria(cat: CategoriaTicket): boolean {
  return FOTO_OBLIGATORIA.includes(cat);
}

const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
function formatFecha(ts: import('firebase/firestore').Timestamp): string {
  const d = ts.toDate();
  return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
}

// ─── Pantalla principal ───────────────────────────────────────

export default function SoporteScreen() {
  const { user } = useAuth();

  const [paso, setPaso]             = useState<Paso>('lista');
  const [tickets, setTickets]       = useState<Ticket[]>([]);
  const [cargando, setCargando]     = useState(true);
  const [inquilino, setInquilino]   = useState<Inquilino | null>(null);

  const [categoriaActiva, setCategoriaActiva]       = useState<CategoriaTicket | null>(null);
  const [subcategoriaActiva, setSubcategoriaActiva] = useState<SubcategoriaTicket | null>(null);
  const [descripcion, setDescripcion]               = useState('');
  const [sacasteRopa, setSacasteRopa]               = useState<boolean | null>(null);
  const [fotoUri, setFotoUri]                       = useState<string | null>(null);
  const [enviando, setEnviando]                     = useState(false);
  const [folioConfirmado, setFolioConfirmado]       = useState('');

  useEffect(() => {
    if (!user?.uid) return;
    getDocs(query(collections.inquilinos, where('uid', '==', user.uid)))
      .then(snap => setInquilino(snap.docs[0]?.data() as Inquilino ?? null))
      .catch(() => {});
    return listenMisTickets(user.uid, data => {
      setTickets(data);
      setCargando(false);
    });
  }, [user?.uid]);

  function resetForm() {
    setCategoriaActiva(null);
    setSubcategoriaActiva(null);
    setDescripcion('');
    setSacasteRopa(null);
    setFotoUri(null);
  }

  function abrirCategoria(cat: CategoriaTicket) {
    resetForm();
    setCategoriaActiva(cat);
    setSubcategoriaActiva(null);
    setPaso('formulario');
  }

  async function pickFoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      const { status: camStatus } = await ImagePicker.requestCameraPermissionsAsync();
      if (camStatus !== 'granted') {
        Alert.alert('Permiso requerido', 'Necesitamos acceso a fotos o cámara.');
        return;
      }
    }
    Alert.alert('Adjuntar foto', '', [
      {
        text: 'Cámara', onPress: async () => {
          const r = await ImagePicker.launchCameraAsync({ quality: 0.75, allowsEditing: false });
          if (!r.canceled) setFotoUri(r.assets[0].uri);
        },
      },
      {
        text: 'Galería', onPress: async () => {
          const r = await ImagePicker.launchImageLibraryAsync({ quality: 0.75, allowsEditing: false });
          if (!r.canceled) setFotoUri(r.assets[0].uri);
        },
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  async function enviar() {
    if (!categoriaActiva || !subcategoriaActiva || !user?.uid) return;
    if (fotoEsObligatoria(categoriaActiva) && !fotoUri) {
      Alert.alert('Foto requerida', 'Este tipo de reporte necesita una foto del problema.');
      return;
    }
    setEnviando(true);
    try {
      const folio = await crearTicket({
        inquilinoId:      user.uid,
        habitacionId:     inquilino?.habitacionId ?? '',
        habitacionNumero: inquilino?.habitacionId ?? '',
        inquilinoNombre:  inquilino ? `${inquilino.nombre} ${inquilino.apellido}`.trim() : user.uid,
        categoria:    categoriaActiva,
        subcategoria: subcategoriaActiva,
        descripcion,
        sacasteRopa: categoriaActiva === 'lavadora' && subcategoriaActiva === 'se_paro' ? sacasteRopa : null,
        fotoUri,
      });
      setFolioConfirmado(folio);
      resetForm();
      setPaso('confirmacion');
    } catch {
      Alert.alert('Error', 'No se pudo enviar el reporte. Intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  // ── Vista: Confirmación ────────────────────────────────────────
  if (paso === 'confirmacion') {
    return (
      <View style={styles.root}>
        <SafeAreaView edges={['top']} style={{ backgroundColor: cartasBosque.bruma }} />
        <ScrollView contentContainerStyle={styles.confirmContainer} showsVerticalScrollIndicator={false}>

          <View style={styles.checkCircle}>
            <Ionicons name="checkmark" size={44} color={cartasBosque.pergamino} />
          </View>

          <Text style={styles.confirmTitulo}>Reporte enviado correctamente</Text>
          <Text style={styles.folioLabel}>Folio</Text>
          <Text style={styles.folioValue}>{folioConfirmado}</Text>

          {/* Tracker 4 pasos */}
          <View style={styles.tracker}>
            {PASOS_CONFIRMACION.map((p, i) => {
              const activo  = i === 1; // "En revisión" es el estado inicial
              const hecho   = i === 0; // "Ticket enviado" ya está hecho
              const color   = hecho ? '#3A7D44' : activo ? '#2A5EB0' : cartasBosque.pergaminoOscuro;
              const bgStep  = hecho ? '#D6EDD9' : activo ? '#D6E8F5' : cartasBosque.pergamino;
              return (
                <React.Fragment key={p.key}>
                  {i > 0 && (
                    <View style={[styles.trackerLine, { backgroundColor: i <= 1 ? '#3A7D44' : cartasBosque.pergaminoOscuro }]} />
                  )}
                  <View style={styles.trackerStep}>
                    <View style={[styles.trackerDot, { backgroundColor: bgStep, borderColor: color }]}>
                      {hecho && <Ionicons name="checkmark" size={10} color="#3A7D44" />}
                      {activo && <View style={[styles.trackerDotInner, { backgroundColor: '#2A5EB0' }]} />}
                    </View>
                    <Text style={[styles.trackerLabel, { color }]}>{p.label}</Text>
                  </View>
                </React.Fragment>
              );
            })}
          </View>

          <TouchableOpacity
            style={styles.btnPrimario}
            onPress={() => { setPaso('lista'); }}
            activeOpacity={0.85}
          >
            <Text style={styles.btnPrimarioText}>Ver todos mis tickets</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.btnSecundario} onPress={() => setPaso('lista')} activeOpacity={0.75}>
            <Text style={styles.btnSecundarioText}>Volver al inicio</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ── Vista: Formulario ─────────────────────────────────────────
  if (paso === 'formulario' && categoriaActiva) {
    const cat        = categoriaActiva;
    const subs       = SUBCATEGORIAS[cat].filter(s => {
      if (s === 'sucia_rota_entrega' && !esSuciRota15Dias(inquilino)) return false;
      return true;
    });
    const fotoOblig  = fotoEsObligatoria(cat);
    const isLavadora = cat === 'lavadora' && subcategoriaActiva === 'se_paro';
    const needsDesc  = necesitaDescripcion(subcategoriaActiva);
    const puedeEnviar = !!subcategoriaActiva && !enviando && !(fotoOblig && !fotoUri);

    return (
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <SafeAreaView edges={['top']} style={styles.formHeader}>
          <TouchableOpacity style={styles.backRow} onPress={() => { resetForm(); setPaso('lista'); }}>
            <Ionicons name="arrow-back" size={20} color={cartasBosque.tinta} />
            <Text style={styles.backLabel}>Soporte</Text>
          </TouchableOpacity>
          <Text style={styles.formTitulo}>{CATEGORIA_LABELS[cat]}</Text>
          <Text style={styles.formSubtitulo}>{CATEGORIA_SUBTITULO[cat]}</Text>
        </SafeAreaView>

        <ScrollView
          contentContainerStyle={styles.formScroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* Sección subcategorías */}
          <Text style={styles.seccionLabel}>¿QUÉ PROBLEMA TIENES?</Text>
          <View style={styles.chipsGrid}>
            {subs.map(sub => {
              const selec = subcategoriaActiva === sub;
              return (
                <TouchableOpacity
                  key={sub}
                  style={[styles.chip, selec && styles.chipSeleccionado]}
                  onPress={() => setSubcategoriaActiva(sub)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.chipText, selec && styles.chipTextSelec]}>
                    {SUBCATEGORIA_LABELS[sub] ?? sub}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Pregunta lavadora */}
          {isLavadora && (
            <View style={styles.fieldBlock}>
              <Text style={styles.seccionLabel}>¿SACASTE TU ROPA?</Text>
              <View style={styles.radioRow}>
                {([true, false] as const).map(v => (
                  <TouchableOpacity
                    key={String(v)}
                    style={[styles.radioBtn, sacasteRopa === v && styles.radioBtnSelec]}
                    onPress={() => setSacasteRopa(v)}
                  >
                    <Text style={[styles.radioText, sacasteRopa === v && styles.radioTextSelec]}>
                      {v ? 'Sí' : 'No'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Campo libre "otro" */}
          {needsDesc && (
            <View style={styles.fieldBlock}>
              <Text style={styles.seccionLabel}>DESCRIBE EL PROBLEMA</Text>
              <TextInput
                style={styles.textArea}
                value={descripcion}
                onChangeText={setDescripcion}
                multiline
                numberOfLines={4}
                placeholder="Escribe los detalles aquí..."
                placeholderTextColor={cartasBosque.niebla}
                textAlignVertical="top"
              />
            </View>
          )}

          {/* Foto */}
          <View style={styles.fieldBlock}>
            <Text style={styles.seccionLabel}>
              FOTO DEL PROBLEMA{fotoOblig ? ' · OBLIGATORIA' : ' · OPCIONAL'}
            </Text>
            {fotoUri ? (
              <View style={styles.fotoWrap}>
                <Image source={{ uri: fotoUri }} style={styles.fotoPreview} resizeMode="cover" />
                <TouchableOpacity style={styles.fotoRemove} onPress={() => setFotoUri(null)}>
                  <View style={styles.fotoRemoveBg}>
                    <Ionicons name="close" size={14} color={cartasBosque.bruma} />
                  </View>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.fotoPicker} onPress={pickFoto} activeOpacity={0.75}>
                <Ionicons name="camera-outline" size={24} color={cartasBosque.bosque} />
                <Text style={styles.fotoPickerText}>
                  {fotoOblig ? 'Adjuntar foto (requerida)' : 'Adjuntar foto (opcional)'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Aviso */}
          <View style={styles.aviso}>
            <Ionicons name="information-circle-outline" size={16} color="#B07D2A" />
            <Text style={styles.avisoText}>
              Importante: Sigue las indicaciones del área y en breve nos comunicaremos contigo.
            </Text>
          </View>

          {/* Botón enviar */}
          <TouchableOpacity
            style={[styles.btnEnviar, !puedeEnviar && styles.btnEnviarDeshabilitado]}
            onPress={enviar}
            disabled={!puedeEnviar}
            activeOpacity={0.85}
          >
            {enviando
              ? <ActivityIndicator color={cartasBosque.bruma} />
              : <Text style={styles.btnEnviarText}>Enviar reporte</Text>
            }
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Vista: Lista ──────────────────────────────────────────────
  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: cartasBosque.bruma }}>
        {/* Header fijo */}
        <View style={styles.listaHeader}>
          <Text style={styles.listaTitulo}>Contactar soporte</Text>
          <Text style={styles.listaSubtitulo}>¿En qué podemos ayudarte?</Text>
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={styles.listaScroll}
        showsVerticalScrollIndicator={false}
      >

        {/* Sección categorías */}
        <Text style={styles.seccionLabel}>SELECCIONA UNA CATEGORÍA</Text>
        {CATEGORIAS.map(cat => (
          <TouchableOpacity
            key={cat}
            style={styles.catCard}
            onPress={() => abrirCategoria(cat)}
            activeOpacity={0.78}
          >
            <View style={styles.catIconWrap}>
              <Text style={styles.catEmoji}>{CATEGORIA_EMOJI[cat]}</Text>
            </View>
            <Text style={styles.catLabel}>{CATEGORIA_LABELS[cat]}</Text>
            <Ionicons name="chevron-forward" size={16} color={cartasBosque.niebla} />
          </TouchableOpacity>
        ))}

        {/* Sección mis tickets */}
        <Text style={[styles.seccionLabel, { marginTop: spacing[6] }]}>MIS TICKETS</Text>

        {cargando ? (
          <ActivityIndicator color={cartasBosque.bosque} style={{ marginVertical: spacing[6] }} />
        ) : tickets.length === 0 ? (
          <View style={styles.vacio}>
            <Ionicons name="headset-outline" size={32} color={cartasBosque.niebla} />
            <Text style={styles.vacioText}>No tienes tickets abiertos</Text>
          </View>
        ) : (
          tickets.map(t => (
            <TicketCard key={t.id} ticket={t} esAdmin={false} />
          ))
        )}
      </ScrollView>
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: cartasBosque.bruma },

  // ── Lista ──
  listaHeader: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    paddingBottom: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: cartasBosque.pergaminoOscuro,
  },
  listaTitulo: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 22,
    color: cartasBosque.tinta,
    letterSpacing: -0.3,
  },
  listaSubtitulo: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: cartasBosque.musgo,
    marginTop: spacing[0.5],
  },
  listaScroll: {
    padding: spacing[5],
    paddingBottom: spacing[12],
  },

  seccionLabel: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 10,
    color: cartasBosque.helecho,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: spacing[3],
  },

  catCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: cartasBosque.pergamino,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: cartasBosque.pergaminoOscuro,
    padding: spacing[4],
    marginBottom: spacing[2],
  },
  catIconWrap: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.sm,
    backgroundColor: cartasBosque.bruma,
    borderWidth: 1,
    borderColor: cartasBosque.pergaminoOscuro,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catEmoji: { fontSize: 20 },
  catLabel: {
    flex: 1,
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    color: cartasBosque.tinta,
  },

  vacio: {
    alignItems: 'center',
    paddingVertical: spacing[8],
    gap: spacing[2],
  },
  vacioText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: cartasBosque.helecho,
  },

  // ── Formulario ──
  formHeader: {
    backgroundColor: cartasBosque.bruma,
    borderBottomWidth: 1,
    borderBottomColor: cartasBosque.pergaminoOscuro,
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[4],
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
    marginBottom: spacing[3],
    marginTop: spacing[1],
  },
  backLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: cartasBosque.tinta,
  },
  formTitulo: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 20,
    color: cartasBosque.tinta,
    letterSpacing: -0.2,
  },
  formSubtitulo: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: cartasBosque.musgo,
    marginTop: spacing[1],
  },
  formScroll: {
    padding: spacing[5],
    paddingBottom: spacing[14],
  },

  chipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    marginBottom: spacing[5],
  },
  chip: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: cartasBosque.pergaminoOscuro,
    backgroundColor: cartasBosque.pergamino,
  },
  chipSeleccionado: {
    backgroundColor: cartasBosque.tinta,
    borderColor: cartasBosque.tinta,
  },
  chipText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: cartasBosque.musgo,
  },
  chipTextSelec: {
    fontFamily: 'DMSans_600SemiBold',
    color: cartasBosque.bruma,
  },

  fieldBlock: { marginBottom: spacing[5] },

  radioRow: { flexDirection: 'row', gap: spacing[3] },
  radioBtn: {
    flex: 1,
    paddingVertical: spacing[3],
    alignItems: 'center',
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: cartasBosque.pergaminoOscuro,
    backgroundColor: cartasBosque.pergamino,
  },
  radioBtnSelec: {
    backgroundColor: cartasBosque.tinta,
    borderColor: cartasBosque.tinta,
  },
  radioText:      { fontFamily: 'DMSans_600SemiBold', fontSize: 14, color: cartasBosque.musgo },
  radioTextSelec: { color: cartasBosque.bruma },

  textArea: {
    backgroundColor: cartasBosque.pergamino,
    borderWidth: 1.5,
    borderColor: cartasBosque.pergaminoOscuro,
    borderRadius: borderRadius.md,
    padding: spacing[4],
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    color: cartasBosque.tinta,
    minHeight: 100,
  },

  fotoWrap: { position: 'relative' },
  fotoPreview: {
    width: '100%',
    height: 180,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: cartasBosque.pergaminoOscuro,
  },
  fotoRemove: { position: 'absolute', top: spacing[2], right: spacing[2] },
  fotoRemoveBg: {
    width: 24, height: 24,
    borderRadius: 12,
    backgroundColor: cartasBosque.tinta,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fotoPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingVertical: spacing[5],
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: cartasBosque.bosque,
    borderStyle: 'dashed',
    backgroundColor: cartasBosque.pergamino,
  },
  fotoPickerText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    color: cartasBosque.bosque,
  },

  aviso: {
    flexDirection: 'row',
    gap: spacing[2],
    alignItems: 'flex-start',
    backgroundColor: '#FDF4E3',
    borderRadius: borderRadius.md,
    padding: spacing[4],
    marginBottom: spacing[5],
    borderWidth: 1,
    borderColor: '#F0D78C',
  },
  avisoText: {
    flex: 1,
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: '#8A5A00',
    lineHeight: 18,
  },

  btnEnviar: {
    backgroundColor: cartasBosque.tinta,
    borderRadius: borderRadius.md,
    paddingVertical: spacing[4],
    alignItems: 'center',
    shadowColor: cartasBosque.tinta,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  btnEnviarDeshabilitado: { opacity: 0.35 },
  btnEnviarText: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 16,
    color: cartasBosque.bruma,
    letterSpacing: 0.2,
  },

  // ── Confirmación ──
  confirmContainer: {
    flexGrow: 1,
    paddingHorizontal: spacing[6],
    paddingTop: spacing[12],
    paddingBottom: spacing[12],
    alignItems: 'center',
    gap: spacing[4],
  },
  checkCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#3A7D44',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[2],
    shadowColor: '#3A7D44',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  confirmTitulo: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 20,
    color: cartasBosque.tinta,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  folioLabel: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 10,
    color: cartasBosque.helecho,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: spacing[1],
  },
  folioValue: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 14,
    color: cartasBosque.bosque,
    letterSpacing: 1,
  },

  // Tracker 4 pasos
  tracker: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginTop: spacing[2],
    marginBottom: spacing[4],
    width: '100%',
  },
  trackerStep: { alignItems: 'center', width: (width - spacing[6] * 2) / 4 - 4 },
  trackerDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[1.5],
  },
  trackerDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  trackerLine: {
    flex: 1,
    height: 2,
    marginTop: 11,
    borderRadius: 1,
  },
  trackerLabel: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 8,
    textAlign: 'center',
    letterSpacing: 0.3,
  },

  btnPrimario: {
    width: '100%',
    backgroundColor: cartasBosque.tinta,
    borderRadius: borderRadius.md,
    paddingVertical: spacing[4],
    alignItems: 'center',
    marginTop: spacing[2],
  },
  btnPrimarioText: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 15,
    color: cartasBosque.bruma,
  },
  btnSecundario: {
    width: '100%',
    paddingVertical: spacing[3],
    alignItems: 'center',
  },
  btnSecundarioText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    color: cartasBosque.musgo,
    textDecorationLine: 'underline',
  },
});
