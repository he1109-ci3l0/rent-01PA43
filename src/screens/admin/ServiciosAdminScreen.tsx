import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { cartasBosque } from '@/constants/colors';
import { spacing } from '@/constants/spacing';
import HuespedExtraAdminScreen from '@/screens/admin/HuespedExtraAdminScreen';
import LavanderiaAdminScreen   from '@/screens/admin/LavanderiaAdminScreen';

type Tab = 'huespedes' | 'lavanderia';

export default function ServiciosAdminScreen() {
  const [tab, setTab] = useState<Tab>('huespedes');

  return (
    <View style={{ flex: 1, backgroundColor: cartasBosque.bruma }}>
      <View style={styles.tabBar}>
        {(['huespedes', 'lavanderia'] as Tab[]).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tabBtn, tab === t && styles.tabBtnActivo]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActivo]}>
              {t === 'huespedes' ? 'Huéspedes' : 'Lavandería'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'huespedes'
        ? <HuespedExtraAdminScreen />
        : <LavanderiaAdminScreen />
      }
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
