import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { cartasBosque } from '@/constants/colors';
import { spacing } from '@/constants/spacing';

export default function SoporteScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Soporte</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: cartasBosque.pergamino, alignItems: 'center', justifyContent: 'center' },
  text: { fontFamily: 'DMSans_400Regular', fontSize: 16, color: cartasBosque.musgo, letterSpacing: spacing[0.5] },
});
