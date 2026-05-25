import React from 'react';
import { View, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { cartasBosque } from '@/constants/colors';

// ── Tenant screens ────────────────────────────────────────────
import DossierScreen        from '@/screens/tenant/DossierScreen';
import NoticiasScreen       from '@/screens/tenant/NoticiasScreen';
import HomeScreen           from '@/screens/tenant/HomeScreen';
import PagosScreen          from '@/screens/tenant/PagosScreen';
import ServiciosMenuScreen  from '@/screens/tenant/ServiciosMenuScreen';
import VisitasScreen        from '@/screens/tenant/VisitasScreen';
import SoporteScreen        from '@/screens/tenant/SoporteScreen';

// ── Admin screens ─────────────────────────────────────────────
import DashboardAdminScreen from '@/screens/admin/DashboardAdminScreen';
import PagosAdminScreen     from '@/screens/admin/PagosAdminScreen';
import ServiciosAdminScreen from '@/screens/admin/ServiciosAdminScreen';
import TicketsAdminScreen   from '@/screens/admin/TicketsAdminScreen';
import ConfigAdminScreen    from '@/screens/admin/ConfigAdminScreen';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const ICON_ACTIVE   = '#CDB29D';
const ICON_INACTIVE = '#4A5E48';

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

      {/* Home — tab central con pill destacado */}
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
//  ADMIN — 5 tabs placeholder
// ─────────────────────────────────────────────────────────────

type AdminTabList = {
  Dashboard:  undefined;
  Pagos:      undefined;
  Inquilinos: undefined;
  Tickets:    undefined;
  Config:     undefined;
};

const AdminTab = createBottomTabNavigator<AdminTabList>();

function AdminNavigator() {
  return (
    <AdminTab.Navigator
      initialRouteName="Dashboard"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ICON_ACTIVE,
        tabBarInactiveTintColor: ICON_INACTIVE,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <AdminTab.Screen
        name="Dashboard"
        component={DashboardAdminScreen}
        options={{ tabBarIcon: tabIcon('grid-outline', 'grid'), tabBarLabel: 'Dashboard' }}
      />
      <AdminTab.Screen
        name="Pagos"
        component={PagosAdminScreen}
        options={{ tabBarIcon: tabIcon('card-outline', 'card') }}
      />
      <AdminTab.Screen
        name="Inquilinos"
        component={ServiciosAdminScreen}
        options={{ tabBarIcon: tabIcon('people-outline', 'people'), tabBarLabel: 'Inquilinos' }}
      />
      <AdminTab.Screen
        name="Tickets"
        component={TicketsAdminScreen}
        options={{ tabBarIcon: tabIcon('headset-outline', 'headset'), tabBarLabel: 'Tickets' }}
      />
      <AdminTab.Screen
        name="Config"
        component={ConfigAdminScreen}
        options={{ tabBarIcon: tabIcon('settings-outline', 'settings'), tabBarLabel: 'Config' }}
      />
    </AdminTab.Navigator>
  );
}

// ─────────────────────────────────────────────────────────────
//  Root — elige navegador según rol
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
  // Home tab central
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
