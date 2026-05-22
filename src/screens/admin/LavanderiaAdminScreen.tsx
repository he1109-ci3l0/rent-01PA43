import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Timestamp } from 'firebase/firestore';
import { cartasBosque } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/spacing';
import { useAuth } from '@/hooks/useAuth';
import {
  inicioSemanaISO,
  autorizarReserva, cancelarReserva, completarReserva,
  listenReservasHoy, listenReservasSemana, listenReservasMes,
} from '@/services/firebase/lavanderia';
import type { ReservaLavanderia, EstadoReserva } from '@/types/firestore';

// ─── Helpers ──────────────────────────────────────────────────

const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

function formatHora(ts: Timestamp): string {
  const d = ts.toDate();
  return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

function formatDia(ts: Timestamp): string {
  return ts.toDate().toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });
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
    case 'pendiente_auth': return 'auth. req.';
    case 'completada':    return 'completada';
    case 'cancelada':     return 'cancelada';
  }
}

// ─── Tarjeta reserva ──────────────────────────────────────────

function ReservaRow({ reserva, onAutorizar, onCompletar, onCancelar }: {
  reserva: ReservaLavanderia;
  onAutorizar: () => void;
  onCompletar: () => void;
  onCancelar: () => void;
}) {
  return (
    <View style={styles.reservaCard}>
      <View style={styles.reservaTop}>
        <View style={styles.reservaInfo}>
          <Text style={styles.reservaHora}>{formatHora(reserva.fechaReserva)}</Text>
          <Text style={styles.reservaNombre}>
            {reserva.inquilinoNombre ?? 'Inquilino'} · Hab. {reserva.habitacionNumero ?? '—'}
          </Text>
          {reserva.esCargaExtra && (
            <Text style={styles.extraTag}>carga extra · ${reserva.monto}</Text>
          )}
        </View>
        <View style={[styles.estadoBadge, { backgroundColor: estadoColor(reserva.estado) }]}>
          <Text style={styles.estadoText}>{estadoLabel(reserva.estado)}</Text>
        </View>
      </View>

      {(reserva.estado === 'pendiente_auth' || reserva.estado === 'confirmada' || reserva.estado === 'pendiente') && (
        <View style={styles.accionesRow}>
          {reserva.estado === 'pendiente_auth' && (
            <TouchableOpacity style={[styles.btnAccion, styles.btnAuth]} onPress={onAutorizar}>
              <Ionicons name="checkmark-circle-outline" size={14} color={cartasBosque.bruma} />
              <Text style={styles.btnAuthText}>Autorizar</Text>
            </TouchableOpacity>
          )}
          {reserva.estado === 'confirmada' && (
            <TouchableOpacity style={[styles.btnAccion, styles.btnCompletar]} onPress={onCompletar}>
              <Ionicons name="checkmark-done-outline" size={14} color={cartasBosque.bruma} />
              <Text style={styles.btnCompletarText}>Completar</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.btnAccion, styles.btnCancelar]} onPress={onCancelar}>
            <Text style={styles.btnCancelarText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── Vista Mes ────────────────────────────────────────────────

const MES_NOMBRES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Jul','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function VistaMes({ mes }: { mes: Date }) {
  const [reservas, setReservas] = useState<ReservaLavanderia[]>([]);

  useEffect(() => {
    return listenReservasMes(mes, setReservas);
  }, [mes.getFullYear(), mes.getMonth()]);

  const primerDia  = new Date(mes.getFullYear(), mes.getMonth(), 1);
  const diasEnMes  = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate();
  const offsetInicio = (primerDia.getDay() + 6) % 7; // lunes = 0

  const reservasPorDia: Record<number, ReservaLavanderia[]> = {};
  for (const r of reservas) {
    const d = r.fechaReserva.toDate().getDate();
    if (!reservasPorDia[d]) reservasPorDia[d] = [];
    reservasPorDia[d].push(r);
  }

  const celdas: (number | null)[] = [
    ...Array(offsetInicio).fill(null),
    ...Array.from({ length: diasEnMes }, (_, i) => i + 1),
  ];
  while (celdas.length % 7 !== 0) celdas.push(null);

  const hoy = new Date();
  const esHoyMes = hoy.getFullYear() === mes.getFullYear() && hoy.getMonth() === mes.getMonth();

  return (
    <View style={styles.mesContainer}>
      {/* Header días */}
      <View style={styles.mesDiasRow}>
        {['L','M','X','J','V','S','D'].map(d => (
          <Text key={d} style={styles.mesDiaHeader}>{d}</Text>
        ))}
      </View>
      {/* Grid */}
      {Array.from({ length: celdas.length / 7 }, (_, semana) => (
        <View key={semana} style={styles.mesRow}>
          {celdas.slice(semana * 7, semana * 7 + 7).map((dia, col) => {
            if (!dia) return <View key={col} style={styles.mesCelda} />;
            const rsv  = reservasPorDia[dia] ?? [];
            const esHoy = esHoyMes && hoy.getDate() === dia;
            return (
              <View key={col} style={[styles.mesCelda, esHoy && styles.mesCeldaHoy]}>
                <Text style={[styles.mesDiaNum, esHoy && styles.mesDiaNumHoy]}>{dia}</Text>
                <View style={styles.mesDots}>
                  {rsv.slice(0, 3).map((r, i) => (
                    <View key={i} style={[styles.mesDot, { backgroundColor: estadoColor(r.estado) }]} />
                  ))}
                  {rsv.length > 3 && <Text style={styles.mesMore}>+{rsv.length - 3}</Text>}
                </View>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ─── Vista Semana ─────────────────────────────────────────────

function VistaSemana({ inicioSem }: { inicioSem: Date }) {
  const [reservasSem, setReservasSem] = useState<ReservaLavanderia[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    return listenReservasSemana(inicioSem, setReservasSem);
  }, [inicioSem.toISOString()]);

  // Agrupar por día (lunes=0 … domingo=6)
  const porDia: ReservaLavanderia[][] = Array.from({ length: 7 }, () => []);
  for (const r of reservasSem) {
    const d = r.fechaReserva.toDate();
    const dow = (d.getDay() + 6) % 7; // 0=lunes
    porDia[dow].push(r);
  }

  return (
    <View style={styles.semanaGrid}>
      {DIAS.map((dia, i) => {
        const reservasDelDia = porDia[i];
        const fecha = new Date(inicioSem);
        fecha.setDate(fecha.getDate() + i);
        const esHoy = fecha.toDateString() === new Date().toDateString();
        return (
          <View key={dia} style={[styles.semanaCol, esHoy && styles.semanaColHoy]}>
            <Text style={[styles.semanaDia, esHoy && styles.semanaDiaHoy]}>{dia}</Text>
            <Text style={styles.semanaNum}>{fecha.getDate()}</Text>
            <View style={styles.semanaSlots}>
              {reservasDelDia.length === 0
                ? <View style={styles.semanaVacio} />
                : reservasDelDia.map(r => (
                  <View
                    key={r.id}
                    style={[styles.semanaDot, { backgroundColor: estadoColor(r.estado) }]}
                  />
                ))
              }
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ─── Pantalla principal ───────────────────────────────────────

type Vista = 'hoy' | 'semana' | 'mes';

export default function LavanderiaAdminScreen() {
  const { user } = useAuth();
  const [vista, setVista] = useState<Vista>('hoy');
  const [reservasHoy, setReservasHoy] = useState<ReservaLavanderia[]>([]);
  const [cargando, setCargando] = useState(true);
  const [mesActual, setMesActual] = useState(new Date());

  const inicioSem = inicioSemanaISO(new Date());

  useEffect(() => {
    return listenReservasHoy(data => {
      setReservasHoy(data);
      setCargando(false);
    });
  }, []);

  const pendientesAuth = reservasHoy.filter(r => r.estado === 'pendiente_auth').length;

  function cambiarMes(delta: number) {
    setMesActual(m => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Segmented */}
      <View style={styles.segmented}>
        {(['hoy', 'semana', 'mes'] as Vista[]).map(v => (
          <TouchableOpacity
            key={v}
            style={[styles.segBtn, vista === v && styles.segBtnActivo]}
            onPress={() => setVista(v)}
          >
            <Text style={[styles.segText, vista === v && styles.segTextActivo]}>
              {v === 'hoy' ? `Hoy${pendientesAuth > 0 ? ` (${pendientesAuth})` : ''}` : v === 'semana' ? 'Semana' : 'Mes'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {vista === 'hoy' && (
        <ScrollView contentContainerStyle={styles.content}>
          {cargando
            ? <ActivityIndicator color={cartasBosque.bosque} style={{ marginTop: spacing[6] }} />
            : reservasHoy.length === 0
              ? (
                <View style={styles.vacioCont}>
                  <Ionicons name="shirt-outline" size={36} color={cartasBosque.niebla} />
                  <Text style={styles.vacioText}>Sin reservas hoy</Text>
                </View>
              )
              : reservasHoy.map(r => (
                <ReservaRow
                  key={r.id}
                  reserva={r}
                  onAutorizar={() => user && autorizarReserva(r.id, user.uid).catch(() => {})}
                  onCompletar={() => completarReserva(r.id).catch(() => {})}
                  onCancelar={() => cancelarReserva(r.id).catch(() => {})}
                />
              ))
          }
        </ScrollView>
      )}

      {vista === 'semana' && (
        <ScrollView contentContainerStyle={styles.content}>
          <VistaSemana inicioSem={inicioSem} />
          <Text style={styles.semanaLegenda}>
            ● confirmada &nbsp; ● pendiente &nbsp; ● auth. req.
          </Text>
        </ScrollView>
      )}

      {vista === 'mes' && (
        <ScrollView contentContainerStyle={styles.content}>
          {/* Nav mes */}
          <View style={styles.mesNav}>
            <TouchableOpacity onPress={() => cambiarMes(-1)} style={styles.mesNavBtn}>
              <Ionicons name="chevron-back" size={18} color={cartasBosque.bosque} />
            </TouchableOpacity>
            <Text style={styles.mesNavTitulo}>
              {MES_NOMBRES[mesActual.getMonth()]} {mesActual.getFullYear()}
            </Text>
            <TouchableOpacity onPress={() => cambiarMes(1)} style={styles.mesNavBtn}>
              <Ionicons name="chevron-forward" size={18} color={cartasBosque.bosque} />
            </TouchableOpacity>
          </View>
          <VistaMes mes={mesActual} />
          <Text style={styles.semanaLegenda}>
            ● confirmada &nbsp; ● pendiente &nbsp; ● auth. req.
          </Text>
        </ScrollView>
      )}
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  segmented: {
    flexDirection: 'row',
    borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro,
    backgroundColor: cartasBosque.bruma,
  },
  segBtn: {
    flex: 1, paddingVertical: spacing[2] + 2, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  segBtnActivo: { borderBottomColor: cartasBosque.bosque },
  segText: { fontFamily: 'SpaceMono_400Regular', fontSize: 11, color: cartasBosque.helecho },
  segTextActivo: { color: cartasBosque.bosque, fontFamily: 'SpaceMono_400Regular' },
  content: { padding: spacing[3], paddingBottom: spacing[8] },
  vacioCont: { alignItems: 'center', gap: spacing[2], marginTop: spacing[8] },
  vacioText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: cartasBosque.helecho },
  // Tarjeta
  reservaCard: {
    backgroundColor: cartasBosque.pergamino, borderRadius: borderRadius.md,
    padding: spacing[3], marginBottom: spacing[2],
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
  },
  reservaTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  reservaInfo: { flex: 1 },
  reservaHora: { fontFamily: 'SpaceMono_400Regular', fontSize: 16, color: cartasBosque.tinta },
  reservaNombre: { fontFamily: 'Inter_400Regular', fontSize: 12, color: cartasBosque.helecho, marginTop: 2 },
  extraTag: { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.corteza, marginTop: 2 },
  estadoBadge: { borderRadius: borderRadius.sm, paddingHorizontal: spacing[2], paddingVertical: 2 },
  estadoText: { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.bruma },
  accionesRow: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[2] },
  btnAccion: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: borderRadius.sm, paddingHorizontal: spacing[2], paddingVertical: 5,
  },
  btnAuth: { backgroundColor: cartasBosque.bosque },
  btnAuthText: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: cartasBosque.bruma },
  btnCompletar: { backgroundColor: cartasBosque.helecho },
  btnCompletarText: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: cartasBosque.bruma },
  btnCancelar: { borderWidth: 1, borderColor: cartasBosque.niebla, backgroundColor: 'transparent' },
  btnCancelarText: { fontFamily: 'Inter_400Regular', fontSize: 11, color: cartasBosque.helecho },
  // Mes
  mesNav:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[3] },
  mesNavBtn:     { padding: spacing[2] },
  mesNavTitulo:  { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: cartasBosque.tinta },
  mesContainer:  { },
  mesDiasRow:    { flexDirection: 'row', marginBottom: spacing[1] },
  mesDiaHeader:  { flex: 1, textAlign: 'center', fontFamily: 'SpaceMono_400Regular', fontSize: 9, color: cartasBosque.helecho, textTransform: 'uppercase' },
  mesRow:        { flexDirection: 'row' },
  mesCelda:      { flex: 1, minHeight: 52, padding: 4, borderWidth: 0.5, borderColor: cartasBosque.pergaminoOscuro, alignItems: 'center' },
  mesCeldaHoy:   { backgroundColor: cartasBosque.bosque + '14' },
  mesDiaNum:     { fontFamily: 'Inter_500Medium', fontSize: 12, color: cartasBosque.tinta },
  mesDiaNumHoy:  { color: cartasBosque.bosque, fontFamily: 'Inter_700Bold' },
  mesDots:       { flexDirection: 'row', flexWrap: 'wrap', gap: 2, marginTop: 2, justifyContent: 'center' },
  mesDot:        { width: 6, height: 6, borderRadius: 3 },
  mesMore:       { fontFamily: 'SpaceMono_400Regular', fontSize: 8, color: cartasBosque.helecho },
  // Semana
  semanaGrid: { flexDirection: 'row', gap: spacing[1] },
  semanaCol: {
    flex: 1, alignItems: 'center', padding: spacing[1],
    borderRadius: borderRadius.sm,
  },
  semanaColHoy: { backgroundColor: cartasBosque.pergamino },
  semanaDia: { fontFamily: 'SpaceMono_400Regular', fontSize: 9, color: cartasBosque.helecho },
  semanaDiaHoy: { color: cartasBosque.bosque },
  semanaNum: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: cartasBosque.tinta, marginVertical: 2 },
  semanaSlots: { gap: 3, alignItems: 'center' },
  semanaVacio: { width: 8, height: 8 },
  semanaDot: { width: 8, height: 8, borderRadius: 4 },
  semanaLegenda: {
    fontFamily: 'SpaceMono_400Regular', fontSize: 9, color: cartasBosque.niebla,
    textAlign: 'center', marginTop: spacing[3],
  },
});
