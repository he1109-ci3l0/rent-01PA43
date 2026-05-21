import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, TextInput, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { cartasBosque } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/spacing';
import { useAuth } from '@/hooks/useAuth';
import VisitaCard from '@/components/common/VisitaCard';
import type { Visita, TipoDocumento } from '@/types/firestore';
import { listenMisVisitas, registrarEntrada } from '@/services/firebase/visitas';

type Vista = 'lista' | 'checkin';
type DocTipo = TipoDocumento;

const DOC_TIPOS: DocTipo[] = ['CC', 'CE', 'PP', 'TI', 'otro'];

// ─── Componente ───────────────────────────────────────────────

export default function VisitasScreen() {
  const { user } = useAuth();
  const [vista, setVista] = useState<Vista>('lista');
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [cargando, setCargando] = useState(true);

  // Form checkin
  const [nombreVisitante, setNombreVisitante] = useState('');
  const [docTipo, setDocTipo] = useState<DocTipo>('CC');
  const [docNumero, setDocNumero] = useState('');
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = listenMisVisitas(user.uid, data => {
      setVisitas(data);
      setCargando(false);
    });
    return unsub;
  }, [user?.uid]);

  const activas = visitas.filter(v => !v.fechaSalida);
  const recientes = visitas.filter(v => !!v.fechaSalida);

  function resetForm() {
    setNombreVisitante('');
    setDocTipo('CC');
    setDocNumero('');
    setMotivo('');
    setError('');
    setExito(false);
  }

  async function handleCheckin() {
    if (!docNumero.trim()) {
      setError('El número de documento es requerido.');
      return;
    }
    if (!user?.uid) return;
    setEnviando(true);
    setError('');
    try {
      await registrarEntrada({
        inquilinoId: user.uid,
        habitacionId: visitas[0]?.habitacionId ?? 'sin-asignar',
        habitacionNumero: visitas[0]?.habitacionNumero,
        inquilinoNombre: visitas[0]?.inquilinoNombre,
        nombreVisitante: nombreVisitante.trim() || undefined,
        documentoTipo: docTipo,
        documentoNumero: docNumero.trim(),
        motivo: motivo.trim() || undefined,
      });
      setExito(true);
    } catch (e: any) {
      setError('Error al registrar: ' + (e.message ?? 'intenta de nuevo'));
    } finally {
      setEnviando(false);
    }
  }

  // ── Vista check-in ───────────────────────────────────────────

  if (vista === 'checkin') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => { setVista('lista'); resetForm(); }}>
            <Ionicons name="arrow-back" size={22} color={cartasBosque.tinta} />
          </TouchableOpacity>
          <Text style={styles.titulo}>Registrar visita</Text>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {exito ? (
            <View style={styles.exitoBox}>
              <Ionicons name="checkmark-circle" size={40} color={cartasBosque.bosque} />
              <Text style={styles.exitoTitulo}>Visita registrada</Text>
              <Text style={styles.exitoSub}>
                La entrada fue registrada exitosamente.
              </Text>
              <TouchableOpacity
                style={styles.btnPrimario}
                onPress={() => { setVista('lista'); resetForm(); }}
              >
                <Text style={styles.btnPrimarioText}>Ver mis visitas</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnSecundario}
                onPress={resetForm}
              >
                <Text style={styles.btnSecundarioText}>Registrar otra</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.label}>Nombre del visitante <Text style={styles.opcional}>(opcional)</Text></Text>
              <TextInput
                style={styles.input}
                value={nombreVisitante}
                onChangeText={setNombreVisitante}
                placeholder="Nombre completo"
                placeholderTextColor={cartasBosque.niebla}
              />

              <Text style={styles.label}>Tipo de documento</Text>
              <View style={styles.chipRow}>
                {DOC_TIPOS.map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.chip, docTipo === t && styles.chipActivo]}
                    onPress={() => setDocTipo(t)}
                  >
                    <Text style={[styles.chipText, docTipo === t && styles.chipTextoActivo]}>
                      {t}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Número de documento <Text style={styles.requerido}>*</Text></Text>
              <TextInput
                style={styles.input}
                value={docNumero}
                onChangeText={setDocNumero}
                placeholder="Número"
                placeholderTextColor={cartasBosque.niebla}
                keyboardType="default"
                autoCapitalize="characters"
              />

              <Text style={styles.label}>Motivo <Text style={styles.opcional}>(opcional)</Text></Text>
              <TextInput
                style={styles.input}
                value={motivo}
                onChangeText={setMotivo}
                placeholder="Visita familiar, trámite, etc."
                placeholderTextColor={cartasBosque.niebla}
              />

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <TouchableOpacity
                style={[styles.btnPrimario, enviando && { opacity: 0.6 }]}
                onPress={handleCheckin}
                disabled={enviando}
              >
                {enviando
                  ? <ActivityIndicator color={cartasBosque.bruma} />
                  : <Text style={styles.btnPrimarioText}>Registrar entrada</Text>
                }
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Vista lista ──────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.titulo}>Visitas</Text>
        <TouchableOpacity
          style={styles.btnNueva}
          onPress={() => setVista('checkin')}
        >
          <Ionicons name="add" size={18} color={cartasBosque.bruma} />
          <Text style={styles.btnNuevaText}>Check-in</Text>
        </TouchableOpacity>
      </View>

      {cargando ? (
        <View style={styles.center}>
          <ActivityIndicator color={cartasBosque.bosque} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Activas */}
          {activas.length > 0 && (
            <>
              <Text style={styles.seccionTitulo}>Activas ({activas.length})</Text>
              {activas.map(v => (
                <VisitaCard key={v.id} visita={v} modo="tenant" />
              ))}
            </>
          )}

          {/* Recientes 72h */}
          {recientes.length > 0 && (
            <>
              <Text style={styles.seccionTitulo}>Últimas 72 horas</Text>
              {recientes.map(v => (
                <VisitaCard key={v.id} visita={v} modo="tenant" />
              ))}
            </>
          )}

          {activas.length === 0 && recientes.length === 0 && (
            <View style={styles.vacio}>
              <Ionicons name="walk-outline" size={40} color={cartasBosque.niebla} />
              <Text style={styles.vacioText}>Sin visitas registradas</Text>
              <Text style={styles.vacioSub}>Usa el botón Check-in para registrar una visita</Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─── Estilos ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: cartasBosque.bruma,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
    paddingBottom: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: cartasBosque.pergaminoOscuro,
  },
  titulo: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 18,
    color: cartasBosque.tinta,
  },
  btnNueva: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: cartasBosque.bosque,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1] + 2,
  },
  btnNuevaText: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 13,
    color: cartasBosque.bruma,
  },
  scrollContent: {
    padding: spacing[4],
  },
  seccionTitulo: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 11,
    color: cartasBosque.helecho,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: spacing[2],
    marginTop: spacing[1],
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vacio: {
    alignItems: 'center',
    gap: spacing[2],
    marginTop: spacing[8],
  },
  vacioText: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 16,
    color: cartasBosque.tinta,
  },
  vacioSub: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: cartasBosque.helecho,
    textAlign: 'center',
  },
  // Form
  label: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 11,
    color: cartasBosque.helecho,
    letterSpacing: 0.5,
    marginBottom: spacing[1],
    marginTop: spacing[3],
  },
  opcional: {
    color: cartasBosque.niebla,
  },
  requerido: {
    color: cartasBosque.corteza,
  },
  input: {
    backgroundColor: cartasBosque.pergamino,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: cartasBosque.pergaminoOscuro,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2] + 2,
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    color: cartasBosque.tinta,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  chip: {
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: cartasBosque.pergaminoOscuro,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1] + 2,
    backgroundColor: cartasBosque.pergamino,
  },
  chipActivo: {
    backgroundColor: cartasBosque.bosque,
    borderColor: cartasBosque.bosque,
  },
  chipText: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 12,
    color: cartasBosque.tinta,
  },
  chipTextoActivo: {
    color: cartasBosque.bruma,
  },
  errorText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: cartasBosque.corteza,
    marginTop: spacing[2],
  },
  btnPrimario: {
    marginTop: spacing[4],
    backgroundColor: cartasBosque.bosque,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing[3],
    alignItems: 'center',
  },
  btnPrimarioText: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 14,
    color: cartasBosque.bruma,
  },
  btnSecundario: {
    marginTop: spacing[2],
    borderRadius: borderRadius.sm,
    paddingVertical: spacing[2] + 2,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: cartasBosque.pergaminoOscuro,
  },
  btnSecundarioText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: cartasBosque.tinta,
  },
  exitoBox: {
    alignItems: 'center',
    gap: spacing[3],
    paddingTop: spacing[8],
  },
  exitoTitulo: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 20,
    color: cartasBosque.tinta,
  },
  exitoSub: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    color: cartasBosque.helecho,
    textAlign: 'center',
  },
});
