import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getDocs, query, where, onSnapshot } from 'firebase/firestore';
import { collections } from '@/services/firebase/firestore';
import { listenAlertasSeguridad } from '@/services/firebase/sesiones';
import { listenTodasVisitasActivas } from '@/services/firebase/visitas';
import { cartasBosque } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/spacing';
import type { Habitacion, Pago, Ticket, ScoreReputacion, Inquilino, AlertaSeguridad, Visita } from '@/types/firestore';

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

function calcularMesAnterior(pagos: Pago[]): number {
  const ahora = new Date();
  const inicioMesAnt = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);
  const finMesAnt    = new Date(ahora.getFullYear(), ahora.getMonth(), 0);
  return pagos
    .filter(p => {
      if (p.estado !== 'pagado' || !p.fechaPago) return false;
      const fp = (p.fechaPago as any).toDate();
      return fp >= inicioMesAnt && fp <= finMesAnt;
    })
    .reduce((s, p) => s + p.montoPagado, 0);
}

// ─── Sub-components ───────────────────────────────────────────

const ESTADO_HAB_COLOR: Record<string, string> = {
  disponible:    '#4A5E48',
  ocupada:       cartasBosque.bosque,
  mantenimiento: '#8A6A72',
  reservada:     cartasBosque.helecho,
};

function MetricCard({
  title, value, sub, color, icon,
}: { title: string; value: string; sub?: string; color: string; icon: string }) {
  return (
    <View style={mc.card}>
      <View style={[mc.iconBox, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon as any} size={22} color={color} />
      </View>
      <Text style={[mc.value, { color }]}>{value}</Text>
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
            {total > 0 ? `$${Math.round(total / 1000)}k` : '$0'}
          </Text>
          <View style={bc.barBg}>
            <View style={[
              bc.bar,
              {
                height: Math.max((total / max) * 120, 3),
                backgroundColor: total > 0 ? cartasBosque.bosque : cartasBosque.pergaminoOscuro,
              },
            ]} />
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
  const [data, setData]             = useState<DashData | null>(null);
  const [alertas, setAlertas]       = useState<AlertaSeguridad[]>([]);
  const [visitasHoy, setVisitasHoy] = useState<Visita[]>([]);
  const [cargando, setCargando]     = useState(true);
  const [exporting, setExporting]   = useState(false);

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
    const unsubVisitas = listenTodasVisitasActivas(visitas => {
      const hoy = new Date();
      setVisitasHoy(visitas.filter(v => {
        const fe = v.fechaEntrada.toDate();
        return fe.getDate() === hoy.getDate() &&
               fe.getMonth() === hoy.getMonth() &&
               fe.getFullYear() === hoy.getFullYear();
      }));
    });
    return () => { unsubAl(); unsubVisitas(); };
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

  const habsActivas  = habitaciones.filter(h => h.habilitada);
  const ocupadas     = habsActivas.filter(h => h.estado === 'ocupada').length;
  const ocupacionPct = habsActivas.length > 0
    ? Math.round((ocupadas / habsActivas.length) * 100) : 0;

  const pagosDelMes     = pagos.filter(p => p.fechaPago && (p.fechaPago as any).toDate() >= inicio);
  const recaudadoMes    = pagosDelMes.filter(p => p.estado === 'pagado').reduce((s, p) => s + p.montoPagado, 0);
  const recaudadoMesAnt = calcularMesAnterior(pagos);
  const diffRecaudado   = recaudadoMesAnt > 0
    ? Math.round(((recaudadoMes - recaudadoMesAnt) / recaudadoMesAnt) * 100)
    : null;
  const vencidos        = pagos.filter(p => p.estado === 'vencido').length;
  const ticketsAbiertos = tickets.filter(t => t.estado !== 'resuelto').length;

  const pagosPorVerificar = pagos.filter(p => p.estado === 'en_revision').length;
  const ticketsSinResp    = tickets.filter(t => {
    if (t.estado === 'resuelto') return false;
    const hrs = (Date.now() - (t.creadoEn as any).toDate().getTime()) / 36e5;
    return hrs > 24;
  }).length;
  const totalPendientes = pagosPorVerificar + ticketsSinResp + visitasHoy.length;

  const barData    = agruparPorMes(pagos);
  const inqActivos = inquilinos.filter(i => i.estado !== 'inactivo');

  const hoy7dias = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const proximosVencimientos = pagos
    .filter(p => {
      if (p.estado !== 'pendiente' || !p.fechaVencimiento) return false;
      const fv = (p.fechaVencimiento as any).toDate() as Date;
      return fv >= new Date() && fv <= hoy7dias;
    })
    .sort((a, b) =>
      (a.fechaVencimiento as any).toDate().getTime() -
      (b.fechaVencimiento as any).toDate().getTime()
    );

  const alertasSinVer = alertas.filter(a => !a.adminVio);

  const hoy = new Date();
  const proximosDesocupar = inquilinos
    .filter(i => i.fechaSalida !== null && i.fechaSalida !== undefined)
    .map(i => {
      const fechaSalida = (i.fechaSalida as any).toDate();
      const diasRestantes = Math.ceil(
        (fechaSalida.getTime() - hoy.getTime()) / 864e5
      );
      return { ...i, fechaSalida, diasRestantes };
    })
    .sort((a, b) => a.diasRestantes - b.diasRestantes);

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

      {/* ── Pendientes de acción hoy ── */}
      {totalPendientes > 0 && (
        <View style={s.pendientesBar}>
          <Ionicons name="alert-circle" size={16} color="#E8A838" />
          <Text style={s.pendientesTitulo}>PENDIENTES HOY</Text>
          <View style={s.pendientesItems}>
            {pagosPorVerificar > 0 && (
              <View style={s.pendienteChip}>
                <Text style={s.pendienteChipText}>
                  {pagosPorVerificar} pago{pagosPorVerificar !== 1 ? 's' : ''} por verificar
                </Text>
              </View>
            )}
            {ticketsSinResp > 0 && (
              <View style={[s.pendienteChip, { backgroundColor: '#E05C2A22' }]}>
                <Text style={[s.pendienteChipText, { color: '#E05C2A' }]}>
                  {ticketsSinResp} ticket{ticketsSinResp !== 1 ? 's' : ''} sin respuesta +24h
                </Text>
              </View>
            )}
            {visitasHoy.length > 0 && (
              <View style={[s.pendienteChip, { backgroundColor: '#3B82F622' }]}>
                <Text style={[s.pendienteChipText, { color: '#3B82F6' }]}>
                  {visitasHoy.length} visita{visitasHoy.length !== 1 ? 's' : ''} activas hoy
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* ── Métricas ── */}
      <View style={s.metricsRow}>
        <MetricCard
          title="Ocupación"
          value={`${ocupacionPct}%`}
          sub={`${ocupadas} / ${habsActivas.length} cuartos`}
          color="#3B82F6"
          icon="home"
        />
        <MetricCard
          title="Recaudado (mes)"
          value={`$${recaudadoMes.toLocaleString('es-MX')}`}
          sub={diffRecaudado !== null
            ? `${diffRecaudado >= 0 ? '↑' : '↓'} ${Math.abs(diffRecaudado)}% vs mes anterior`
            : `${pagosDelMes.filter(p => p.estado === 'pagado').length} pagos verificados`
          }
          color="#4A9B6F"
          icon="card"
        />
        <MetricCard
          title="Pagos vencidos"
          value={String(vencidos)}
          sub={vencidos > 0 ? 'Requieren atención' : 'Todo al corriente'}
          color={vencidos > 0 ? '#C0392B' : '#4A9B6F'}
          icon={vencidos > 0 ? 'warning' : 'checkmark-circle'}
        />
        <MetricCard
          title="Tickets abiertos"
          value={String(ticketsAbiertos)}
          sub={ticketsAbiertos > 0 ? 'Pendientes de resolver' : 'Sin tickets activos'}
          color={ticketsAbiertos > 0 ? '#E8A838' : '#4A9B6F'}
          icon="headset"
        />
        <MetricCard
          title="Visitas hoy"
          value={String(visitasHoy.length)}
          sub={visitasHoy.length > 0
            ? `Última: ${visitasHoy[visitasHoy.length - 1]
                ?.fechaEntrada.toDate()
                .toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`
            : 'Sin visitas registradas'
          }
          color="#3B82F6"
          icon="walk"
        />
        {proximosDesocupar.length > 0 && (
          <MetricCard
            title="Desocupan pronto"
            value={String(proximosDesocupar.length)}
            sub={proximosDesocupar[0]
              ? `Próximo: Hab ${proximosDesocupar[0].habitacionId} en ${
                  proximosDesocupar[0].diasRestantes <= 0 ? 'hoy'
                  : proximosDesocupar[0].diasRestantes + 'd'
                }`
              : ''}
            color="#E05C2A"
            icon="exit-outline"
          />
        )}
      </View>

      {/* ── Segunda fila: gráfica + habitaciones ── */}
      <View style={s.row2}>
        <View style={[s.card, { flex: 3 }]}>
          <Text style={s.cardTitulo}>Ingresos últimos 6 meses</Text>
          <BarChart data={barData} />
          <Text style={s.cardNote}>
            Total acumulado: ${barData.reduce((acc, d) => acc + d.total, 0).toLocaleString('es-MX')}
          </Text>
        </View>

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

      {/* ── Tercera fila: vencimientos + alertas ── */}
      <View style={s.row2}>

        {/* Vencimientos próximos */}
        <View style={[s.card, { flex: 1 }]}>
          <View style={s.cardHeaderRow}>
            <Text style={s.cardTitulo}>Vencimientos próximos</Text>
            <Text style={s.cardHeaderSub}>próximos 7 días</Text>
          </View>
          {proximosVencimientos.length === 0 ? (
            <View style={s.emptyRow}>
              <Ionicons name="checkmark-circle-outline" size={24} color="#4A9B6F" />
              <Text style={s.emptyText}>Sin vencimientos esta semana</Text>
            </View>
          ) : (
            proximosVencimientos.slice(0, 8).map(p => {
              const fv = (p.fechaVencimiento as any).toDate() as Date;
              const diasRestantes = Math.ceil((fv.getTime() - new Date().getTime()) / 864e5);
              const color = diasRestantes <= 1 ? '#C0392B'
                : diasRestantes <= 3 ? '#E05C2A' : '#E8A838';
              return (
                <View key={p.id} style={s.scoreRow}>
                  <Text style={s.scoreNombre} numberOfLines={1}>
                    {p.inquilinoNombre ?? '—'}
                  </Text>
                  <Text style={s.scoreHab}>Hab {p.habitacionNumero ?? '—'}</Text>
                  <View style={[s.scoreBadge, { backgroundColor: color + '22' }]}>
                    <Text style={[s.scorePts, { color }]}>
                      {diasRestantes === 0 ? 'hoy' : `${diasRestantes}d`}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Próximos a desocupar */}
        <View style={[s.card, { flex: 1 }]}>
          <View style={s.cardHeaderRow}>
            <Text style={s.cardTitulo}>Próximos a desocupar</Text>
            <Text style={s.cardHeaderSub}>depósito en curso</Text>
          </View>
          {proximosDesocupar.length === 0 ? (
            <View style={s.emptyRow}>
              <Ionicons
                name="home-outline"
                size={24}
                color="#4A9B6F"
              />
              <Text style={s.emptyText}>
                Sin habitaciones en protocolo de salida
              </Text>
            </View>
          ) : (
            proximosDesocupar.map(inq => {
              const color = inq.diasRestantes <= 3  ? '#C0392B'
                          : inq.diasRestantes <= 7  ? '#E05C2A'
                          : inq.diasRestantes <= 15 ? '#E8A838'
                          : '#3B82F6';
              return (
                <View key={inq.id} style={s.scoreRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.scoreNombre} numberOfLines={1}>
                      {inq.nombre} {inq.apellido}
                    </Text>
                    <Text style={[s.scoreHab, { marginTop: 2 }]}>
                      Hab. {inq.habitacionId ?? '—'} ·{' '}
                      {inq.fechaSalida.toLocaleDateString('es-MX', {
                        day: '2-digit', month: 'short', year: 'numeric'
                      })}
                    </Text>
                  </View>
                  <View style={[s.scoreBadge, { backgroundColor: color + '22' }]}>
                    <Text style={[s.scorePts, { color }]}>
                      {inq.diasRestantes <= 0
                        ? 'HOY'
                        : inq.diasRestantes === 1
                        ? 'mañana'
                        : `${inq.diasRestantes}d`}
                    </Text>
                  </View>
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
                <Text style={s.alertaBadgeText}>
                  {alertasSinVer.length} nueva{alertasSinVer.length !== 1 ? 's' : ''}
                </Text>
              </View>
            )}
          </View>
          {alertas.length > 0 ? (
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
          ) : null}
        </View>

      </View>

      <View style={{ height: spacing[8] }} />
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#F7F7F5' },
  scroll: { padding: spacing[5] },

  header: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between', marginBottom: spacing[5],
    flexWrap: 'wrap', gap: spacing[3],
  },
  headerTitulo: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 26, color: cartasBosque.tinta },
  headerSub:    { fontFamily: 'MonaSans_400Regular', fontSize: 12, color: cartasBosque.helecho, marginTop: 2 },
  exportRow: { flexDirection: 'row', gap: spacing[2], flexWrap: 'wrap' },
  exportBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    backgroundColor: cartasBosque.bruma,
  },
  exportBtnPrimary: { backgroundColor: cartasBosque.bosque, borderColor: cartasBosque.bosque },
  exportText: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: cartasBosque.bosque },

  // Pendientes hoy
  pendientesBar: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing[3],
    backgroundColor: '#E8A83811',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#E8A83844',
    padding: spacing[3],
    marginBottom: spacing[4],
  },
  pendientesTitulo: {
    fontFamily: 'MonaSans_400Regular',
    fontSize: 10,
    color: '#E8A838',
    letterSpacing: 0.8,
  },
  pendientesItems: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    flex: 1,
  },
  pendienteChip: {
    paddingHorizontal: spacing[2],
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
    backgroundColor: '#E8A83822',
  },
  pendienteChipText: {
    fontFamily: 'BricolageGrotesque_400Regular',
    fontSize: 11,
    color: '#E8A838',
  },

  metricsRow: { flexDirection: 'row', gap: spacing[4], marginBottom: spacing[4], flexWrap: 'wrap' },
  row2:       { flexDirection: 'row', gap: spacing[4], marginBottom: spacing[4], flexWrap: 'wrap' },

  card: {
    backgroundColor: cartasBosque.bruma,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    minWidth: 260,
  },
  cardTitulo: {
    fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 14, color: cartasBosque.tinta,
    marginBottom: spacing[3],
  },
  cardNote: {
    fontFamily: 'MonaSans_400Regular', fontSize: 10, color: cartasBosque.helecho,
    marginTop: spacing[3], textAlign: 'right',
  },
  cardHeaderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: spacing[3],
  },
  cardHeaderSub: { fontFamily: 'MonaSans_400Regular', fontSize: 10, color: cartasBosque.helecho },

  leyenda:      { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginBottom: spacing[3] },
  leyendaItem:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  leyendaDot:   { width: 8, height: 8, borderRadius: 4 },
  leyendaLabel: { fontFamily: 'MonaSans_400Regular', fontSize: 9, color: cartasBosque.helecho },

  // Scores / vencimientos
  scoreRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingVertical: spacing[2],
    borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro,
  },
  scoreNombre: { flex: 1, fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: cartasBosque.tinta },
  scoreHab:    { fontFamily: 'MonaSans_400Regular', fontSize: 10, color: cartasBosque.helecho, width: 56 },
  scoreBadge:  { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  scorePts:    { fontFamily: 'MonaSans_400Regular', fontSize: 11 },
  scoreNA:     { fontFamily: 'MonaSans_400Regular', fontSize: 11, color: cartasBosque.niebla, width: 30, textAlign: 'center' },

  // Alertas
  alertaBadge: {
    paddingHorizontal: spacing[2], paddingVertical: 2,
    backgroundColor: '#960018' + '22', borderRadius: borderRadius.full,
  },
  alertaBadgeText: { fontFamily: 'MonaSans_400Regular', fontSize: 9, color: '#960018' },
  alertaRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingVertical: spacing[2],
    borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro,
  },
  alertaRowNoVista: { backgroundColor: '#E8EBE0' + '33' },
  alertaNombre:     { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: cartasBosque.tinta },
  alertaMeta:       { fontFamily: 'MonaSans_400Regular', fontSize: 10, color: cartasBosque.helecho },
  dotNueva:         { width: 7, height: 7, borderRadius: 4, backgroundColor: cartasBosque.bosque },

  emptyRow:  { alignItems: 'center', paddingVertical: spacing[4], gap: spacing[2] },
  emptyText: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: cartasBosque.helecho, textAlign: 'center' },
});

const mc = StyleSheet.create({
  card: {
    flex: 1, minWidth: 160,
    backgroundColor: cartasBosque.bruma,
    borderRadius: borderRadius.lg, padding: spacing[4],
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
  },
  iconBox: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing[3],
  },
  value: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 28, lineHeight: 32 },
  title: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: cartasBosque.tinta, marginTop: spacing[1] },
  sub:   { fontFamily: 'MonaSans_400Regular', fontSize: 10, color: cartasBosque.helecho, marginTop: 3 },
});

const bc = StyleSheet.create({
  root:  { flexDirection: 'row', alignItems: 'flex-end', height: 160, gap: 8, paddingTop: spacing[2] },
  col:   { flex: 1, alignItems: 'center' },
  barBg: {
    width: '80%', height: 120,
    justifyContent: 'flex-end',
    backgroundColor: cartasBosque.pergaminoOscuro + '55',
    borderRadius: 4,
    overflow: 'hidden',
  },
  bar:      { width: '100%', borderRadius: 4 },
  valLabel: { fontFamily: 'MonaSans_400Regular', fontSize: 9, color: cartasBosque.helecho, marginBottom: 2, height: 14 },
  mesLabel: { fontFamily: 'MonaSans_400Regular', fontSize: 10, color: cartasBosque.helecho, marginTop: 4, textTransform: 'uppercase' },
});

const rg = StyleSheet.create({
  cell: { width: 52, height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  num:  { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 12, color: '#FFFFFF' },
  piso: { fontFamily: 'MonaSans_400Regular', fontSize: 8, color: '#FFFFFFAA' },
});
