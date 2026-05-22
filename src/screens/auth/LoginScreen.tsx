import React, { useState, useRef } from 'react';
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
  TextInput as RNTextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { cartasBosque } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/spacing';
import { useAuth } from '@/hooks/useAuth';

interface Props {
  onRegister: () => void;
}

export default function LoginScreen({ onRegister }: Props) {
  const { signIn } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lockedMinutes, setLockedMinutes] = useState<number | null>(null);

  const passwordRef = useRef<RNTextInput>(null);

  async function handleSignIn() {
    if (!username.trim() || !password.trim()) {
      setErrorMsg('Ingresa tu usuario y contraseña.');
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    setLockedMinutes(null);

    try {
      await signIn(username, password);
    } catch (err: any) {
      if (err.code === 'LOCKED') {
        setLockedMinutes(err.minutesLeft ?? 24);
      } else if (err.code === 'NETWORK_ERROR') {
        setErrorMsg('Sin conexión. Verifica tu internet.');
      } else if (err.code === 'REQUIRES_ADMIN_AUTH') {
        setErrorMsg('Tu cuenta está pendiente de verificación por el administrador.');
      } else {
        const left: number = err.attemptsLeft ?? 0;
        setErrorMsg(
          left > 0
            ? `Credenciales incorrectas. ${left} intento${left === 1 ? '' : 's'} restante${left === 1 ? '' : 's'}.`
            : 'Credenciales incorrectas.',
        );
      }
    } finally {
      setLoading(false);
    }
  }

  const isBlocked = loading || lockedMinutes !== null;

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
        {/* ── Logo ── */}
        <View style={styles.header}>
          <View style={styles.logoMark}>
            <Text style={styles.logoChar}>A</Text>
          </View>
          <Text style={styles.title}>Antioquia 43</Text>
          <Text style={styles.welcome}>
            Hola, bienvenido a Antioquia 43{'\n'}tu app de renta segura
          </Text>
        </View>

        {/* ── Formulario ── */}
        <View style={styles.form}>

          {/* Nombre de usuario */}
          <View style={styles.field}>
            <Text style={styles.label}>Nombre de usuario</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={(t) => { setUsername(t); setErrorMsg(null); }}
              placeholder="tu_usuario"
              placeholderTextColor={cartasBosque.helecho}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              editable={!isBlocked}
            />
          </View>

          {/* Contraseña */}
          <View style={styles.field}>
            <Text style={styles.label}>Contraseña</Text>
            <View style={styles.passwordRow}>
              <TextInput
                ref={passwordRef}
                style={[styles.input, { flex: 1 }]}
                value={password}
                onChangeText={(t) => { setPassword(t); setErrorMsg(null); }}
                placeholder="••••••••"
                placeholderTextColor={cartasBosque.helecho}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleSignIn}
                editable={!isBlocked}
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={cartasBosque.musgo}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Error */}
          {errorMsg && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={15} color={cartasBosque.corteza} />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          )}

          {/* Bloqueo */}
          {lockedMinutes !== null && (
            <View style={styles.lockBox}>
              <Ionicons name="lock-closed-outline" size={15} color={cartasBosque.corteza} />
              <Text style={styles.lockText}>
                Cuenta bloqueada — intenta en {lockedMinutes} min.
              </Text>
            </View>
          )}

          {/* Botón Entrar */}
          <TouchableOpacity
            style={[styles.button, isBlocked && styles.buttonDisabled]}
            onPress={handleSignIn}
            disabled={isBlocked}
            activeOpacity={0.82}
          >
            {loading ? (
              <ActivityIndicator size="small" color={cartasBosque.bruma} />
            ) : (
              <Text style={styles.buttonText}>Entrar</Text>
            )}
          </TouchableOpacity>

          {/* Link de registro */}
          <TouchableOpacity style={styles.registerRow} onPress={onRegister} disabled={loading}>
            <Text style={styles.registerText}>
              ¿No tienes cuenta aún?{' '}
              <Text style={styles.registerLink}>Regístrate</Text>
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Pie ── */}
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
    justifyContent: 'center',
    paddingVertical: spacing[14],
  },

  // Header
  header: { alignItems: 'center', marginBottom: spacing[10] },
  logoMark: {
    width: 68,
    height: 68,
    borderRadius: borderRadius.xl,
    backgroundColor: cartasBosque.bosque,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[5],
    shadowColor: cartasBosque.bosque,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  logoChar: {
    fontFamily: 'Inter_700Bold',
    fontSize: 34,
    color: cartasBosque.pergamino,
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 30,
    color: cartasBosque.bosque,
    letterSpacing: -0.4,
    marginBottom: spacing[3],
  },
  welcome: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: cartasBosque.musgo,
    textAlign: 'center',
    lineHeight: 21,
  },

  // Form
  form: { gap: spacing[4] },
  field: { gap: spacing[1.5] },
  label: {
    fontFamily: 'Inter_500Medium',
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
    fontFamily: 'Inter_400Regular',
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

  // Mensajes
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: 'rgba(103,0,16,0.15)',
    borderRadius: borderRadius.md,
    padding: spacing[3],
  },
  errorText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: cartasBosque.corteza,
    flex: 1,
  },
  lockBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: cartasBosque.pergaminoOscuro,
    borderRadius: borderRadius.md,
    padding: spacing[3],
  },
  lockText: {
    fontFamily: 'Inter_400Regular',
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
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: cartasBosque.bruma,
    letterSpacing: 0.3,
  },

  // Registro
  registerRow: {
    alignItems: 'center',
    paddingTop: spacing[2],
  },
  registerText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: cartasBosque.musgo,
  },
  registerLink: {
    fontFamily: 'Inter_600SemiBold',
    color: cartasBosque.bosque,
    textDecorationLine: 'underline',
  },

  // Footer
  footer: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 10,
    color: cartasBosque.helecho,
    textAlign: 'center',
    marginTop: spacing[12],
    letterSpacing: 1.2,
  },
});
