import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { cartasBosque } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/spacing';
import type { EspacioAlmacenamiento, TipoEspacio } from '@/types/firestore';

// ─── Colores cuadrícula ───────────────────────────────────────

export const COLOR_LIBRE   = '#8A9E80';   // verde oliva
export const COLOR_OCUPADO = '#9B8EC4';   // lila
export const COLOR_MIO     = '#CDB29D';   // arena

// ─── Props ────────────────────────────────────────────────────

interface Props {
  espacios: EspacioAlmacenamiento[];
  tipo: TipoEspacio;
  miInquilinoId?: string;
  showNombres?: boolean;
  onPress?: (espacio: EspacioAlmacenamiento) => void;
}

// ─── Componente ───────────────────────────────────────────────

const GAP      = spacing[1];   // 4 px
const CELL_SIZE = 56;

export default function CuadriculaAlmacenamiento({
  espacios, tipo, miInquilinoId, showNombres, onPress,
}: Props) {

  const celdas = espacios
    .filter(e => e.tipo === tipo)
    .sort((a, b) => a.numero - b.numero);

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Ionicons
          name={tipo === 'locker' ? 'archive-outline' : 'snow-outline'}
          size={13}
          color={cartasBosque.helecho}
        />
        <Text style={styles.titulo}>
          {tipo === 'locker' ? 'Lockers' : 'Refrigeradores'}
        </Text>
      </View>

      <View style={styles.grid}>
        {celdas.map(e => {
          const esMio = !!miInquilinoId && e.inquilinoId === miInquilinoId;
          const bg =
            e.estado === 'libre' ? COLOR_LIBRE :
            esMio              ? COLOR_MIO    : COLOR_OCUPADO;
          const numColor =
            e.estado === 'libre' ? cartasBosque.bruma : cartasBosque.tinta;

          return (
            <TouchableOpacity
              key={e.id}
              style={[styles.celda, { width: CELL_SIZE, height: CELL_SIZE, backgroundColor: bg }]}
              onPress={() => onPress?.(e)}
              disabled={!onPress}
              activeOpacity={onPress ? 0.75 : 1}
            >
              <Text style={[styles.num, { color: numColor }]}>{e.numero}</Text>
              {e.estado === 'libre' ? (
                <View style={styles.celdaLibre}>
                  <Ionicons name="add-circle-outline" size={16} color="#4A9B6F" />
                  <Text style={styles.celdaLibreText}>Asignar</Text>
                </View>
              ) : (showNombres && e.inquilinoNombre ? (
                <Text style={styles.nombre} numberOfLines={1}>
                  {primerNombre(e.inquilinoNombre)}
                </Text>
              ) : null)}
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.leyenda}>
        <Dot color={COLOR_LIBRE} label="libre" />
        <Dot color={COLOR_OCUPADO} label="ocupado" />
        {miInquilinoId != null && <Dot color={COLOR_MIO} label="el tuyo" />}
      </View>
    </View>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────

function primerNombre(nombre: string): string {
  return nombre.split(' ')[0] ?? nombre;
}

function Dot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.dotRow}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.dotLabel}>{label}</Text>
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing[5] },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[1],
    marginBottom: spacing[2],
  },
  titulo: {
    fontFamily: 'SpaceMono_400Regular', fontSize: 10,
    color: cartasBosque.helecho, letterSpacing: 0.5,
  },
  grid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: GAP,
  },
  celda: {
    borderRadius: borderRadius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  num: {
    fontFamily: 'Inter_600SemiBold', fontSize: 12,
  },
  nombre: {
    fontFamily: 'SpaceMono_400Regular', fontSize: 9,
    color: cartasBosque.tinta, marginTop: 1,
  },
  leyenda: {
    flexDirection: 'row', gap: spacing[3], marginTop: spacing[1] + 2,
  },
  dotRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  dot: { width: 8, height: 8, borderRadius: 2 },
  dotLabel: {
    fontFamily: 'SpaceMono_400Regular', fontSize: 9, color: cartasBosque.helecho,
  },
  celdaLibre: {
    alignItems: 'center', justifyContent: 'center', gap: 2,
  },
  celdaLibreText: {
    fontFamily: 'SpaceMono_400Regular', fontSize: 8, color: '#4A9B6F',
  },
});
