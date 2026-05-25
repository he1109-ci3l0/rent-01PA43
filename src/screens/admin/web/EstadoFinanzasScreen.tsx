import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getDocs, query, where } from 'firebase/firestore';
import { Timestamp } from 'firebase/firestore';
import { collections } from '@/services/firebase/firestore';
import { spacing, borderRadius } from '@/constants/spacing';
import type { Pago, Habitacion, Ticket, CategoriaTicket } from '@/types/firestore';

// ─── Helpers ──────────────────────────────────────────────────

function inicioMesActual(): Timestamp {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return Timestamp.fromDate(d);
}

function finMesActual(): Timestamp {
  const d = new Date();
  d.setMonth(d.getMonth() + 1, 1);
  d.setHours(0, 0, 0, 0);
  return Timestamp.fromDate(d);
}

function formatPesos(n: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency', currency: 'MXN', maximumFractionDigits: 0,
  }).format(n);
}

function exportarCSV(pagos: Pago[]): void {
  const header = 'Inquilino,Habitacion,Concepto,Monto,FechaPago,Estado';
  const rows = pagos.map(p =>
    [
      p.inquilinoNombre ?? '',
      p.habitacionNumero ?? '',
      p.concepto,
      p.montoPagado,
      p.fechaPago ? p.fechaPago.toDate().toLocaleDateString('es-MX') : '',
      p.estado,
    ].join(',')
  );
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ingresos_${new Date().toISOString().slice(0, 7)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── MetricCard ───────────────────────────────────────────────

function MetricCard({
  label, value, color, icon,
}: { label: string; value: string; color: string; icon: string }) {
  return (
    <View style={[mc.card, { borderTopColor: color }]}>
      <Ionicons name={icon as any} size={18} color={color} />
      <Text style={[mc.value, { color }]}>{value}</Text>
      <Text style={mc.label}>{label}</Text>
    </View>
  );
}

const mc = StyleSheet.create({
  card: {
    flex: 1, minWidth: 160,
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    borderTopWidth: 3,
    padding: spacing[4],
    gap: spacing[1],
  },
  value: { fontFamily: 'SpaceMono_400Regular', fontSize: 22, marginTop: spacing[1] },
  label: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#4A5E48' },
});

// ─── Constants ────────────────────────────────────────────────

const CATEGORIA_LABELS: Record<CategoriaTicket, string> = {
  internet:          'Internet',
  pago:              'Pago',
  reporte_limpieza:  'Limpieza',
  reporte_inquilino: 'Inquilino',
  lavadora:          'Lavadora',
  almacenamiento:    'Almacén',
  mantenimiento:     'Mantenimiento',
};

// ─── Screen ───────────────────────────────────────────────────

export default function EstadoFinanzasScreen() {
  const [pagosMes, setPagosMes]       = useState<Pago[]>([]);
  const [habitaciones, setHabitaciones] = useState<Habitacion[]>([]);
  const [tickets, setTickets]         = useState<Ticket[]>([]);
  const [cargando, setCargando]       = useState(true);

  useEffect(() => {
    const ini = inicioMesActual();
    const fin = finMesActual();

    Promise.all([
      getDocs(query(
        collections.pagos,
        where('estado', '==', 'pagado'),
        where('fechaPago', '>=', ini),
        where('fechaPago', '<', fin),
      )),
      getDocs(collections.habitaciones),
      getDocs(collections.tickets),
    ]).then(([snapPagos, snapHabs, snapTickets]) => {
      setPagosMes(snapPagos.docs.map(d => ({ ...d.data(), id: d.id } as Pago)));
      setHabitaciones(snapHabs.docs.map(d => ({ ...d.data(), id: d.id } as Habitacion)));
      setTickets(snapTickets.docs.map(d => ({ ...d.data(), id: d.id } as Ticket)));
      setCargando(false);
    });
  }, []);

  // ── Derived metrics ───────────────────────────────────────────
  const totalIngresos = pagosMes.reduce((s, p) => s + (p.montoPagado ?? 0), 0);

  const habsHabilitadas = habitaciones.filter(h => h.habilitada);
  const habsOcupadas    = habsHabilitadas.filter(h => h.estado === 'ocupada');
  const pctOcupacion    = habsHabilitadas.length > 0
    ? Math.round((habsOcupadas.length / habsHabilitadas.length) * 100)
    : 0;

  const ticketsAbiertos = tickets.filter(t => t.estado !== 'resuelto');

  const pagosConFecha = pagosMes.filter(p => p.fechaPago && p.fechaVencimiento);
  const pagosATiempo  = pagosConFecha.filter(
    p => p.fechaPago!.toMillis() <= p.fechaVencimiento.toMillis()
  );
  const pctATiempo = pagosConFecha.length > 0
    ? Math.round((pagosATiempo.length / pagosConFecha.length) * 100)
    : 0;

  const diasPago = pagosConFecha
    .map(p => (p.fechaPago!.toMillis() - p.creadoEn.toMillis()) / (1000 * 60 * 60 * 24))
    .filter(d => d >= 0);
  const promDias = diasPago.length > 0
    ? Math.round(diasPago.reduce((s, d) => s + d, 0) / diasPago.length)
    : 0;

  const ticketsPorCat = tickets.reduce<Record<string, number>>((acc, t) => {
    acc[t.categoria] = (acc[t.categoria] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.container}>

      {/* Header */}
      <View style={s.headerRow}>
        <View>
          <Text style={s.titulo}>Estado financiero</Text>
          <Text style={s.subtitulo}>
            {new Date().toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
          </Text>
        </View>
        <TouchableOpacity
          style={s.exportBtn}
          onPress={() => exportarCSV(pagosMes)}
          activeOpacity={0.75}
        >
          <Ionicons name="download-outline" size={14} color="#FFFFFF" />
          <Text style={s.exportBtnText}>Exportar CSV</Text>
        </TouchableOpacity>
      </View>

      {/* MetricCards */}
      <View style={s.cardsRow}>
        <MetricCard
          label="Ingresos del mes"
          value={cargando ? '—' : formatPesos(totalIngresos)}
          color="#4A9B6F"
          icon="trending-up-outline"
        />
        <MetricCard
          label="Ocupación"
          value={cargando ? '—' : `${pctOcupacion}%`}
          color="#3B82F6"
          icon="home-outline"
        />
        <MetricCard
          label="Habitaciones ocupadas"
          value={cargando ? '—' : `${habsOcupadas.length} / ${habsHabilitadas.length}`}
          color="#E05C2A"
          icon="stats-chart-outline"
        />
        <MetricCard
          label="Tickets abiertos"
          value={cargando ? '—' : String(ticketsAbiertos.length)}
          color="#E8A838"
          icon="headset-outline"
        />
      </View>

      {/* Pagos del mes */}
      <View style={s.seccion}>
        <Text style={s.seccionTitulo}>PAGOS DEL MES</Text>
        {cargando ? (
          <Text style={s.vacioText}>Cargando…</Text>
        ) : pagosMes.length === 0 ? (
          <Text style={s.vacioText}>Sin pagos registrados este mes.</Text>
        ) : (
          pagosMes.map(p => (
            <View key={p.id} style={s.pagoRow}>
              <View style={s.pagoLeft}>
                <Text style={s.pagoNombre}>{p.inquilinoNombre ?? '—'}</Text>
                <Text style={s.pagoSub}>Hab. {p.habitacionNumero ?? '—'} · {p.concepto}</Text>
              </View>
              <Text style={s.pagoMonto}>{formatPesos(p.montoPagado)}</Text>
            </View>
          ))
        )}
      </View>

      {/* Métricas */}
      <View style={s.seccion}>
        <Text style={s.seccionTitulo}>MÉTRICAS</Text>
        <View style={s.metricaGrid}>
          <View style={s.metricaCard}>
            <Text style={[s.metricaVal, { color: '#4A9B6F' }]}>{pctATiempo}%</Text>
            <Text style={s.metricaLabel}>Pago a tiempo</Text>
          </View>
          <View style={s.metricaCard}>
            <Text style={[s.metricaVal, { color: '#3B82F6' }]}>{promDias}d</Text>
            <Text style={s.metricaLabel}>Días prom. pago</Text>
          </View>
          <View style={s.metricaCard}>
            <Text style={[s.metricaVal, { color: '#E05C2A' }]}>{pagosMes.length}</Text>
            <Text style={s.metricaLabel}>Pagos este mes</Text>
          </View>
        </View>
      </View>

      {/* Tickets por área */}
      <View style={s.seccion}>
        <Text style={s.seccionTitulo}>TICKETS POR ÁREA</Text>
        {Object.keys(ticketsPorCat).length === 0 ? (
          <Text style={s.vacioText}>Sin tickets registrados.</Text>
        ) : (
          <View style={s.catGrid}>
            {(Object.keys(ticketsPorCat) as CategoriaTicket[]).map(cat => (
              <View key={cat} style={s.catCard}>
                <Text style={[s.catVal, { color: '#E8A838' }]}>{ticketsPorCat[cat]}</Text>
                <Text style={s.catLabel}>{CATEGORIA_LABELS[cat] ?? cat}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

    </ScrollView>
  );
}

// ─── Estilos ──────────────────────────────────────────────────

const s = StyleSheet.create({
  scroll:     { flex: 1, backgroundColor: '#F5F2EC' },
  container:  { padding: spacing[5], gap: spacing[5] },

  headerRow: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
  },
  titulo: { fontFamily: 'Inter_700Bold', fontSize: 22, color: '#122A1F' },
  subtitulo: {
    fontFamily: 'SpaceMono_400Regular', fontSize: 11, color: '#8A9E80',
    textTransform: 'capitalize', marginTop: spacing[1],
  },

  exportBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[1] + 2,
    backgroundColor: '#2E3C2C',
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    borderRadius: borderRadius.md,
  },
  exportBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#FFFFFF' },

  cardsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },

  seccion: {
    backgroundColor: '#FFFFFF', borderRadius: borderRadius.lg,
    padding: spacing[4], gap: spacing[3],
  },
  seccionTitulo: {
    fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: '#8A9E80', letterSpacing: 1,
  },
  vacioText: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#8A9E80' },

  pagoRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacing[2],
    borderBottomWidth: 1, borderBottomColor: '#F5F2EC',
  },
  pagoLeft:   { gap: 2 },
  pagoNombre: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#122A1F' },
  pagoSub:    { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: '#8A9E80' },
  pagoMonto:  { fontFamily: 'SpaceMono_400Regular', fontSize: 14, color: '#4A9B6F' },

  metricaGrid: { flexDirection: 'row', gap: spacing[3] },
  metricaCard: {
    flex: 1, backgroundColor: '#F5F2EC',
    borderRadius: borderRadius.md, padding: spacing[3], alignItems: 'center', gap: 4,
  },
  metricaVal:   { fontFamily: 'SpaceMono_400Regular', fontSize: 20 },
  metricaLabel: {
    fontFamily: 'Inter_400Regular', fontSize: 11, color: '#4A5E48', textAlign: 'center',
  },

  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  catCard: {
    backgroundColor: '#F5F2EC', borderRadius: borderRadius.md,
    padding: spacing[3], alignItems: 'center', minWidth: 100, gap: 4,
  },
  catVal:   { fontFamily: 'SpaceMono_400Regular', fontSize: 18 },
  catLabel: {
    fontFamily: 'Inter_400Regular', fontSize: 11, color: '#4A5E48', textAlign: 'center',
  },
});
