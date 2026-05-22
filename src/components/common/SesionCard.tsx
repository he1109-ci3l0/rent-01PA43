import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { cartasBosque } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/spacing';
import type { Sesion } from '@/types/firestore';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

function formatFechaHora(ts: any): string {
  try {
    const d = ts.toDate();
    return d.toLocaleString('es-MX', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return '—'; }
}

function plataformaIcon(p: string): IoniconsName {
  if (p === 'ios')     return 'phone-portrait-outline';
  if (p === 'android') return 'logo-android';
  return 'desktop-outline';
}

function ubicacionStr(s: Sesion): string {
  const partes = [s.colonia, s.alcaldia, s.ciudad].filter(Boolean);
  if (partes.length) return partes.join(', ');
  if (s.pais) return s.pais;
  return 'Ubicación desconocida';
}

interface Props {
  sesion: Sesion;
  esActual?: boolean;
  onCerrar: () => void;
}

export default function SesionCard({ sesion, esActual = false, onCerrar }: Props) {
  return (
    <View style={[styles.card, esActual && styles.cardActual, sesion.reporteRobo && styles.cardRobo]}>
      <View style={styles.iconBox}>
        <Ionicons
          name={plataformaIcon(sesion.plataforma)}
          size={20}
          color={sesion.reporteRobo ? '#960018' : cartasBosque.bosque}
        />
      </View>

      <View style={{ flex: 1 }}>
        <View style={styles.headerRow}>
          <Text style={styles.dispositivo} numberOfLines={1}>{sesion.dispositivo}</Text>
          {esActual && (
            <View style={styles.actualBadge}>
              <Text style={styles.actualText}>Este dispositivo</Text>
            </View>
          )}
          {sesion.reporteRobo && (
            <View style={styles.roboBadge}>
              <Text style={styles.roboText}>Robo reportado</Text>
            </View>
          )}
        </View>

        <Text style={styles.ubicacion}>{ubicacionStr(sesion)}</Text>
        {sesion.cp ? <Text style={styles.meta}>CP {sesion.cp}</Text> : null}
        <Text style={styles.fecha}>{formatFechaHora(sesion.fechaInicio)}</Text>
      </View>

      <TouchableOpacity style={styles.cerrarBtn} onPress={onCerrar}>
        <Ionicons name="close-outline" size={18} color={cartasBosque.helecho} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3],
    backgroundColor: cartasBosque.pergamino,
    borderRadius: borderRadius.md, padding: spacing[3],
    marginBottom: spacing[2],
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
  },
  cardActual: {
    borderColor: cartasBosque.musgo + '80',
    backgroundColor: '#E8EBE0' + '33',
  },
  cardRobo: {
    borderColor: '#960018' + '60',
    backgroundColor: 'rgba(103,0,16,0.15)' + '33',
  },
  iconBox: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: cartasBosque.niebla + '44',
    alignItems: 'center', justifyContent: 'center',
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], flexWrap: 'wrap', marginBottom: 2 },
  dispositivo: {
    fontFamily: 'Inter_600SemiBold', fontSize: 13, color: cartasBosque.tinta,
    flexShrink: 1,
  },
  actualBadge: {
    paddingHorizontal: spacing[2], paddingVertical: 2,
    backgroundColor: '#E8EBE0', borderRadius: borderRadius.full,
  },
  actualText: { fontFamily: 'SpaceMono_400Regular', fontSize: 9, color: '#4A5E48' },
  roboBadge: {
    paddingHorizontal: spacing[2], paddingVertical: 2,
    backgroundColor: 'rgba(103,0,16,0.15)', borderRadius: borderRadius.full,
  },
  roboText: { fontFamily: 'SpaceMono_400Regular', fontSize: 9, color: '#960018' },
  ubicacion: { fontFamily: 'Inter_400Regular', fontSize: 12, color: cartasBosque.tinta },
  meta:      { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.helecho, marginTop: 1 },
  fecha:     { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.helecho, marginTop: 2 },
  cerrarBtn: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: cartasBosque.niebla + '44',
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
  },
});
