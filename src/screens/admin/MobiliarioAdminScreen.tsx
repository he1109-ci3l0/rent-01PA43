import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { cartasBosque } from '@/constants/colors';
import { spacing } from '@/constants/spacing';

export default function MobiliarioAdminScreen() {
  return (
    <View style={s.root}>
      <Text style={s.titulo}>Mobiliario</Text>
      <Text style={s.sub}>Módulo en construcción</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: cartasBosque.bruma },
  titulo: { fontFamily: 'Inter_600SemiBold', fontSize: 20, color: cartasBosque.tinta, marginBottom: spacing[2] },
  sub:    { fontFamily: 'Inter_400Regular',  fontSize: 14, color: cartasBosque.helecho },
});
