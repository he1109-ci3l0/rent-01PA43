import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { cartasBosque } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/spacing';
import HuespedExtraScreen        from '@/screens/tenant/HuespedExtraScreen';
import LavanderiaTenantScreen    from '@/screens/tenant/LavanderiaTenantScreen';
import AlmacenamientoTenantScreen from '@/screens/tenant/AlmacenamientoTenantScreen';
import LimpiezaTenantScreen       from '@/screens/tenant/LimpiezaTenantScreen';

type Seccion = 'menu' | 'huespedes' | 'lavanderia' | 'almacenamiento' | 'limpieza';

const ENTRADAS = [
  {
    id: 'huespedes' as const,
    icon: 'person-add-outline' as const,
    titulo: 'Huéspedes extra',
    sub: 'Registra acompañantes temporales',
  },
  {
    id: 'lavanderia' as const,
    icon: 'shirt-outline' as const,
    titulo: 'Lavandería',
    sub: '3 cargas incluidas al mes · $150 extra',
  },
  {
    id: 'almacenamiento' as const,
    icon: 'archive-outline' as const,
    titulo: 'Almacenamiento',
    sub: '15 lockers · 15 refrigeradores · desde $78/sem',
  },
  {
    id: 'limpieza' as const,
    icon: 'brush-outline' as const,
    titulo: 'Limpieza',
    sub: 'Turnos de baño, cocina y áreas comunes',
  },
];

export default function ServiciosMenuScreen() {
  const [seccion, setSeccion] = useState<Seccion>('menu');

  if (seccion === 'huespedes') {
    return (
      <View style={{ flex: 1 }}>
        <SafeAreaView style={styles.subHeader}>
          <TouchableOpacity onPress={() => setSeccion('menu')} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color={cartasBosque.tinta} />
            <Text style={styles.backLabel}>Servicios</Text>
          </TouchableOpacity>
          <Text style={styles.subTitulo}>Huéspedes extra</Text>
        </SafeAreaView>
        <HuespedExtraScreen />
      </View>
    );
  }

  if (seccion === 'lavanderia') {
    return (
      <View style={{ flex: 1 }}>
        <SafeAreaView style={styles.subHeader}>
          <TouchableOpacity onPress={() => setSeccion('menu')} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color={cartasBosque.tinta} />
            <Text style={styles.backLabel}>Servicios</Text>
          </TouchableOpacity>
          <Text style={styles.subTitulo}>Lavandería</Text>
        </SafeAreaView>
        <LavanderiaTenantScreen />
      </View>
    );
  }

  if (seccion === 'almacenamiento') {
    return (
      <View style={{ flex: 1 }}>
        <SafeAreaView style={styles.subHeader}>
          <TouchableOpacity onPress={() => setSeccion('menu')} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color={cartasBosque.tinta} />
            <Text style={styles.backLabel}>Servicios</Text>
          </TouchableOpacity>
          <Text style={styles.subTitulo}>Almacenamiento</Text>
        </SafeAreaView>
        <AlmacenamientoTenantScreen />
      </View>
    );
  }

  if (seccion === 'limpieza') {
    return (
      <View style={{ flex: 1 }}>
        <SafeAreaView style={styles.subHeader}>
          <TouchableOpacity onPress={() => setSeccion('menu')} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color={cartasBosque.tinta} />
            <Text style={styles.backLabel}>Servicios</Text>
          </TouchableOpacity>
          <Text style={styles.subTitulo}>Limpieza</Text>
        </SafeAreaView>
        <LimpiezaTenantScreen />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.titulo}>Servicios</Text>
      <Text style={styles.sub}>Gestiona tus servicios adicionales</Text>
      <View style={styles.lista}>
        {ENTRADAS.map(e => (
          <TouchableOpacity
            key={e.id}
            style={styles.entrada}
            onPress={() => setSeccion(e.id)}
          >
            <View style={styles.entradaIcon}>
              <Ionicons name={e.icon} size={22} color={cartasBosque.bosque} />
            </View>
            <View style={styles.entradaTexto}>
              <Text style={styles.entradaTitulo}>{e.titulo}</Text>
              <Text style={styles.entradaSub}>{e.sub}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={cartasBosque.niebla} />
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: cartasBosque.bruma,
    paddingHorizontal: spacing[4], paddingTop: spacing[6],
  },
  titulo: {
    fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 22, color: cartasBosque.tinta,
    marginBottom: spacing[1],
  },
  sub: {
    fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: cartasBosque.helecho,
    marginBottom: spacing[5],
  },
  lista: { gap: spacing[2] },
  entrada: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    backgroundColor: cartasBosque.pergamino, borderRadius: borderRadius.md,
    padding: spacing[3], borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
  },
  entradaIcon: {
    width: 42, height: 42, borderRadius: borderRadius.sm,
    backgroundColor: cartasBosque.niebla + '55',
    alignItems: 'center', justifyContent: 'center',
  },
  entradaTexto: { flex: 1 },
  entradaTitulo: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 14, color: cartasBosque.tinta },
  entradaSub: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 11, color: cartasBosque.helecho, marginTop: 1 },
  // Sub-header para vistas internas
  subHeader: {
    backgroundColor: cartasBosque.bruma,
    borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro,
    paddingHorizontal: spacing[4], paddingBottom: spacing[2],
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], marginBottom: spacing[1] },
  backLabel: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: cartasBosque.tinta },
  subTitulo: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 18, color: cartasBosque.tinta },
});
