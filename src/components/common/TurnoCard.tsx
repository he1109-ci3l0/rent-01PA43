import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { cartasBosque } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/spacing';
import { AREA_LABELS, AREA_ICONS, formatFechaTurno, dentroVentanaFoto, fotoVencida } from '@/services/firebase/limpieza';
import type { TurnoLimpieza } from '@/types/firestore';

// ─── Estado colors ────────────────────────────────────────────

const ESTADO_CONFIG: Record<TurnoLimpieza['estado'], { label: string; bg: string; text: string }> = {
  pendiente:      { label: 'pendiente',      bg: '#F5E8C8', text: '#B07D2A' },
  completado:     { label: 'completado',     bg: '#D6EDD9', text: '#3A7D44' },
  incumplimiento: { label: 'incumplimiento', bg: '#F5DAD8', text: '#A63228' },
};

// ─── Props ────────────────────────────────────────────────────

interface TurnoCardProps {
  turno: TurnoLimpieza;
  miInquilinoId?: string;   // undefined = vista admin (muestra siempre el nombre)
  onFoto?: (turno: TurnoLimpieza) => void;
  onPermuta?: (turno: TurnoLimpieza) => void;
  onMover?: (turno: TurnoLimpieza) => void;  // solo admin
  onPrivacidad?: (turno: TurnoLimpieza) => void;
  compact?: boolean;
}

export default function TurnoCard({
  turno,
  miInquilinoId,
  onFoto,
  onPermuta,
  onMover,
  onPrivacidad,
  compact = false,
}: TurnoCardProps) {
  const esMio      = miInquilinoId !== undefined && turno.inquilinoId === miInquilinoId;
  const esAdmin    = miInquilinoId === undefined;
  const ventanaFoto = dentroVentanaFoto(turno);
  const vencido     = fotoVencida(turno);
  const estadoCfg   = ESTADO_CONFIG[turno.estado];

  const nombreVisible =
    esAdmin ? turno.inquilinoNombre :
    esMio   ? turno.inquilinoNombre :
    turno.privacidad ? '—' : turno.inquilinoNombre;

  return (
    <View style={[styles.card, compact && styles.cardCompact]}>
      {/* Franja de área */}
      <View style={styles.row}>
        <View style={styles.iconBox}>
          <Ionicons
            name={AREA_ICONS[turno.area] as any}
            size={18}
            color={cartasBosque.bosque}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.area}>{AREA_LABELS[turno.area]}</Text>
          {!compact && (
            <Text style={styles.nombre} numberOfLines={1}>{nombreVisible}</Text>
          )}
        </View>
        {/* Badge estado */}
        <View style={[styles.badge, { backgroundColor: estadoCfg.bg }]}>
          <Text style={[styles.badgeText, { color: estadoCfg.text }]}>{estadoCfg.label}</Text>
        </View>
      </View>

      {/* Fecha + hora */}
      <View style={styles.fechaRow}>
        <Ionicons name="calendar-outline" size={12} color={cartasBosque.helecho} />
        <Text style={styles.fecha}>{formatFechaTurno(turno.fechaProgramada)}</Text>
        <Ionicons name="time-outline" size={12} color={cartasBosque.helecho} style={{ marginLeft: spacing[2] }} />
        <Text style={styles.fecha}>{turno.horaInicio}</Text>
        {turno.habitacionNumero ? (
          <>
            <Text style={[styles.fecha, { marginLeft: spacing[2] }]}>·</Text>
            <Text style={styles.fecha}> Hab. {turno.habitacionNumero}</Text>
          </>
        ) : null}
        {esMio && onPrivacidad && (
          <TouchableOpacity onPress={() => onPrivacidad(turno)} style={styles.lockBtn}>
            <Ionicons
              name={turno.privacidad ? 'eye-off-outline' : 'eye-outline'}
              size={14}
              color={cartasBosque.helecho}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Acciones */}
      {!compact && (
        <View style={styles.acciones}>
          {/* Foto — solo si es mío, pendiente, dentro de ventana */}
          {esMio && turno.estado === 'pendiente' && ventanaFoto && onFoto && (
            <TouchableOpacity style={styles.btnFoto} onPress={() => onFoto(turno)}>
              <Ionicons name="camera-outline" size={14} color={cartasBosque.bruma} />
              <Text style={styles.btnFotoText}>Acreditar turno</Text>
            </TouchableOpacity>
          )}
          {/* Aviso ventana por abrir */}
          {esMio && turno.estado === 'pendiente' && !ventanaFoto && !vencido && (
            <Text style={styles.hint}>Foto disponible el día del turno</Text>
          )}
          {/* Vencido sin foto */}
          {vencido && turno.estado === 'pendiente' && (
            <Text style={[styles.hint, { color: '#A63228' }]}>Ventana expirada · 12 h</Text>
          )}
          {/* Foto ya subida */}
          {turno.estado === 'completado' && (
            <View style={styles.completadoRow}>
              <Ionicons name="checkmark-circle" size={14} color="#3A7D44" />
              <Text style={styles.completadoText}>Turno acreditado</Text>
            </View>
          )}
          {/* Permuta — solo si es mío y pendiente */}
          {esMio && turno.estado === 'pendiente' && onPermuta && (
            <TouchableOpacity style={styles.btnSecundario} onPress={() => onPermuta(turno)}>
              <Ionicons name="swap-horizontal-outline" size={13} color={cartasBosque.bosque} />
              <Text style={styles.btnSecundarioText}>Permuta</Text>
            </TouchableOpacity>
          )}
          {/* Admin: mover */}
          {esAdmin && onMover && (
            <TouchableOpacity style={styles.btnSecundario} onPress={() => onMover(turno)}>
              <Ionicons name="create-outline" size={13} color={cartasBosque.bosque} />
              <Text style={styles.btnSecundarioText}>Mover</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: cartasBosque.pergamino,
    borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    padding: spacing[3],
    marginBottom: spacing[2],
  },
  cardCompact: {
    paddingVertical: spacing[2],
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    marginBottom: spacing[1],
  },
  iconBox: {
    width: 34, height: 34, borderRadius: borderRadius.sm,
    backgroundColor: cartasBosque.niebla + '55',
    alignItems: 'center', justifyContent: 'center',
  },
  area: {
    fontFamily: 'DMSans_600SemiBold', fontSize: 13, color: cartasBosque.tinta,
  },
  nombre: {
    fontFamily: 'DMSans_400Regular', fontSize: 11, color: cartasBosque.helecho, marginTop: 1,
  },
  badge: {
    paddingHorizontal: spacing[2], paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  badgeText: {
    fontFamily: 'DMMono_400Regular', fontSize: 9, letterSpacing: 0.3,
  },
  fechaRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginBottom: spacing[2],
    paddingLeft: spacing[1],
  },
  fecha: {
    fontFamily: 'DMMono_400Regular', fontSize: 10, color: cartasBosque.helecho,
  },
  lockBtn: { marginLeft: spacing[1], padding: 2 },
  acciones: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2],
    paddingTop: spacing[1],
    borderTopWidth: 1, borderTopColor: cartasBosque.pergaminoOscuro,
  },
  btnFoto: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[1],
    backgroundColor: cartasBosque.bosque,
    paddingHorizontal: spacing[3], paddingVertical: spacing[1] + 2,
    borderRadius: borderRadius.sm,
  },
  btnFotoText: {
    fontFamily: 'DMSans_600SemiBold', fontSize: 12, color: cartasBosque.bruma,
  },
  btnSecundario: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[1],
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    paddingHorizontal: spacing[2], paddingVertical: spacing[1] + 1,
    borderRadius: borderRadius.sm,
  },
  btnSecundarioText: {
    fontFamily: 'DMSans_400Regular', fontSize: 12, color: cartasBosque.bosque,
  },
  hint: {
    fontFamily: 'DMMono_400Regular', fontSize: 10, color: cartasBosque.helecho,
    alignSelf: 'center',
  },
  completadoRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[1],
  },
  completadoText: {
    fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#3A7D44',
  },
});
