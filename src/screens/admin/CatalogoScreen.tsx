import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { cartasBosque } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/spacing';
import { HabitacionCatalogRow } from '@/components/common/HabitacionCard';
import { updateHabitacion, toggleRemodelacion, ESTADO_LABEL } from '@/services/firebase/habitaciones';
import type { Habitacion } from '@/types/firestore';

interface Props {
  rooms: Habitacion[];
  onClose?: () => void;
}

export default function CatalogoScreen({ rooms, onClose }: Props) {
  const [editRoom, setEditRoom] = useState<Habitacion | null>(null);
  const [nuevoPrecio, setNuevoPrecio] = useState('');
  const [guardando, setGuardando] = useState(false);

  const abrirEdicion = (room: Habitacion) => {
    setEditRoom(room);
    setNuevoPrecio(String(room.precioMensual));
  };

  const handleGuardar = async () => {
    if (!editRoom) return;
    const precio = parseInt(nuevoPrecio, 10);
    if (isNaN(precio) || precio < 1000 || precio > 20000) {
      Alert.alert('Precio inválido', 'Ingresa un precio entre $1,000 y $20,000.');
      return;
    }
    setGuardando(true);
    try {
      await updateHabitacion(editRoom.id, { precioMensual: precio });
      setEditRoom(null);
    } catch {
      Alert.alert('Error', 'No se pudo actualizar el precio.');
    } finally {
      setGuardando(false);
    }
  };

  const handleToggleRemodelacion = async (room: Habitacion) => {
    const activa = !room.remodelacionActiva;
    try {
      await toggleRemodelacion(room.id, activa);
      Alert.alert(
        activa ? 'Módulo activado' : 'Módulo desactivado',
        activa
          ? `Hab 03 pasa a Grande · $${(3600).toLocaleString('es-MX')}/mes`
          : `Hab 03 vuelve a Pequeña · $${(2700).toLocaleString('es-MX')}/mes`,
      );
    } catch {
      Alert.alert('Error', 'No se pudo cambiar el módulo.');
    }
  };

  // Agrupar por piso para mejor lectura
  const pisos = [
    { label: 'Planta Baja', rooms: rooms.filter(r => r.pisoNombre === 'PB') },
    { label: 'Primer Piso', rooms: rooms.filter(r => r.pisoNombre === 'P1') },
    { label: 'Terraza Piso', rooms: rooms.filter(r => r.pisoNombre === 'TP') },
  ];

  return (
    <>
      <View style={styles.header}>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={8}>
            <Ionicons name="close" size={22} color={cartasBosque.musgo} />
          </TouchableOpacity>
        )}
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>Admin</Text>
          <Text style={styles.title}>Catálogo</Text>
        </View>
      </View>

      {/* Leyenda de precio adicional */}
      <View style={styles.notaRow}>
        <Ionicons name="people-outline" size={13} color={cartasBosque.helecho} />
        <Text style={styles.notaText}>
          +$500 por ocupante adicional · máx 3 personas por habitación
        </Text>
      </View>

      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {pisos.map(({ label, rooms: pisoRooms }) => (
          <View key={label} style={styles.pisoSection}>
            <Text style={styles.pisoLabel}>{label}</Text>
            <View style={styles.lista}>
              {pisoRooms.map(room => (
                <View key={room.id}>
                  <HabitacionCatalogRow
                    habitacion={room}
                    onPress={() => abrirEdicion(room)}
                  />
                  {/* Módulo remodelación (solo hab 03) */}
                  {room.moduloRemodelacion && (
                    <TouchableOpacity
                      style={[
                        styles.remodelBtn,
                        room.remodelacionActiva && styles.remodelBtnActive,
                      ]}
                      onPress={() => handleToggleRemodelacion(room)}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name={room.remodelacionActiva ? 'checkmark-circle' : 'construct-outline'}
                        size={14}
                        color={room.remodelacionActiva ? '#558B2F' : cartasBosque.helecho}
                      />
                      <Text style={[
                        styles.remodelBtnText,
                        room.remodelacionActiva && { color: '#558B2F' },
                      ]}>
                        {room.remodelacionActiva
                          ? 'Remodelación activa · Pequeña → Grande $3,600'
                          : 'Habilitar módulo remodelación → Grande $3,600'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          </View>
        ))}

        {/* Nota P1 expansión */}
        <View style={styles.expansionNote}>
          <Ionicons name="add-circle-outline" size={15} color={cartasBosque.helecho} />
          <Text style={styles.expansionText}>
            Expansión P1 habilitada desde admin · slots 011–014 disponibles
          </Text>
        </View>

        {/* Capacidad total */}
        <View style={styles.capacidadBox}>
          <Text style={styles.capacidadLabel}>CAPACIDAD DEL SISTEMA</Text>
          <Text style={styles.capacidadValue}>14 / 45 habilitadas</Text>
          <View style={styles.capacidadBar}>
            <View style={[styles.capacidadFill, { width: `${(14 / 45) * 100}%` }]} />
          </View>
        </View>
      </ScrollView>

      {/* Modal de edición de precio */}
      <Modal
        visible={!!editRoom}
        transparent
        animationType="slide"
        onRequestClose={() => setEditRoom(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            {editRoom && (
              <>
                <View style={styles.modalHeader}>
                  <View>
                    <Text style={styles.modalTitle}>Hab. {editRoom.numero} — {editRoom.tamano}</Text>
                    <Text style={styles.modalSub}>
                      {editRoom.pisoNombre} · {ESTADO_LABEL[editRoom.estado]}
                    </Text>
                  </View>
                </View>

                {/* Estado actual */}
                <View style={styles.modalInfoRow}>
                  <Text style={styles.modalInfoLabel}>Precio actual</Text>
                  <Text style={styles.modalInfoValue}>
                    ${editRoom.precioMensual.toLocaleString('es-MX')}/mes
                  </Text>
                </View>
                {editRoom.precioAlSalir && (
                  <View style={styles.modalInfoRow}>
                    <Text style={styles.modalInfoLabel}>Precio al salir</Text>
                    <Text style={[styles.modalInfoValue, { color: '#558B2F' }]}>
                      ${editRoom.precioAlSalir.toLocaleString('es-MX')}/mes
                    </Text>
                  </View>
                )}
                <View style={styles.modalInfoRow}>
                  <Text style={styles.modalInfoLabel}>Baño</Text>
                  <Text style={styles.modalInfoValue}>{editRoom.bano}</Text>
                </View>
                <View style={styles.modalInfoRow}>
                  <Text style={styles.modalInfoLabel}>Cocina</Text>
                  <Text style={styles.modalInfoValue}>{editRoom.cocina}</Text>
                </View>
                <View style={styles.modalInfoRow}>
                  <Text style={styles.modalInfoLabel}>Área</Text>
                  <Text style={styles.modalInfoValue}>{editRoom.area} m²</Text>
                </View>

                <View style={styles.divider} />

                {/* Input nuevo precio */}
                <Text style={styles.inputLabel}>Nuevo precio mensual</Text>
                <View style={styles.inputRow}>
                  <Text style={styles.inputPrefix}>$</Text>
                  <TextInput
                    style={styles.input}
                    value={nuevoPrecio}
                    onChangeText={setNuevoPrecio}
                    keyboardType="numeric"
                    placeholder="ej: 2700"
                    placeholderTextColor={cartasBosque.helecho}
                    maxLength={6}
                  />
                  <Text style={styles.inputSuffix}>MXN/mes</Text>
                </View>

                <View style={styles.modalBtns}>
                  <TouchableOpacity
                    style={styles.modalBtnCancel}
                    onPress={() => setEditRoom(null)}
                  >
                    <Text style={styles.modalBtnCancelText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalBtnSave, guardando && { opacity: 0.5 }]}
                    onPress={handleGuardar}
                    disabled={guardando}
                  >
                    <Text style={styles.modalBtnSaveText}>Guardar</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

// ─── Estilos ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: cartasBosque.pergamino },
  content: { padding: spacing[5], paddingBottom: spacing[10], gap: spacing[5] },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    paddingBottom: spacing[2],
    backgroundColor: cartasBosque.pergamino,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: cartasBosque.bruma,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: cartasBosque.pergaminoOscuro,
  },
  headerText: { flex: 1 },
  eyebrow: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 10,
    color: cartasBosque.musgo,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 24,
    color: cartasBosque.bosque,
    letterSpacing: -0.3,
  },

  notaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[3],
    backgroundColor: cartasBosque.pergamino,
  },
  notaText: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 10,
    color: cartasBosque.helecho,
    flex: 1,
    lineHeight: 15,
  },

  pisoSection: { gap: spacing[2] },
  pisoLabel: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 13,
    color: cartasBosque.musgo,
    letterSpacing: 0.3,
  },
  lista: { gap: spacing[2] },

  remodelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginTop: spacing[1],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    backgroundColor: '#FFFDE7',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#F9A825' + '40',
  },
  remodelBtnActive: {
    backgroundColor: '#F1F8E9',
    borderColor: '#558B2F40',
  },
  remodelBtnText: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 10,
    color: cartasBosque.helecho,
    flex: 1,
  },

  expansionNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    padding: spacing[3],
    backgroundColor: cartasBosque.bruma,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: cartasBosque.pergaminoOscuro,
    borderStyle: 'dashed',
  },
  expansionText: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 10,
    color: cartasBosque.helecho,
    flex: 1,
    lineHeight: 15,
  },

  capacidadBox: {
    gap: spacing[2],
    padding: spacing[4],
    backgroundColor: cartasBosque.bruma,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: cartasBosque.pergaminoOscuro,
  },
  capacidadLabel: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 9,
    color: cartasBosque.helecho,
    letterSpacing: 1,
  },
  capacidadValue: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 16,
    color: cartasBosque.bosque,
  },
  capacidadBar: {
    height: 6,
    backgroundColor: cartasBosque.pergaminoOscuro,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  capacidadFill: {
    height: 6,
    backgroundColor: cartasBosque.bosque,
    borderRadius: borderRadius.full,
  },

  divider: { height: 1, backgroundColor: cartasBosque.pergaminoOscuro },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  modalSheet: {
    backgroundColor: cartasBosque.bruma,
    borderTopLeftRadius: borderRadius['2xl'],
    borderTopRightRadius: borderRadius['2xl'],
    padding: spacing[6],
    paddingBottom: spacing[8],
    gap: spacing[3],
  },
  modalHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: cartasBosque.pergaminoOscuro,
    alignSelf: 'center', marginBottom: spacing[2],
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  modalTitle: { fontFamily: 'DMSans_700Bold', fontSize: 17, color: cartasBosque.tinta },
  modalSub: { fontFamily: 'DMMono_400Regular', fontSize: 11, color: cartasBosque.helecho, marginTop: 2 },

  modalInfoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalInfoLabel: { fontFamily: 'DMMono_400Regular', fontSize: 11, color: cartasBosque.helecho },
  modalInfoValue: { fontFamily: 'DMSans_500Medium', fontSize: 13, color: cartasBosque.tinta },

  inputLabel: { fontFamily: 'DMMono_400Regular', fontSize: 11, color: cartasBosque.musgo, letterSpacing: 0.5 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    borderRadius: borderRadius.md, paddingHorizontal: spacing[3],
    backgroundColor: cartasBosque.pergamino,
  },
  inputPrefix: { fontFamily: 'DMSans_600SemiBold', fontSize: 16, color: cartasBosque.musgo },
  input: {
    flex: 1, paddingVertical: spacing[3],
    fontFamily: 'DMSans_600SemiBold', fontSize: 20, color: cartasBosque.tinta,
  },
  inputSuffix: { fontFamily: 'DMMono_400Regular', fontSize: 11, color: cartasBosque.helecho },

  modalBtns: { flexDirection: 'row', gap: spacing[3] },
  modalBtnCancel: {
    flex: 1, paddingVertical: spacing[3], alignItems: 'center',
    borderRadius: borderRadius.md, borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
  },
  modalBtnCancelText: { fontFamily: 'DMSans_500Medium', fontSize: 14, color: cartasBosque.musgo },
  modalBtnSave: {
    flex: 1, paddingVertical: spacing[3], alignItems: 'center',
    borderRadius: borderRadius.md, backgroundColor: cartasBosque.bosque,
  },
  modalBtnSaveText: { fontFamily: 'DMSans_600SemiBold', fontSize: 14, color: cartasBosque.bruma },
});
