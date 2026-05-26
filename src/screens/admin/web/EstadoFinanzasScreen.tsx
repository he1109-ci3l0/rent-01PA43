import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, TextInput, Switch, Platform, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getDocs, query, where } from 'firebase/firestore';
import { Timestamp } from 'firebase/firestore';
import { collections } from '@/services/firebase/firestore';
import { spacing, borderRadius } from '@/constants/spacing';
import { useAuth } from '@/hooks/useAuth';
import type { Pago, Habitacion, Ticket, CategoriaTicket } from '@/types/firestore';
import {
  listenGastosMes, registrarGasto,
  TIPO_LABELS, CATEGORIA_LABELS_GASTO,
  CATEGORIAS_POR_TIPO, TIPO_COLOR,
  type Gasto, type TipoGasto, type CategoriaGasto,
} from '@/services/firebase/gastos';

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

function exportarCSVCompleto(pagos: Pago[], gastos: Gasto[]): void {
  const header = 'Tipo,Descripcion,Categoria,Monto,Fecha';
  const filasIngresos = pagos.map(p =>
    [
      'INGRESO',
      p.inquilinoNombre ?? '',
      p.concepto,
      p.montoPagado,
      p.fechaPago ? p.fechaPago.toDate().toLocaleDateString('es-MX') : '',
    ].join(',')
  );
  const filasGastos = gastos.map(g =>
    [
      'EGRESO',
      g.descripcion,
      CATEGORIA_LABELS_GASTO[g.categoria],
      -g.monto,
      g.fecha.toDate().toLocaleDateString('es-MX'),
    ].join(',')
  );
  const csv = [header, ...filasIngresos, ...filasGastos].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `balance_${new Date().toISOString().slice(0, 7)}.csv`;
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

// ─── FormGasto ────────────────────────────────────────────────

function FormGasto({ onDone, adminId, mes, anio }: {
  onDone: () => void;
  adminId: string;
  mes: number;
  anio: number;
}) {
  const [tipo, setTipo]             = useState<TipoGasto>('servicio');
  const [categoria, setCategoria]   = useState<CategoriaGasto>('luz');
  const [descripcion, setDescripcion] = useState('');
  const [monto, setMonto]           = useState('');
  const [habitacionId, setHabitacionId] = useState('');
  const [comprobante, setComprobante]   = useState('');
  const [guardando, setGuardando]   = useState(false);
  const [error, setError]           = useState('');

  async function guardar() {
    if (!descripcion.trim() || !monto.trim()) {
      setError('Descripción y monto son requeridos'); return;
    }
    setGuardando(true);
    try {
      await registrarGasto({
        tipo,
        categoria,
        descripcion: descripcion.trim(),
        monto: Number(monto),
        fecha: Timestamp.now(),
        mes,
        anio,
        habitacionId: habitacionId.trim() || undefined,
        comprobante:  comprobante.trim() || undefined,
        adminId,
      });
      onDone();
    } catch (e: any) {
      setError(e.message ?? 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Pressable style={fg.overlay} onPress={onDone}>
      <Pressable onPress={e => e.stopPropagation()}>
        <ScrollView
          style={fg.panel}
          contentContainerStyle={fg.panelContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={fg.header}>
            <Text style={fg.titulo}>Registrar gasto</Text>
            <TouchableOpacity onPress={onDone}>
              <Ionicons name="close" size={20} color="#122A1F" />
            </TouchableOpacity>
          </View>

          {/* Tipo */}
          <Text style={fg.label}>TIPO DE GASTO</Text>
          <View style={fg.chipRow}>
            {(['servicio', 'mantenimiento_regular', 'mantenimiento_atipico'] as TipoGasto[]).map(t => (
              <TouchableOpacity
                key={t}
                style={[fg.chip, tipo === t && { backgroundColor: TIPO_COLOR[t], borderColor: TIPO_COLOR[t] }]}
                onPress={() => { setTipo(t); setCategoria(CATEGORIAS_POR_TIPO[t][0]); }}
              >
                <Text style={[fg.chipText, tipo === t && { color: '#FFFFFF' }]}>
                  {TIPO_LABELS[t]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Categoría */}
          <Text style={fg.label}>CATEGORÍA</Text>
          <View style={fg.chipRow}>
            {CATEGORIAS_POR_TIPO[tipo].map(c => (
              <TouchableOpacity
                key={c}
                style={[fg.chip, categoria === c && fg.chipActivo]}
                onPress={() => setCategoria(c)}
              >
                <Text style={[fg.chipText, categoria === c && fg.chipTextActivo]}>
                  {CATEGORIA_LABELS_GASTO[c]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Descripción */}
          <Text style={fg.label}>DESCRIPCIÓN</Text>
          <TextInput
            style={fg.input}
            value={descripcion}
            onChangeText={setDescripcion}
            placeholder="ej. Pago CFE mayo, Reparación plomería hab 03"
            placeholderTextColor="#8A9E80"
          />

          {/* Monto */}
          <Text style={fg.label}>MONTO $</Text>
          <TextInput
            style={fg.input}
            value={monto}
            onChangeText={setMonto}
            placeholder="0"
            keyboardType="numeric"
            placeholderTextColor="#8A9E80"
          />

          {/* Habitación opcional */}
          <Text style={fg.label}>HABITACIÓN (opcional)</Text>
          <TextInput
            style={fg.input}
            value={habitacionId}
            onChangeText={setHabitacionId}
            placeholder="ej. 03"
            placeholderTextColor="#8A9E80"
          />

          {/* URL comprobante */}
          <Text style={fg.label}>URL COMPROBANTE (opcional)</Text>
          <TextInput
            style={fg.input}
            value={comprobante}
            onChangeText={setComprobante}
            placeholder="https://…"
            autoCapitalize="none"
            placeholderTextColor="#8A9E80"
          />

          {error ? <Text style={fg.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[fg.btnGuardar, guardando && { opacity: 0.5 }]}
            onPress={guardar}
            disabled={guardando}
          >
            <Text style={fg.btnGuardarText}>
              {guardando ? 'Guardando…' : 'Registrar gasto'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </Pressable>
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────

export default function EstadoFinanzasScreen() {
  const { user } = useAuth();
  const [pagosMes, setPagosMes]         = useState<Pago[]>([]);
  const [habitaciones, setHabitaciones] = useState<Habitacion[]>([]);
  const [tickets, setTickets]           = useState<Ticket[]>([]);
  const [cargando, setCargando]         = useState(true);
  const [gastos, setGastos]             = useState<Gasto[]>([]);
  const [showFormGasto, setShowFormGasto] = useState(false);

  const mesActual  = new Date().getMonth() + 1;
  const anioActual = new Date().getFullYear();

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

  useEffect(() => {
    return listenGastosMes(mesActual, anioActual, setGastos);
  }, []);

  // ── Derived — ingresos ────────────────────────────────────────
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

  // ── Derived — gastos ──────────────────────────────────────────
  const totalGastos = gastos.reduce((s, g) => s + g.monto, 0);
  const gastosPorTipo = {
    servicio:              gastos.filter(g => g.tipo === 'servicio').reduce((s, g) => s + g.monto, 0),
    mantenimiento_regular: gastos.filter(g => g.tipo === 'mantenimiento_regular').reduce((s, g) => s + g.monto, 0),
    mantenimiento_atipico: gastos.filter(g => g.tipo === 'mantenimiento_atipico').reduce((s, g) => s + g.monto, 0),
  };
  const balance = totalIngresos - totalGastos;

  return (
    <View style={{ flex: 1 }}>
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

        {/* MetricCards fila 1 — ingresos y ocupación */}
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

        {/* MetricCards fila 2 — egresos y balance */}
        <View style={s.cardsRow}>
          <MetricCard
            label="Total egresos mes"
            value={formatPesos(totalGastos)}
            color="#C0392B"
            icon="trending-down-outline"
          />
          <MetricCard
            label="Balance del mes"
            value={formatPesos(balance)}
            color={balance >= 0 ? '#4A9B6F' : '#C0392B'}
            icon={balance >= 0 ? 'checkmark-circle-outline' : 'alert-circle-outline'}
          />
          <MetricCard
            label="Servicios (luz/agua/gas/internet)"
            value={formatPesos(gastosPorTipo.servicio)}
            color="#3B82F6"
            icon="flash-outline"
          />
          <MetricCard
            label="Mantenimiento atípico"
            value={formatPesos(gastosPorTipo.mantenimiento_atipico)}
            color="#E05C2A"
            icon="construct-outline"
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

        {/* Egresos del mes */}
        <View style={s.seccion}>
          <View style={s.seccionHeaderRow}>
            <Text style={s.seccionTitulo}>EGRESOS DEL MES</Text>
            <TouchableOpacity style={s.addBtn} onPress={() => setShowFormGasto(true)}>
              <Ionicons name="add" size={14} color="#FFFFFF" />
              <Text style={s.addBtnText}>Registrar gasto</Text>
            </TouchableOpacity>
          </View>

          {/* Resumen por tipo */}
          <View style={s.tipoResumenRow}>
            {(['servicio', 'mantenimiento_regular', 'mantenimiento_atipico'] as TipoGasto[]).map(tipo => (
              <View
                key={tipo}
                style={[s.tipoChip, {
                  borderColor: TIPO_COLOR[tipo] + '66',
                  backgroundColor: TIPO_COLOR[tipo] + '11',
                }]}
              >
                <Text style={[s.tipoChipVal, { color: TIPO_COLOR[tipo] }]}>
                  {formatPesos(gastosPorTipo[tipo])}
                </Text>
                <Text style={s.tipoChipLabel}>{TIPO_LABELS[tipo]}</Text>
              </View>
            ))}
          </View>

          {/* Lista de gastos */}
          {gastos.length === 0 ? (
            <Text style={s.vacioText}>Sin gastos registrados este mes.</Text>
          ) : (
            gastos.map(g => (
              <View key={g.id} style={s.gastoRow}>
                <View style={[s.gastoDot, { backgroundColor: TIPO_COLOR[g.tipo] }]} />
                <View style={{ flex: 1 }}>
                  <Text style={s.gastoDesc}>{g.descripcion}</Text>
                  <Text style={s.gastoSub}>
                    {CATEGORIA_LABELS_GASTO[g.categoria]} ·{' '}
                    {g.fecha.toDate().toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                    {g.habitacionId ? ` · Hab. ${g.habitacionId}` : ''}
                  </Text>
                </View>
                <Text style={[s.gastoMonto, { color: TIPO_COLOR[g.tipo] }]}>
                  {formatPesos(g.monto)}
                </Text>
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

        {/* Balance del mes */}
        <View style={[s.seccion, {
          borderWidth: 2,
          borderColor: balance >= 0 ? '#4A9B6F44' : '#C0392B44',
        }]}>
          <Text style={s.seccionTitulo}>BALANCE DEL MES</Text>

          <View style={s.balanceRow}>
            <View style={s.balanceItem}>
              <Text style={s.balanceLabel}>INGRESOS</Text>
              <Text style={[s.balanceVal, { color: '#4A9B6F' }]}>{formatPesos(totalIngresos)}</Text>
            </View>
            <Text style={s.balanceSep}>−</Text>
            <View style={s.balanceItem}>
              <Text style={s.balanceLabel}>EGRESOS</Text>
              <Text style={[s.balanceVal, { color: '#C0392B' }]}>{formatPesos(totalGastos)}</Text>
            </View>
            <Text style={s.balanceSep}>=</Text>
            <View style={s.balanceItem}>
              <Text style={s.balanceLabel}>BALANCE</Text>
              <Text style={[s.balanceVal, {
                color: balance >= 0 ? '#4A9B6F' : '#C0392B',
                fontSize: 26,
              }]}>
                {formatPesos(balance)}
              </Text>
            </View>
          </View>

          <View style={s.desglosRow}>
            <Text style={s.desglose}>
              Servicios {formatPesos(gastosPorTipo.servicio)} ·{' '}
              Mant. regular {formatPesos(gastosPorTipo.mantenimiento_regular)} ·{' '}
              Mant. atípico {formatPesos(gastosPorTipo.mantenimiento_atipico)}
            </Text>
          </View>

          <TouchableOpacity
            style={s.exportBtn}
            onPress={() => exportarCSVCompleto(pagosMes, gastos)}
          >
            <Ionicons name="download-outline" size={14} color="#FFFFFF" />
            <Text style={s.exportBtnText}>Exportar balance CSV</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* Modal — registrar gasto */}
      <Modal
        visible={showFormGasto}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFormGasto(false)}
      >
        <FormGasto
          onDone={() => setShowFormGasto(false)}
          adminId={user?.uid ?? ''}
          mes={mesActual}
          anio={anioActual}
        />
      </Modal>
    </View>
  );
}

// ─── Estilos — Screen ─────────────────────────────────────────

const s = StyleSheet.create({
  scroll:    { flex: 1, backgroundColor: '#F5F2EC' },
  container: { padding: spacing[5], gap: spacing[5] },

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

  // ── Egresos
  seccionHeaderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#2E3C2C',
    paddingHorizontal: spacing[3], paddingVertical: spacing[1] + 2,
    borderRadius: borderRadius.sm,
  },
  addBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#FFFFFF' },
  tipoResumenRow: {
    flexDirection: 'row', gap: spacing[2], flexWrap: 'wrap',
  },
  tipoChip: {
    flex: 1, minWidth: 120,
    borderRadius: borderRadius.md, borderWidth: 1,
    padding: spacing[3], gap: 4,
  },
  tipoChipVal:   { fontFamily: 'SpaceMono_400Regular', fontSize: 16 },
  tipoChipLabel: { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#4A5E48' },
  gastoRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    paddingVertical: spacing[2],
    borderBottomWidth: 1, borderBottomColor: '#F5F2EC',
  },
  gastoDot:   { width: 8, height: 8, borderRadius: 4 },
  gastoDesc:  { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#122A1F' },
  gastoSub:   { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: '#8A9E80' },
  gastoMonto: { fontFamily: 'SpaceMono_400Regular', fontSize: 13 },

  // ── Balance
  balanceRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-around', gap: spacing[3],
    paddingVertical: spacing[3],
  },
  balanceItem:  { alignItems: 'center', gap: 4 },
  balanceLabel: {
    fontFamily: 'SpaceMono_400Regular', fontSize: 9, color: '#8A9E80', letterSpacing: 1,
  },
  balanceVal: { fontFamily: 'SpaceMono_400Regular', fontSize: 22 },
  balanceSep: { fontFamily: 'Inter_700Bold', fontSize: 24, color: '#8A9E80' },
  desglosRow: { marginTop: spacing[1] },
  desglose: {
    fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: '#8A9E80', textAlign: 'center',
  },
});

// ─── Estilos — FormGasto ──────────────────────────────────────

const fg = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(18,42,31,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  panel: {
    backgroundColor: '#F5F2EC',
    borderRadius: borderRadius.xl,
    width: 480,
    maxHeight: '85%' as any,
  },
  panelContent: { padding: spacing[5], gap: spacing[1] },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: spacing[3],
  },
  titulo: { fontFamily: 'Inter_700Bold', fontSize: 18, color: '#122A1F' },
  label: {
    fontFamily: 'SpaceMono_400Regular', fontSize: 9, color: '#8A9E80',
    letterSpacing: 0.8,
    marginTop: spacing[3], marginBottom: spacing[1],
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  chip: {
    paddingHorizontal: spacing[3], paddingVertical: spacing[1] + 2,
    borderRadius: borderRadius.sm, borderWidth: 1,
    borderColor: '#CDB29D', backgroundColor: '#FFFFFF',
  },
  chipActivo:     { backgroundColor: '#2E3C2C', borderColor: '#2E3C2C' },
  chipText:       { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#122A1F' },
  chipTextActivo: { color: '#FFFFFF' },
  input: {
    backgroundColor: '#FFFFFF', borderRadius: borderRadius.sm,
    borderWidth: 1, borderColor: '#CDB29D',
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    fontFamily: 'Inter_400Regular', fontSize: 13, color: '#122A1F',
  },
  error: {
    fontFamily: 'Inter_400Regular', fontSize: 12, color: '#C0392B', marginTop: spacing[2],
  },
  btnGuardar: {
    backgroundColor: '#2E3C2C', borderRadius: borderRadius.sm,
    paddingVertical: spacing[3], alignItems: 'center',
    marginTop: spacing[4],
  },
  btnGuardarText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#FFFFFF' },
});
