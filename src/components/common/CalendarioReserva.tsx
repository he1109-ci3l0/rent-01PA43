import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { cartasBosque } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/spacing';
import { generarSlots, slotBloqueado, HORA_INICIO, HORA_FIN } from '@/services/firebase/lavanderia';

// ─── Constantes ───────────────────────────────────────────────

const DIAS_SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];

// ─── Helpers ──────────────────────────────────────────────────

function primerDiaMes(año: number, mes: number): Date {
  return new Date(año, mes, 1);
}

function diasEnMes(año: number, mes: number): number {
  return new Date(año, mes + 1, 0).getDate();
}

// Índice del primer día en la cuadrícula (lunes=0)
function offsetMes(año: number, mes: number): number {
  const dow = primerDiaMes(año, mes).getDay(); // 0=dom
  return (dow + 6) % 7;
}

function mismoMes(a: Date, b: Date) {
  return a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
}

function formatHora(d: Date): string {
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

// ─── Props ────────────────────────────────────────────────────

interface CalendarioReservaProps {
  slotsTomados: Date[];
  seleccionado: Date | null;
  onSeleccionar: (fecha: Date) => void;
}

// ─── Componente ───────────────────────────────────────────────

export default function CalendarioReserva({
  slotsTomados,
  seleccionado,
  onSeleccionar,
}: CalendarioReservaProps) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const [año, setAño] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth());
  const [diaSelec, setDiaSelec] = useState<Date | null>(null);

  const offset = offsetMes(año, mes);
  const totalDias = diasEnMes(año, mes);
  const celdas: (Date | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: totalDias }, (_, i) => new Date(año, mes, i + 1)),
  ];

  // Completar a múltiplos de 7
  while (celdas.length % 7 !== 0) celdas.push(null);

  function navegarMes(delta: number) {
    const d = new Date(año, mes + delta, 1);
    setAño(d.getFullYear());
    setMes(d.getMonth());
    setDiaSelec(null);
  }

  const slotsDelDia: Date[] = diaSelec ? generarSlots(diaSelec) : [];

  // Solo mostrar slots a partir de ahora (+ 1 hora de margen)
  const ahora = new Date();
  const slotsFiltrados = slotsDelDia.filter(s => {
    const limite = new Date(ahora.getTime() + 60 * 60_000);
    return s >= limite && s.getHours() < HORA_FIN;
  });

  return (
    <View style={styles.container}>
      {/* Encabezado mes */}
      <View style={styles.mesHeader}>
        <TouchableOpacity onPress={() => navegarMes(-1)} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={20} color={cartasBosque.tinta} />
        </TouchableOpacity>
        <Text style={styles.mesTitulo}>{MESES[mes]} {año}</Text>
        <TouchableOpacity onPress={() => navegarMes(1)} style={styles.navBtn}>
          <Ionicons name="chevron-forward" size={20} color={cartasBosque.tinta} />
        </TouchableOpacity>
      </View>

      {/* Días de semana */}
      <View style={styles.diaSemanaRow}>
        {DIAS_SEMANA.map(d => (
          <Text key={d} style={styles.diaSemanaLabel}>{d}</Text>
        ))}
      </View>

      {/* Cuadrícula */}
      <View style={styles.grid}>
        {celdas.map((dia, idx) => {
          if (!dia) return <View key={`vacio-${idx}`} style={styles.celda} />;
          const esPasado = dia < hoy;
          const esHoy = dia.toDateString() === hoy.toDateString();
          const esSelec = diaSelec?.toDateString() === dia.toDateString();

          return (
            <TouchableOpacity
              key={dia.toISOString()}
              style={[
                styles.celda,
                esHoy && styles.celdaHoy,
                esSelec && styles.celdaSelec,
                esPasado && styles.celdaPasado,
              ]}
              onPress={() => !esPasado && setDiaSelec(dia)}
              disabled={esPasado}
            >
              <Text style={[
                styles.celdaNum,
                esPasado && styles.celdaNumPasado,
                esSelec && styles.celdaNumSelec,
              ]}>
                {dia.getDate()}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Slots de hora */}
      {diaSelec && (
        <View style={styles.slotsContainer}>
          <Text style={styles.slotsTitulo}>
            Horarios disponibles — {diaSelec.toLocaleDateString('es-MX', {
              weekday: 'long', day: 'numeric', month: 'long',
            })}
          </Text>
          {slotsFiltrados.length === 0 ? (
            <Text style={styles.slotsVacio}>Sin slots disponibles para este día</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.slotsRow}>
                {slotsFiltrados.map(slot => {
                  const bloqueado = slotBloqueado(slot, slotsTomados);
                  const esEsteSlot = seleccionado?.getTime() === slot.getTime();
                  return (
                    <TouchableOpacity
                      key={slot.toISOString()}
                      style={[
                        styles.slot,
                        bloqueado && styles.slotBloqueado,
                        esEsteSlot && styles.slotSelec,
                      ]}
                      onPress={() => !bloqueado && onSeleccionar(slot)}
                      disabled={bloqueado}
                    >
                      <Text style={[
                        styles.slotText,
                        bloqueado && styles.slotTextBloqueado,
                        esEsteSlot && styles.slotTextSelec,
                      ]}>
                        {formatHora(slot)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          )}
          <Text style={styles.legendaText}>
            Horario: {HORA_INICIO}:00–{HORA_FIN}:00 · duración 60 min · min 30 min entre cargas
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────

const CELDA_SIZE = 40;

const styles = StyleSheet.create({
  container: {
    backgroundColor: cartasBosque.pergamino,
    borderRadius: borderRadius.md,
    padding: spacing[3],
    borderWidth: 1,
    borderColor: cartasBosque.pergaminoOscuro,
  },
  mesHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: spacing[2],
  },
  mesTitulo: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: cartasBosque.tinta },
  navBtn: { padding: spacing[1] },
  diaSemanaRow: { flexDirection: 'row', marginBottom: spacing[1] },
  diaSemanaLabel: {
    width: CELDA_SIZE, textAlign: 'center',
    fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.helecho,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  celda: {
    width: CELDA_SIZE, height: CELDA_SIZE,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: CELDA_SIZE / 2,
  },
  celdaHoy: { borderWidth: 1, borderColor: cartasBosque.helecho },
  celdaSelec: { backgroundColor: cartasBosque.bosque },
  celdaPasado: { opacity: 0.3 },
  celdaNum: { fontFamily: 'Inter_400Regular', fontSize: 13, color: cartasBosque.tinta },
  celdaNumPasado: { color: cartasBosque.niebla },
  celdaNumSelec: { color: cartasBosque.bruma, fontFamily: 'Inter_600SemiBold' },
  // Slots
  slotsContainer: { marginTop: spacing[3] },
  slotsTitulo: {
    fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.helecho,
    letterSpacing: 0.4, marginBottom: spacing[2],
  },
  slotsVacio: { fontFamily: 'Inter_400Regular', fontSize: 12, color: cartasBosque.niebla },
  slotsRow: { flexDirection: 'row', gap: spacing[1], paddingBottom: spacing[1] },
  slot: {
    paddingHorizontal: spacing[2], paddingVertical: spacing[1] + 2,
    borderRadius: borderRadius.sm, borderWidth: 1, borderColor: cartasBosque.helecho,
    backgroundColor: cartasBosque.bruma, minWidth: 52, alignItems: 'center',
  },
  slotBloqueado: {
    borderColor: cartasBosque.pergaminoOscuro, backgroundColor: cartasBosque.pergaminoOscuro,
  },
  slotSelec: { backgroundColor: cartasBosque.bosque, borderColor: cartasBosque.bosque },
  slotText: { fontFamily: 'SpaceMono_400Regular', fontSize: 12, color: cartasBosque.bosque },
  slotTextBloqueado: { color: cartasBosque.niebla },
  slotTextSelec: { color: cartasBosque.bruma },
  legendaText: {
    fontFamily: 'SpaceMono_400Regular', fontSize: 9, color: cartasBosque.niebla,
    marginTop: spacing[2], textAlign: 'center',
  },
});
