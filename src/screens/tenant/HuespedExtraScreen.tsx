import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Timestamp } from 'firebase/firestore';
import { cartasBosque } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/spacing';
import { useAuth } from '@/hooks/useAuth';
import PromoCard from '@/components/common/PromoCard';
import {
  TABLA_COBROS, registrarHuespedExtra, ofrecerPromo, responderPromo,
  listenMisHuespedes, seedHuespedes,
} from '@/services/firebase/huespedes';
import type { HuespedExtra, TipoDocumento } from '@/types/firestore';

type Step = 'lista' | 'aviso' | 'perfil' | 'promo' | 'confirmacion';

const DOC_TIPOS: TipoDocumento[] = ['CC', 'CE', 'PP', 'TI'];

const AVISOS = [
  'El huésped extra NO puede usar la habitación de forma exclusiva.',
  'Subarrendar está PROHIBIDO y es causal de desalojo inmediato.',
  'El titular debe estar presente en la habitación durante toda la estadía.',
  'El incumplimiento genera penalización en tu Score de reputación.',
  'Máximo 2 huéspedes extra por habitación (3 personas en total).',
];

export default function HuespedExtraScreen() {
  const { user } = useAuth();
  const uid = user?.uid ?? '';

  const [step, setStep] = useState<Step>('lista');
  const [huespedes, setHuespedes] = useState<HuespedExtra[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState('');
  const [confirmOk, setConfirmOk] = useState(true);

  // Promo state
  const [promoId, setPromoId] = useState<string | null>(null);
  const promoHuesped = huespedes.find(h => h.id === promoId) ?? null;

  // Form
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [docTipo, setDocTipo] = useState<TipoDocumento>('CC');
  const [docNumero, setDocNumero] = useState('');
  const [parentesco, setParentesco] = useState('');

  useEffect(() => {
    if (!uid) return;
    if (__DEV__) seedHuespedes().catch(() => {});
    return listenMisHuespedes(uid, setHuespedes);
  }, [uid]);

  const activos = huespedes.filter(h => h.activo && h.estado !== 'inactivo');
  const puedeRegistrar = activos.length < 2;

  function resetForm() {
    setNombre(''); setApellido('');
    setDocTipo('CC'); setDocNumero(''); setParentesco('');
  }

  async function handleRegistrar() {
    if (!nombre.trim() || !apellido.trim() || !docNumero.trim()) {
      Alert.alert('Campos incompletos', 'Nombre, apellido y número de documento son obligatorios.');
      return;
    }
    if (!puedeRegistrar) {
      Alert.alert('Límite alcanzado', 'Solo puedes registrar hasta 2 huéspedes extra.');
      return;
    }
    setLoading(true);
    try {
      const { id, semana, requiereAuth } = await registrarHuespedExtra({
        inquilinoId: uid,
        habitacionId: activos[0]?.habitacionId ?? 'sin-asignar',
        habitacionNumero: activos[0]?.habitacionNumero,
        inquilinoNombre: activos[0]?.inquilinoNombre,
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        documentoTipo: docTipo,
        documentoNumero: docNumero.trim(),
        parentesco: parentesco.trim() || undefined,
        fechaEntrada: Timestamp.now(),
      });

      resetForm();

      if (requiereAuth) {
        setConfirmMsg(
          `${nombre} fue registrado en semana ${semana}.\n` +
          'Requiere autorización del administrador antes de ingresar a las instalaciones.',
        );
        setConfirmOk(false);
        setStep('confirmacion');
      } else if (semana === 4) {
        setConfirmMsg(
          `${nombre} queda incorporado automáticamente como residente mensual · $500/mes.`,
        );
        setConfirmOk(true);
        setStep('confirmacion');
      } else {
        // Semana 1 → ofrecer promo inmediatamente
        await ofrecerPromo(id);
        setPromoId(id);
        setStep('promo');
      }
    } catch {
      Alert.alert('Error', 'No se pudo registrar el huésped. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAceptarPromo() {
    if (!promoId) return;
    await responderPromo(promoId, true);
    setConfirmMsg('Promo aceptada. El huésped queda incorporado como residente mensual · $500/mes.');
    setConfirmOk(true);
    setPromoId(null);
    setStep('confirmacion');
  }

  async function handleRechazarPromo() {
    if (!promoId) return;
    await responderPromo(promoId, false);
    setConfirmMsg('El huésped continúa en modalidad temporal · $700/semana.');
    setConfirmOk(true);
    setPromoId(null);
    setStep('confirmacion');
  }

  // ── LISTA ────────────────────────────────────────────────────

  if (step === 'lista') {
    return (
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.pageHeader}>
          <Text style={styles.eyebrow}>Mis servicios</Text>
          <Text style={styles.pageTitle}>Huésped Extra</Text>
        </View>

        {/* Aviso anti-subarriendo */}
        <View style={styles.warningBox}>
          <Ionicons name="shield-checkmark-outline" size={14} color={cartasBosque.corteza} />
          <Text style={styles.warningText}>
            El huésped no puede usar la habitación en tu ausencia. Subarrendar anula el contrato.
          </Text>
        </View>

        {/* Huéspedes activos */}
        {activos.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>REGISTRADOS ACTUALMENTE</Text>
            <View style={styles.lista}>
              {activos.map(h => (
                <View key={h.id} style={styles.huespedCard}>
                  <View style={[styles.huespedAvatar, estadoStyle(h.estado).avatar]}>
                    <Text style={styles.huespedIniciales}>
                      {h.nombre[0]}{h.apellido[0]}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.huespedNombre}>{h.nombre} {h.apellido}</Text>
                    <Text style={styles.huespedSub}>
                      {h.documentoTipo} {h.documentoNumero}
                      {h.parentesco ? ` · ${h.parentesco}` : ''}
                    </Text>
                  </View>
                  <View style={[styles.estadoBadge, estadoStyle(h.estado).badge]}>
                    <Text style={[styles.estadoTxt, estadoStyle(h.estado).txt]}>
                      {ESTADO_LABEL[h.estado]}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Tabla de cobros */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>TABLA DE COBROS</Text>
          <View style={styles.tabla}>
            <View style={styles.tablaHeader}>
              <Text style={[styles.tablaHdrCell, { flex: 1.4 }]}>Semana</Text>
              <Text style={styles.tablaHdrCell}>Monto</Text>
              <Text style={styles.tablaHdrCell}>Mensual</Text>
              <Text style={[styles.tablaHdrCell, { flex: 1.2 }]}>Auth</Text>
            </View>
            {([1, 2, 3, 4] as const).map(s => {
              const c = TABLA_COBROS[s];
              return (
                <View key={s} style={[styles.tablaRow, s === 4 && styles.tablaRowFinal]}>
                  <View style={{ flex: 1.4 }}>
                    <Text style={styles.tablaCellBold}>{c.label}</Text>
                    <Text style={styles.tablaCellSub}>{c.diasRango}</Text>
                  </View>
                  <Text style={styles.tablaCell}>
                    {c.semana > 0 ? `$${c.semana}/sem` : '—'}
                  </Text>
                  <Text style={[styles.tablaCell, { color: cartasBosque.bosque }]}>
                    ${c.mensual}/mes
                  </Text>
                  <View style={{ flex: 1.2, alignItems: 'flex-start' }}>
                    {c.requiereAuth
                      ? <Ionicons name="lock-closed" size={13} color={cartasBosque.corteza} />
                      : <Ionicons name="checkmark-circle" size={13} color={cartasBosque.musgo} />
                    }
                  </View>
                </View>
              );
            })}
          </View>
          <Text style={styles.tablaNote}>
            IVA exento · Art. 20 LIVA · Máx. 3 personas por habitación
          </Text>
        </View>

        {/* Botón registrar */}
        <TouchableOpacity
          style={[styles.btnRegistrar, !puedeRegistrar && styles.btnDisabled]}
          onPress={() => puedeRegistrar && setStep('aviso')}
          disabled={!puedeRegistrar}
          activeOpacity={0.82}
        >
          <Ionicons name="person-add-outline" size={18} color={cartasBosque.bruma} />
          <Text style={styles.btnRegistrarTxt}>
            {puedeRegistrar ? 'Registrar huésped extra' : 'Límite alcanzado (2/2)'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ── AVISO ────────────────────────────────────────────────────

  if (step === 'aviso') {
    return (
      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <TouchableOpacity onPress={() => setStep('lista')} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color={cartasBosque.musgo} />
            <Text style={styles.backTxt}>Volver</Text>
          </TouchableOpacity>

          <View style={styles.avisoBox}>
            <View style={styles.avisoIconWrap}>
              <Ionicons name="warning" size={32} color={cartasBosque.corteza} />
            </View>
            <Text style={styles.avisoTitle}>Antes de continuar</Text>
            <Text style={styles.avisoSubtitle}>
              Registrar un huésped implica las siguientes responsabilidades:
            </Text>
            {AVISOS.map((a, i) => (
              <View key={i} style={styles.avisoItem}>
                <View style={styles.avisoBullet} />
                <Text style={styles.avisoItemTxt}>{a}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={styles.btnRegistrar}
            onPress={() => setStep('perfil')}
            activeOpacity={0.82}
          >
            <Text style={styles.btnRegistrarTxt}>Entendido, continuar</Text>
            <Ionicons name="arrow-forward" size={18} color={cartasBosque.bruma} />
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ── PERFIL ───────────────────────────────────────────────────

  if (step === 'perfil') {
    return (
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <TouchableOpacity onPress={() => setStep('aviso')} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color={cartasBosque.musgo} />
            <Text style={styles.backTxt}>Volver</Text>
          </TouchableOpacity>

          <Text style={styles.pageTitle}>Datos del huésped</Text>
          <Text style={styles.eyebrow}>PASO 1 DE 1 · PERFIL</Text>

          {/* Nombre */}
          <View style={styles.field}>
            <Text style={styles.label}>Nombre *</Text>
            <TextInput
              style={styles.input}
              value={nombre}
              onChangeText={setNombre}
              placeholder="Nombre"
              placeholderTextColor={cartasBosque.helecho}
              autoCapitalize="words"
            />
          </View>

          {/* Apellido */}
          <View style={styles.field}>
            <Text style={styles.label}>Apellido *</Text>
            <TextInput
              style={styles.input}
              value={apellido}
              onChangeText={setApellido}
              placeholder="Apellido"
              placeholderTextColor={cartasBosque.helecho}
              autoCapitalize="words"
            />
          </View>

          {/* Tipo documento */}
          <View style={styles.field}>
            <Text style={styles.label}>Tipo de documento *</Text>
            <View style={styles.chipRow}>
              {DOC_TIPOS.map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.chip, docTipo === t && styles.chipActive]}
                  onPress={() => setDocTipo(t)}
                >
                  <Text style={[styles.chipTxt, docTipo === t && styles.chipTxtActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Número documento */}
          <View style={styles.field}>
            <Text style={styles.label}>Número de documento *</Text>
            <TextInput
              style={styles.input}
              value={docNumero}
              onChangeText={setDocNumero}
              placeholder="0000000000"
              placeholderTextColor={cartasBosque.helecho}
              keyboardType="numeric"
            />
          </View>

          {/* Parentesco */}
          <View style={styles.field}>
            <Text style={styles.label}>Parentesco / relación</Text>
            <TextInput
              style={styles.input}
              value={parentesco}
              onChangeText={setParentesco}
              placeholder="Ej: Hermano, Amigo, Pareja"
              placeholderTextColor={cartasBosque.helecho}
              autoCapitalize="words"
            />
          </View>

          <TouchableOpacity
            style={[styles.btnRegistrar, loading && styles.btnDisabled]}
            onPress={handleRegistrar}
            disabled={loading}
            activeOpacity={0.82}
          >
            {loading
              ? <ActivityIndicator size="small" color={cartasBosque.bruma} />
              : <>
                  <Text style={styles.btnRegistrarTxt}>Registrar</Text>
                  <Ionicons name="checkmark" size={18} color={cartasBosque.bruma} />
                </>
            }
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── PROMO ────────────────────────────────────────────────────

  if (step === 'promo') {
    return (
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>Oferta especial</Text>
        <Text style={styles.eyebrow}>INCORPORACIÓN MENSUAL</Text>

        {promoHuesped ? (
          <PromoCard
            nombreHuesped={`${promoHuesped.nombre} ${promoHuesped.apellido}`}
            semana={promoHuesped.semanaIngreso}
            montoMensual={promoHuesped.montoMensual}
            promoTimestamp={promoHuesped.promoTimestamp}
            onAceptar={handleAceptarPromo}
            onRechazar={handleRechazarPromo}
          />
        ) : (
          <ActivityIndicator size="large" color={cartasBosque.bosque} style={{ marginTop: 40 }} />
        )}
      </ScrollView>
    );
  }

  // ── CONFIRMACIÓN ─────────────────────────────────────────────

  return (
    <View style={[styles.root, styles.centerContent]}>
      <View style={[styles.confirmIcon, confirmOk && styles.confirmIconOk]}>
        <Ionicons
          name={confirmOk ? 'checkmark-circle' : 'time-outline'}
          size={48}
          color={confirmOk ? cartasBosque.bosque : cartasBosque.tierra}
        />
      </View>
      <Text style={styles.confirmTitle}>
        {confirmOk ? '¡Listo!' : 'Pendiente de autorización'}
      </Text>
      <Text style={styles.confirmMsg}>{confirmMsg}</Text>
      <TouchableOpacity
        style={styles.btnRegistrar}
        onPress={() => setStep('lista')}
        activeOpacity={0.82}
      >
        <Text style={styles.btnRegistrarTxt}>Ver mis huéspedes</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Helpers ──────────────────────────────────────────────────

const ESTADO_LABEL: Record<string, string> = {
  pendiente_auth: 'Pendiente',
  activo:         'Activo',
  incorporado:    'Mensual',
  inactivo:       'Inactivo',
};

function estadoStyle(estado: string) {
  const colors: Record<string, { badge: object; txt: object; avatar: object }> = {
    pendiente_auth: {
      badge:  { backgroundColor: 'rgba(205,178,157,0.15)', borderColor: '#FFCD39' + '60' },
      txt:    { color: '#8A6A72' },
      avatar: { backgroundColor: cartasBosque.tierra + '20' },
    },
    activo: {
      badge:  { backgroundColor: '#E8EBE0', borderColor: '#4A5E4840' },
      txt:    { color: '#122A1F' },
      avatar: { backgroundColor: cartasBosque.bosque + '20' },
    },
    incorporado: {
      badge:  { backgroundColor: '#E8EBE0', borderColor: '#4A5E4840' },
      txt:    { color: '#122A1F' },
      avatar: { backgroundColor: '#4A5E4820' },
    },
    inactivo: {
      badge:  { backgroundColor: cartasBosque.pergaminoOscuro, borderColor: cartasBosque.helecho + '60' },
      txt:    { color: cartasBosque.musgo },
      avatar: { backgroundColor: cartasBosque.niebla + '40' },
    },
  };
  return colors[estado] ?? colors.inactivo;
}

// ─── Estilos ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: cartasBosque.bruma },
  content: { padding: spacing[5], paddingBottom: spacing[12], gap: spacing[5] },
  centerContent: { alignItems: 'center', justifyContent: 'center', padding: spacing[6] },

  pageHeader: { gap: spacing[1] },
  eyebrow: {
    fontFamily: 'DMMono_400Regular', fontSize: 10,
    color: cartasBosque.musgo, letterSpacing: 1.5, textTransform: 'uppercase',
  },
  pageTitle: {
    fontFamily: 'DMSans_700Bold', fontSize: 26,
    color: cartasBosque.bosque, letterSpacing: -0.3,
  },

  warningBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2],
    backgroundColor: 'rgba(205,178,157,0.15)', borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: '#FB8C0040',
    padding: spacing[3],
  },
  warningText: {
    fontFamily: 'DMMono_400Regular', fontSize: 11,
    color: cartasBosque.corteza, flex: 1, lineHeight: 16,
  },

  section: { gap: spacing[3] },
  sectionLabel: {
    fontFamily: 'DMMono_400Regular', fontSize: 10,
    color: cartasBosque.helecho, letterSpacing: 1,
  },
  lista: { gap: spacing[2] },

  huespedCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    backgroundColor: cartasBosque.bruma,
    borderRadius: borderRadius.lg,
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    padding: spacing[3],
  },
  huespedAvatar: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },
  huespedIniciales: {
    fontFamily: 'DMSans_700Bold', fontSize: 14, color: cartasBosque.bosque,
  },
  huespedNombre: {
    fontFamily: 'DMSans_600SemiBold', fontSize: 14, color: cartasBosque.tinta,
  },
  huespedSub: {
    fontFamily: 'DMMono_400Regular', fontSize: 10, color: cartasBosque.helecho,
  },
  estadoBadge: {
    paddingHorizontal: spacing[2], paddingVertical: spacing[0.5],
    borderRadius: borderRadius.full, borderWidth: 1,
  },
  estadoTxt: { fontFamily: 'DMMono_400Regular', fontSize: 10 },

  // Tabla
  tabla: {
    backgroundColor: cartasBosque.bruma,
    borderRadius: borderRadius.lg,
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    overflow: 'hidden',
  },
  tablaHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing[4], paddingVertical: spacing[2],
    backgroundColor: cartasBosque.pergaminoOscuro,
  },
  tablaHdrCell: {
    flex: 1, fontFamily: 'DMMono_400Regular', fontSize: 9,
    color: cartasBosque.musgo, letterSpacing: 0.5,
  },
  tablaRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderTopWidth: 1, borderTopColor: cartasBosque.pergaminoOscuro,
  },
  tablaRowFinal: { backgroundColor: '#E8EBE0' },
  tablaCellBold: {
    fontFamily: 'DMSans_600SemiBold', fontSize: 12, color: cartasBosque.tinta,
  },
  tablaCellSub: {
    fontFamily: 'DMMono_400Regular', fontSize: 9, color: cartasBosque.helecho,
  },
  tablaCell: {
    flex: 1, fontFamily: 'DMMono_400Regular', fontSize: 11, color: cartasBosque.tinta,
  },
  tablaNote: {
    fontFamily: 'DMMono_400Regular', fontSize: 10,
    color: cartasBosque.helecho, textAlign: 'center',
    marginTop: spacing[2],
  },

  // Aviso
  avisoBox: {
    backgroundColor: '#F5F2EC',
    borderRadius: borderRadius.lg,
    borderWidth: 1, borderColor: cartasBosque.corteza + '30',
    padding: spacing[5], gap: spacing[4],
    alignItems: 'center',
  },
  avisoIconWrap: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: 'rgba(205,178,157,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  avisoTitle: {
    fontFamily: 'DMSans_700Bold', fontSize: 20,
    color: cartasBosque.tinta, textAlign: 'center',
  },
  avisoSubtitle: {
    fontFamily: 'DMSans_400Regular', fontSize: 14,
    color: cartasBosque.musgo, textAlign: 'center', lineHeight: 20,
  },
  avisoItem: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3], width: '100%' },
  avisoBullet: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: cartasBosque.corteza, marginTop: 5,
  },
  avisoItemTxt: {
    fontFamily: 'DMMono_400Regular', fontSize: 12,
    color: cartasBosque.tinta, flex: 1, lineHeight: 18,
  },

  // Form
  field: { gap: spacing[1.5] },
  label: { fontFamily: 'DMSans_500Medium', fontSize: 13, color: cartasBosque.tinta },
  input: {
    backgroundColor: cartasBosque.bruma,
    borderWidth: 1.5, borderColor: cartasBosque.pergaminoOscuro,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    fontFamily: 'DMSans_400Regular', fontSize: 15, color: cartasBosque.tinta,
  },
  chipRow: { flexDirection: 'row', gap: spacing[2] },
  chip: {
    paddingHorizontal: spacing[4], paddingVertical: spacing[2],
    borderRadius: borderRadius.full, borderWidth: 1.5,
    borderColor: cartasBosque.pergaminoOscuro,
    backgroundColor: cartasBosque.bruma,
  },
  chipActive: { borderColor: cartasBosque.bosque, backgroundColor: cartasBosque.bosque },
  chipTxt: { fontFamily: 'DMSans_500Medium', fontSize: 13, color: cartasBosque.musgo },
  chipTxtActive: { color: cartasBosque.bruma },

  // Back
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  backTxt: { fontFamily: 'DMSans_500Medium', fontSize: 14, color: cartasBosque.musgo },

  // Botón principal
  btnRegistrar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing[2], backgroundColor: cartasBosque.bosque,
    borderRadius: borderRadius.md, paddingVertical: spacing[4],
    shadowColor: cartasBosque.bosque,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25, shadowRadius: 6, elevation: 3,
  },
  btnDisabled: { opacity: 0.45 },
  btnRegistrarTxt: {
    fontFamily: 'DMSans_600SemiBold', fontSize: 16, color: cartasBosque.bruma,
  },

  // Confirmación
  confirmIcon: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: cartasBosque.niebla + '50',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing[5],
  },
  confirmIconOk: { backgroundColor: '#E8EBE0' },
  confirmTitle: {
    fontFamily: 'DMSans_700Bold', fontSize: 24,
    color: cartasBosque.tinta, marginBottom: spacing[3], textAlign: 'center',
  },
  confirmMsg: {
    fontFamily: 'DMSans_400Regular', fontSize: 15,
    color: cartasBosque.musgo, textAlign: 'center', lineHeight: 22,
    marginBottom: spacing[8], paddingHorizontal: spacing[4],
  },
});
