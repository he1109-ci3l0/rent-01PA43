import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { cartasBosque } from '@/constants/colors';
import { spacing } from '@/constants/spacing';
import HabitacionesScreen    from '@/screens/admin/HabitacionesScreen';
import FacturasAdminScreen   from '@/screens/admin/FacturasAdminScreen';
import ChatAdminScreen       from '@/screens/admin/ChatAdminScreen';
import SesionesAdminScreen   from '@/screens/admin/SesionesAdminScreen';

type Tab = 'habitaciones' | 'facturacion' | 'chat' | 'seguridad';

const TAB_LABELS: Record<Tab, string> = {
  habitaciones: 'Habitaciones',
  facturacion:  'Facturación',
  chat:         'Chat',
  seguridad:    'Seguridad',
};

export default function ConfigAdminScreen() {
  const [tab, setTab] = useState<Tab>('habitaciones');

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
  tabText:      { fontFamily: 'DMMono_400Regular', fontSize: 10, color: cartasBosque.helecho },
  tabTextActivo:{ color: cartasBosque.bosque },
});
