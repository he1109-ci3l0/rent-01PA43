import React from 'react';
import { View, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { cartasBosque } from '@/constants/colors';

// ── Tenant screens ────────────────────────────────────────────
import DossierScreen   from '@/screens/tenant/DossierScreen';
import NoticiasScreen  from '@/screens/tenant/NoticiasScreen';
import PagosScreen     from '@/screens/tenant/PagosScreen';
import ServiciosScreen from '@/screens/tenant/ServiciosScreen';
import SoporteScreen   from '@/screens/tenant/SoporteScreen';


// ── Admin screens ─────────────────────────────────────────────
import AdminHomeScreen    from '@/screens/admin/AdminHomeScreen';
import PagosAdminScreen   from '@/screens/admin/PagosAdminScreen';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

// ─────────────────────────────────────────────────────────────
//  TENANT — 5 tabs
// ─────────────────────────────────────────────────────────────

type TenantTabList = {
  Dossier: undefined;
  Noticias: undefined;
  Home: undefined;
  Servicios: undefined;
  Soporte: undefined;
};

const TenantTab = createBottomTabNavigator<TenantTabList>();

function tabIcon(name: IoniconsName, nameFocused: IoniconsName) {
  return ({ focused, size }: { focused: boolean; size: number }) => (
    <Ionicons
      name={focused ? nameFocused : name}
      size={size}
      color={focused ? cartasBosque.bosque : cartasBosque.helecho}
    />
  );
}

function TenantNavigator() {
  return (
    <TenantTab.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: cartasBosque.bosque,
        tabBarInactiveTintColor: cartasBosque.helecho,
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
        name="Noticias"
        component={NoticiasScreen}
        options={{ tabBarIcon: tabIcon('notifications-outline', 'notifications') }}
      />

      {/* Home — tab central con pill destacado */}
      <TenantTab.Screen
        name="Home"
        component={PagosScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={[styles.homePill, focused && styles.homePillActive]}>
              <Ionicons
                name={focused ? 'home' : 'home-outline'}
                size={22}
                color={focused ? cartasBosque.bruma : cartasBosque.helecho}
              />
            </View>
          ),
          tabBarLabel: 'Home',
        }}
      />

      <TenantTab.Screen
        name="Servicios"
        component={ServiciosScreen}
        options={{ tabBarIcon: tabIcon('construct-outline', 'construct') }}
      />
      <TenantTab.Screen
        name="Soporte"
        component={SoporteScreen}
        options={{ tabBarIcon: tabIcon('chatbubble-ellipses-outline', 'chatbubble-ellipses') }}
      />
    </TenantTab.Navigator>
  );
}

// ─────────────────────────────────────────────────────────────
//  ADMIN — 5 tabs placeholder
// ─────────────────────────────────────────────────────────────

type AdminTabList = {
  Panel: undefined;
  Inquilinos: undefined;
  Pagos: undefined;
  Tickets: undefined;
  Ajustes: undefined;
};

const AdminTab = createBottomTabNavigator<AdminTabList>();

function AdminNavigator() {
  return (
    <AdminTab.Navigator
      initialRouteName="Panel"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: cartasBosque.bosque,
        tabBarInactiveTintColor: cartasBosque.helecho,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <AdminTab.Screen
        name="Panel"
        component={AdminHomeScreen}
        options={{ tabBarIcon: tabIcon('grid-outline', 'grid') }}
      />
      <AdminTab.Screen
        name="Inquilinos"
        component={AdminHomeScreen}
        options={{ tabBarIcon: tabIcon('people-outline', 'people') }}
      />
      <AdminTab.Screen
        name="Pagos"
        component={PagosAdminScreen}
        options={{ tabBarIcon: tabIcon('card-outline', 'card') }}
      />
      <AdminTab.Screen
        name="Tickets"
        component={AdminHomeScreen}
        options={{ tabBarIcon: tabIcon('hammer-outline', 'hammer') }}
      />
      <AdminTab.Screen
        name="Ajustes"
        component={AdminHomeScreen}
        options={{ tabBarIcon: tabIcon('settings-outline', 'settings') }}
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
    backgroundColor: cartasBosque.bruma,
    borderTopColor: cartasBosque.pergaminoOscuro,
    borderTopWidth: 1,
    height: 60,
    paddingBottom: 6,
    paddingTop: 4,
  },
  tabLabel: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 9,
    letterSpacing: 0.6,
  },
  // Home tab central
  homePill: {
    width: 46,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: cartasBosque.niebla,
  },
  homePillActive: {
    backgroundColor: cartasBosque.bosque,
  },
});
