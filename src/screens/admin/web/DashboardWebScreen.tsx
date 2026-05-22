import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getDocs, query, where, onSnapshot } from 'firebase/firestore';
import { collections } from '@/services/firebase/firestore';
import { listenAlertasSeguridad } from '@/services/firebase/sesiones';
import { cartasBosque } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/spacing';
import type { Habitacion, Pago, Ticket, ScoreReputacion, Inquilino, AlertaSeguridad } from '@/types/firestore';

// ─── CSV export (web only) ────────────────────────────────────

function exportarCSV(nombre: string, filas: string[][]) {
  if (typeof document === 'undefined') return;
  const csv = '﻿' + filas
    .map(f => f.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${nombre}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Helpers ──────────────────────────────────────────────────

const MES_LABELS = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

function inicioMesActual(): Date {
  const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d;
}

function agruparPorMes(pagos: Pago[]): { mes: string; total: number }[] {
  const ahora = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(ahora.getFullYear(), ahora.getMonth() - (5 - i), 1);
    const total = pagos
      .filter(p => {
        if (p.estado !== 'pagado' || !p.fechaPago) return false;
        const fp = (p.fechaPago as any).toDate();
        return fp.getFullYear() === d.getFullYear() && fp.getMonth() === d.getMonth();
      })
      .reduce((s, p) => s + p.montoPagado, 0);
    return { mes: MES_LABELS[d.getMonth()], total };
  });
}

// ─── Sub-components ───────────────────────────────────────────

const ESTADO_HAB_COLOR: Record<string, string> = {
  disponible:    '#4A5E48',
  ocupada:       cartasBosque.bosque,
  mantenimiento: '#8A6A72',
  reservada:     cartasBosque.musgo,
};

const NIVEL_COLOR: Record<string, string> = {
  pesimo: '#960018', moroso: '#8A6A72', regular: cartasBosque.helecho,
  bueno:  cartasBosque.musgo, excelente: cartasBosque.bosque,
};

const NIVEL_LABEL: Record<string, string> = {
  pesimo: 'Pésimo', moroso: 'Moroso', regular: 'Regular',
  bueno: 'Bueno',   excelente: 'Excelente',
};

function MetricCard({
  title, value, sub, color, icon,
}: { title: string; value: string; sub?: string; color: string; icon: string }) {
  return (
    <View style={mc.card}>
      <View style={[mc.iconBox, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon as any} size={22} color={color} />
      </View>
      <Text style={mc.value}>{value}</Text>
      <Text style={mc.title}>{title}</Text>
      {sub ? <Text style={mc.sub}>{sub}</Text> : null}
    </View>
  );
}

function BarChart({ data }: { data: { mes: string; total: number }[] }) {
  const max = Math.max(...data.map(d => d.total), 1);
  return (
    <View style={bc.root}>
      {data.map(({ mes, total }) => (
        <View key={mes} style={bc.col}>
          <Text style={bc.valLabel}>
            {total > 0 ? `$${Math.round(total / 1000)}k` : ''}
          </Text>
          <View style={bc.barBg}>
            <View style={[bc.bar, { height: Math.max((total / max) * 120, total > 0 ? 4 : 2) }]} />
          </View>
          <Text style={bc.mesLabel}>{mes}</Text>
        </View>
      ))}
    </View>
  );
}

function RoomGrid({ habitaciones }: { habitaciones: Habitacion[] }) {
  const activas = habitaciones.filter(h => h.habilitada).sort((a, b) =>
    a.numero.localeCompare(b.numero, undefined, { numeric: true }));
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {activas.map(h => (
        <View
          key={h.id}
          style={[rg.cell, { backgroundColor: ESTADO_HAB_COLOR[h.estado] ?? cartasBosque.helecho }]}
        >
          <Text style={rg.num}>{h.numero}</Text>
          <Text style={rg.piso}>{h.pisoNombre}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── DashboardWebScreen ───────────────────────────────────────

interface DashData {
  habitaciones:   Habitacion[];
  pagos:          Pago[];
  inquilinos:     Inquilino[];
  tickets:        Ticket[];
  scores:         ScoreReputacion[];
}

export default function DashboardWebScreen() {
  const [data, setData]         = useState<DashData | null>(null);
  const [alertas, setAlertas]   = useState<AlertaSeguridad[]>([]);
  const [cargando, setCargando] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    async function cargar() {
      try {
        const [habSnap, pagosSnap, inqSnap, tickSnap, scoresSnap] = await Promise.all([
          getDocs(collections.habitaciones),
          getDocs(collections.pagos),
          getDocs(collections.inquilinos),
          getDocs(collections.tickets),
          getDocs(collections.scores),
        ]);
        setData({
          habitaciones: habSnap.docs.map(d => ({ ...d.data(), id: d.id } as Habitacion)),
          pagos:        pagosSnap.docs.map(d => ({ ...d.data(), id: d.id } as Pago)),
          inquilinos:   inqSnap.docs.map(d => ({ ...d.data(), id: d.id } as Inquilino)),
          tickets:      tickSnap.docs.map(d => ({ ...d.data(), id: d.id } as Ticket)),
          scores:       scoresSnap.docs.map(d => ({ ...d.data(), id: d.id } as ScoreReputacion)),
        });
      } finally {
        setCargando(false);
      }
    }
    cargar();
    const unsubAl = listenAlertasSeguridad(list => setAlertas(list.slice(0, 8)));
    return unsubAl;
  }, []);

  const handleExportarPagos = useCallback(() => {
    if (!data) return;
    setExporting(true);
    const header = ['ID','Inquilino','Habitación','Concepto','Monto','Pagado','Estado','Vencimiento','Fecha Pago'];
    const filas = data.pagos.map(p => [
      p.id, p.inquilinoNombre ?? p.inquilinoId, p.habitacionNumero ?? p.habitacionId,
      p.concepto, String(p.monto), String(p.montoPagado), p.estado,
      p.fechaVencimiento ? (p.fechaVencimiento as any).toDate().toLocaleDateString('es-MX') : '',
      p.fechaPago ? (p.fechaPago as any).toDate().toLocaleDateString('es-MX') : '',
    ]);
    exportarCSV('pagos', [header, ...filas]);
    setExporting(false);
  }, [data]);

  const handleExportarInquilinos = useCallback(() => {
    if (!data) return;
    const header = ['ID','Nombre','Apellido','Email','Teléfono','Habitación','Estado','Ingreso'];
    const filas = data.inquilinos.map(i => [
      i.id, i.nombre, i.apellido, i.email, i.telefono,
      i.habitacionId ?? '', i.estado,
      i.fechaIngreso ? (i.fechaIngreso as any).toDate().toLocaleDateString('es-MX') : '',
    ]);
    exportarCSV('inquilinos', [header, ...filas]);
  }, [data]);

  const handleExportarBD = useCallback(() => {
    if (!data) return;
    handleExportarPagos();
    handleExportarInquilinos();
  }, [data, handleExportarPagos, handleExportarInquilinos]);

  if (cargando) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={cartasBosque.bosque} size="large" />
      </View>
    );
  }

  if (!data) return null;

  const { habitaciones, pagos, inquilinos, tickets, scores } = data;
  const inicio = inicioMesActual();

  const habsActivas = habitaciones.filter(h => h.habilitada);
  const ocupadas    = habsActivas.filter(h => h.estado === 'ocupada').length;
  const ocupacionPct = habsActivas.length > 0
    ? Math.round((ocupadas / habsActivas.length) * 100) : 0;

  const pagosDelMes   = pagos.filter(p => p.fechaPago && (p.fechaPago as any).toDate() >= inicio);
  const recaudadoMes  = pagosDelMes.filter(p => p.estado === 'pagado').reduce((s, p) => s + p.montoPagado, 0);
  const vencidos      = pagos.filter(p => p.estado === 'vencido').length;
  const ticketsAbiertos = tickets.filter(t => t.estado !== 'resuelto').length;

  const barData = agruparPorMes(pagos);

  const scoreMap: Record<string, ScoreReputacion> = {};
  scores.forEach(sc => { scoreMap[sc.inquilinoId] = sc; });
  const inqActivos = inquilinos.filter(i => i.estado !== 'inactivo');

  const alertasSinVer = alertas.filter(a => !a.adminVio);

  return (
    <ScrollView style={s.root} contentContainerStyle={s.scroll}>
      {/* ── Header ── */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitulo}>Dashboard</Text>
          <Text style={s.headerSub}>
            {new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </Text>
        </View>
        <View style={s.exportRow}>
          <TouchableOpacity style={s.exportBtn} onPress={handleExportarPagos}>
            <Ionicons name="download-outline" size={14} color={cartasBosque.bosque} />
            <Text style={s.exportText}>Pagos CSV</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.exportBtn} onPress={handleExportarInquilinos}>
            <Ionicons name="download-outline" size={14} color={cartasBosque.bosque} />
            <Text style={s.exportText}>Inquilinos CSV</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.exportBtn, s.exportBtnPrimary]} onPress={handleExportarBD}>
            <Ionicons name="archive-outline" size={14} color={cartasBosque.bruma} />
            <Text style={[s.exportText, { color: cartasBosque.bruma }]}>Exportar BD</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Métricas ── */}
      <View style={s.metricsRow}>
        <MetricCard
          title="Ocupación"
          value={`${ocupacionPct}%`}
          sub={`${ocupadas} / ${habsActivas.length} cuartos`}
          color={cartasBosque.bosque}
          icon="home"
        />
        <MetricCard
          title="Recaudado (mes)"
          value={`$${recaudadoMes.toLocaleString('es-MX')}`}
          sub={`${pagosDelMes.filter(p => p.estado === 'pagado').length} pagos verificados`}
          color="#4A5E48"
          icon="card"
        />
        <MetricCard
          title="Pagos vencidos"
          value={String(vencidos)}
          sub={vencidos > 0 ? 'Requieren atención' : 'Todo al corriente'}
          color={vencidos > 0 ? '#960018' : '#4A5E48'}
          icon={vencidos > 0 ? 'warning' : 'checkmark-circle'}
        />
        <MetricCard
          title="Tickets abiertos"
          value={String(ticketsAbiertos)}
          sub={ticketsAbiertos > 0 ? 'Pendientes de resolver' : 'Sin tickets activos'}
          color={ticketsAbiertos > 0 ? '#8A6A72' : cartasBosque.helecho}
          icon="headset"
        />
      </View>

      {/* ── Segunda fila: gráfica + habitaciones ── */}
      <View style={s.row2}>
        {/* Ingresos 6 meses */}
        <View style={[s.card, { flex: 3 }]}>
          <Text style={s.cardTitulo}>Ingresos últimos 6 meses</Text>
          <BarChart data={barData} />
          <Text style={s.cardNote}>
            Total acumulado: ${barData.reduce((s, d) => s + d.total, 0).toLocaleString('es-MX')}
          </Text>
        </View>

        {/* Grid de habitaciones */}
        <View style={[s.card, { flex: 2 }]}>
          <Text style={s.cardTitulo}>Habitaciones ({habsActivas.length})</Text>
          <View style={s.leyenda}>
            {Object.entries(ESTADO_HAB_COLOR).map(([est, col]) => (
              <View key={est} style={s.leyendaItem}>
                <View style={[s.leyendaDot, { backgroundColor: col }]} />
                <Text style={s.leyendaLabel}>{est}</Text>
              </View>
            ))}
          </View>
          <RoomGrid habitaciones={habsActivas} />
        </View>
      </View>

      {/* ── Tercera fila: scores + alertas ── */}
      <View style={s.row2}>
        {/* Score de inquilinos */}
        <View style={[s.card, { flex: 1 }]}>
          <View style={s.cardHeaderRow}>
            <Text style={s.cardTitulo}>Score de inquilinos</Text>
            <Text style={s.cardHeaderSub}>{inqActivos.length} activos</Text>
          </View>
          {inqActivos.length === 0 ? (
            <Text style={s.emptyText}>Sin inquilinos activos</Text>
          ) : (
            inqActivos.slice(0, 10).map(inq => {
              const sc = scoreMap[inq.id];
              const color = sc ? (NIVEL_COLOR[sc.nivel] ?? cartasBosque.helecho) : cartasBosque.helecho;
              return (
                <View key={inq.id} style={s.scoreRow}>
                  <Text style={s.scoreNombre} numberOfLines={1}>
                    {inq.nombre} {inq.apellido}
                  </Text>
                  <Text style={s.scoreHab}>Hab {inq.habitacionId?.replace('hab_', '') ?? '—'}</Text>
                  {sc ? (
                    <View style={[s.scoreBadge, { backgroundColor: color + '22' }]}>
                      <Text style={[s.scorePts, { color }]}>{sc.puntos}</Text>
                    </View>
                  ) : (
                    <Text style={s.scoreNA}>—</Text>
                  )}
                </View>
              );
            })
          )}
        </View>

        {/* Alertas de seguridad */}
        <View style={[s.card, { flex: 1 }]}>
          <View style={s.cardHeaderRow}>
            <Text style={s.cardTitulo}>Alertas de seguridad</Text>
            {alertasSinVer.length > 0 && (
              <View style={s.alertaBadge}>
                <Text style={s.alertaBadgeText}>{alertasSinVer.length} nueva{alertasSinVer.length !== 1 ? 's' : ''}</Text>
              </View>
            )}
          </View>
          {alertas.length === 0 ? (
            <View style={s.emptyRow}>
              <Ionicons name="shield-checkmark-outline" size={24} color={cartasBosque.niebla} />
              <Text style={s.emptyText}>Sin alertas</Text>
            </View>
          ) : (
            alertas.map(al => (
              <View key={al.id} style={[s.alertaRow, !al.adminVio && s.alertaRowNoVista]}>
                <Ionicons
                  name={al.tipo === 'reporte_robo' ? 'warning-outline' : 'phone-portrait-outline'}
                  size={14}
                  color={al.tipo === 'reporte_robo' ? '#960018' : cartasBosque.bosque}
                />
                <View style={{ flex: 1 }}>
                  <Text style={s.alertaNombre} numberOfLines={1}>{al.inquilinoNombre}</Text>
                  <Text style={s.alertaMeta}>
                    {al.tipo === 'reporte_robo' ? 'Robo / extravío' : 'Dispositivo nuevo'} · {al.ubicacion}
                  </Text>
                </View>
                {!al.adminVio && <View style={s.dotNueva} />}
              </View>
            ))
          )}
        </View>
      </View>

      <View style={{ height: spacing[8] }} />
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#F5F2EC' },
  scroll: { padding: spacing[5] },

  header: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between', marginBottom: spacing[5],
    flexWrap: 'wrap', gap: spacing[3],
  },
  headerTitulo: { fontFamily: 'Inter_700Bold', fontSize: 26, color: cartasBosque.tinta },
  headerSub:    { fontFamily: 'SpaceMono_400Regular', fontSize: 12, color: cartasBosque.helecho, marginTop: 2 },
  exportRow: { flexDirection: 'row', gap: spacing[2], flexWrap: 'wrap' },
  exportBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    backgroundColor: cartasBosque.bruma,
  },
  exportBtnPrimary: { backgroundColor: cartasBosque.bosque, borderColor: cartasBosque.bosque },
  exportText: { fontFamily: 'Inter_400Regular', fontSize: 12, color: cartasBosque.bosque },

  metricsRow: { flexDirection: 'row', gap: spacing[4], marginBottom: spacing[4], flexWrap: 'wrap' },

  row2: { flexDirection: 'row', gap: spacing[4], marginBottom: spacing[4], flexWrap: 'wrap' },

  card: {
    backgroundColor: cartasBosque.bruma,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    minWidth: 260,
  },
  cardTitulo: {
    fontFamily: 'Inter_600SemiBold', fontSize: 14, color: cartasBosque.tinta,
    marginBottom: spacing[3],
  },
  cardNote: {
    fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.helecho,
    marginTop: spacing[3], textAlign: 'right',
  },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[3] },
  cardHeaderSub: { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.helecho },

  leyenda: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginBottom: spacing[3] },
  leyendaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  leyendaDot:  { width: 8, height: 8, borderRadius: 4 },
  leyendaLabel:{ fontFamily: 'SpaceMono_400Regular', fontSize: 9, color: cartasBosque.helecho },

  // Scores
  scoreRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingVertical: spacing[2],
    borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro,
  },
  scoreNombre: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 12, color: cartasBosque.tinta },
  scoreHab:    { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.helecho, width: 48 },
  scoreBadge:  { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  scorePts:    { fontFamily: 'SpaceMono_400Regular', fontSize: 11 },
  scoreNA:     { fontFamily: 'SpaceMono_400Regular', fontSize: 11, color: cartasBosque.niebla, width: 30, textAlign: 'center' },

  // Alertas
  alertaBadge: {
    paddingHorizontal: spacing[2], paddingVertical: 2,
    backgroundColor: '#960018' + '22', borderRadius: borderRadius.full,
  },
  alertaBadgeText: { fontFamily: 'SpaceMono_400Regular', fontSize: 9, color: '#960018' },
  alertaRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingVertical: spacing[2],
    borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro,
  },
  alertaRowNoVista: { backgroundColor: '#E8EBE0' + '33' },
  alertaNombre: { fontFamily: 'Inter_400Regular', fontSize: 12, color: cartasBosque.tinta },
  alertaMeta:   { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.helecho },
  dotNueva:     { width: 7, height: 7, borderRadius: 4, backgroundColor: cartasBosque.bosque },

  emptyRow: { alignItems: 'center', paddingVertical: spacing[4], gap: spacing[2] },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 12, color: cartasBosque.helecho, textAlign: 'center' },
});

const mc = StyleSheet.create({
  card: {
    flex: 1, minWidth: 160,
    backgroundColor: cartasBosque.bruma,
    borderRadius: borderRadius.lg, padding: spacing[4],
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
  },
  iconBox: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: spacing[3] },
  value: { fontFamily: 'Inter_700Bold', fontSize: 28, color: cartasBosque.tinta, lineHeight: 32 },
  title: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: cartasBosque.tinta, marginTop: spacing[1] },
  sub:   { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.helecho, marginTop: 3 },
});

const bc = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'flex-end', height: 160, gap: 8, paddingTop: spacing[2] },
  col:  { flex: 1, alignItems: 'center' },
  barBg: {
    width: '80%', height: 120,
    justifyContent: 'flex-end',
    backgroundColor: cartasBosque.pergaminoOscuro + '55',
    borderRadius: 4,
    overflow: 'hidden',
  },
  bar:  { width: '100%', backgroundColor: cartasBosque.bosque, borderRadius: 4 },
  valLabel: { fontFamily: 'SpaceMono_400Regular', fontSize: 9, color: cartasBosque.helecho, marginBottom: 2, height: 14 },
  mesLabel: { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.helecho, marginTop: 4, textTransform: 'uppercase' },
});

const rg = StyleSheet.create({
  cell: {
    width: 52, height: 44, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  num:  { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#FFFFFF' },
  piso: { fontFamily: 'SpaceMono_400Regular', fontSize: 8, color: '#FFFFFFAA' },
});
