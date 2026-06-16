import React, { useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, StyleSheet, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { cartasBosque } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/spacing';
import { generarSlots, slotBloqueado, HORA_INICIO, HORA_FIN } from '@/services/firebase/lavanderia';

// ─── Constantes ───────────────────────────────────────────────

const DIAS_SEMANA_CORTOS = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
const DIAS_NOMBRE = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MESES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const MESES_LARGO = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

// ─── Helpers ──────────────────────────────────────────────────

function mismaFecha(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function inicioSemana(): Date {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatHora(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ─── Props ────────────────────────────────────────────────────

interface CalendarioReservaProps {
  slotsTomados: Date[];
  seleccionado: Date | null;
  onSeleccionar: (fecha: Date) => void;
}

// ─── Componente ───────────────────────────────────────────────

type Tab = 'hoy' | 'semana' | 'mes';

const TABS: { key: Tab; label: string }[] = [
  { key: 'hoy',    label: 'HOY'    },
  { key: 'semana', label: 'SEMANA' },
  { key: 'mes',    label: 'MES'    },
];

export default function CalendarioReserva({
  slotsTomados, seleccionado, onSeleccionar,
}: CalendarioReservaProps) {
  const [tab, setTab] = useState<Tab>('hoy');
  const [mesCalendario, setMesCalendario] = useState(() => {
    const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d;
  });
  const [diaModal, setDiaModal] = useState<Date | null>(null);

  const ahora = new Date();
  const hoy   = new Date(); hoy.setHours(0, 0, 0, 0);
  const limite = new Date(ahora.getTime() + 60 * 60_000);

  // ── HOY ───────────────────────────────────────────────────────
  const slotsHoy = generarSlots(hoy).filter(s => s >= limite && s.getHours() < HORA_FIN);

  // ── SEMANA ────────────────────────────────────────────────────
  const lunesSemana = inicioSemana();
  const diasSemana = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(lunesSemana); d.setDate(lunesSemana.getDate() + i); return d;
  });

  // ── MES ───────────────────────────────────────────────────────
  const anioMes = mesCalendario.getFullYear();
  const mesMes  = mesCalendario.getMonth();
  const diasEnMesCnt   = new Date(anioMes, mesMes + 1, 0).getDate();
  const primerDiaSemana = new Date(anioMes, mesMes, 1).getDay();
  const celdas: (number | null)[] = [
    ...Array(primerDiaSemana).fill(null),
    ...Array.from({ length: diasEnMesCnt }, (_, i) => i + 1),
  ];
  while (celdas.length % 7 !== 0) celdas.push(null);

  // ── Modal ─────────────────────────────────────────────────────
  const slotsModal = diaModal
    ? generarSlots(diaModal).filter(s => s >= limite && s.getHours() < HORA_FIN)
    : [];

  return (
    <View style={styles.container}>

      {/* ── Tab bar ──────────────────────────────────────────── */}
      <View style={styles.tabBar}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tabBtn, tab === t.key && styles.tabBtnActivo]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActivo]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── HOY ──────────────────────────────────────────────── */}
      {tab === 'hoy' && (
        <View style={styles.tabContent}>
          <Text style={styles.secLabel}>
            {ahora.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
          </Text>
          {slotsHoy.length === 0 ? (
            <Text style={styles.emptyText}>Sin horarios disponibles para hoy</Text>
          ) : (
            <View style={styles.slotsWrap}>
              {slotsHoy.map(slot => {
                const bloqueado = slotBloqueado(slot, slotsTomados);
                const esEste = seleccionado?.getTime() === slot.getTime();
                return (
                  <TouchableOpacity
                    key={slot.toISOString()}
                    style={[styles.slot, bloqueado && styles.slotBloqueado, esEste && styles.slotSelec]}
                    onPress={() => !bloqueado && onSeleccionar(slot)}
                    disabled={bloqueado}
                  >
                    <Text style={[
                      styles.slotText,
                      bloqueado && styles.slotTextBloqueado,
                      esEste && styles.slotTextSelec,
                    ]}>
                      {formatHora(slot)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
          <Text style={styles.legenda}>
            Horario {HORA_INICIO}:00–{HORA_FIN}:00 · 60 min · mín 30 min entre cargas
          </Text>
        </View>
      )}

      {/* ── SEMANA ───────────────────────────────────────────── */}
      {tab === 'semana' && (
        <View style={styles.tabContent}>
          {diasSemana.map((dia, idx) => {
            const esPasado  = dia < hoy;
            const esHoy     = mismaFecha(dia, hoy);
            const esDiaSelec = !!(seleccionado && mismaFecha(seleccionado, dia));
            const slotsDisp = esPasado ? 0
              : generarSlots(dia)
                  .filter(s => s >= limite && s.getHours() < HORA_FIN && !slotBloqueado(s, slotsTomados))
                  .length;
            return (
              <TouchableOpacity
                key={idx}
                style={[styles.semanaFila, esPasado && styles.semanaFilaPasado]}
                onPress={() => !esPasado && setDiaModal(dia)}
                disabled={esPasado}
                activeOpacity={0.7}
              >
                <View style={[styles.semanaNumWrap, esHoy && styles.semanaNumHoy]}>
                  <Text style={[styles.semanaLabel, esHoy && styles.semanaTextoHoy]}>
                    {DIAS_SEMANA_CORTOS[dia.getDay()]}
                  </Text>
                  <Text style={[styles.semanaNum, esHoy && styles.semanaTextoHoy]}>
                    {dia.getDate()}
                  </Text>
                </View>
                <View style={styles.semanaInfo}>
                  {esDiaSelec
                    ? <Text style={styles.semanaSlotSelec}>{formatHora(seleccionado!)} seleccionado</Text>
                    : slotsDisp > 0
                    ? <Text style={styles.semanaDisp}>{slotsDisp} disponibles</Text>
                    : <Text style={styles.semanaOcupado}>sin disponibilidad</Text>
                  }
                </View>
                {!esPasado && (
                  <Ionicons name="chevron-forward" size={14} color={cartasBosque.niebla} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* ── MES ──────────────────────────────────────────────── */}
      {tab === 'mes' && (
        <View style={styles.tabContent}>
          {/* Navegación */}
          <View style={styles.calNav}>
            <TouchableOpacity
              onPress={() => setMesCalendario(d => { const n = new Date(d); n.setMonth(n.getMonth() - 1); return n; })}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="chevron-back" size={18} color={cartasBosque.tinta} />
            </TouchableOpacity>
            <Text style={styles.calNavTitulo}>{MESES_ES[mesMes].toUpperCase()} {anioMes}</Text>
            <TouchableOpacity
              onPress={() => setMesCalendario(d => { const n = new Date(d); n.setMonth(n.getMonth() + 1); return n; })}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="chevron-forward" size={18} color={cartasBosque.tinta} />
            </TouchableOpacity>
          </View>

          {/* Encabezados de día */}
          <View style={styles.calGridRow}>
            {DIAS_SEMANA_CORTOS.map(d => (
              <Text key={d} style={styles.calDiaNombre}>{d}</Text>
            ))}
          </View>

          {/* Cuadrícula */}
          <View style={styles.calGrid}>
            {celdas.map((dia, idx) => {
              if (dia === null) return <View key={`b-${idx}`} style={styles.calCelda} />;
              const fechaCelda = new Date(anioMes, mesMes, dia);
              const esPasado   = fechaCelda < hoy;
              const esHoy      = mismaFecha(fechaCelda, new Date());
              const esDiaSelec = !!(seleccionado && mismaFecha(seleccionado, fechaCelda));
              return (
                <TouchableOpacity
                  key={dia}
                  style={[styles.calCelda, esPasado && { opacity: 0.3 }]}
                  onPress={() => !esPasado && setDiaModal(fechaCelda)}
                  disabled={esPasado}
                  activeOpacity={0.7}
                >
                  <View style={[
                    styles.calNumWrap,
                    esHoy && styles.calNumHoy,
                    esDiaSelec && styles.calNumSelec,
                  ]}>
                    <Text style={[
                      styles.calNum,
                      esHoy && styles.calNumHoyText,
                      esDiaSelec && styles.calNumSelecText,
                    ]}>
                      {dia}
                    </Text>
                  </View>
                  {esDiaSelec && (
                    <View style={[styles.calDot, { backgroundColor: cartasBosque.helecho }]} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.legenda}>
            Horario {HORA_INICIO}:00–{HORA_FIN}:00 · 60 min · mín 30 min entre cargas
          </Text>
        </View>
      )}

      {/* ── Modal detalle de día ─────────────────────────────── */}
      <Modal
        visible={diaModal !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setDiaModal(null)}
      >
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setDiaModal(null)} />
        <View style={styles.sheet}>
          {diaModal && (
            <>
              <Text style={styles.sheetTitulo}>
                {DIAS_NOMBRE[diaModal.getDay()]} {diaModal.getDate()} de {MESES_LARGO[diaModal.getMonth()]}
              </Text>
              <Text style={styles.sheetSub}>Selecciona un horario</Text>
              {slotsModal.length === 0 ? (
                <Text style={styles.emptyText}>Sin horarios disponibles para este día</Text>
              ) : (
                <ScrollView style={{ maxHeight: 280 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                  {slotsModal.map(slot => {
                    const bloqueado = slotBloqueado(slot, slotsTomados);
                    const esEste    = seleccionado?.getTime() === slot.getTime();
                    return (
                      <TouchableOpacity
                        key={slot.toISOString()}
                        style={[
                          styles.horaItem,
                          bloqueado && styles.horaItemBloqueado,
                          esEste && styles.horaItemSel,
                        ]}
                        onPress={() => { if (!bloqueado) { onSeleccionar(slot); setDiaModal(null); } }}
                        disabled={bloqueado}
                      >
                        <Text style={[
                          styles.horaText,
                          bloqueado && styles.horaTextBloqueado,
                          esEste && styles.horaTextSel,
                        ]}>
                          {formatHora(slot)}
                        </Text>
                        {esEste && <Ionicons name="checkmark-circle" size={16} color={cartasBosque.bruma} />}
                        {bloqueado && <Text style={styles.horaOcupado}>ocupado</Text>}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
              <TouchableOpacity style={styles.btnSecundario} onPress={() => setDiaModal(null)}>
                <Text style={styles.btnSecundarioText}>Cerrar</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </Modal>
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    backgroundColor: cartasBosque.pergamino,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: cartasBosque.pergaminoOscuro,
    overflow: 'hidden',
  },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro,
  },
  tabBtn: {
    flex: 1, paddingVertical: spacing[2] + 2, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabBtnActivo:  { borderBottomColor: cartasBosque.bosque },
  tabText:       { fontFamily: 'MonaSans_400Regular', fontSize: 11, color: cartasBosque.helecho },
  tabTextActivo: { color: cartasBosque.bosque },

  tabContent: { padding: spacing[3] },

  // Shared
  secLabel: {
    fontFamily: 'MonaSans_400Regular', fontSize: 10, color: cartasBosque.helecho,
    letterSpacing: 0.4, marginBottom: spacing[2], textTransform: 'capitalize',
  },
  emptyText: {
    fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: cartasBosque.niebla,
    textAlign: 'center', paddingVertical: spacing[4],
  },
  legenda: {
    fontFamily: 'MonaSans_400Regular', fontSize: 9, color: cartasBosque.niebla,
    marginTop: spacing[2], textAlign: 'center',
  },

  // HOY – slot chips
  slotsWrap: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing[1] + 1,
    marginBottom: spacing[1],
  },
  slot: {
    paddingHorizontal: spacing[2], paddingVertical: spacing[1] + 2,
    borderRadius: borderRadius.sm, borderWidth: 1, borderColor: cartasBosque.helecho,
    backgroundColor: cartasBosque.bruma, minWidth: 52, alignItems: 'center',
  },
  slotBloqueado: {
    borderColor: cartasBosque.pergaminoOscuro, backgroundColor: cartasBosque.pergaminoOscuro,
  },
  slotSelec: { backgroundColor: cartasBosque.bosque, borderColor: cartasBosque.bosque },
  slotText:         { fontFamily: 'MonaSans_400Regular', fontSize: 12, color: cartasBosque.bosque },
  slotTextBloqueado:{ color: cartasBosque.niebla },
  slotTextSelec:    { color: cartasBosque.bruma },

  // SEMANA
  semanaFila: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: spacing[2],
    borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro,
    gap: spacing[3],
  },
  semanaFilaPasado: { opacity: 0.35 },
  semanaNumWrap: {
    width: 44, height: 44, borderRadius: borderRadius.sm,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: cartasBosque.bruma,
  },
  semanaNumHoy:   { backgroundColor: cartasBosque.bosque },
  semanaLabel:    { fontFamily: 'MonaSans_400Regular', fontSize: 8, color: cartasBosque.helecho, textTransform: 'uppercase' },
  semanaNum:      { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 16, color: cartasBosque.tinta },
  semanaTextoHoy: { color: cartasBosque.bruma },
  semanaInfo:     { flex: 1 },
  semanaDisp:     { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: cartasBosque.helecho },
  semanaOcupado:  { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: cartasBosque.niebla },
  semanaSlotSelec:{ fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 12, color: cartasBosque.bosque },

  // MES calendario
  calNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: spacing[3],
  },
  calNavTitulo: {
    fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 14, color: cartasBosque.tinta,
  },
  calGridRow: { flexDirection: 'row', marginBottom: spacing[1] },
  calDiaNombre: {
    flex: 1, textAlign: 'center',
    fontFamily: 'MonaSans_400Regular', fontSize: 9, color: cartasBosque.helecho,
  },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCelda: {
    width: `${100 / 7}%`, alignItems: 'center',
    paddingVertical: spacing[1], minHeight: 44,
  },
  calNumWrap: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  calNumHoy:      { backgroundColor: cartasBosque.bosque },
  calNumSelec:    { backgroundColor: cartasBosque.helecho },
  calNum:         { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: cartasBosque.tinta },
  calNumHoyText:  { color: cartasBosque.bruma },
  calNumSelecText:{ color: cartasBosque.bruma },
  calDot:         { width: 5, height: 5, borderRadius: 3, marginTop: 2 },

  // Modal
  overlay: { flex: 1, backgroundColor: 'rgba(18,42,31,0.35)' },
  sheet: {
    backgroundColor: cartasBosque.bruma,
    borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl,
    padding: spacing[5], paddingBottom: spacing[8],
  },
  sheetTitulo: {
    fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 18, color: cartasBosque.tinta,
    marginBottom: spacing[1],
  },
  sheetSub: {
    fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: cartasBosque.helecho,
    marginBottom: spacing[3],
  },
  horaItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacing[2] + 1, paddingHorizontal: spacing[3],
    borderRadius: borderRadius.sm, marginBottom: 2,
  },
  horaItemBloqueado: { backgroundColor: `${cartasBosque.pergaminoOscuro}60` },
  horaItemSel:        { backgroundColor: cartasBosque.bosque },
  horaText:           { fontFamily: 'MonaSans_400Regular', fontSize: 13, color: cartasBosque.tinta },
  horaTextBloqueado:  { color: cartasBosque.niebla },
  horaTextSel:        { color: cartasBosque.bruma, fontFamily: 'BricolageGrotesque_600SemiBold' },
  horaOcupado:        { fontFamily: 'MonaSans_400Regular', fontSize: 10, color: cartasBosque.niebla },
  btnSecundario:      { paddingVertical: spacing[3], alignItems: 'center', marginTop: spacing[3] },
  btnSecundarioText:  { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: cartasBosque.helecho },
});
