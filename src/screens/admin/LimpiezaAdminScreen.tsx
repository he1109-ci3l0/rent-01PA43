import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, FlatList, Modal, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Timestamp } from 'firebase/firestore';
import { cartasBosque } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/spacing';
import TurnoCard from '@/components/common/TurnoCard';
import {
  listenTodosTurnos, listenPermutasPendientes, listenIncumplimientos,
  seedTurnos, moverTurno, marcarIncumplimiento,
  aprobarPermuta, bloquearPermuta,
  AREA_LABELS, AREA_ICONS, AREAS_COMUNES, formatFechaTurno,
  HORAS_LIMITE_FOTO,
} from '@/services/firebase/limpieza';
import type { TurnoLimpieza, PermutaLimpieza, AreaLimpieza } from '@/types/firestore';

// ─── Helpers ──────────────────────────────────────────────────

type Vista = 'calendario' | 'permutas' | 'incumplimientos';

const HORAS = Array.from({ length: 16 }, (_, i) => `${String(i + 7).padStart(2, '0')}:00`);

function agruparPorFecha(
  turnos: TurnoLimpieza[],
): Array<{ fecha: string; items: TurnoLimpieza[] }> {
  const map = new Map<string, TurnoLimpieza[]>();
  for (const t of turnos) {
    const key = t.fechaProgramada.toDate().toLocaleDateString('es-MX', {
      weekday: 'short', day: 'numeric', month: 'short',
    });
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(t);
  }
  return Array.from(map.entries()).map(([fecha, items]) => ({ fecha, items }));
}

// ─── Modal mover turno ────────────────────────────────────────

function ModalMover({
  turno, visible, onClose,
}: {
  turno: TurnoLimpieza | null;
  visible: boolean;
  onClose: () => void;
}) {
  const [hora, setHora]         = useState('08:00');
  const [diasOffset, setDias]   = useState(0);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (turno) { setHora(turno.horaInicio); setDias(0); }
  }, [turno]);

  async function confirmar() {
    if (!turno) return;
    setGuardando(true);
    try {
      const base = turno.fechaProgramada.toDate();
      base.setDate(base.getDate() + diasOffset);
      await moverTurno(turno.id, base, hora);
      onClose();
    } catch {
      Alert.alert('Error', 'No se pudo mover el turno.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        <Text style={styles.sheetTitulo}>Mover turno</Text>
        {turno && (
          <Text style={styles.sheetSub}>
            {turno.inquilinoNombre} · {AREA_LABELS[turno.area]}
          </Text>
        )}

        <Text style={styles.sheetLabel}>DESPLAZAR DÍAS</Text>
        <View style={styles.stepper}>
          <TouchableOpacity onPress={() => setDias(d => d - 1)} style={styles.stepBtn}>
            <Ionicons name="remove-outline" size={20} color={cartasBosque.bosque} />
          </TouchableOpacity>
          <Text style={styles.stepValue}>{diasOffset > 0 ? `+${diasOffset}` : diasOffset}</Text>
          <TouchableOpacity onPress={() => setDias(d => d + 1)} style={styles.stepBtn}>
            <Ionicons name="add-outline" size={20} color={cartasBosque.bosque} />
          </TouchableOpacity>
        </View>

        <Text style={styles.sheetLabel}>HORA</Text>
        <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
          {HORAS.map(h => (
            <TouchableOpacity
              key={h}
              style={[styles.horaItem, hora === h && styles.horaItemSel]}
              onPress={() => setHora(h)}
            >
              <Text style={[styles.horaText, hora === h && styles.horaTextSel]}>{h}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <TouchableOpacity
          style={[styles.btnPrimario, guardando && { opacity: 0.5 }]}
          onPress={confirmar} disabled={guardando}
        >
          {guardando
            ? <ActivityIndicator color={cartasBosque.bruma} />
            : <Text style={styles.btnPrimarioText}>Guardar</Text>
          }
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnSecundario} onPress={onClose}>
          <Text style={styles.btnSecundarioText}>Cancelar</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ─── Fila permuta ─────────────────────────────────────────────

function PermutaRow({
  permuta, onAprobar, onBloquear,
}: {
  permuta: PermutaLimpieza;
  onAprobar: () => void;
  onBloquear: () => void;
}) {
  return (
    <View style={styles.permutaCard}>
      <View style={styles.permutaTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.permutaTitle}>
            {permuta.solicitanteNombre}
            <Text style={styles.permutaSub}> · Hab. {permuta.solicitanteHab || '—'}</Text>
          </Text>
          <Text style={styles.permutaSub}>
            {formatFechaTurno(permuta.turnoOrigenFecha)} → con {permuta.inquilinoDestinoNombre}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: '#E8EBE0' }]}>
          <Text style={[styles.badgeText, { color: '#8A6A72' }]}>pendiente</Text>
        </View>
      </View>
      <View style={styles.permutaAcciones}>
        <TouchableOpacity style={styles.btnAprobar} onPress={onAprobar}>
          <Ionicons name="checkmark-outline" size={13} color={cartasBosque.bruma} />
          <Text style={styles.btnAprobarText}>Aprobar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnBloquear} onPress={onBloquear}>
          <Ionicons name="ban-outline" size={13} color={cartasBosque.helecho} />
          <Text style={styles.btnBloquearText}>Bloquear</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Fila incumplimiento ──────────────────────────────────────

function IncumpRow({ turno }: { turno: TurnoLimpieza }) {
  return (
    <View style={styles.incumpCard}>
      <View style={{ flex: 1 }}>
        <Text style={styles.incumpNombre}>{turno.inquilinoNombre}</Text>
        <Text style={styles.incumpSub}>
          {AREA_LABELS[turno.area]} · {formatFechaTurno(turno.fechaProgramada)} · {turno.horaInicio}
        </Text>
      </View>
      <View style={[styles.badge, { backgroundColor: 'rgba(103,0,16,0.15)' }]}>
        <Text style={[styles.badgeText, { color: '#960018' }]}>incumpl.</Text>
      </View>
    </View>
  );
}

// ─── Pantalla principal ───────────────────────────────────────

export default function LimpiezaAdminScreen() {
  const [vista, setVista]             = useState<Vista>('calendario');
  const [turnos, setTurnos]           = useState<TurnoLimpieza[]>([]);
  const [permutas, setPermutas]       = useState<PermutaLimpieza[]>([]);
  const [incumplimientos, setIncumpl] = useState<TurnoLimpieza[]>([]);
  const [cargando, setCargando]       = useState(true);
  const [turnoMover, setTurnoMover]   = useState<TurnoLimpieza | null>(null);
  const [seeding, setSeeding]         = useState(false);

  // filtro de área
  const [areaFiltro, setAreaFiltro] = useState<AreaLimpieza | 'todas'>('todas');

  useEffect(() => {
    seedTurnos()
      .catch(() => {})
      .finally(() => setSeeding(false));

    const uns1 = listenTodosTurnos(data => {
      setTurnos(data);
      setCargando(false);
    });
    const uns2 = listenPermutasPendientes(setPermutas);
    const uns3 = listenIncumplimientos(setIncumpl);
    return () => { uns1(); uns2(); uns3(); };
  }, []);

  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const turnosFiltrados = turnos.filter(t => {
    const futuro = t.fechaProgramada.toDate() >= hoy;
    const matchArea = areaFiltro === 'todas' || t.area === areaFiltro;
    return futuro && matchArea;
  });

  const grupos = agruparPorFecha(turnosFiltrados);

  const ALL_AREAS: Array<AreaLimpieza | 'todas'> = [
    'todas', 'bano_1_pb', 'bano_2_pb', 'bano_gris', 'bano_marron', 'bano_terraza',
    'cocina_pb', 'cocina_tp', 'pasillo', 'escalera', 'patio', 'tendedero',
  ];

  async function handleMarcarIncumplimiento(turno: TurnoLimpieza) {
    Alert.alert(
      'Marcar incumplimiento',
      `¿Registrar incumplimiento para ${turno.inquilinoNombre}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar', style: 'destructive',
          onPress: () => marcarIncumplimiento(turno.id).catch(() => {}),
        },
      ],
    );
  }

  async function handleAprobar(p: PermutaLimpieza) {
    try { await aprobarPermuta(p); }
    catch { Alert.alert('Error', 'No se pudo aprobar la permuta.'); }
  }

  async function handleBloquear(p: PermutaLimpieza) {
    try { await bloquearPermuta(p); }
    catch { Alert.alert('Error', 'No se pudo bloquear la permuta.'); }
  }

  return (
    <View style={{ flex: 1, backgroundColor: cartasBosque.bruma }}>
      {/* Tab bar interno */}
      <View style={styles.tabs}>
        {([
          ['calendario',      `Calendario (${turnosFiltrados.length})`],
          ['permutas',        `Permutas (${permutas.length})`],
          ['incumplimientos', `Incumpl. (${incumplimientos.length})`],
        ] as [Vista, string][]).map(([v, label]) => (
          <TouchableOpacity
            key={v}
            style={[styles.tabBtn, vista === v && styles.tabBtnActivo]}
            onPress={() => setVista(v)}
          >
            <Text style={[styles.tabText, vista === v && styles.tabTextActivo]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {cargando ? (
        <ActivityIndicator color={cartasBosque.bosque} style={{ marginTop: spacing[8] }} />
      ) : vista === 'calendario' ? (
        <>
          {/* Filtro de área */}
          <ScrollView
            horizontal showsHorizontalScrollIndicator={false}
            style={styles.areaScroll}
            contentContainerStyle={{ gap: spacing[2], padding: spacing[3] }}
          >
            {ALL_AREAS.map(a => (
              <TouchableOpacity
                key={a}
                style={[styles.areaChip, areaFiltro === a && styles.areaChipActivo]}
                onPress={() => setAreaFiltro(a)}
              >
                {a !== 'todas' && (
                  <Ionicons
                    name={AREA_ICONS[a as AreaLimpieza] as any}
                    size={12}
                    color={areaFiltro === a ? cartasBosque.bruma : cartasBosque.bosque}
                  />
                )}
                <Text style={[styles.areaChipText, areaFiltro === a && styles.areaChipTextActivo]}>
                  {a === 'todas' ? 'Todas' : AREA_LABELS[a as AreaLimpieza]}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {grupos.length === 0 ? (
            <View style={styles.vacio}>
              <Ionicons name="brush-outline" size={36} color={cartasBosque.niebla} />
              <Text style={styles.vacioText}>Sin turnos próximos</Text>
            </View>
          ) : (
            <FlatList
              data={grupos}
              keyExtractor={g => g.fecha}
              contentContainerStyle={{ padding: spacing[4], paddingBottom: spacing[10] }}
              renderItem={({ item: grupo }) => (
                <View>
                  <Text style={styles.fechaHeader}>{grupo.fecha}</Text>
                  {grupo.items.map(t => (
                    <View key={t.id}>
                      <TurnoCard
                        turno={t}
                        onMover={t2 => setTurnoMover(t2)}
                      />
                      {t.estado === 'pendiente' && (
                        <TouchableOpacity
                          style={styles.btnIncumplimiento}
                          onPress={() => handleMarcarIncumplimiento(t)}
                        >
                          <Text style={styles.btnIncumplimientoText}>
                            Registrar incumplimiento
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                </View>
              )}
            />
          )}
        </>
      ) : vista === 'permutas' ? (
        <FlatList
          data={permutas}
          keyExtractor={p => p.id}
          contentContainerStyle={{ padding: spacing[4], paddingBottom: spacing[10] }}
          ListEmptyComponent={
            <View style={styles.vacio}>
              <Ionicons name="swap-horizontal-outline" size={36} color={cartasBosque.niebla} />
              <Text style={styles.vacioText}>Sin permutas pendientes</Text>
            </View>
          }
          renderItem={({ item }) => (
            <PermutaRow
              permuta={item}
              onAprobar={() => handleAprobar(item)}
              onBloquear={() => handleBloquear(item)}
            />
          )}
        />
      ) : (
        <FlatList
          data={incumplimientos}
          keyExtractor={t => t.id}
          contentContainerStyle={{ padding: spacing[4], paddingBottom: spacing[10] }}
          ListEmptyComponent={
            <View style={styles.vacio}>
              <Ionicons name="shield-checkmark-outline" size={36} color={cartasBosque.niebla} />
              <Text style={styles.vacioText}>Sin incumplimientos registrados</Text>
            </View>
          }
          renderItem={({ item }) => <IncumpRow turno={item} />}
        />
      )}

      <ModalMover
        turno={turnoMover}
        visible={turnoMover !== null}
        onClose={() => setTurnoMover(null)}
      />
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro,
    backgroundColor: cartasBosque.bruma,
  },
  tabBtn: {
    flex: 1, paddingVertical: spacing[2], alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabBtnActivo: { borderBottomColor: cartasBosque.bosque },
  tabText:      { fontFamily: 'DMMono_400Regular', fontSize: 9, color: cartasBosque.helecho },
  tabTextActivo:{ color: cartasBosque.bosque },
  areaScroll: { borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro, maxHeight: 52 },
  areaChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing[2] + 2, paddingVertical: spacing[1] + 1,
    borderRadius: borderRadius.full,
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    backgroundColor: cartasBosque.pergamino,
  },
  areaChipActivo: { backgroundColor: cartasBosque.bosque, borderColor: cartasBosque.bosque },
  areaChipText:   { fontFamily: 'DMMono_400Regular', fontSize: 10, color: cartasBosque.bosque },
  areaChipTextActivo: { color: cartasBosque.bruma },
  fechaHeader: {
    fontFamily: 'DMSans_600SemiBold', fontSize: 13, color: cartasBosque.tinta,
    marginBottom: spacing[2], marginTop: spacing[3],
  },
  btnIncumplimiento: {
    alignSelf: 'flex-end', marginTop: -spacing[1], marginBottom: spacing[2],
    paddingHorizontal: spacing[2], paddingVertical: 3,
  },
  btnIncumplimientoText: {
    fontFamily: 'DMMono_400Regular', fontSize: 9, color: '#960018', letterSpacing: 0.2,
  },
  vacio: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[2], marginTop: spacing[10] },
  vacioText: { fontFamily: 'DMSans_400Regular', fontSize: 14, color: cartasBosque.helecho },
  // Permuta
  permutaCard: {
    backgroundColor: cartasBosque.pergamino,
    borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    padding: spacing[3], marginBottom: spacing[2],
  },
  permutaTop:    { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing[2] },
  permutaTitle:  { fontFamily: 'DMSans_600SemiBold', fontSize: 13, color: cartasBosque.tinta },
  permutaSub:    { fontFamily: 'DMSans_400Regular', fontSize: 11, color: cartasBosque.helecho, marginTop: 2 },
  permutaAcciones: { flexDirection: 'row', gap: spacing[2] },
  btnAprobar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[1],
    backgroundColor: cartasBosque.bosque,
    paddingHorizontal: spacing[3], paddingVertical: spacing[1] + 2,
    borderRadius: borderRadius.sm,
  },
  btnAprobarText: { fontFamily: 'DMSans_600SemiBold', fontSize: 12, color: cartasBosque.bruma },
  btnBloquear: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[1],
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    paddingHorizontal: spacing[2], paddingVertical: spacing[1] + 1,
    borderRadius: borderRadius.sm,
  },
  btnBloquearText: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: cartasBosque.helecho },
  badge: { paddingHorizontal: spacing[2], paddingVertical: 3, borderRadius: borderRadius.full },
  badgeText: { fontFamily: 'DMMono_400Regular', fontSize: 9, letterSpacing: 0.3 },
  // Incumplimiento
  incumpCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: cartasBosque.pergamino,
    borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    padding: spacing[3], marginBottom: spacing[2],
  },
  incumpNombre: { fontFamily: 'DMSans_600SemiBold', fontSize: 13, color: cartasBosque.tinta },
  incumpSub:    { fontFamily: 'DMSans_400Regular', fontSize: 11, color: cartasBosque.helecho, marginTop: 2 },
  // Modal
  overlay: { flex: 1, backgroundColor: 'rgba(18,42,31,0.35)' },
  sheet: {
    backgroundColor: cartasBosque.bruma,
    borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl,
    padding: spacing[5], paddingBottom: spacing[8],
  },
  sheetTitulo: { fontFamily: 'DMSans_600SemiBold', fontSize: 18, color: cartasBosque.tinta, marginBottom: spacing[1] },
  sheetSub:    { fontFamily: 'DMSans_400Regular', fontSize: 13, color: cartasBosque.helecho, marginBottom: spacing[3] },
  sheetLabel:  { fontFamily: 'DMMono_400Regular', fontSize: 10, color: cartasBosque.helecho, letterSpacing: 0.5, marginBottom: spacing[1], marginTop: spacing[2] },
  stepper:     { flexDirection: 'row', alignItems: 'center', gap: spacing[4], marginBottom: spacing[2] },
  stepBtn:     { padding: spacing[2] },
  stepValue:   { fontFamily: 'DMMono_400Regular', fontSize: 18, color: cartasBosque.tinta, minWidth: 32, textAlign: 'center' },
  horaItem:    { paddingVertical: spacing[2], paddingHorizontal: spacing[3], borderRadius: borderRadius.sm, marginBottom: 2 },
  horaItemSel: { backgroundColor: cartasBosque.bosque },
  horaText:    { fontFamily: 'DMMono_400Regular', fontSize: 13, color: cartasBosque.tinta },
  horaTextSel: { color: cartasBosque.bruma },
  btnPrimario: {
    backgroundColor: cartasBosque.bosque, borderRadius: borderRadius.sm,
    paddingVertical: spacing[3], alignItems: 'center', marginTop: spacing[3], marginBottom: spacing[2],
  },
  btnPrimarioText: { fontFamily: 'DMSans_600SemiBold', fontSize: 14, color: cartasBosque.bruma },
  btnSecundario: { paddingVertical: spacing[2], alignItems: 'center' },
  btnSecundarioText: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: cartasBosque.helecho },
});
