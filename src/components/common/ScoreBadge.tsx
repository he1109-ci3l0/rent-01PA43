import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SCORE_CONFIG, GRADIENT_COLORS } from '@/services/firebase/pagos';
import type { NivelScore } from '@/types/firestore';
import { cartasBosque } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/spacing';

interface ScoreBadgeProps {
  nivel: NivelScore;
  puntos: number;          // 0–100
  showBar?: boolean;       // mostrar barra de progreso (default true)
  size?: 'sm' | 'md' | 'lg';
}

export default function ScoreBadge({
  nivel,
  puntos,
  showBar = true,
  size = 'md',
}: ScoreBadgeProps) {
  const cfg = SCORE_CONFIG[nivel];
  const pct = Math.max(0, Math.min(100, puntos)) / 100;

  const isLg = size === 'lg';
  const isSm = size === 'sm';

  return (
    <View style={styles.root}>
      {/* Pill de nivel */}
      <View style={[styles.pill, { backgroundColor: cfg.bg }, isSm && styles.pillSm]}>
        <View style={[styles.dot, { backgroundColor: cfg.color }]} />
        <Text style={[styles.pillLabel, { color: cfg.color }, isSm && styles.pillLabelSm]}>
          {cfg.label}
        </Text>
      </View>

      {showBar && (
        <View style={styles.barWrap}>
          {/* Barra gradiente de fondo */}
          <LinearGradient
            colors={GRADIENT_COLORS}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.barTrack, isLg && styles.barTrackLg]}
          />
          {/* Máscara de "relleno" — cubre la parte derecha con pergamino */}
          <View
            style={[
              styles.barMask,
              isLg && styles.barTrackLg,
              { left: `${pct * 100}%` },
            ]}
          />
          {/* Indicador de posición */}
          <View style={[styles.indicator, { left: `${pct * 100}%` }]} />

          {/* Etiquetas de extremos */}
          {isLg && (
            <View style={styles.extremos}>
              <Text style={[styles.extremoText, { color: GRADIENT_COLORS[0] }]}>Pésimo</Text>
              <Text style={[styles.extremoText, { color: GRADIENT_COLORS[4] }]}>Excelente</Text>
            </View>
          )}
        </View>
      )}

      {isLg && (
        <Text style={[styles.puntos, { color: cfg.color }]}>{puntos} pts</Text>
      )}
    </View>
  );
}

const BAR_H = 8;
const BAR_H_LG = 12;

const styles = StyleSheet.create({
  root: { gap: spacing[2] },

  // Pill
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.full,
    gap: spacing[1.5],
  },
  pillSm: { paddingHorizontal: spacing[2], paddingVertical: spacing[0.5] },
  dot: { width: 7, height: 7, borderRadius: 4 },
  pillLabel: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 13,
  },
  pillLabelSm: { fontSize: 11 },

  // Barra
  barWrap: { position: 'relative', justifyContent: 'center' },
  barTrack: {
    height: BAR_H,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  barTrackLg: { height: BAR_H_LG },
  barMask: {
    position: 'absolute',
    top: 0,
    right: 0,
    height: BAR_H,
    borderRadius: borderRadius.full,
    backgroundColor: cartasBosque.pergamino,
    opacity: 0.75,
  },
  indicator: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: cartasBosque.bruma,
    borderWidth: 2.5,
    borderColor: cartasBosque.tinta,
    marginLeft: -7,
    top: -3,
    shadowColor: '#122A1F',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  extremos: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing[1.5],
  },
  extremoText: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 9,
    letterSpacing: 0.5,
  },
  puntos: {
    fontFamily: 'DMMono_500Medium',
    fontSize: 12,
    letterSpacing: 0.5,
  },
});
