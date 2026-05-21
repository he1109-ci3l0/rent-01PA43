import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { cartasBosque } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/spacing';
import { useAuth } from '@/hooks/useAuth';
import FacturacionScreen from './FacturacionScreen';

type Seccion = 'dossier' | 'facturacion';

export default function DossierScreen() {
  const { user, signOut } = useAuth();
  const [seccion, setSeccion] = useState<Seccion>('dossier');

  if (seccion === 'facturacion') {
    return <FacturacionScreen onBack={() => setSeccion('dossier')} />;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.titulo}>Mi expediente</Text>
        <TouchableOpacity onPress={signOut}>
          <Ionicons name="log-out-outline" size={22} color={cartasBosque.helecho} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Perfil básico */}
        <View style={styles.avatarRow}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={32} color={cartasBosque.bruma} />
          </View>
          <View>
            <Text style={styles.nombre}>{user?.email ?? '—'}</Text>
            <Text style={styles.uid}>uid: {user?.uid?.slice(0, 12)}…</Text>
          </View>
        </View>

        {/* Secciones */}
        <Text style={styles.seccionLabel}>Servicios</Text>

        <EntradaCard
          icon="receipt-outline"
          titulo="Facturación CFDI"
          sub="Solicita tus facturas electrónicas"
          onPress={() => setSeccion('facturacion')}
        />

        <EntradaCard
          icon="star-outline"
          titulo="Score de reputación"
          sub="Consulta tu historial y nivel"
          onPress={() => {}}
        />

        <EntradaCard
          icon="document-text-outline"
          titulo="Contrato de hospedaje"
          sub="Consulta los términos vigentes"
          onPress={() => {}}
        />

        <EntradaCard
          icon="notifications-outline"
          titulo="Notificaciones"
          sub="Configura tus alertas"
          onPress={() => {}}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function EntradaCard({
  icon, titulo, sub, onPress,
}: { icon: any; titulo: string; sub: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.entradaCard} onPress={onPress}>
      <View style={styles.entradaIcon}>
        <Ionicons name={icon} size={20} color={cartasBosque.bosque} />
      </View>
      <View style={styles.entradaTexto}>
        <Text style={styles.entradaTitulo}>{titulo}</Text>
        <Text style={styles.entradaSub}>{sub}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={cartasBosque.niebla} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: cartasBosque.bruma },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingTop: spacing[4], paddingBottom: spacing[3],
    borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro,
  },
  titulo: { fontFamily: 'DMSans_600SemiBold', fontSize: 18, color: cartasBosque.tinta },
  scrollContent: { padding: spacing[4] },
  avatarRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    backgroundColor: cartasBosque.pergamino, borderRadius: borderRadius.md,
    padding: spacing[4], marginBottom: spacing[4],
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
  },
  avatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: cartasBosque.bosque,
    alignItems: 'center', justifyContent: 'center',
  },
  nombre: { fontFamily: 'DMSans_600SemiBold', fontSize: 14, color: cartasBosque.tinta },
  uid: { fontFamily: 'DMMono_400Regular', fontSize: 10, color: cartasBosque.helecho, marginTop: 2 },
  seccionLabel: {
    fontFamily: 'DMMono_400Regular', fontSize: 10, color: cartasBosque.helecho,
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: spacing[2],
  },
  entradaCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    backgroundColor: cartasBosque.pergamino, borderRadius: borderRadius.md,
    padding: spacing[3], marginBottom: spacing[2],
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
  },
  entradaIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: cartasBosque.niebla,
    alignItems: 'center', justifyContent: 'center',
  },
  entradaTexto: { flex: 1 },
  entradaTitulo: { fontFamily: 'DMSans_600SemiBold', fontSize: 13, color: cartasBosque.tinta },
  entradaSub: { fontFamily: 'DMSans_400Regular', fontSize: 11, color: cartasBosque.helecho },
});
