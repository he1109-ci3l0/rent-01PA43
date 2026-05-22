import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { cartasBosque } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/spacing';
import { ESTADO_COLOR, ESTADO_LABEL } from '@/services/firebase/habitaciones';
import type { Habitacion } from '@/types/firestore';

// ─── Grid cell ────────────────────────────────────────────────

interface GridCellProps {
  habitacion: Habitacion;
  width: number;
  height?: number;
  onPress?: () => void;
}

export function HabitacionCell({ habitacion, width, height = 88, onPress }: GridCellProps) {
  const bg = habitacion.habilitada
    ? ESTADO_COLOR[habitacion.estado]
    : '#E8EBE0';

  const isOscuro = habitacion.estado === 'ocupada'
    || habitacion.estado === 'mantenimiento'
    || habitacion.estado === 'reservada';

  const textColor = isOscuro ? cartasBosque.bruma : cartasBosque.tinta;
  const subColor  = isOscuro ? 'rgba(255,255,255,0.7)' : cartasBosque.helecho;

  return (
    <TouchableOpacity
      style={[styles.cell, { width, height, backgroundColor: bg }]}
      onPress={onPress}
      activeOpacity={0.82}
      disabled={!habitacion.habilitada}
    >
      {/* Número */}
      <Text style={[styles.cellNum, { color: textColor }]}>{habitacion.numero}</Text>

      {/* Precio */}
      <Text style={[styles.cellPrice, { color: subColor }]}>
        ${(habitacion.precioMensual / 1000).toFixed(1)}k
      </Text>

      {/* Nombre inquilino (solo si ocupada) */}
      {habitacion.estado === 'ocupada' && habitacion.inquilinoNombre ? (
        <Text style={[styles.cellInq, { color: subColor }]} numberOfLines={1}>
          {habitacion.inquilinoNombre.split(' ')[0]}
        </Text>
      ) : null}

      {/* Badge especial */}
      {habitacion.moduloRemodelacion && !habitacion.remodelacionActiva && (
        <View style={styles.remodelDot} />
      )}
    </TouchableOpacity>
  );
}

// ─── Catalog row ──────────────────────────────────────────────

interface CatalogRowProps {
  habitacion: Habitacion;
  onPress?: () => void;
}

export function HabitacionCatalogRow({ habitacion, onPress }: CatalogRowProps) {
  const estadoColor = ESTADO_COLOR[habitacion.estado];
  const isOscuro = habitacion.estado === 'ocupada';

  return (
    <TouchableOpacity
      style={styles.catalogRow}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {/* Número + estado dot */}
      <View style={[styles.catalogNumBox, { backgroundColor: estadoColor }]}>
        <Text style={[styles.catalogNum, { color: isOscuro ? cartasBosque.bruma : cartasBosque.tinta }]}>
          {habitacion.numero}
        </Text>
      </View>

      {/* Info */}
      <View style={styles.catalogInfo}>
        <Text style={styles.catalogTamano}>{habitacion.tamano}</Text>
        <Text style={styles.catalogPiso}>{habitacion.pisoNombre} · {habitacion.bano}</Text>
      </View>

      {/* Precios */}
      <View style={styles.catalogPrecios}>
        <Text style={styles.catalogPrecio}>
          ${habitacion.precioMensual.toLocaleString('es-MX')}
        </Text>
        {habitacion.precioAlSalir && (
          <Text style={styles.catalogPrecioSalida}>
            →${habitacion.precioAlSalir.toLocaleString('es-MX')}
          </Text>
        )}
        {habitacion.moduloRemodelacion && habitacion.precioRemodelado && (
          <Text style={styles.catalogPrecioRemod}>
            ★${habitacion.precioRemodelado.toLocaleString('es-MX')}
          </Text>
        )}
      </View>

      <Ionicons name="chevron-forward" size={16} color={cartasBosque.helecho} />
    </TouchableOpacity>
  );
}

// ─── Slot inhabilitado ────────────────────────────────────────

export function SlotInhabilitado({ width, numero }: { width: number; numero: string }) {
  return (
    <View style={[styles.slotDisabled, { width }]}>
      <Text style={styles.slotNum}>{numero}</Text>
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Grid cell
  cell: {
    borderRadius: borderRadius.lg,
    padding: spacing[2],
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  cellNum: {
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
    letterSpacing: -0.5,
  },
  cellPrice: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 10,
    letterSpacing: 0.3,
  },
  cellInq: {
    fontFamily: 'Inter_500Medium',
    fontSize: 9,
    letterSpacing: 0.2,
  },
  remodelDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#CDB29D',
  },

  // Catalog row
  catalogRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: cartasBosque.bruma,
    borderRadius: borderRadius.md,
    padding: spacing[3],
    gap: spacing[3],
    borderWidth: 1,
    borderColor: cartasBosque.pergaminoOscuro,
  },
  catalogNumBox: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catalogNum: {
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
  },
  catalogInfo: { flex: 1 },
  catalogTamano: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: cartasBosque.tinta,
  },
  catalogPiso: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 10,
    color: cartasBosque.helecho,
    marginTop: 1,
  },
  catalogPrecios: { alignItems: 'flex-end', gap: 1 },
  catalogPrecio: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: cartasBosque.tinta,
  },
  catalogPrecioSalida: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 9,
    color: '#2E3C2C',
  },
  catalogPrecioRemod: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 9,
    color: '#CDB29D',
  },

  // Slot inhabilitado
  slotDisabled: {
    height: 88,
    borderRadius: borderRadius.lg,
    backgroundColor: '#E8E8E0',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D0D0C8',
    borderStyle: 'dashed',
  },
  slotNum: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 11,
    color: '#A0A09A',
    letterSpacing: 0.5,
  },
});
