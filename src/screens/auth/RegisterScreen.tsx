import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { cartasBosque } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/spacing';
import { useAuth } from '@/hooks/useAuth';

interface Props {
  onBack: () => void;
}

type Step = 'form' | 'success';

export default function RegisterScreen({ onBack }: Props) {
  const { signUp, signOut } = useAuth();

  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [curp, setCurp] = useState('');
  const [emailPersonal, setEmailPersonal] = useState('');
  const [telefono, setTelefono] = useState('');
  const [keepLoggedIn, setKeepLoggedIn] = useState(true);
  const [showCurp, setShowCurp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('form');
  const [generatedUsername, setGeneratedUsername] = useState('');

  async function handleRegister() {
    if (!nombre.trim() || !apellido.trim() || !curp.trim() || !emailPersonal.trim() || !telefono.trim()) {
      setErrorMsg('Completa todos los campos.');
      return;
    }
    if (curp.trim().length < 10) {
      setErrorMsg('Ingresa una CURP válida.');
      return;
    }
    setLoading(true);
    setErrorMsg(null);

    try {
      const { username } = await signUp({ nombre, apellido, curp, emailPersonal, telefono });
      setGeneratedUsername(username);
      if (!keepLoggedIn) {
        await signOut();
      }
      setStep('success');
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setErrorMsg('Ya existe una cuenta con ese correo.');
      } else if (err.code === 'auth/network-request-failed') {
        setErrorMsg('Sin conexión. Verifica tu internet.');
      } else {
        setErrorMsg('No se pudo crear la cuenta. Intenta de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  }

  if (step === 'success') {
    return (
      <View style={styles.root}>
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={56} color={cartasBosque.bosque} />
          </View>
          <Text style={styles.successTitle}>¡Cuenta creada!</Text>
          <Text style={styles.successBody}>
            Tu solicitud está pendiente de verificación por el administrador.
            Una vez aprobada, podrás iniciar sesión con:
          </Text>
          <View style={styles.usernameBox}>
            <Text style={styles.usernameLabel}>Tu nombre de usuario</Text>
            <Text style={styles.usernameValue}>{generatedUsername}</Text>
            <Text style={styles.passwordHint}>Contraseña: tu CURP</Text>
          </View>
          <TouchableOpacity style={styles.button} onPress={onBack} activeOpacity={0.82}>
            <Text style={styles.buttonText}>Volver al inicio de sesión</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Encabezado */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="arrow-back" size={22} color={cartasBosque.bosque} />
          </TouchableOpacity>
          <Text style={styles.title}>Crear cuenta</Text>
          <Text style={styles.subtitle}>Solo para inquilinos de Antioquia 43</Text>
        </View>

        {/* Formulario */}
        <View style={styles.form}>

          <View style={styles.field}>
            <Text style={styles.label}>Nombre(s)</Text>
            <TextInput
              style={styles.input}
              value={nombre}
              onChangeText={(t) => { setNombre(t); setErrorMsg(null); }}
              placeholder="María Elena"
              placeholderTextColor={cartasBosque.helecho}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="next"
              editable={!loading}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Apellidos</Text>
            <TextInput
              style={styles.input}
              value={apellido}
              onChangeText={(t) => { setApellido(t); setErrorMsg(null); }}
              placeholder="García López"
              placeholderTextColor={cartasBosque.helecho}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="next"
              editable={!loading}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>CURP</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={curp}
                onChangeText={(t) => { setCurp(t.toUpperCase()); setErrorMsg(null); }}
                placeholder="18 caracteres"
                placeholderTextColor={cartasBosque.helecho}
                secureTextEntry={!showCurp}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={18}
                returnKeyType="next"
                editable={!loading}
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowCurp((v) => !v)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name={showCurp ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={cartasBosque.musgo}
                />
              </TouchableOpacity>
            </View>
            <Text style={styles.hint}>Tu CURP será tu contraseña de acceso.</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Correo electrónico</Text>
            <TextInput
              style={styles.input}
              value={emailPersonal}
              onChangeText={(t) => { setEmailPersonal(t); setErrorMsg(null); }}
              placeholder="correo@ejemplo.com"
              placeholderTextColor={cartasBosque.helecho}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              editable={!loading}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Número de celular</Text>
            <TextInput
              style={styles.input}
              value={telefono}
              onChangeText={(t) => { setTelefono(t); setErrorMsg(null); }}
              placeholder="55 1234 5678"
              placeholderTextColor={cartasBosque.helecho}
              keyboardType="phone-pad"
              returnKeyType="done"
              editable={!loading}
            />
          </View>

          {/* Keep me logged in */}
          <View style={styles.keepRow}>
            <View style={styles.keepTextCol}>
              <Text style={styles.keepLabel}>Mantener sesión iniciada</Text>
              <Text style={styles.keepSub}>
                {keepLoggedIn ? 'No tendrás que ingresar de nuevo.' : 'Se cerrará sesión al terminar.'}
              </Text>
            </View>
            <Switch
              value={keepLoggedIn}
              onValueChange={setKeepLoggedIn}
              trackColor={{ false: cartasBosque.pergaminoOscuro, true: cartasBosque.bosque }}
              thumbColor={cartasBosque.pergamino}
              disabled={loading}
            />
          </View>

          {/* Error */}
          {errorMsg && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={15} color={cartasBosque.corteza} />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          )}

          {/* Botón */}
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.82}
          >
            {loading ? (
              <ActivityIndicator size="small" color={cartasBosque.bruma} />
            ) : (
              <Text style={styles.buttonText}>Crear cuenta</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.backRow} onPress={onBack} disabled={loading}>
            <Text style={styles.backText}>¿Ya tienes cuenta? <Text style={styles.backLink}>Inicia sesión</Text></Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>Sistema de gestión · Antioquia 43</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: cartasBosque.bruma },

  container: {
    flexGrow: 1,
    paddingHorizontal: spacing[6],
    paddingTop: spacing[12],
    paddingBottom: spacing[10],
  },

  // Encabezado
  header: { marginBottom: spacing[8] },
  backBtn: { marginBottom: spacing[4] },
  title: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 28,
    color: cartasBosque.bosque,
    letterSpacing: -0.3,
    marginBottom: spacing[1.5],
  },
  subtitle: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    color: cartasBosque.musgo,
  },

  // Form
  form: { gap: spacing[4] },
  field: { gap: spacing[1.5] },
  label: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 13,
    color: cartasBosque.tinta,
  },
  input: {
    backgroundColor: cartasBosque.bruma,
    borderWidth: 1.5,
    borderColor: cartasBosque.pergaminoOscuro,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    color: cartasBosque.tinta,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  eyeBtn: {
    padding: spacing[3],
    backgroundColor: cartasBosque.bruma,
    borderWidth: 1.5,
    borderColor: cartasBosque.pergaminoOscuro,
    borderRadius: borderRadius.md,
  },
  hint: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 11,
    color: cartasBosque.helecho,
    marginTop: spacing[0.5],
  },

  // Keep me logged in
  keepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: cartasBosque.pergamino,
    borderRadius: borderRadius.md,
    padding: spacing[4],
    gap: spacing[3],
  },
  keepTextCol: { flex: 1 },
  keepLabel: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    color: cartasBosque.tinta,
  },
  keepSub: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: cartasBosque.musgo,
    marginTop: spacing[0.5],
  },

  // Error
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: 'rgba(103,0,16,0.15)',
    borderRadius: borderRadius.md,
    padding: spacing[3],
  },
  errorText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: cartasBosque.corteza,
    flex: 1,
  },

  // Botón principal
  button: {
    backgroundColor: cartasBosque.bosque,
    borderRadius: borderRadius.md,
    paddingVertical: spacing[4],
    alignItems: 'center',
    marginTop: spacing[2],
    shadowColor: cartasBosque.bosque,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  buttonDisabled: { opacity: 0.45 },
  buttonText: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 16,
    color: cartasBosque.bruma,
    letterSpacing: 0.3,
  },

  // Volver
  backRow: { alignItems: 'center', paddingTop: spacing[2] },
  backText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    color: cartasBosque.musgo,
  },
  backLink: {
    fontFamily: 'DMSans_600SemiBold',
    color: cartasBosque.bosque,
    textDecorationLine: 'underline',
  },

  // Footer
  footer: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 10,
    color: cartasBosque.helecho,
    textAlign: 'center',
    marginTop: spacing[10],
    letterSpacing: 1.2,
  },

  // Success
  successContainer: {
    flex: 1,
    paddingHorizontal: spacing[6],
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing[5],
  },
  successIcon: { marginBottom: spacing[2] },
  successTitle: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 26,
    color: cartasBosque.bosque,
    letterSpacing: -0.3,
  },
  successBody: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    color: cartasBosque.musgo,
    textAlign: 'center',
    lineHeight: 22,
  },
  usernameBox: {
    width: '100%',
    backgroundColor: cartasBosque.pergamino,
    borderRadius: borderRadius.md,
    padding: spacing[5],
    alignItems: 'center',
    gap: spacing[1.5],
  },
  usernameLabel: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 12,
    color: cartasBosque.musgo,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  usernameValue: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 18,
    color: cartasBosque.bosque,
    letterSpacing: 1,
  },
  passwordHint: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: cartasBosque.musgo,
    marginTop: spacing[1],
  },
});
