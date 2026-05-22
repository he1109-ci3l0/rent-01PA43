import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, FlatList, Modal, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Timestamp } from 'firebase/firestore';
import { cartasBosque } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/spacing';
import CuadriculaAlmacenamiento from '@/components/common/CuadriculaAlmacenamiento';
import {
  listenEspacios, seedEspacios,
  asignarEspacio, liberarEspacio, renovarEspacio,
  getInquilinos, montoConIva,
} from '@/services/firebase/almacenamiento';
import type {
  EspacioAlmacenamiento, ModalidadEspacio, Inquilino,
} from '@/types/firestore';

// ─── Helpers ──────────────────────────────────────────────────

type Vista = 'cuadricula' | 'activos';

function formatFecha(ts: Timestamp | null): string {
  if (!ts) return '—';
  return ts.toDate().toLocaleDateString('es-MX', {
    day: 'numeric', month: 'short', year: '2-digit',
  });
}

// ─── Fila espacio activo ──────────────────────────────────────

function EspacioRow({ espacio, onRenovar, onLiberar }: {
  espacio: EspacioAlmacenamiento;
  onRenovar: () => void;
  onLiberar: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardNombre}>{espacio.inquilinoNombre ?? '—'}</Text>
          <Text style={styles.cardSub}>
            {espacio.tipo === 'locker' ? 'Locker' : 'Refri'} #{espacio.numero}
            {espacio.habitacionNumero ? ` · Hab. ${espacio.habitacionNumero}` : ''}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.cardMod}>{espacio.modalidad ?? '—'}</Text>
          <Text style={styles.cardVence}>vence {formatFecha(espacio.fechaVencimiento)}</Text>
        </View>
      </View>
      <View style={styles.cardAcciones}>
        <TouchableOpacity style={styles.btnRenovar} onPress={onRenovar}>
          <Text style={styles.btnRenovarText}>Renovar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnLiberar} onPress={onLiberar}>
          <Text style={styles.btnLiberarText}>Liberar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Modal asignar ────────────────────────────────────────────

function SheetAsignar({
  espacio, onClose, onAsignar,
}: {
  espacio: EspacioAlmacenamiento;
  onClose: () => void;
  onAsignar: (p: {
    inquilinoId: string;
    inquilinoNombre: string;
    habitacionNumero?: string;
    modalidad: ModalidadEspacio;
  }) => Promise<void>;
}) {
  const [inquilinos, setInquilinos] = useState<Inquilino[]>([]);
  const [sel, setSel]               = useState<Inquilino | null>(null);
  const [modalidad, setModalidad]   = useState<ModalidadEspacio>('mensual');
  const [guardando, setGuardando]   = useState(false);

  useEffect(() => {
    getInquilinos().then(setInquilinos).catch(() => {});
  }, []);

  async function confirmar() {
    if (!sel) return;
    setGuardando(true);
    try {
      await onAsignar({
        inquilinoId: sel.uid,
        inquilinoNombre: `${sel.nombre} ${sel.apellido}`.trim(),
        modalidad,
      });
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Intenta de nuevo');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <View style={styles.sheet}>
      <Text style={styles.sheetTitulo}>
        Asignar {espacio.tipo === 'locker' ? 'locker' : 'refrigerador'} #{espacio.numero}
      </Text>

      <Text style={styles.sheetLabel}>INQUILINO</Text>
      {inquilinos.length === 0 ? (
        <ActivityIndicator color={cartasBosque.bosque} style={{ marginVertical: spacing[3] }} />
      ) : (
        <ScrollView style={styles.listBox} nestedScrollEnabled>
          {inquilinos.map(i => (
            <TouchableOpacity
              key={i.id}
              style={[styles.listItem, sel?.id === i.id && styles.listItemSel]}
              onPress={() => setSel(i)}
            >
              <Text style={[styles.listNombre, sel?.id === i.id && styles.listNombreSel]}>
                {i.nombre} {i.apellido}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <Text style={styles.sheetLabel}>MODALIDAD</Text>
      <View style={styles.modRow}>
        {(['semanal', 'mensual'] as ModalidadEspacio[]).map(m => (
          <TouchableOpacity
            key={m}
            style={[styles.modBtn, modalidad === m && styles.modBtnActivo]}
            onPress={() => setModalidad(m)}
          >
            <Text style={[styles.modText, modalidad === m && styles.modTextActivo]}>
              {m} · ${montoConIva(m)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.btnPrimario, (!sel || guardando) && { opacity: 0.5 }]}
        onPress={confirmar}
        disabled={!sel || guardando}
      >
        {guardando
          ? <ActivityIndicator color={cartasBosque.bruma} />
          : <Text style={styles.btnPrimarioText}>Asignar</Text>
        }
      </TouchableOpacity>
      <TouchableOpacity style={styles.btnSecundario} onPress={onClose}>
        <Text style={styles.btnSecundarioText}>Cancelar</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Modal renovar ────────────────────────────────────────────

function SheetRenovar({
  espacio, onClose, onRenovar,
}: {
  espacio: EspacioAlmacenamiento;
  onClose: () => void;
  onRenovar: (m: ModalidadEspacio) => Promise<void>;
}) {
  const [modalidad, setModalidad] = useState<ModalidadEspacio>(
    espacio.modalidad ?? 'mensual',
  );
  const [guardando, setGuardando] = useState(false);

  async function confirmar() {
    setGuardando(true);
    try {
      await onRenovar(modalidad);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Intenta de nuevo');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <View style={styles.sheet}>
      <Text style={styles.sheetTitulo}>
        Renovar {espacio.tipo === 'locker' ? 'locker' : 'refrigerador'} #{espacio.numero}
      </Text>
      <Text style={styles.sheetSub}>{espacio.inquilinoNombre}</Text>

      <Text style={styles.sheetLabel}>MODALIDAD</Text>
      <View style={styles.modRow}>
        {(['semanal', 'mensual'] as ModalidadEspacio[]).map(m => (
          <TouchableOpacity
            key={m}
            style={[styles.modBtn, modalidad === m && styles.modBtnActivo]}
            onPress={() => setModalidad(m)}
          >
            <Text style={[styles.modText, modalidad === m && styles.modTextActivo]}>
              {m} · ${montoConIva(m)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.btnPrimario, guardando && { opacity: 0.5 }]}
        onPress={confirmar}
        disabled={guardando}
      >
        {guardando
          ? <ActivityIndicator color={cartasBosque.bruma} />
          : <Text style={styles.btnPrimarioText}>Renovar</Text>
        }
      </TouchableOpacity>
      <TouchableOpacity style={styles.btnSecundario} onPress={onClose}>
        <Text style={styles.btnSecundarioText}>Cancelar</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Pantalla principal ───────────────────────────────────────

export default function AlmacenamientoAdminScreen() {
  const [vista, setVista]       = useState<Vista>('cuadricula');
  const [espacios, setEspacios] = useState<EspacioAlmacenamiento[]>([]);
  const [cargando, setCargando] = useState(true);
  const [sheetAsignar, setSheetAsignar] = useState(false);
  const [sheetRenovar, setSheetRenovar] = useState(false);
  const [selec, setSelec]       = useState<EspacioAlmacenamiento | null>(null);

  useEffect(() => {
    seedEspacios().catch(() => {});
    return listenEspacios(data => {
      setEspacios(data);
      setCargando(false);
    });
  }, []);

  const activos = espacios.filter(e => e.estado === 'ocupado');

  function handleTapCuadricula(e: EspacioAlmacenamiento) {
    if (e.estado === 'libre') {
      setSelec(e);
      setSheetAsignar(true);
    } else {
      Alert.alert(
        `${e.tipo === 'locker' ? 'Locker' : 'Refri'} #${e.numero}`,
        `${e.inquilinoNombre ?? '—'}\nVence: ${formatFecha(e.fechaVencimiento)}`,
        [
          { text: 'OK', style: 'cancel' },
          {
            text: 'Liberar', style: 'destructive',
            onPress: () => liberarEspacio(e.id).catch(() => {}),
          },
        ],
      );
    }
  }

  function handleLiberar(e: EspacioAlmacenamiento) {
    Alert.alert(
      'Liberar espacio',
      `¿Liberar ${e.tipo === 'locker' ? 'locker' : 'refri'} #${e.numero} de ${e.inquilinoNombre}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Liberar', style: 'destructive',
          onPress: () => liberarEspacio(e.id).catch(() => {}),
        },
      ],
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: cartasBosque.bruma }}>
      {/* Segmented */}
      <View style={styles.segmented}>
        {(['cuadricula', 'activos'] as Vista[]).map(v => (
          <TouchableOpacity
            key={v}
            style={[styles.segBtn, vista === v && styles.segBtnActivo]}
            onPress={() => setVista(v)}
          >
            <Text style={[styles.segText, vista === v && styles.segTextActivo]}>
              {v === 'cuadricula' ? 'Cuadrícula' : `Activos (${activos.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {cargando ? (
        <ActivityIndicator color={cartasBosque.bosque} style={{ marginTop: spacing[8] }} />
      ) : vista === 'cuadricula' ? (
        <ScrollView contentContainerStyle={styles.content}>
          <CuadriculaAlmacenamiento
            espacios={espacios}
            tipo="locker"
            showNombres
            onPress={handleTapCuadricula}
          />
          <CuadriculaAlmacenamiento
            espacios={espacios}
            tipo="refrigerador"
            showNombres
            onPress={handleTapCuadricula}
          />
          <Text style={styles.hint}>Toca un espacio libre para asignarlo</Text>
        </ScrollView>
      ) : (
        <FlatList
          data={activos}
          keyExtractor={e => e.id}
          contentContainerStyle={styles.content}
          ListEmptyComponent={
            <View style={styles.vacioCont}>
              <Ionicons name="archive-outline" size={36} color={cartasBosque.niebla} />
              <Text style={styles.vacioText}>Sin espacios activos</Text>
            </View>
          }
          renderItem={({ item }) => (
            <EspacioRow
              espacio={item}
              onRenovar={() => { setSelec(item); setSheetRenovar(true); }}
              onLiberar={() => handleLiberar(item)}
            />
          )}
        />
      )}

      {/* Modal asignar */}
      <Modal
        visible={sheetAsignar}
        transparent
        animationType="slide"
        onRequestClose={() => setSheetAsignar(false)}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setSheetAsignar(false)}
        />
        {selec && (
          <SheetAsignar
            espacio={selec}
            onClose={() => setSheetAsignar(false)}
            onAsignar={async params => {
              await asignarEspacio({ espacioId: selec.id, ...params });
              setSheetAsignar(false);
            }}
          />
        )}
      </Modal>

      {/* Modal renovar */}
      <Modal
        visible={sheetRenovar}
        transparent
        animationType="slide"
        onRequestClose={() => setSheetRenovar(false)}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setSheetRenovar(false)}
        />
        {selec && (
          <SheetRenovar
            espacio={selec}
            onClose={() => setSheetRenovar(false)}
            onRenovar={async m => {
              await renovarEspacio(selec.id, m);
              setSheetRenovar(false);
            }}
          />
        )}
      </Modal>
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
  segTextActivo: { color: cartasBosque.bosque },
  content: { padding: spacing[4], paddingBottom: spacing[8] },
  hint: {
    fontFamily: 'SpaceMono_400Regular', fontSize: 9, color: cartasBosque.niebla,
    textAlign: 'center', marginTop: spacing[1],
  },
  vacioCont: { alignItems: 'center', gap: spacing[2], marginTop: spacing[8] },
  vacioText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: cartasBosque.helecho },
  // EspacioRow
  card: {
    backgroundColor: cartasBosque.pergamino, borderRadius: borderRadius.md,
    padding: spacing[3], marginBottom: spacing[2],
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
  },
  cardTop: { flexDirection: 'row', marginBottom: spacing[2] },
  cardNombre: {
    fontFamily: 'Inter_600SemiBold', fontSize: 14, color: cartasBosque.tinta,
  },
  cardSub: {
    fontFamily: 'Inter_400Regular', fontSize: 12, color: cartasBosque.helecho, marginTop: 2,
  },
  cardMod: {
    fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.bosque,
  },
  cardVence: {
    fontFamily: 'SpaceMono_400Regular', fontSize: 9, color: cartasBosque.niebla, marginTop: 2,
  },
  cardAcciones: { flexDirection: 'row', gap: spacing[2] },
  btnRenovar: {
    borderRadius: borderRadius.sm, paddingHorizontal: spacing[2], paddingVertical: 4,
    backgroundColor: cartasBosque.bosque,
  },
  btnRenovarText: {
    fontFamily: 'Inter_600SemiBold', fontSize: 11, color: cartasBosque.bruma,
  },
  btnLiberar: {
    borderRadius: borderRadius.sm, paddingHorizontal: spacing[2], paddingVertical: 4,
    borderWidth: 1, borderColor: cartasBosque.niebla,
  },
  btnLiberarText: {
    fontFamily: 'Inter_400Regular', fontSize: 11, color: cartasBosque.helecho,
  },
  // Modal
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
  listBox: { maxHeight: 160, marginBottom: spacing[3] },
  listItem: {
    paddingVertical: spacing[2], paddingHorizontal: spacing[3],
    borderRadius: borderRadius.sm, marginBottom: 2,
  },
  listItemSel: { backgroundColor: cartasBosque.bosque },
  listNombre: {
    fontFamily: 'Inter_400Regular', fontSize: 13, color: cartasBosque.tinta,
  },
  listNombreSel: { color: cartasBosque.bruma },
  modRow: { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[3] },
  modBtn: {
    flex: 1, paddingVertical: spacing[2], alignItems: 'center',
    borderRadius: borderRadius.sm, borderWidth: 1,
    borderColor: cartasBosque.pergaminoOscuro, backgroundColor: cartasBosque.pergamino,
  },
  modBtnActivo: { borderColor: cartasBosque.bosque, backgroundColor: cartasBosque.bosque },
  modText: {
    fontFamily: 'SpaceMono_400Regular', fontSize: 11, color: cartasBosque.helecho,
  },
  modTextActivo: { color: cartasBosque.bruma },
  btnPrimario: {
    backgroundColor: cartasBosque.bosque, borderRadius: borderRadius.sm,
    paddingVertical: spacing[3], alignItems: 'center', marginBottom: spacing[2],
  },
  btnPrimarioText: {
    fontFamily: 'Inter_600SemiBold', fontSize: 14, color: cartasBosque.bruma,
  },
  btnSecundario: { paddingVertical: spacing[2], alignItems: 'center' },
  btnSecundarioText: {
    fontFamily: 'Inter_400Regular', fontSize: 13, color: cartasBosque.helecho,
  },
});
