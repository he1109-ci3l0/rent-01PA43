import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { cartasBosque } from '@/constants/colors';
import { spacing } from '@/constants/spacing';

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

const ICON_ACTIVE   = '#CDB29D';
const ICON_INACTIVE = '#4A5E48';

// ─────────────────────────────────────────────────────────────
//  Sub-tab bar reutilizable
// ─────────────────────────────────────────────────────────────

function SubTabBar({ tabs, active, onPress }: {
  tabs: { id: string; label: string }[];
  active: string;
  onPress: (id: string) => void;
}) {
  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: cartasBosque.bruma }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro }}
        contentContainerStyle={{ flexDirection: 'row' }}
      >
        {tabs.map(t => (
          <TouchableOpacity
            key={t.id}
            style={[sub.tab, active === t.id && sub.tabActivo]}
            onPress={() => onPress(t.id)}
          >
            <Text style={[sub.tabText, active === t.id && sub.tabTextActivo]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────
//  Admin sub-screens
// ─────────────────────────────────────────────────────────────

function AdminGeneralScreen() {
  const [tab, setTab] = useState('pagos');
  return (
    <View style={{ flex: 1, backgroundColor: cartasBosque.bruma }}>
      <SubTabBar
        tabs={[
          { id: 'pagos',        label: 'Pagos' },
          { id: 'inquilinos',   label: 'Inquilinos' },
          { id: 'habitaciones', label: 'Habitaciones' },
        ]}
        active={tab}
        onPress={setTab}
      />
      {tab === 'pagos'        && <PagosAdminScreen />}
      {tab === 'inquilinos'   && <InquilinosWebScreen />}
      {tab === 'habitaciones' && <HabitacionesScreen />}
    </View>
  );
}

function AdminServiciosScreen() {
  const [tab, setTab] = useState('lavanderia');
  return (
    <View style={{ flex: 1, backgroundColor: cartasBosque.bruma }}>
      <SubTabBar
        tabs={[
          { id: 'lavanderia',     label: 'Lavandería' },
          { id: 'limpieza',       label: 'Limpieza' },
          { id: 'almacenamiento', label: 'Almacén' },
          { id: 'mobiliario',     label: 'Mobiliario' },
          { id: 'huespedes',      label: 'Huéspedes' },
        ]}
        active={tab}
        onPress={setTab}
      />
      {tab === 'lavanderia'     && <LavanderiaAdminScreen />}
      {tab === 'limpieza'       && <LimpiezaAdminScreen />}
      {tab === 'almacenamiento' && <AlmacenamientoAdminScreen />}
      {tab === 'mobiliario'     && <MobiliarioAdminScreen />}
      {tab === 'huespedes'      && <ServiciosAdminScreen />}
    </View>
  );
}

function AdminFinanzasScreen() {
  const [tab, setTab] = useState('facturacion');
  return (
    <View style={{ flex: 1, backgroundColor: cartasBosque.bruma }}>
      <SubTabBar
        tabs={[
          { id: 'facturacion', label: 'Facturación' },
          { id: 'cupones',     label: 'Cupones' },
          { id: 'estado',      label: 'Estado' },
        ]}
        active={tab}
        onPress={setTab}
      />
      {tab === 'facturacion' && <FacturasAdminScreen />}
      {tab === 'cupones'     && <CuponesAdminScreen />}
      {tab === 'estado'      && <EstadoFinanzasScreen />}
    </View>
  );
}

function AdminOperacionesScreen() {
  const [tab, setTab] = useState('visitas');
  return (
    <View style={{ flex: 1, backgroundColor: cartasBosque.bruma }}>
      <SubTabBar
        tabs={[
          { id: 'visitas',     label: 'Visitas' },
          { id: 'tickets',     label: 'Tickets' },
          { id: 'chat',        label: 'Chat' },
          { id: 'sesiones',    label: 'Sesiones' },
          { id: 'expedientes', label: 'Expedientes' },
          { id: 'config',      label: 'Config' },
        ]}
        active={tab}
        onPress={setTab}
      />
      {tab === 'visitas'     && <VisitasAdminScreen />}
      {tab === 'tickets'     && <TicketsAdminScreen />}
      {tab === 'chat'        && <ChatAdminScreen />}
      {tab === 'sesiones'    && <SesionesAdminScreen />}
      {tab === 'expedientes' && <ExpedienteAdminScreen />}
      {tab === 'config'      && <ConfigAdminScreen />}
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

function tabIcon(name: IoniconsName, nameFocused: IoniconsName) {
  return ({ focused, size }: { focused: boolean; size: number }) => (
    <Ionicons
      name={focused ? nameFocused : name}
      size={size}
      color={focused ? ICON_ACTIVE : ICON_INACTIVE}
    />
  );
}

function TenantNavigator() {
  return (
    <TenantTab.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ICON_ACTIVE,
        tabBarInactiveTintColor: ICON_INACTIVE,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <TenantTab.Screen
        name="Dossier"
        component={DossierScreen}
        options={{ tabBarIcon: tabIcon('document-text-outline', 'document-text') }}
      />
      <TenantTab.Screen
        name="Comunidad"
        component={NoticiasScreen}
        options={{ tabBarIcon: tabIcon('newspaper-outline', 'newspaper'), tabBarLabel: 'Comunidad' }}
      />
      <TenantTab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={[styles.homePill, focused && styles.homePillActive]}>
              <Ionicons
                name={focused ? 'home' : 'home-outline'}
                size={24}
                color={focused ? '#122A1F' : cartasBosque.helecho}
              />
            </View>
          ),
          tabBarLabel: 'Home',
        }}
      />
      <TenantTab.Screen
        name="Servicios"
        component={ServiciosMenuScreen}
        options={{ tabBarIcon: tabIcon('grid-outline', 'grid') }}
      />
      <TenantTab.Screen
        name="Soporte"
        component={SoporteScreen}
        options={{ tabBarIcon: tabIcon('help-circle-outline', 'help-circle'), tabBarLabel: 'Soporte' }}
      />
    </TenantTab.Navigator>
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
  return (
    <AdminTab.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ICON_ACTIVE,
        tabBarInactiveTintColor: ICON_INACTIVE,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <AdminTab.Screen
        name="General"
        component={AdminGeneralScreen}
        options={{ tabBarIcon: tabIcon('grid-outline', 'grid'), tabBarLabel: 'General' }}
      />
      <AdminTab.Screen
        name="Servicios"
        component={AdminServiciosScreen}
        options={{ tabBarIcon: tabIcon('construct-outline', 'construct'), tabBarLabel: 'Servicios' }}
      />
      <AdminTab.Screen
        name="Home"
        component={AdminHomeScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={[styles.homePill, focused && styles.homePillActive]}>
              <Ionicons
                name={focused ? 'home' : 'home-outline'}
                size={24}
                color={focused ? '#122A1F' : cartasBosque.helecho}
              />
            </View>
          ),
          tabBarLabel: 'Home',
        }}
      />
      <AdminTab.Screen
        name="Finanzas"
        component={AdminFinanzasScreen}
        options={{ tabBarIcon: tabIcon('bar-chart-outline', 'bar-chart'), tabBarLabel: 'Finanzas' }}
      />
      <AdminTab.Screen
        name="Admin"
        component={AdminOperacionesScreen}
        options={{ tabBarIcon: tabIcon('shield-outline', 'shield'), tabBarLabel: 'Admin' }}
      />
    </AdminTab.Navigator>
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
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 9,
    letterSpacing: 0.6,
  },
  homePill: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2E3C2C',
    marginBottom: 20,
  },
  homePillActive: {
    backgroundColor: '#CDB29D',
  },
});

const sub = StyleSheet.create({
  tab: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2] + 2,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActivo: {
    borderBottomColor: cartasBosque.bosque,
  },
  tabText: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 11,
    color: cartasBosque.helecho,
  },
  tabTextActivo: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: cartasBosque.bosque,
  },
});
