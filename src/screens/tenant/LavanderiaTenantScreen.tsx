import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Timestamp } from 'firebase/firestore';
import { cartasBosque } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/spacing';
import { useAuth } from '@/hooks/useAuth';
import CalendarioReserva from '@/components/common/CalendarioReserva';
import {
  PRECIO_CARGA_EXTRA, IVA, CARGAS_INCLUIDAS_MES,
  getSlotsTomados, crearReserva, cancelarReserva,
  listenMisReservas, contarCargasMes, seedReservas,
} from '@/services/firebase/lavanderia';
import type { ReservaLavanderia, EstadoReserva } from '@/types/firestore';

// ─── Helpers ──────────────────────────────────────────────────

function formatFechaHora(ts: Timestamp): string {
  const d = ts.toDate();
  return d.toLocaleDateString('es-MX', {
    weekday: 'short', day: 'numeric', month: 'short',
  }) + ' · ' + d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

function estadoColor(estado: EstadoReserva): string {
  switch (estado) {
    case 'confirmada':    return cartasBosque.bosque;
    case 'pendiente':     return '#CDB29D';
    case 'pendiente_auth': return cartasBosque.corteza;
    case 'completada':    return cartasBosque.helecho;
    case 'cancelada':     return cartasBosque.niebla;
  }
}

function estadoLabel(estado: EstadoReserva): string {
  switch (estado) {
    case 'confirmada':    return 'confirmada';
    case 'pendiente':     return 'pendiente';
    case 'pendiente_auth': return 'auth. requerida';
    case 'completada':    return 'completada';
    case 'cancelada':     return 'cancelada';
  }
}

// ─── Componente ───────────────────────────────────────────────

export default function LavanderiaTenantScreen() {
  const { user } = useAuth();
  const [reservas, setReservas] = useState<ReservaLavanderia[]>([]);
  const [cargando, setCargando] = useState(true);
  const [seeded, setSeeded] = useState(false);

  const [slotsTomados, setSlotsTomados] = useState<Date[]>([]);
  const [slotSelec, setSlotSelec] = useState<Date | null>(null);
  const [cargasMes, setCargasMes] = useState(0);
  const [enviando, setEnviando] = useState(false);

  const ahora = new Date();
  const mesActual = ahora.getMonth() + 1;
  const anioActual = ahora.getFullYear();

  // Cargar slots del día seleccionado cuando cambia el slot
  useEffect(() => {
    if (!slotSelec) return;
    getSlotsTomados(slotSelec).then(setSlotsTomados).catch(() => {});
  }, [slotSelec?.toDateString()]);

  // Escuchar reservas del inquilino
  useEffect(() => {
    if (!user) return;
    if (__DEV__ && !seeded) {
      seedReservas().catch(() => {}).finally(() => setSeeded(true));
    }
    return listenMisReservas(user.uid, data => {
      setReservas(data);
      setCargando(false);
    });
  }, [user]);

  // Contar cargas del mes
  useEffect(() => {
    if (!user) return;
    contarCargasMes(user.uid, mesActual, anioActual).then(setCargasMes).catch(() => {});
  }, [user, reservas.length]);

  const proximas = reservas.filter(
    r => r.estado !== 'cancelada' && r.estado !== 'completada',
  );
  const historial = reservas
    .filter(r => r.estado === 'completada')
    .slice(0, 5);

  const esCargaExtra = cargasMes >= CARGAS_INCLUIDAS_MES;
  const montoExtra = Math.round(PRECIO_CARGA_EXTRA * (1 + IVA));

  async function handleConfirmar() {
    if (!slotSelec || !user) return;
    const habitacionId = reservas[0]?.habitacionId ?? '';
    setEnviando(true);
    try {
      const result = await crearReserva({
        inquilinoId: user.uid,
        habitacionId,
        fechaReserva: slotSelec,
      });
      setSlotSelec(null);
      if (result.esCargaExtra) {
        Alert.alert(
          'Carga extra',
          `Esta es una carga extra. Se generó un cargo de $${montoExtra} MXN (IVA incluido).`,
        );
      }
      if (result.estado === 'pendiente_auth') {
        Alert.alert(
          'Autorización requerida',
          'Tu reserva está pendiente de autorización por parte del administrador debido a un adeudo registrado.',
        );
      }
    } catch (e: any) {
      Alert.alert('No disponible', e.message ?? 'Intenta de nuevo');
    } finally {
      setEnviando(false);
    }
  }

  async function handleCancelar(id: string) {
    Alert.alert('Cancelar reserva', '¿Deseas cancelar esta reserva?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Cancelar reserva', style: 'destructive',
        onPress: () => cancelarReserva(id).catch(() => {}),
      },
    ]);
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {/* Contador mes */}
      <View style={styles.contadorCard}>
        <View style={styles.contadorLeft}>
          <Text style={styles.contadorNum}>{Math.min(cargasMes, CARGAS_INCLUIDAS_MES)}</Text>
          <Text style={styles.contadorDe}>/ {CARGAS_INCLUIDAS_MES}</Text>
          <Text style={styles.contadorLabel}> cargas incluidas este mes</Text>
        </View>
        {esCargaExtra && (
          <View style={styles.extraBadge}>
            <Text style={styles.extraBadgeText}>+${montoExtra} extra</Text>
          </View>
        )}
      </View>

      {/* Calendario */}
      <Text style={styles.seccionTitulo}>Nueva reserva</Text>
      <CalendarioReserva
        slotsTomados={slotsTomados}
        seleccionado={slotSelec}
        onSeleccionar={setSlotSelec}
      />

      {slotSelec && (
        <TouchableOpacity
          style={[styles.btnConfirmar, enviando && { opacity: 0.6 }]}
          onPress={handleConfirmar}
          disabled={enviando}
        >
          {enviando
            ? <ActivityIndicator color={cartasBosque.bruma} />
            : (
              <Text style={styles.btnConfirmarText}>
                Confirmar {slotSelec.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                {esCargaExtra ? `  ·  $${montoExtra}` : '  ·  incluida'}
              </Text>
            )
          }
        </TouchableOpacity>
      )}

      {/* Próximas reservas */}
      {proximas.length > 0 && (
        <>
          <Text style={styles.seccionTitulo}>Próximas</Text>
          {proximas.map(r => (
            <View key={r.id} style={styles.reservaCard}>
              <View style={styles.reservaRow}>
                <Text style={styles.reservaFecha}>{formatFechaHora(r.fechaReserva)}</Text>
                <View style={[styles.estadoBadge, { backgroundColor: estadoColor(r.estado) }]}>
                  <Text style={styles.estadoLabel}>{estadoLabel(r.estado)}</Text>
                </View>
              </View>
              {r.esCargaExtra && (
                <Text style={styles.reservaExtra}>Carga extra · ${r.monto} MXN</Text>
              )}
              {r.estado === 'pendiente' && (
                <TouchableOpacity
                  style={styles.btnCancelar}
                  onPress={() => handleCancelar(r.id)}
                >
                  <Text style={styles.btnCancelarText}>Cancelar</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </>
      )}

      {/* Historial */}
      {historial.length > 0 && (
        <>
          <Text style={styles.seccionTitulo}>Últimas lavadas</Text>
          {historial.map(r => (
            <View key={r.id} style={[styles.reservaCard, styles.historialCard]}>
              <Text style={styles.reservaFecha}>{formatFechaHora(r.fechaReserva)}</Text>
              {r.esCargaExtra && (
                <Text style={styles.reservaExtra}>Carga extra · ${r.monto} MXN</Text>
              )}
            </View>
          ))}
        </>
      )}

      {cargando && (
        <ActivityIndicator color={cartasBosque.bosque} style={{ marginTop: spacing[4] }} />
      )}
    </ScrollView>
  );
}

// ─── Estilos ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: cartasBosque.bruma },
  content: { padding: spacing[4], paddingBottom: spacing[8] },
  contadorCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: cartasBosque.pergamino, borderRadius: borderRadius.md,
    padding: spacing[3], marginBottom: spacing[4],
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
  },
  contadorLeft: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  contadorNum: { fontFamily: 'Inter_600SemiBold', fontSize: 28, color: cartasBosque.bosque },
  contadorDe: { fontFamily: 'Inter_400Regular', fontSize: 18, color: cartasBosque.helecho },
  contadorLabel: { fontFamily: 'Inter_400Regular', fontSize: 12, color: cartasBosque.helecho },
  extraBadge: {
    backgroundColor: cartasBosque.corteza, borderRadius: borderRadius.sm,
    paddingHorizontal: spacing[2], paddingVertical: 3,
  },
  extraBadgeText: { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.bruma },
  seccionTitulo: {
    fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.helecho,
    letterSpacing: 0.6, marginBottom: spacing[2], marginTop: spacing[4],
    textTransform: 'uppercase',
  },
  btnConfirmar: {
    marginTop: spacing[3], backgroundColor: cartasBosque.bosque,
    borderRadius: borderRadius.sm, paddingVertical: spacing[3], alignItems: 'center',
  },
  btnConfirmarText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: cartasBosque.bruma },
  reservaCard: {
    backgroundColor: cartasBosque.pergamino, borderRadius: borderRadius.md,
    padding: spacing[3], marginBottom: spacing[2],
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
  },
  historialCard: { opacity: 0.75 },
  reservaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reservaFecha: { fontFamily: 'Inter_400Regular', fontSize: 13, color: cartasBosque.tinta },
  reservaExtra: {
    fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.corteza,
    marginTop: 3,
  },
  estadoBadge: { borderRadius: borderRadius.sm, paddingHorizontal: spacing[2], paddingVertical: 2 },
  estadoLabel: { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.bruma },
  btnCancelar: { marginTop: spacing[2], alignSelf: 'flex-start' },
  btnCancelarText: {
    fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.corteza,
    textDecorationLine: 'underline',
  },
});
