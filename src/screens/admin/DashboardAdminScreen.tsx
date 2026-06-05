import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { getDocs } from 'firebase/firestore';
import { cartasBosque } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/spacing';
import { collections } from '@/services/firebase/firestore';
import { listenAlertasSeguridad } from '@/services/firebase/sesiones';
import type { Pago, Ticket, Inquilino, Visita, AlertaSeguridad, ScoreReputacion } from '@/types/firestore';

type AdminNav = BottomTabNavigationProp<{
  Dashboard: undefined; Pagos: undefined; Inquilinos: undefined;
  Tickets: undefined; Config: undefined;
}>;

interface Stats {
  pagosPendientes: number;
  pagosVencidos:   number;
  ticketsAbiertos: number;
  visitasActivas:  number;
  ocupadas:        number;
  totalHabs:       number;
}

const NIVEL_COLOR: Record<string, string> = {
  pesimo: '#960018', moroso: '#8A6A72', regular: cartasBosque.helecho,
  bueno:  cartasBosque.helecho, excelente: cartasBosque.bosque,
};

export default function DashboardAdminScreen() {
  const nav = useNavigation<AdminNav>();
  const [stats, setStats]     = useState<Stats | null>(null);
  const [scores, setScores]   = useState<ScoreReputacion[]>([]);
  const [alertas, setAlertas] = useState<AlertaSeguridad[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function cargar() {
      try {
        const [pagosSnap, tickSnap, visitasSnap, habSnap, scoresSnap] = await Promise.all([
          getDocs(collections.pagos),
          getDocs(collections.tickets),
          getDocs(collections.visitas),
          getDocs(collections.habitaciones),
          getDocs(collections.scores),
        ]);
        const pagos  = pagosSnap.docs.map(d => d.data() as Pago);
        const ticks  = tickSnap.docs.map(d => d.data() as Ticket);
        const visitas = visitasSnap.docs.map(d => d.data() as Visita);
        const habs   = habSnap.docs.map(d => d.data() as any);
        setScores(scoresSnap.docs.map(d => ({ ...d.data(), id: d.id } as ScoreReputacion)));
        setStats({
          pagosPendientes: pagos.filter(p => p.estado === 'pendiente' || p.estado === 'en_revision').length,
          pagosVencidos:   pagos.filter(p => p.estado === 'vencido').length,
          ticketsAbiertos: ticks.filter(t => t.estado !== 'resuelto').length,
          visitasActivas:  visitas.filter(v => !v.fechaSalida).length,
          ocupadas:        habs.filter((h: any) => h.estado === 'ocupada').length,
          totalHabs:       habs.filter((h: any) => h.habilitada).length,
        });
      } finally {
        setLoading(false);
      }
    }
    cargar();
    return listenAlertasSeguridad(list => setAlertas(list.filter(a => !a.adminVio)));
  }, []);

  if (loading || !stats) {
    return (
      <SafeAreaView style={s.safeArea} edges={['top']}>
        <ActivityIndicator color={cartasBosque.bosque} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  const ocupPct = stats.totalHabs > 0
    ? Math.round((stats.ocupadas / stats.totalHabs) * 100) : 0;

  const scoreNiveles: Record<string, number> = {};
  scores.forEach(sc => { scoreNiveles[sc.nivel] = (scoreNiveles[sc.nivel] ?? 0) + 1; });

  return (
    <SafeAreaView style={s.safeArea} edges={['top']}>
      <ScrollView style={s.root} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.eyebrow}>
              {new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
            <Text style={s.title}>Dashboard</Text>
          </View>
          <Ionicons name="grid" size={22} color={cartasBosque.bosque} />
        </View>

        {/* Alerta banner */}
        {alertas.length > 0 && (
          <TouchableOpacity style={s.alertaBanner} onPress={() => nav.navigate('Config')} activeOpacity={0.85}>
            <Ionicons name="shield-outline" size={15} color="#FFFFFF" />
            <Text style={s.alertaBannerText}>
              {alertas.length} alerta{alertas.length > 1 ? 's' : ''} de seguridad sin revisar
            </Text>
            <Ionicons name="chevron-forward" size={13} color="#FFFFFF" />
          </TouchableOpacity>
        )}

        {/* Métricas 2×2 */}
        <View style={s.metricsGrid}>
          <MetricCard
            label="Ocupación"
            value={`${ocupPct}%`}
            sub={`${stats.ocupadas} / ${stats.totalHabs} habs`}
            color={cartasBosque.bosque}
            icon="home"
          />
          <MetricCard
            label="Pagos pend."
            value={String(stats.pagosPendientes)}
            sub={stats.pagosVencidos > 0 ? `${stats.pagosVencidos} vencidos` : undefined}
            color={stats.pagosVencidos > 0 ? cartasBosque.alertaBorde : '#CDB29D'}
            icon="card"
          />
          <MetricCard
            label="Tickets"
            value={String(stats.ticketsAbiertos)}
            color="#4A5E48"
            icon="headset"
          />
          <MetricCard
            label="Visitas activas"
            value={String(stats.visitasActivas)}
            color={cartasBosque.helecho}
            icon="people"
          />
        </View>

        {/* Scores */}
        {scores.length > 0 && (
          <>
            <Text style={s.sectionTitle}>Reputación inquilinos</Text>
            <View style={s.scoresRow}>
              {(['excelente', 'bueno', 'regular', 'moroso', 'pesimo'] as const).map(nivel => {
                const count = scoreNiveles[nivel] ?? 0;
                if (count === 0) return null;
                return (
                  <View
                    key={nivel}
                    style={[s.scoreChip, {
                      backgroundColor: NIVEL_COLOR[nivel] + '18',
                      borderColor:     NIVEL_COLOR[nivel] + '55',
                    }]}
                  >
                    <Text style={[s.scoreChipNum, { color: NIVEL_COLOR[nivel] }]}>{count}</Text>
                    <Text style={[s.scoreChipLbl, { color: NIVEL_COLOR[nivel] }]}>{nivel}</Text>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* Accesos rápidos */}
        <Text style={s.sectionTitle}>Accesos rápidos</Text>
        <View style={s.quickGrid}>
          {ACCESOS.map(m => (
            <TouchableOpacity
              key={m.id}
              style={s.quickCard}
              onPress={() => nav.navigate(m.route as any)}
              activeOpacity={0.75}
            >
              <View style={[s.quickIcon, { backgroundColor: m.color + '18' }]}>
                <Ionicons name={m.icon as any} size={20} color={m.color} />
              </View>
              <Text style={s.quickLabel}>{m.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const ACCESOS = [
  { id: 'pagos',     label: 'Pagos',      icon: 'card',     color: cartasBosque.bosque,  route: 'Pagos' },
  { id: 'inq',       label: 'Inquilinos', icon: 'people',   color: cartasBosque.helecho,   route: 'Inquilinos' },
  { id: 'tickets',   label: 'Tickets',    icon: 'headset',  color: '#4A5E48',            route: 'Tickets' },
  { id: 'config',    label: 'Config',     icon: 'settings', color: cartasBosque.helecho, route: 'Config' },
];

function MetricCard({
  label, value, sub, color, icon,
}: { label: string; value: string; sub?: string; color: string; icon: string }) {
  return (
    <View style={s.metricCard}>
      <View style={[s.metricIcon, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon as any} size={18} color={color} />
      </View>
      <Text style={[s.metricValue, { color }]}>{value}</Text>
      <Text style={s.metricLabel}>{label}</Text>
      {sub ? <Text style={s.metricSub}>{sub}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: cartasBosque.bruma },
  root:     { flex: 1, backgroundColor: cartasBosque.bruma },
  content:  { padding: spacing[5], paddingBottom: spacing[10] },

  header:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: spacing[4] },
  eyebrow: { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.helecho, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 },
  title:   { fontFamily: 'Inter_700Bold', fontSize: 26, color: cartasBosque.tinta, letterSpacing: -0.3 },

  alertaBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: cartasBosque.alertaBorde, borderRadius: borderRadius.md,
    padding: spacing[3], marginBottom: spacing[4],
  },
  alertaBannerText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: '#FFFFFF', flex: 1 },

  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3], marginBottom: spacing[2] },
  metricCard:  {
    width: '47%', backgroundColor: cartasBosque.pergamino,
    borderRadius: borderRadius.lg, padding: spacing[4],
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    shadowColor: cartasBosque.tinta, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  metricIcon:  { width: 36, height: 36, borderRadius: borderRadius.sm, alignItems: 'center', justifyContent: 'center', marginBottom: spacing[2] },
  metricValue: { fontFamily: 'Inter_700Bold', fontSize: 24, letterSpacing: -0.5 },
  metricLabel: { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.helecho, letterSpacing: 0.5, marginTop: 2 },
  metricSub:   { fontFamily: 'SpaceMono_400Regular', fontSize: 9, color: cartasBosque.helecho, marginTop: 2 },

  sectionTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: cartasBosque.tinta, marginTop: spacing[5], marginBottom: spacing[3] },

  scoresRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  scoreChip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[1.5],
    paddingHorizontal: spacing[2.5], paddingVertical: spacing[1],
    borderRadius: borderRadius.full, borderWidth: 1,
  },
  scoreChipNum: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  scoreChipLbl: { fontFamily: 'SpaceMono_400Regular', fontSize: 10, textTransform: 'capitalize' },

  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  quickCard: {
    width: '47%', backgroundColor: cartasBosque.pergamino,
    borderRadius: borderRadius.lg, padding: spacing[4],
    alignItems: 'center', gap: spacing[2],
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
  },
  quickIcon:  { width: 42, height: 42, borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontFamily: 'Inter_500Medium', fontSize: 13, color: cartasBosque.tinta, textAlign: 'center' },
});
