import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { cartasBosque } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/spacing';
import {
  CATEGORIA_LABELS, CATEGORIA_ICONS, ESTADO_LABELS, ETIQUETA_LABELS,
  SUBCATEGORIA_LABELS,
} from '@/services/firebase/tickets';
import type { Ticket } from '@/types/firestore';

const ESTADO_COLORES: Record<string, { bg: string; text: string }> = {
  en_revision: { bg: '#D6E8F5', text: '#2A5EB0' },
  en_proceso:  { bg: '#FFF0E0', text: '#C05A00' },
  resuelto:    { bg: '#D6EDD9', text: '#3A7D44' },
};

const ETIQUETA_COLORES: Record<string, string> = {
  mal_uso:            '#F5DAD8',
  admin_cubre:        '#D6E8F5',
  sin_culpa:          '#D6EDD9',
  reportar_proveedor: '#EEE5F8',
};

interface Props {
  ticket: Ticket;
  esAdmin?: boolean;
  onPress?: (ticket: Ticket) => void;
}

export default function TicketCard({ ticket, esAdmin = false, onPress }: Props) {
  const est  = ESTADO_COLORES[ticket.estado] ?? ESTADO_COLORES.en_revision;
  const icon = CATEGORIA_ICONS[ticket.categoria] as React.ComponentProps<typeof Ionicons>['name'];

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress?.(ticket)}
      activeOpacity={onPress ? 0.75 : 1}
    >
      {/* Header */}
      <View style={styles.row}>
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={18} color={cartasBosque.bosque} />
        </View>
        <View style={styles.info}>
          <Text style={styles.folio} numberOfLines={1}>{ticket.folio}</Text>
          <Text style={styles.categoria}>{CATEGORIA_LABELS[ticket.categoria]}</Text>
        </View>
        <View style={[styles.estadoBadge, { backgroundColor: est.bg }]}>
          <Text style={[styles.estadoText, { color: est.text }]}>
            {ESTADO_LABELS[ticket.estado]}
          </Text>
        </View>
      </View>

      {/* Subcategoría + descripción */}
      <Text style={styles.sub} numberOfLines={1}>
        {SUBCATEGORIA_LABELS[ticket.subcategoria] ?? ticket.subcategoria}
        {ticket.descripcion ? ` · ${ticket.descripcion}` : ''}
      </Text>

      {/* Foto thumbnail */}
      {ticket.fotoUrl && (
        <Image source={{ uri: ticket.fotoUrl }} style={styles.thumb} resizeMode="cover" />
      )}

      {/* Etiquetas internas — solo admin */}
      {esAdmin && ticket.etiquetas.length > 0 && (
        <View style={styles.etiquetasRow}>
          {ticket.etiquetas.map(e => (
            <View key={e} style={[styles.etiqueta, { backgroundColor: ETIQUETA_COLORES[e] ?? cartasBosque.niebla }]}>
              <Text style={styles.etiquetaText}>{ETIQUETA_LABELS[e]}</Text>
            </View>
          ))}
          {ticket.afectaScore && (
            <View style={[styles.etiqueta, { backgroundColor: '#F5DAD8' }]}>
              <Text style={[styles.etiquetaText, { color: '#A63228' }]}>Score ↓</Text>
            </View>
          )}
        </View>
      )}

      {/* Habitación + fecha */}
      <View style={[styles.row, { marginTop: spacing[1] }]}>
        <Text style={styles.meta}>Hab. {ticket.habitacionNumero}</Text>
        {esAdmin && <Text style={styles.meta}>{ticket.inquilinoNombre}</Text>}
        <Text style={[styles.meta, { marginLeft: 'auto' }]}>
          {ticket.creadoEn.toDate().toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: cartasBosque.pergamino,
    borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    padding: spacing[3],
    marginBottom: spacing[2],
  },
  row:      { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  iconWrap: {
    width: 36, height: 36, borderRadius: borderRadius.sm,
    backgroundColor: cartasBosque.niebla + '55',
    alignItems: 'center', justifyContent: 'center',
  },
  info:     { flex: 1 },
  folio:    { fontFamily: 'DMMono_400Regular', fontSize: 10, color: cartasBosque.helecho, letterSpacing: 0.3 },
  categoria:{ fontFamily: 'DMSans_600SemiBold', fontSize: 13, color: cartasBosque.tinta },
  estadoBadge: {
    paddingHorizontal: spacing[2], paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  estadoText:  { fontFamily: 'DMMono_400Regular', fontSize: 10, letterSpacing: 0.2 },
  sub: {
    fontFamily: 'DMSans_400Regular', fontSize: 12, color: cartasBosque.helecho,
    marginTop: spacing[1], marginLeft: 36 + spacing[2],
  },
  thumb: {
    width: '100%', height: 120, borderRadius: borderRadius.sm,
    marginTop: spacing[2],
  },
  etiquetasRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: spacing[2],
  },
  etiqueta: {
    paddingHorizontal: spacing[2], paddingVertical: 2, borderRadius: borderRadius.sm,
  },
  etiquetaText: {
    fontFamily: 'DMMono_400Regular', fontSize: 9, color: cartasBosque.tinta, letterSpacing: 0.2,
  },
  meta: { fontFamily: 'DMMono_400Regular', fontSize: 10, color: cartasBosque.helecho },
});
