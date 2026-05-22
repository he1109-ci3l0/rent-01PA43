import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Modal, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, FlatList,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { cartasBosque } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/spacing';
import { useAuth } from '@/hooks/useAuth';
import TurnoCard from '@/components/common/TurnoCard';
import {
  listenMisTurnos, subirFotoTurno, togglePrivacidad,
  actualizarHora, solicitarPermuta,
  AREA_LABELS, formatFechaTurno,
} from '@/services/firebase/limpieza';
import { getDocs, query, where } from 'firebase/firestore';
import { collections } from '@/services/firebase/firestore';
import type { TurnoLimpieza, Inquilino } from '@/types/firestore';

// ─── Helpers ──────────────────────────────────────────────────

const HORAS = Array.from({ length: 16 }, (_, i) => {
  const h = i + 7;
  return `${String(h).padStart(2, '0')}:00`;
});

function gruparPorMes(turnos: TurnoLimpieza[]): Array<{ mes: string; items: TurnoLimpieza[] }> {
  const map = new Map<string, TurnoLimpieza[]>();
  for (const t of turnos) {
    const key = t.fechaProgramada.toDate().toLocaleDateString('es-MX', {
      month: 'long', year: 'numeric',
    });
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(t);
  }
  return Array.from(map.entries()).map(([mes, items]) => ({ mes, items }));
}

// ─── Modal hora ───────────────────────────────────────────────

function ModalHora({
  turno, visible, onClose, onGuardar,
}: {
  turno: TurnoLimpieza | null;
  visible: boolean;
  onClose: () => void;
  onGuardar: (hora: string) => Promise<void>;
}) {
  const [hora, setHora] = useState(turno?.horaInicio ?? '08:00');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => { if (turno) setHora(turno.horaInicio); }, [turno]);

  async function confirmar() {
    setGuardando(true);
    try { await onGuardar(hora); onClose(); }
    catch { Alert.alert('Error', 'No se pudo actualizar la hora.'); }
    finally { setGuardando(false); }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        <Text style={styles.sheetTitulo}>Elegir hora</Text>
        <Text style={styles.sheetSub}>
          {turno ? `${AREA_LABELS[turno.area]} · ${formatFechaTurno(turno.fechaProgramada)}` : ''}
        </Text>
        <ScrollView style={{ maxHeight: 240 }} nestedScrollEnabled>
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

// ─── Modal permuta ────────────────────────────────────────────

function ModalPermuta({
  turno, visible, onClose,
}: {
  turno: TurnoLimpieza | null;
  visible: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [inquilinos, setInquilinos] = useState<Inquilino[]>([]);
  const [selecId, setSelecId]       = useState<string | null>(null);
  const [enviando, setEnviando]     = useState(false);

  useEffect(() => {
    if (!visible) return;
    getDocs(query(collections.inquilinos, where('estado', '==', 'activo')))
      .then(snap => {
        setInquilinos(
          snap.docs
            .map(d => ({ ...(d.data() as any), id: d.id }))
            .filter((i: Inquilino) => i.uid !== user?.uid)
        );
      })
      .catch(() => {});
  }, [visible]);

  async function enviar() {
    if (!turno || !selecId) return;
    const destino = inquilinos.find(i => i.uid === selecId);
    if (!destino) return;
    const meSnap = await getDocs(query(collections.inquilinos, where('uid', '==', user?.uid)));
    const me = meSnap.docs[0]?.data() as Inquilino | undefined;
    setEnviando(true);
    try {
      await solicitarPermuta({
        solicitanteId:         user!.uid,
        solicitanteNombre:     me ? `${me.nombre} ${me.apellido}`.trim() : user!.uid,
        solicitanteHab:        me?.habitacionId ?? '',
        turnoOrigenId:         turno.id,
        turnoOrigenFecha:      turno.fechaProgramada,
        inquilinoDestinoId:    destino.uid,
        inquilinoDestinoNombre:`${destino.nombre} ${destino.apellido}`.trim(),
        inquilinoDestinoHab:   destino.habitacionId ?? '',
      });
      Alert.alert('Solicitud enviada', 'El administrador revisará la permuta.');
      onClose();
    } catch {
      Alert.alert('Error', 'No se pudo enviar la solicitud.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        <Text style={styles.sheetTitulo}>Solicitar permuta</Text>
        <Text style={styles.sheetSub}>
          {turno ? `${AREA_LABELS[turno.area]} · ${formatFechaTurno(turno.fechaProgramada)}` : ''}
        </Text>
        <Text style={styles.sheetLabel}>CON QUIÉN PERMUTAR</Text>
        {inquilinos.length === 0
          ? <ActivityIndicator color={cartasBosque.bosque} style={{ marginVertical: spacing[3] }} />
          : (
            <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
              {inquilinos.map(i => (
                <TouchableOpacity
                  key={i.uid}
                  style={[styles.horaItem, selecId === i.uid && styles.horaItemSel]}
                  onPress={() => setSelecId(i.uid)}
                >
                  <Text style={[styles.horaText, selecId === i.uid && styles.horaTextSel]}>
                    {i.nombre} {i.apellido} · Hab. {i.habitacionId ?? '—'}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )
        }
        <TouchableOpacity
          style={[styles.btnPrimario, (!selecId || enviando) && { opacity: 0.5 }]}
          onPress={enviar} disabled={!selecId || enviando}
        >
          {enviando
            ? <ActivityIndicator color={cartasBosque.bruma} />
            : <Text style={styles.btnPrimarioText}>Enviar solicitud</Text>
          }
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnSecundario} onPress={onClose}>
          <Text style={styles.btnSecundarioText}>Cancelar</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ─── Pantalla principal ───────────────────────────────────────

export default function LimpiezaTenantScreen() {
  const { user } = useAuth();
  const [turnos, setTurnos]       = useState<TurnoLimpieza[]>([]);
  const [cargando, setCargando]   = useState(true);
  const [filtro, setFiltro]       = useState<'proximos' | 'todos'>('proximos');
  const [turnoHora, setTurnoHora] = useState<TurnoLimpieza | null>(null);
  const [turnoPermuta, setTurnoPermuta] = useState<TurnoLimpieza | null>(null);

  useEffect(() => {
    if (!user?.uid) return;
    return listenMisTurnos(user.uid, data => {
      setTurnos(data);
      setCargando(false);
    });
  }, [user?.uid]);

  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);

  const proximos = turnos.filter(t =>
    t.fechaProgramada.toDate() >= hoy && t.estado === 'pendiente'
  );
  const todos    = turnos;
  const listaMostrada = filtro === 'proximos' ? proximos : todos;
  const grupos   = gruparPorMes(listaMostrada);

  async function handleFoto(turno: TurnoLimpieza) {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a tus fotos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: false,
    });
    if (result.canceled) return;
    try {
      await subirFotoTurno(turno.id, result.assets[0].uri);
      Alert.alert('¡Listo!', 'Turno acreditado correctamente.');
    } catch {
      Alert.alert('Error', 'No se pudo registrar la foto.');
    }
  }

  const handlePrivacidad = useCallback(async (turno: TurnoLimpieza) => {
    try { await togglePrivacidad(turno.id, !turno.privacidad); }
    catch { Alert.alert('Error', 'No se pudo cambiar la privacidad.'); }
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: cartasBosque.bruma }}>
      {/* Filtro */}
      <View style={styles.filtroBar}>
        {(['proximos', 'todos'] as const).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filtroBtn, filtro === f && styles.filtroBtnActivo]}
            onPress={() => setFiltro(f)}
          >
            <Text style={[styles.filtroText, filtro === f && styles.filtroTextActivo]}>
              {f === 'proximos' ? `Próximos (${proximos.length})` : `Todos (${todos.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {cargando ? (
        <ActivityIndicator color={cartasBosque.bosque} style={{ marginTop: spacing[8] }} />
      ) : grupos.length === 0 ? (
        <View style={styles.vacioContain}>
          <Ionicons name="brush-outline" size={36} color={cartasBosque.niebla} />
          <Text style={styles.vacioText}>Sin turnos asignados</Text>
        </View>
      ) : (
        <FlatList
          data={grupos}
          keyExtractor={g => g.mes}
          contentContainerStyle={{ padding: spacing[4], paddingBottom: spacing[10] }}
          renderItem={({ item: grupo }) => (
            <View>
              <Text style={styles.mesHeader}>{grupo.mes}</Text>
              {grupo.items.map(t => (
                <TurnoCard
                  key={t.id}
                  turno={t}
                  miInquilinoId={user?.uid}
                  onFoto={handleFoto}
                  onPermuta={t2 => setTurnoPermuta(t2)}
                  onPrivacidad={handlePrivacidad}
                  onMover={t2 => setTurnoHora(t2)}
                />
              ))}
            </View>
          )}
        />
      )}

      <ModalHora
        turno={turnoHora}
        visible={turnoHora !== null}
        onClose={() => setTurnoHora(null)}
        onGuardar={h => actualizarHora(turnoHora!.id, h)}
      />
      <ModalPermuta
        turno={turnoPermuta}
        visible={turnoPermuta !== null}
        onClose={() => setTurnoPermuta(null)}
      />
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  filtroBar: {
    flexDirection: 'row',
    borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro,
    backgroundColor: cartasBosque.bruma,
  },
  filtroBtn: {
    flex: 1, paddingVertical: spacing[2] + 2, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  filtroBtnActivo: { borderBottomColor: cartasBosque.bosque },
  filtroText:       { fontFamily: 'SpaceMono_400Regular', fontSize: 11, color: cartasBosque.helecho },
  filtroTextActivo: { color: cartasBosque.bosque },
  mesHeader: {
    fontFamily: 'Inter_600SemiBold', fontSize: 13, color: cartasBosque.tinta,
    textTransform: 'capitalize', marginBottom: spacing[2], marginTop: spacing[3],
  },
  vacioContain: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[2],
  },
  vacioText: {
    fontFamily: 'Inter_400Regular', fontSize: 14, color: cartasBosque.helecho,
  },
  // Modales
  overlay: { flex: 1, backgroundColor: 'rgba(18,42,31,0.35)' },
  sheet: {
    backgroundColor: cartasBosque.bruma,
    borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl,
    padding: spacing[5], paddingBottom: spacing[8],
  },
  sheetTitulo: {
    fontFamily: 'Inter_600SemiBold', fontSize: 18, color: cartasBosque.tinta,
    marginBottom: spacing[1],
  },
  sheetSub: {
    fontFamily: 'Inter_400Regular', fontSize: 13, color: cartasBosque.helecho,
    marginBottom: spacing[3],
  },
  sheetLabel: {
    fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.helecho,
    letterSpacing: 0.5, marginBottom: spacing[1], marginTop: spacing[2],
  },
  horaItem: {
    paddingVertical: spacing[2] + 1, paddingHorizontal: spacing[3],
    borderRadius: borderRadius.sm, marginBottom: 2,
  },
  horaItemSel: { backgroundColor: cartasBosque.bosque },
  horaText:    { fontFamily: 'SpaceMono_400Regular', fontSize: 13, color: cartasBosque.tinta },
  horaTextSel: { color: cartasBosque.bruma },
  btnPrimario: {
    backgroundColor: cartasBosque.bosque, borderRadius: borderRadius.sm,
    paddingVertical: spacing[3], alignItems: 'center', marginTop: spacing[3], marginBottom: spacing[2],
  },
  btnPrimarioText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: cartasBosque.bruma },
  btnSecundario:   { paddingVertical: spacing[2], alignItems: 'center' },
  btnSecundarioText:{ fontFamily: 'Inter_400Regular', fontSize: 13, color: cartasBosque.helecho },
});
