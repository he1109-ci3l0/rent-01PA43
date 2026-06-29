import React, { useState } from 'react';
import {
  View, TouchableOpacity, ScrollView, StyleSheet, ImageBackground,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { cartasBosque } from '@/constants/colors';

import BarraSuperior from '@/components/common/BarraSuperior';

// ── Tenant screens ────────────────────────────────────────────
import DossierScreen         from '@/screens/tenant/DossierScreen';
import NoticiasScreen        from '@/screens/tenant/NoticiasScreen';
import HomeScreen            from '@/screens/tenant/HomeScreen';
import ServiciosMenuScreen   from '@/screens/tenant/ServiciosMenuScreen';
import SoporteScreen         from '@/screens/tenant/SoporteScreen';

// ── Admin Home ────────────────────────────────────────────────
import AdminHomeScreen       from '@/screens/admin/AdminHomeScreen';

// ── Admin General ─────────────────────────────────────────────
import PagosAdminScreen      from '@/screens/admin/PagosAdminScreen';
import InquilinosWebScreen   from '@/screens/admin/web/InquilinosWebScreen';
import HabitacionesScreen    from '@/screens/admin/HabitacionesScreen';

// ── Admin Servicios ───────────────────────────────────────────
import LavanderiaAdminScreen     from '@/screens/admin/LavanderiaAdminScreen';
import LimpiezaAdminScreen       from '@/screens/admin/LimpiezaAdminScreen';
import AlmacenamientoAdminScreen from '@/screens/admin/AlmacenamientoAdminScreen';
import MobiliarioAdminScreen     from '@/screens/admin/MobiliarioAdminScreen';
import ServiciosAdminScreen      from '@/screens/admin/ServiciosAdminScreen';

// ── Admin Finanzas ────────────────────────────────────────────
import FacturasAdminScreen   from '@/screens/admin/FacturasAdminScreen';
import CuponesAdminScreen    from '@/screens/admin/CuponesAdminScreen';
import EstadoFinanzasScreen  from '@/screens/admin/web/EstadoFinanzasScreen';

// ── Admin Operaciones ─────────────────────────────────────────
import VisitasAdminScreen    from '@/screens/admin/VisitasAdminScreen';
import TicketsAdminScreen    from '@/screens/admin/TicketsAdminScreen';
import ChatAdminScreen       from '@/screens/admin/ChatAdminScreen';
import SesionesAdminScreen   from '@/screens/admin/SesionesAdminScreen';
import ExpedienteAdminScreen from '@/screens/admin/ExpedienteAdminScreen';
import ConfigAdminScreen     from '@/screens/admin/ConfigAdminScreen';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];
type MCIName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const ICON_ACTIVE   = '#CDB29D';
const ICON_INACTIVE = '#4A5E48';

// ─────────────────────────────────────────────────────────────
//  Sub-tab bar reutilizable
// ─────────────────────────────────────────────────────────────

function SubTabBar({ tabs, active, onPress }: {
  tabs: { id: string; label: string; icon: string }[];
  active: string;
  onPress: (id: string) => void;
}) {
  return (
    <ImageBackground
      source={require('../../assets/papel-tapiz.jpg')}
      resizeMode="cover"
      style={sub.franja}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        {tabs.map(t => (
          <TouchableOpacity key={t.id} style={sub.item} onPress={() => onPress(t.id)}>
            <View style={[sub.pill, active === t.id && sub.pillActivo]}>
              <MaterialCommunityIcons
                name={t.icon as MCIName}
                size={24}
                color={cartasBosque.crema}
              />
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </ImageBackground>
  );
}

// ─────────────────────────────────────────────────────────────
//  Admin sub-screens
// ─────────────────────────────────────────────────────────────

function AdminGeneralScreen() {
  const [tab, setTab] = useState('pagos');
  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: cartasBosque.bruma }}>
      <SubTabBar
        tabs={[
          { id: 'pagos',        label: 'Pagos',        icon: 'cash-multiple' },
          { id: 'inquilinos',   label: 'Inquilinos',   icon: 'account-group' },
          { id: 'habitaciones', label: 'Habitaciones', icon: 'bed' },
        ]}
        active={tab}
        onPress={setTab}
      />
      <View style={{ flex: 1 }}>
        {tab === 'pagos'        && <PagosAdminScreen />}
        {tab === 'inquilinos'   && <InquilinosWebScreen />}
        {tab === 'habitaciones' && <HabitacionesScreen />}
      </View>
    </View>
  );
}

function AdminServiciosScreen() {
  const [tab, setTab] = useState('lavanderia');
  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: cartasBosque.bruma }}>
      <SubTabBar
        tabs={[
          { id: 'lavanderia',     label: 'Lavandería',    icon: 'washing-machine' },
          { id: 'limpieza',       label: 'Limpieza',      icon: 'broom' },
          { id: 'almacenamiento', label: 'Almacén',       icon: 'package-variant' },
          { id: 'mobiliario',     label: 'Mobiliario',    icon: 'sofa' },
          { id: 'huespedes',      label: 'Huéspedes',     icon: 'account-plus' },
        ]}
        active={tab}
        onPress={setTab}
      />
      <View style={{ flex: 1 }}>
        {tab === 'lavanderia'     && <LavanderiaAdminScreen />}
        {tab === 'limpieza'       && <LimpiezaAdminScreen />}
        {tab === 'almacenamiento' && <AlmacenamientoAdminScreen />}
        {tab === 'mobiliario'     && <MobiliarioAdminScreen />}
        {tab === 'huespedes'      && <ServiciosAdminScreen />}
      </View>
    </View>
  );
}

function AdminFinanzasScreen() {
  const [tab, setTab] = useState('facturacion');
  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: cartasBosque.bruma }}>
      <SubTabBar
        tabs={[
          { id: 'facturacion', label: 'Facturación', icon: 'receipt' },
          { id: 'cupones',     label: 'Cupones',     icon: 'ticket-percent' },
          { id: 'estado',      label: 'Estado',      icon: 'chart-line' },
        ]}
        active={tab}
        onPress={setTab}
      />
      <View style={{ flex: 1 }}>
        {tab === 'facturacion' && <FacturasAdminScreen />}
        {tab === 'cupones'     && <CuponesAdminScreen />}
        {tab === 'estado'      && <EstadoFinanzasScreen />}
      </View>
    </View>
  );
}

function AdminOperacionesScreen() {
  const [tab, setTab] = useState('visitas');
  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: cartasBosque.bruma }}>
      <SubTabBar
        tabs={[
          { id: 'visitas',     label: 'Visitas',      icon: 'calendar-account' },
          { id: 'tickets',     label: 'Tickets',      icon: 'ticket-confirmation' },
          { id: 'chat',        label: 'Chat',         icon: 'chat' },
          { id: 'sesiones',    label: 'Sesiones',     icon: 'cellphone-key' },
          { id: 'expedientes', label: 'Expedientes',  icon: 'folder-account' },
          { id: 'config',      label: 'Config',       icon: 'cog' },
        ]}
        active={tab}
        onPress={setTab}
      />
      <View style={{ flex: 1 }}>
        {tab === 'visitas'     && <VisitasAdminScreen />}
        {tab === 'tickets'     && <TicketsAdminScreen />}
        {tab === 'chat'        && <ChatAdminScreen />}
        {tab === 'sesiones'    && <SesionesAdminScreen />}
        {tab === 'expedientes' && <ExpedienteAdminScreen />}
        {tab === 'config'      && <ConfigAdminScreen />}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
//  TENANT — 5 tabs
// ─────────────────────────────────────────────────────────────

type TenantTabList = {
  Dossier:   undefined;
  Comunidad: undefined;
  Home:      undefined;
  Servicios: undefined;
  Soporte:   undefined;
};

const TenantTab = createBottomTabNavigator<TenantTabList>();

function HomePill({ focused }: { focused: boolean }) {
  return (
    <ImageBackground
      source={require('../../assets/papel-tapiz.jpg')}
      resizeMode="cover"
      imageStyle={{ borderRadius: 28 }}
      style={[styles.homePill, focused && styles.homePillActive]}
    >
      <Ionicons
        name={focused ? 'home' : 'home-outline'}
        size={24}
        color="#FFFFFF"
      />
    </ImageBackground>
  );
}

function tabIcon(name: IoniconsName, nameFocused: IoniconsName) {
  return ({ focused, size }: { focused: boolean; size: number }) => (
    <Ionicons
      name={focused ? nameFocused : name}
      size={size}
      color={focused ? ICON_ACTIVE : ICON_INACTIVE}
    />
  );
}

function mciIcon(name: MCIName) {
  return ({ color, size }: { color: string; size: number }) => (
    <MaterialCommunityIcons name={name} size={size} color={color} />
  );
}

function TenantNavigator() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1 }}>
      <BarraSuperior />
    <TenantTab.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: ICON_ACTIVE,
        tabBarInactiveTintColor: ICON_INACTIVE,
        tabBarStyle: [styles.tabBar, { height: 64 + insets.bottom, paddingBottom: 8 + insets.bottom }],
      }}
    >
      <TenantTab.Screen
        name="Dossier"
        component={DossierScreen}
        options={{ tabBarIcon: mciIcon('card-account-details') }}
      />
      <TenantTab.Screen
        name="Comunidad"
        component={NoticiasScreen}
        options={{ tabBarIcon: mciIcon('forum') }}
      />
      <TenantTab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarIcon: ({ focused }) => <HomePill focused={focused} /> }}
      />
      <TenantTab.Screen
        name="Servicios"
        component={ServiciosMenuScreen}
        options={{ tabBarIcon: mciIcon('tools') }}
      />
      <TenantTab.Screen
        name="Soporte"
        component={SoporteScreen}
        options={{ tabBarIcon: mciIcon('headset') }}
      />
    </TenantTab.Navigator>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
//  ADMIN — 5 tabs
// ─────────────────────────────────────────────────────────────

type AdminTabList = {
  General:   undefined;
  Servicios: undefined;
  Home:      undefined;
  Finanzas:  undefined;
  Admin:     undefined;
};

const AdminTab = createBottomTabNavigator<AdminTabList>();

function AdminNavigator() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1 }}>
      <BarraSuperior />
    <AdminTab.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: ICON_ACTIVE,
        tabBarInactiveTintColor: ICON_INACTIVE,
        tabBarStyle: [styles.tabBar, { height: 64 + insets.bottom, paddingBottom: 8 + insets.bottom }],
      }}
    >
      <AdminTab.Screen
        name="General"
        component={AdminGeneralScreen}
        options={{ tabBarIcon: mciIcon('flower') }}
      />
      <AdminTab.Screen
        name="Servicios"
        component={AdminServiciosScreen}
        options={{ tabBarIcon: mciIcon('tools') }}
      />
      <AdminTab.Screen
        name="Home"
        component={AdminHomeScreen}
        options={{ tabBarIcon: ({ focused }) => <HomePill focused={focused} /> }}
      />
      <AdminTab.Screen
        name="Finanzas"
        component={AdminFinanzasScreen}
        options={{ tabBarIcon: mciIcon('chart-bar') }}
      />
      <AdminTab.Screen
        name="Admin"
        component={AdminOperacionesScreen}
        options={{ tabBarIcon: mciIcon('shield-account') }}
      />
    </AdminTab.Navigator>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
//  Root
// ─────────────────────────────────────────────────────────────

export default function AppNavigator() {
  const { role } = useAuth();
  return role === 'admin' ? <AdminNavigator /> : <TenantNavigator />;
}

// ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#122A1F',
    borderTopColor: '#122A1F',
    borderTopWidth: 0,
    elevation: 0,
    height: 64,
    paddingBottom: 8,
    paddingTop: 6,
    overflow: 'visible',
  },
  tabLabel: {
    fontFamily: 'MonaSans_400Regular',
    fontSize: 9,
    letterSpacing: 0.6,
  },
  homePill: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  homePillActive: {
    borderWidth: 2,
    borderColor: cartasBosque.arena,
  },
});

const sub = StyleSheet.create({
  franja: {
    width: 62,
  },
  item: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  pill: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: cartasBosque.sidebar,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActivo: {
    borderWidth: 2,
    borderColor: '#F7F7F5',
  },
});
