import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { cartasBosque } from '@/constants/colors';
import { spacing } from '@/constants/spacing';
import HabitacionesScreen    from '@/screens/admin/HabitacionesScreen';
import FacturasAdminScreen   from '@/screens/admin/FacturasAdminScreen';
import ChatAdminScreen       from '@/screens/admin/ChatAdminScreen';
import SesionesAdminScreen   from '@/screens/admin/SesionesAdminScreen';
import { useAuth } from '@/hooks/useAuth';

type Tab = 'habitaciones' | 'facturacion' | 'chat' | 'seguridad';

const TAB_LABELS: Record<Tab, string> = {
  habitaciones: 'Habitaciones',
  facturacion:  'Facturación',
  chat:         'Chat',
  seguridad:    'Seguridad',
};

export default function ConfigAdminScreen() {
  const [tab, setTab] = useState<Tab>('habitaciones');
  const { signOut } = useAuth();

  return (
    <View style={{ flex: 1, backgroundColor: cartasBosque.bruma }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: cartasBosque.bruma }}>
        <View style={s.tabBar}>
          {(Object.keys(TAB_LABELS) as Tab[]).map(t => (
            <TouchableOpacity
              key={t}
              style={[s.tabBtn, tab === t && s.tabBtnActivo]}
              onPress={() => setTab(t)}
            >
              <Text style={[s.tabText, tab === t && s.tabTextActivo]}>
                {TAB_LABELS[t]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          style={s.cerrarSesionBtn}
          onPress={() =>
            Alert.alert('Cerrar sesión', '¿Confirmas cerrar sesión?', [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Cerrar sesión', style: 'destructive', onPress: signOut },
            ])
          }
        >
          <Ionicons name="log-out-outline" size={16} color={cartasBosque.alertaBorde} />
          <Text style={s.cerrarSesionText}>Cerrar sesión</Text>
        </TouchableOpacity>
      </SafeAreaView>

      {tab === 'habitaciones' && <HabitacionesScreen />}
      {tab === 'facturacion'  && <FacturasAdminScreen />}
      {tab === 'chat'         && <ChatAdminScreen />}
      {tab === 'seguridad'    && <SesionesAdminScreen />}
    </View>
  );
}

const s = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro,
    backgroundColor: cartasBosque.bruma,
  },
  tabBtn: {
    flex: 1, paddingVertical: spacing[2] + 2, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabBtnActivo: { borderBottomColor: cartasBosque.bosque },
  tabText:      { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: cartasBosque.helecho },
  tabTextActivo:{ color: cartasBosque.bosque },
  cerrarSesionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderTopWidth: 1,
    borderTopColor: cartasBosque.pergaminoOscuro,
  },
  cerrarSesionText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: cartasBosque.alertaBorde,
  },
});
