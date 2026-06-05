import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Timestamp } from 'firebase/firestore';
import { cartasBosque } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/spacing';
import type { SemanaIngreso } from '@/types/firestore';

interface Props {
  nombreHuesped: string;
  semana: SemanaIngreso;
  montoMensual: number;
  promoTimestamp: Timestamp | null;
  onAceptar: () => Promise<void>;
  onRechazar: () => Promise<void>;
}

const DURACION_SEG = 600; // 10 minutos

export default function PromoCard({
  nombreHuesped,
  semana,
  montoMensual,
  promoTimestamp,
  onAceptar,
  onRechazar,
}: Props) {
  const [segsRestantes, setSegsRestantes] = useState(DURACION_SEG);
  const [accion, setAccion] = useState<'aceptar' | 'rechazar' | null>(null);

  useEffect(() => {
    if (!promoTimestamp) return;
    const fin = promoTimestamp.toDate().getTime() + DURACION_SEG * 1000;

    const actualizar = () => {
      const resta = Math.max(0, Math.floor((fin - Date.now()) / 1000));
      setSegsRestantes(resta);
      return resta;
    };
    actualizar();

    const tick = setInterval(() => {
      if (actualizar() === 0) clearInterval(tick);
    }, 1000);
    return () => clearInterval(tick);
  }, [promoTimestamp]);

  const mins = Math.floor(segsRestantes / 60);
  const segs = segsRestantes % 60;
  const expirada = segsRestantes === 0;
  const bloqueado = accion !== null || expirada;

  async function handleAceptar() {
    setAccion('aceptar');
    try { await onAceptar(); } finally { setAccion(null); }
  }

  async function handleRechazar() {
    setAccion('rechazar');
    try { await onRechazar(); } finally { setAccion(null); }
  }

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.iconBox}>
          <Ionicons name="star" size={18} color="#C8960C" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.badge}>OFERTA ÚNICA · NO REPETIBLE</Text>
          <Text style={styles.titulo}>Incorporación mensual</Text>
        </View>
        <View style={[styles.countdown, expirada && styles.countdownExp]}>
          <Ionicons
            name="timer-outline"
            size={11}
            color={expirada ? cartasBosque.alertaBorde : cartasBosque.helecho}
          />
          <Text style={[styles.countdownTxt, expirada && styles.countdownTxtExp]}>
            {expirada ? 'Expirada' : `${mins}:${String(segs).padStart(2, '0')}`}
          </Text>
        </View>
      </View>

      {/* Descripción */}
      <Text style={styles.desc}>
        Incorpora a <Text style={styles.bold}>{nombreHuesped}</Text> como residente mensual
        (semana {semana}) por solo{' '}
        <Text style={styles.precio}>${montoMensual.toLocaleString('es-MX')}/mes</Text>.
      </Text>

      {/* Beneficios */}
      {[
        { icon: 'checkmark-circle-outline', text: 'IVA exento · Art. 20 LIVA', color: cartasBosque.helecho },
        { icon: 'checkmark-circle-outline', text: 'Se agrega al expediente como residente permanente', color: cartasBosque.helecho },
        { icon: 'alert-circle-outline', text: 'Esta oferta no se repetirá. Decide ahora.', color: cartasBosque.alertaBorde },
      ].map(({ icon, text, color }) => (
        <View key={text} style={styles.itemRow}>
          <Ionicons name={icon as any} size={14} color={color} />
          <Text style={[styles.itemText, { color }]}>{text}</Text>
        </View>
      ))}

      {/* Botones */}
      <View style={styles.btns}>
        <TouchableOpacity
          style={[styles.btnRechazar, bloqueado && styles.btnDisabled]}
          onPress={handleRechazar}
          disabled={bloqueado}
          activeOpacity={0.8}
        >
          {accion === 'rechazar'
            ? <ActivityIndicator size="small" color={cartasBosque.helecho} />
            : <Text style={styles.btnRechazarTxt}>Rechazar</Text>
          }
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btnAceptar, bloqueado && styles.btnDisabled]}
          onPress={handleAceptar}
          disabled={bloqueado}
          activeOpacity={0.8}
        >
          {accion === 'aceptar'
            ? <ActivityIndicator size="small" color={cartasBosque.bruma} />
            : <Text style={styles.btnAceptarTxt}>Aceptar $500/mes</Text>
          }
        </TouchableOpacity>
      </View>

      {expirada && (
        <Text style={styles.expMsg}>
          Tiempo agotado. El huésped continúa en modalidad temporal ($700/semana).
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(205,178,157,0.12)',
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: '#CDB29D60',
    padding: spacing[5],
    gap: spacing[3],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  iconBox: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#FFF8E1',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#CDB29D40',
  },
  badge: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 9,
    color: '#8A6A72',
    letterSpacing: 1.2,
  },
  titulo: {
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
    color: cartasBosque.tinta,
  },
  countdown: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#E8EBE0',
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.full,
    borderWidth: 1, borderColor: '#2E3C2C40',
  },
  countdownExp: { backgroundColor: 'rgba(103,0,16,0.15)', borderColor: '#96001840' },
  countdownTxt: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 11,
    color: cartasBosque.helecho,
  },
  countdownTxtExp: { color: cartasBosque.alertaBorde },
  desc: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: cartasBosque.tinta,
    lineHeight: 20,
  },
  bold: { fontFamily: 'Inter_700Bold' },
  precio: { fontFamily: 'Inter_700Bold', color: cartasBosque.bosque },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2] },
  itemText: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 11,
    flex: 1,
    lineHeight: 16,
  },
  btns: { flexDirection: 'row', gap: spacing[3], marginTop: spacing[1] },
  btnRechazar: {
    flex: 1, paddingVertical: spacing[3], alignItems: 'center',
    borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
  },
  btnRechazarTxt: {
    fontFamily: 'Inter_500Medium', fontSize: 14, color: cartasBosque.helecho,
  },
  btnAceptar: {
    flex: 2, paddingVertical: spacing[3], alignItems: 'center',
    borderRadius: borderRadius.md, backgroundColor: cartasBosque.bosque,
  },
  btnAceptarTxt: {
    fontFamily: 'Inter_600SemiBold', fontSize: 14, color: cartasBosque.bruma,
  },
  btnDisabled: { opacity: 0.4 },
  expMsg: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 11,
    color: cartasBosque.alertaBorde,
    textAlign: 'center',
    lineHeight: 16,
  },
});
