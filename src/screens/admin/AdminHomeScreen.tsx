import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getDocs } from 'firebase/firestore';
import { cartasBosque } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/spacing';
import { collections } from '@/services/firebase/firestore';
import { listenAlertasSeguridad } from '@/services/firebase/sesiones';
import type { Pago, Ticket, Visita, AlertaSeguridad, ScoreReputacion, Inquilino } from '@/types/firestore';

interface Stats {
  pagosPendientes: number;
  pagosVencidos:   number;
  ticketsAbiertos: number;
  visitasActivas:  number;
  ocupadas:        number;
  totalHabs:       number;
  proximosSalir:   number;
}

const NIVEL_COLOR: Record<string, string> = {
  pesimo:    '#960018',
  moroso:    '#8A6A72',
  regular:   cartasBosque.helecho,
  bueno:     cartasBosque.bosque,
  excelente: '#4A9B6F',
};

export default function AdminHomeScreen() {
  const [stats, setStats]     = useState<Stats | null>(null);
  const [scores, setScores]   = useState<ScoreReputacion[]>([]);
  const [alertas, setAlertas] = useState<AlertaSeguridad[]>([]);
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function cargar() {
      try {
        const [pagosSnap, tickSnap, visitasSnap, habSnap, scoresSnap, inqSnap] =
          await Promise.all([
            getDocs(collections.pagos),
            getDocs(collections.tickets),
            getDocs(collections.visitas),
            getDocs(collections.habitaciones),
            getDocs(collections.scores),
            getDocs(collections.inquilinos),
          ]);

        const pagos   = pagosSnap.docs.map(d => d.data() as Pago);
        const ticks   = tickSnap.docs.map(d => d.data() as Ticket);
        const vis     = visitasSnap.docs.map(d => ({ ...d.data(), id: d.id } as Visita));
        const habs    = habSnap.docs.map(d => d.data() as any);
        const inqs    = inqSnap.docs.map(d => d.data() as Inquilino);

        setScores(scoresSnap.docs.map(d => ({ ...d.data(), id: d.id } as ScoreReputacion)));
        setVisitas(vis.filter(v => !v.fechaSalida).slice(0, 5));

        const ahora = Date.now();
        const en7dias = ahora + 7 * 24 * 60 * 60 * 1000;

        setStats({
          pagosPendientes: pagos.filter(p => p.estado === 'pendiente' || p.estado === 'en_revision').length,
          pagosVencidos:   pagos.filter(p => p.estado === 'vencido').length,
          ticketsAbiertos: ticks.filter(t => t.estado !== 'resuelto').length,
          visitasActivas:  vis.filter(v => !v.fechaSalida).length,
          ocupadas:        habs.filter((h: any) => h.estado === 'ocupada').length,
          totalHabs:       habs.filter((h: any) => h.habilitada).length,
          proximosSalir:   inqs.filter(i =>
            i.fechaSalida && i.fechaSalida.toMillis() <= en7dias
          ).length,
        });
      } finally {
        setLoading(false);
      }
    }

    cargar();
    return listenAlertasSeguridad(list =>
      setAlertas(list.filter(a => !a.adminVio))
    );
  }, []);

  if (loading || !stats) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <ActivityIndicator color={cartasBosque.bosque} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  const ocupPct = stats.totalHabs > 0
    ? Math.round((stats.ocupadas / stats.totalHabs) * 100) : 0;

  const scoreNiveles: Record<string, number> = {};
  scores.forEach(sc => {
    scoreNiveles[sc.nivel] = (scoreNiveles[sc.nivel] ?? 0) + 1;
  });

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.eyebrow}>
              {new Date().toLocaleDateString('es-MX', {
                weekday: 'long', day: 'numeric', month: 'long',
              })}
            </Text>
            <Text style={s.title}>Antioquia 43</Text>
          </View>
          <Ionicons name="home" size={22} color={cartasBosque.bosque} />
        </View>

        {/* Alerta seguridad */}
        {alertas.length > 0 && (
          <View style={s.alertaBanner}>
            <Ionicons name="shield-outline" size={14} color={cartasBosque.bruma} />
            <Text style={s.alertaText}>
              {alertas.length} alerta{alertas.length > 1 ? 's' : ''} de seguridad sin revisar
            </Text>
          </View>
        )}

        {/* Métricas 2x2 */}
        <View style={s.grid}>
          <MetricCard
            label="Ocupación"
            value={`${ocupPct}%`}
            sub={`${stats.ocupadas}/${stats.totalHabs} habs`}
            color={cartasBosque.bosque}
            icon="home"
          />
          <MetricCard
            label="Pagos pend."
            value={String(stats.pagosPendientes)}
            sub={stats.pagosVencidos > 0 ? `${stats.pagosVencidos} vencidos` : undefined}
            color={stats.pagosVencidos > 0 ? '#C0392B' : '#CDB29D'}
            icon="card"
          />
          <MetricCard
            label="Tickets"
            value={String(stats.ticketsAbiertos)}
            color={cartasBosque.helecho}
            icon="headset"
          />
          <MetricCard
            label="Visitas activas"
            value={String(stats.visitasActivas)}
            color={cartasBosque.bosque}
            icon="people"
          />
        </View>

        {/* Próximos a salir */}
        {stats.proximosSalir > 0 && (
          <View style={s.proximosBanner}>
            <Ionicons name="exit-outline" size={14} color="#E8A838" />
            <Text style={s.proximosText}>
              {stats.proximosSalir} inquilino{stats.proximosSalir > 1 ? 's' : ''} próximo{stats.proximosSalir > 1 ? 's' : ''} a salir en 7 días
            </Text>
          </View>
        )}

        {/* Score inquilinos */}
        {scores.length > 0 && (
          <>
            <Text style={s.seccionTitulo}>Reputación</Text>
            <View style={s.scoresRow}>
              {(['excelente', 'bueno', 'regular', 'moroso', 'pesimo'] as const).map(nivel => {
                const count = scoreNiveles[nivel] ?? 0;
                if (count === 0) return null;
                return (
                  <View key={nivel} style={[s.scoreChip, {
                    backgroundColor: NIVEL_COLOR[nivel] + '18',
                    borderColor: NIVEL_COLOR[nivel] + '55',
                  }]}>
                    <Text style={[s.scoreNum, { color: NIVEL_COLOR[nivel] }]}>{count}</Text>
                    <Text style={[s.scoreLbl, { color: NIVEL_COLOR[nivel] }]}>{nivel}</Text>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* Visitas activas recientes */}
        {visitas.length > 0 && (
          <>
            <Text style={s.seccionTitulo}>Visitas activas</Text>
            {visitas.map(v => (
              <View key={v.id} style={s.visitaRow}>
                <Ionicons name="walk-outline" size={14} color={cartasBosque.helecho} />
                <Text style={s.visitaNombre} numberOfLines={1}>
                  {v.nombreVisitante ?? v.documentoNumero}
                </Text>
                <Text style={s.visitaHab}>Hab. {v.habitacionNumero ?? '—'}</Text>
              </View>
            ))}
          </>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── MetricCard ───────────────────────────────────────────────

function MetricCard({ label, value, sub, color, icon }: {
  label: string; value: string; sub?: string; color: string; icon: string;
}) {
  return (
    <View style={s.metricCard}>
      <View style={[s.metricIcon, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon as any} size={16} color={color} />
      </View>
      <Text style={[s.metricValue, { color }]}>{value}</Text>
      <Text style={s.metricLabel}>{label}</Text>
      {sub ? <Text style={s.metricSub}>{sub}</Text> : null}
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: cartasBosque.bruma },
  scroll:  { flex: 1 },
  content: { padding: spacing[4], paddingBottom: spacing[8] },

  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-end', marginBottom: spacing[4],
  },
  eyebrow: {
    fontFamily: 'SpaceMono_400Regular', fontSize: 10,
    color: cartasBosque.helecho, letterSpacing: 1,
    textTransform: 'uppercase', marginBottom: 2,
  },
  title: {
    fontFamily: 'Inter_700Bold', fontSize: 24,
    color: cartasBosque.tinta, letterSpacing: -0.3,
  },

  alertaBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: cartasBosque.alertaFondo,
    borderRadius: borderRadius.md, padding: spacing[3],
    marginBottom: spacing[3],
  },
  alertaText: {
    fontFamily: 'Inter_500Medium', fontSize: 12,
    color: cartasBosque.bruma, flex: 1,
  },

  proximosBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: 'rgba(232,168,56,0.12)',
    borderRadius: borderRadius.md, padding: spacing[3],
    marginBottom: spacing[3],
    borderWidth: 1, borderColor: 'rgba(232,168,56,0.3)',
  },
  proximosText: {
    fontFamily: 'Inter_400Regular', fontSize: 12,
    color: '#E8A838', flex: 1,
  },

  grid: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: spacing[3], marginBottom: spacing[3],
  },
  metricCard: {
    width: '47%', backgroundColor: cartasBosque.pergamino,
    borderRadius: borderRadius.lg, padding: spacing[3],
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
  },
  metricIcon: {
    width: 32, height: 32, borderRadius: borderRadius.sm,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing[2],
  },
  metricValue: {
    fontFamily: 'Inter_700Bold', fontSize: 22, letterSpacing: -0.5,
  },
  metricLabel: {
    fontFamily: 'SpaceMono_400Regular', fontSize: 9,
    color: cartasBosque.helecho, letterSpacing: 0.5, marginTop: 2,
  },
  metricSub: {
    fontFamily: 'SpaceMono_400Regular', fontSize: 9,
    color: cartasBosque.acento, marginTop: 2,
  },

  seccionTitulo: {
    fontFamily: 'Inter_600SemiBold', fontSize: 13,
    color: cartasBosque.tinta, marginBottom: spacing[2], marginTop: spacing[3],
  },

  scoresRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2],
    marginBottom: spacing[2],
  },
  scoreChip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[1],
    paddingHorizontal: spacing[2], paddingVertical: spacing[1],
    borderRadius: borderRadius.full, borderWidth: 1,
  },
  scoreNum: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  scoreLbl: {
    fontFamily: 'SpaceMono_400Regular', fontSize: 9,
    textTransform: 'capitalize',
  },

  visitaRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: cartasBosque.pergamino,
    borderRadius: borderRadius.sm, padding: spacing[2] + 2,
    marginBottom: spacing[1],
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
  },
  visitaNombre: {
    fontFamily: 'Inter_400Regular', fontSize: 12,
    color: cartasBosque.tinta, flex: 1,
  },
  visitaHab: {
    fontFamily: 'SpaceMono_400Regular', fontSize: 10,
    color: cartasBosque.helecho,
  },
});
