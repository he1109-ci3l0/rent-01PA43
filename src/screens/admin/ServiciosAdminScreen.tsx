import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { cartasBosque } from '@/constants/colors';
import { spacing } from '@/constants/spacing';
import HuespedExtraAdminScreen    from '@/screens/admin/HuespedExtraAdminScreen';
import LavanderiaAdminScreen      from '@/screens/admin/LavanderiaAdminScreen';
import AlmacenamientoAdminScreen  from '@/screens/admin/AlmacenamientoAdminScreen';

type Tab = 'huespedes' | 'lavanderia' | 'almacenamiento';

const TAB_LABELS: Record<Tab, string> = {
  huespedes:      'Huéspedes',
  lavanderia:     'Lavandería',
  almacenamiento: 'Almacén',
};

export default function ServiciosAdminScreen() {
  const [tab, setTab] = useState<Tab>('huespedes');

  return (
    <View style={{ flex: 1, backgroundColor: cartasBosque.bruma }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: cartasBosque.bruma, zIndex: 10 }}>
      <View style={styles.tabBar}>
        {(Object.keys(TAB_LABELS) as Tab[]).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tabBtn, tab === t && styles.tabBtnActivo]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActivo]}>
              {TAB_LABELS[t]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      </SafeAreaView>

      {tab === 'huespedes'      && <HuespedExtraAdminScreen />}
      {tab === 'lavanderia'     && <LavanderiaAdminScreen />}
      {tab === 'almacenamiento' && <AlmacenamientoAdminScreen />}
    </View>
  );
}

const styles = StyleSheet.create({
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
  tabText: { fontFamily: 'DMMono_400Regular', fontSize: 11, color: cartasBosque.helecho },
  tabTextActivo: { color: cartasBosque.bosque },
});
