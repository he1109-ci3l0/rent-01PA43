import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, ActivityIndicator,
} from 'react-native';
import { cartasBosque } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/spacing';
import type { Visita } from '@/types/firestore';
import { listenTodasVisitasActivas, seedVisitas, HORAS_ESTACIONARIA } from '@/services/firebase/visitas';
import { calcularHorasActiva } from '@/services/firebase/visitas';
import VisitaCard from '@/components/common/VisitaCard';

// ─── Componente ───────────────────────────────────────────────

export default function VisitasAdminScreen() {
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [cargando, setCargando] = useState(true);
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (__DEV__ && !seeded) {
      seedVisitas().catch(() => {}).finally(() => setSeeded(true));
    }
    const unsub = listenTodasVisitasActivas(data => {
      setVisitas(data);
      setCargando(false);
    });
    return unsub;
  }, []);

  const enAlerta = visitas.filter(v => {
    const h = calcularHorasActiva(v.fechaEntrada);
    return h >= HORAS_ESTACIONARIA.ALERTA_1;
  });

  const cargoPendiente = visitas.filter(v => {
    const h = calcularHorasActiva(v.fechaEntrada);
    return h >= HORAS_ESTACIONARIA.CARGO;
  });

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.titulo}>Visitas activas</Text>
        {__DEV__ && (
          <TouchableOpacity
            style={styles.seedBtn}
            onPress={() => { setSeeded(false); seedVisitas().catch(() => {}); }}
          >
            <Text style={styles.seedBtnText}>seed</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <StatCard label="Total" valor={visitas.length} color="#3B82F6" />
        <StatCard label="En alerta" valor={enAlerta.length} color="#E8A838" />
        <StatCard label="Cargo 72h" valor={cargoPendiente.length} color="#C0392B" />
      </View>

      {cargando ? (
        <View style={styles.center}>
          <ActivityIndicator color={cartasBosque.bosque} />
        </View>
      ) : visitas.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.vacioText}>Sin visitas activas</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {visitas.map(v => (
            <VisitaCard key={v.id} visita={v} modo="admin" />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function StatCard({ label, valor, color }: { label: string; valor: number; color: string }) {
  return (
    <View style={[styles.statCard, { borderTopColor: color }]}>
      <Text style={[styles.statValor, { color }]}>{valor}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
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
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
    color: cartasBosque.tinta,
  },
  seedBtn: {
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: cartasBosque.niebla,
    paddingHorizontal: spacing[2],
    paddingVertical: 3,
  },
  seedBtnText: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 10,
    color: cartasBosque.helecho,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    gap: spacing[3],
  },
  statCard: {
    flex: 1,
    backgroundColor: cartasBosque.pergamino,
    borderRadius: borderRadius.sm,
    padding: spacing[3],
    alignItems: 'center',
    borderTopWidth: 3,
    borderWidth: 1,
    borderColor: cartasBosque.pergaminoOscuro,
  },
  statValor: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 22,
  },
  statLabel: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 10,
    color: cartasBosque.helecho,
    marginTop: 2,
  },
  scrollContent: {
    padding: spacing[4],
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vacioText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: cartasBosque.helecho,
  },
});
