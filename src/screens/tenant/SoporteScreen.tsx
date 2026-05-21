import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator, Alert, TextInput,
  FlatList, Image,
} from 'react-native';
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

type Paso = 'lista' | 'categoria' | 'subcategoria' | 'detalle' | 'enviando';

const CATEGORIAS = Object.keys(CATEGORIA_LABELS) as CategoriaTicket[];

function necesitaDescripcion(cat: CategoriaTicket, sub: SubcategoriaTicket): boolean {
  if (cat === 'pago' && sub === 'otro') return true;
  if (cat === 'mantenimiento') return true;
  if (cat === 'reporte_inquilino') return true;
  return false;
}

export default function SoporteScreen() {
  const { user } = useAuth();

  const [paso, setPaso]           = useState<Paso>('lista');
  const [tickets, setTickets]     = useState<Ticket[]>([]);
  const [cargando, setCargando]   = useState(true);
  const [inquilino, setInquilino] = useState<Inquilino | null>(null);

  const [categoria, setCategoria]       = useState<CategoriaTicket | null>(null);
  const [subcategoria, setSubcategoria] = useState<SubcategoriaTicket | null>(null);
  const [descripcion, setDescripcion]   = useState('');
  const [sacasteRopa, setSacasteRopa]   = useState<boolean | null>(null);
  const [fotoUri, setFotoUri]           = useState<string | null>(null);
  const [enviando, setEnviando]         = useState(false);

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
    setCategoria(null); setSubcategoria(null);
    setDescripcion(''); setSacasteRopa(null); setFotoUri(null);
  }

  const handleNuevo = useCallback(() => { resetForm(); setPaso('categoria'); }, []);

  // ── Paso: Categoría ───────────────────────────────────────────
  if (paso === 'categoria') {
    return (
      <View style={{ flex: 1, backgroundColor: cartasBosque.bruma }}>
        <SafeAreaView style={styles.subHeader}>
          <TouchableOpacity onPress={() => setPaso('lista')} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={18} color={cartasBosque.tinta} />
            <Text style={styles.backLabel}>Soporte</Text>
          </TouchableOpacity>
          <Text style={styles.subTitulo}>¿Qué tipo de problema es?</Text>
        </SafeAreaView>
        <ScrollView contentContainerStyle={{ padding: spacing[4], gap: spacing[2] }}>
          {CATEGORIAS.map(cat => (
            <TouchableOpacity
              key={cat}
              style={styles.opcionCard}
              onPress={() => { setCategoria(cat); setPaso('subcategoria'); }}
            >
              <View style={styles.opcionIcon}>
                <Ionicons
                  name={CATEGORIA_ICONS[cat] as any}
                  size={20} color={cartasBosque.bosque}
                />
              </View>
              <Text style={styles.opcionLabel}>{CATEGORIA_LABELS[cat]}</Text>
              <Ionicons name="chevron-forward" size={15} color={cartasBosque.niebla} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  }

  // ── Paso: Subcategoría ────────────────────────────────────────
  if (paso === 'subcategoria' && categoria) {
    const subs = SUBCATEGORIAS[categoria];
    return (
      <View style={{ flex: 1, backgroundColor: cartasBosque.bruma }}>
        <SafeAreaView style={styles.subHeader}>
          <TouchableOpacity onPress={() => setPaso('categoria')} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={18} color={cartasBosque.tinta} />
            <Text style={styles.backLabel}>{CATEGORIA_LABELS[categoria]}</Text>
          </TouchableOpacity>
          <Text style={styles.subTitulo}>¿Cuál es el problema específico?</Text>
        </SafeAreaView>
        <ScrollView contentContainerStyle={{ padding: spacing[4], gap: spacing[2] }}>
          {subs.map(sub => (
            <TouchableOpacity
              key={sub}
              style={styles.opcionCard}
              onPress={() => { setSubcategoria(sub); setPaso('detalle'); }}
            >
              <Text style={styles.opcionLabelFull}>{SUBCATEGORIA_LABELS[sub] ?? sub}</Text>
              <Ionicons name="chevron-forward" size={15} color={cartasBosque.niebla} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  }

  // ── Paso: Detalle ─────────────────────────────────────────────
  if (paso === 'detalle' && categoria && subcategoria) {
    const cat: CategoriaTicket    = categoria;
    const sub: SubcategoriaTicket = subcategoria;
    const fotoOblig  = FOTO_OBLIGATORIA.includes(cat);
    const needsDesc  = necesitaDescripcion(cat, sub);
    const isSuciRota = cat === 'mantenimiento' && sub === 'sucia_rota_entrega';
    const isLavadora = cat === 'lavadora' && sub === 'se_paro';

    async function pickFoto() {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso requerido', 'Necesitamos acceso a la cámara.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        allowsEditing: false,
      });
      if (!result.canceled) setFotoUri(result.assets[0].uri);
    }

    async function enviar() {
      if (fotoOblig && !fotoUri) {
        Alert.alert('Foto requerida', 'Este tipo de reporte requiere una foto.');
        return;
      }
      if (!user?.uid || !inquilino) return;
      setEnviando(true);
      setPaso('enviando');
      try {
        await crearTicket({
          inquilinoId:      user.uid,
          habitacionId:     inquilino.habitacionId ?? '',
          habitacionNumero: inquilino.habitacionId ?? '',
          inquilinoNombre:  `${inquilino.nombre} ${inquilino.apellido}`.trim(),
          categoria: cat,
          subcategoria: sub,
          descripcion,
          sacasteRopa: isLavadora ? sacasteRopa : null,
          fotoUri,
        });
        Alert.alert('Ticket enviado', 'Te notificaremos cuando haya una actualización.');
        resetForm();
        setPaso('lista');
      } catch {
        Alert.alert('Error', 'No se pudo enviar el ticket. Intenta de nuevo.');
        setPaso('detalle');
      } finally {
        setEnviando(false);
      }
    }

    return (
      <View style={{ flex: 1, backgroundColor: cartasBosque.bruma }}>
        <SafeAreaView style={styles.subHeader}>
          <TouchableOpacity onPress={() => setPaso('subcategoria')} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={18} color={cartasBosque.tinta} />
            <Text style={styles.backLabel}>{SUBCATEGORIA_LABELS[subcategoria]}</Text>
          </TouchableOpacity>
          <Text style={styles.subTitulo}>Detalles del reporte</Text>
        </SafeAreaView>
        <ScrollView contentContainerStyle={{ padding: spacing[4], paddingBottom: spacing[10] }}>

          {isSuciRota && (
            <View style={styles.aviso}>
              <Ionicons name="information-circle-outline" size={16} color="#B07D2A" />
              <Text style={styles.avisoText}>
                Esta opción solo aplica durante los primeros 15 días desde tu fecha de ingreso.
              </Text>
            </View>
          )}

          {isLavadora && (
            <View style={{ marginBottom: spacing[4] }}>
              <Text style={styles.label}>¿SACASTE TU ROPA?</Text>
              <View style={styles.radioRow}>
                {([true, false] as const).map(v => (
                  <TouchableOpacity
                    key={String(v)}
                    style={[styles.radioBtn, sacasteRopa === v && styles.radioBtnSel]}
                    onPress={() => setSacasteRopa(v)}
                  >
                    <Text style={[styles.radioText, sacasteRopa === v && styles.radioTextSel]}>
                      {v ? 'Sí' : 'No'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {needsDesc && (
            <View style={{ marginBottom: spacing[4] }}>
              <Text style={styles.label}>DESCRIPCIÓN</Text>
              <TextInput
                style={styles.input}
                value={descripcion}
                onChangeText={setDescripcion}
                multiline
                numberOfLines={4}
                placeholder="Describe lo que ocurrió..."
                placeholderTextColor={cartasBosque.niebla}
              />
            </View>
          )}

          <View style={{ marginBottom: spacing[4] }}>
            <Text style={styles.label}>FOTO {fotoOblig ? '(OBLIGATORIA)' : '(OPCIONAL)'}</Text>
            {fotoUri ? (
              <View>
                <Image source={{ uri: fotoUri }} style={styles.fotoPreview} resizeMode="cover" />
                <TouchableOpacity style={styles.fotoRemove} onPress={() => setFotoUri(null)}>
                  <Ionicons name="close-circle" size={22} color={cartasBosque.tinta} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.fotoBtn} onPress={pickFoto}>
                <Ionicons name="camera-outline" size={22} color={cartasBosque.bosque} />
                <Text style={styles.fotoBtnText}>Tomar foto</Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={[styles.btnEnviar, enviando && { opacity: 0.5 }]}
            onPress={enviar}
            disabled={enviando}
          >
            <Text style={styles.btnEnviarText}>Enviar ticket</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  if (paso === 'enviando') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={cartasBosque.bosque} />
        <Text style={styles.enviandoText}>Enviando ticket…</Text>
      </View>
    );
  }

  // ── Lista ──────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: cartasBosque.bruma }}>
      <SafeAreaView style={styles.nuevoBtnWrap}>
        <TouchableOpacity style={styles.nuevoBtn} onPress={handleNuevo}>
          <Ionicons name="add" size={18} color={cartasBosque.bruma} />
          <Text style={styles.nuevoBtnText}>Nuevo ticket</Text>
        </TouchableOpacity>
      </SafeAreaView>

      {cargando ? (
        <ActivityIndicator color={cartasBosque.bosque} style={{ marginTop: spacing[8] }} />
      ) : tickets.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="headset-outline" size={36} color={cartasBosque.niebla} />
          <Text style={styles.vacioText}>No tienes tickets abiertos</Text>
        </View>
      ) : (
        <FlatList
          data={tickets}
          keyExtractor={t => t.id}
          contentContainerStyle={{ padding: spacing[4], paddingBottom: spacing[10] }}
          renderItem={({ item }) => <TicketCard ticket={item} esAdmin={false} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  subHeader: {
    backgroundColor: cartasBosque.bruma,
    borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro,
    paddingHorizontal: spacing[4], paddingBottom: spacing[2],
  },
  backBtn:   { flexDirection: 'row', alignItems: 'center', gap: spacing[1], marginBottom: spacing[1] },
  backLabel: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: cartasBosque.tinta },
  subTitulo: { fontFamily: 'DMSans_600SemiBold', fontSize: 18, color: cartasBosque.tinta },

  opcionCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    backgroundColor: cartasBosque.pergamino, borderRadius: borderRadius.md,
    padding: spacing[3], borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    marginBottom: spacing[2],
  },
  opcionIcon: {
    width: 38, height: 38, borderRadius: borderRadius.sm,
    backgroundColor: cartasBosque.niebla + '55',
    alignItems: 'center', justifyContent: 'center',
  },
  opcionLabel:     { flex: 1, fontFamily: 'DMSans_600SemiBold', fontSize: 14, color: cartasBosque.tinta },
  opcionLabelFull: { flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 14, color: cartasBosque.tinta },

  nuevoBtnWrap: {
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro,
  },
  nuevoBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing[2], backgroundColor: cartasBosque.bosque,
    borderRadius: borderRadius.sm, paddingVertical: spacing[3],
  },
  nuevoBtnText: { fontFamily: 'DMSans_600SemiBold', fontSize: 14, color: cartasBosque.bruma },

  label: {
    fontFamily: 'DMMono_400Regular', fontSize: 10, color: cartasBosque.helecho,
    letterSpacing: 0.5, marginBottom: spacing[2],
  },
  input: {
    backgroundColor: cartasBosque.pergamino, borderWidth: 1,
    borderColor: cartasBosque.pergaminoOscuro, borderRadius: borderRadius.sm,
    padding: spacing[3], fontFamily: 'DMSans_400Regular', fontSize: 14,
    color: cartasBosque.tinta, minHeight: 100, textAlignVertical: 'top',
  },
  radioRow: { flexDirection: 'row', gap: spacing[3] },
  radioBtn: {
    flex: 1, paddingVertical: spacing[3], alignItems: 'center',
    borderRadius: borderRadius.sm, borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    backgroundColor: cartasBosque.pergamino,
  },
  radioBtnSel:  { backgroundColor: cartasBosque.bosque, borderColor: cartasBosque.bosque },
  radioText:    { fontFamily: 'DMSans_600SemiBold', fontSize: 14, color: cartasBosque.tinta },
  radioTextSel: { color: cartasBosque.bruma },

  fotoBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing[2], borderWidth: 1, borderColor: cartasBosque.bosque,
    borderRadius: borderRadius.sm, paddingVertical: spacing[4],
    borderStyle: 'dashed',
  },
  fotoBtnText:  { fontFamily: 'DMSans_400Regular', fontSize: 14, color: cartasBosque.bosque },
  fotoPreview:  { width: '100%', height: 160, borderRadius: borderRadius.sm },
  fotoRemove:   { position: 'absolute', top: spacing[1], right: spacing[1] },

  aviso: {
    flexDirection: 'row', gap: spacing[2], alignItems: 'flex-start',
    backgroundColor: '#F5E8C8', borderRadius: borderRadius.sm,
    padding: spacing[3], marginBottom: spacing[4],
  },
  avisoText: { flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#B07D2A' },

  btnEnviar: {
    backgroundColor: cartasBosque.bosque, borderRadius: borderRadius.sm,
    paddingVertical: spacing[4], alignItems: 'center',
  },
  btnEnviarText: { fontFamily: 'DMSans_600SemiBold', fontSize: 15, color: cartasBosque.bruma },

  center:       { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[2] },
  vacioText:    { fontFamily: 'DMSans_400Regular', fontSize: 14, color: cartasBosque.helecho },
  enviandoText: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: cartasBosque.helecho, marginTop: spacing[2] },
});
