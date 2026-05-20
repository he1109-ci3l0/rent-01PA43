import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { cartasBosque } from '@/constants/colors';
import { spacing } from '@/constants/spacing';

export default function AdminHomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>Bailleur</Text>
      <Text style={styles.text}>Panel de administración</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: cartasBosque.pergamino, alignItems: 'center', justifyContent: 'center', gap: spacing[2] },
  eyebrow: { fontFamily: 'DMMono_400Regular', fontSize: 11, color: cartasBosque.musgo, letterSpacing: 2, textTransform: 'uppercase' },
  text: { fontFamily: 'DMSans_400Regular', fontSize: 16, color: cartasBosque.tinta },
});
