import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius } from '@/constants/spacing';
import { useAuth } from '@/hooks/useAuth';

// ── Web-specific screens ──────────────────────────────────────
import DashboardWebScreen     from '@/screens/admin/web/DashboardWebScreen';
import ConfiguracionWebScreen from '@/screens/admin/web/ConfiguracionWebScreen';

// ── Re-used admin screens ─────────────────────────────────────
import PagosAdminScreen          from '@/screens/admin/PagosAdminScreen';
import HabitacionesScreen        from '@/screens/admin/HabitacionesScreen';
import LavanderiaAdminScreen     from '@/screens/admin/LavanderiaAdminScreen';
import LimpiezaAdminScreen       from '@/screens/admin/LimpiezaAdminScreen';
import AlmacenamientoAdminScreen from '@/screens/admin/AlmacenamientoAdminScreen';
import FacturasAdminScreen       from '@/screens/admin/FacturasAdminScreen';
import TicketsAdminScreen        from '@/screens/admin/TicketsAdminScreen';
import ChatAdminScreen           from '@/screens/admin/ChatAdminScreen';
import SesionesAdminScreen       from '@/screens/admin/SesionesAdminScreen';
import ExpedienteAdminScreen     from '@/screens/admin/ExpedienteAdminScreen';

// ── Web-specific screens ──────────────────────────────────────
import InquilinosWebScreen   from '@/screens/admin/web/InquilinosWebScreen';

// ─── Types ────────────────────────────────────────────────────

type Seccion =
  | 'dashboard' | 'pagos' | 'inquilinos' | 'habitaciones'
  | 'lavanderia' | 'limpieza' | 'almacenamiento' | 'facturacion'
  | 'tickets' | 'chat' | 'sesiones' | 'expedientes' | 'configuracion';

interface NavItem {
  id: Seccion;
  label: string;
  icon: string;
  iconActive: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard',      label: 'Dashboard',      icon: 'grid-outline',          iconActive: 'grid' },
  { id: 'pagos',          label: 'Pagos',           icon: 'card-outline',          iconActive: 'card' },
  { id: 'inquilinos',     label: 'Inquilinos',      icon: 'people-outline',        iconActive: 'people' },
  { id: 'habitaciones',   label: 'Habitaciones',    icon: 'bed-outline',           iconActive: 'bed' },
  { id: 'lavanderia',     label: 'Lavandería',      icon: 'water-outline',         iconActive: 'water' },
  { id: 'limpieza',       label: 'Limpieza',        icon: 'sparkles-outline',      iconActive: 'sparkles' },
  { id: 'almacenamiento', label: 'Almacenamiento',  icon: 'archive-outline',       iconActive: 'archive' },
  { id: 'facturacion',    label: 'Facturación',     icon: 'receipt-outline',       iconActive: 'receipt' },
  { id: 'tickets',        label: 'Tickets',         icon: 'headset-outline',       iconActive: 'headset' },
  { id: 'chat',           label: 'Noticias / Chat', icon: 'chatbubbles-outline',   iconActive: 'chatbubbles' },
  { id: 'sesiones',       label: 'Sesiones',        icon: 'shield-outline',        iconActive: 'shield' },
  { id: 'expedientes',    label: 'Expedientes',     icon: 'document-text-outline', iconActive: 'document-text' },
  { id: 'configuracion',  label: 'Configuración',   icon: 'settings-outline',      iconActive: 'settings' },
];

// ─── Content router ───────────────────────────────────────────

function SeccionContent({ seccion }: { seccion: Seccion }) {
  switch (seccion) {
    case 'dashboard':      return <DashboardWebScreen />;
    case 'pagos':          return <PagosAdminScreen />;
    case 'inquilinos':     return <InquilinosWebScreen />;
    case 'habitaciones':   return <HabitacionesScreen />;
    case 'lavanderia':     return <LavanderiaAdminScreen />;
    case 'limpieza':       return <LimpiezaAdminScreen />;
    case 'almacenamiento': return <AlmacenamientoAdminScreen />;
    case 'facturacion':    return <FacturasAdminScreen />;
    case 'tickets':        return <TicketsAdminScreen />;
    case 'chat':           return <ChatAdminScreen />;
    case 'sesiones':       return <SesionesAdminScreen />;
    case 'expedientes':    return <ExpedienteAdminScreen />;
    case 'configuracion':  return <ConfiguracionWebScreen />;
  }
}

// ─── WebAdminNavigator ────────────────────────────────────────

export default function WebAdminNavigator() {
  const [seccion, setSeccion] = useState<Seccion>('dashboard');
  const { signOut } = useAuth();

  return (
    <View style={s.root}>

      {/* ── Sidebar ── */}
      <View style={s.sidebar}>
        {/* Brand */}
        <View style={s.brand}>
          <View style={s.brandLogo}>
            <Text style={s.brandLogoText}>A</Text>
          </View>
          <View>
            <Text style={s.brandNombre}>Antioquia 43</Text>
            <Text style={s.brandRol}>Panel Admin</Text>
          </View>
        </View>

        {/* Nav */}
        <ScrollView style={s.navScroll} showsVerticalScrollIndicator={false}>
          <Text style={s.navGroup}>GENERAL</Text>
          {NAV_ITEMS.slice(0, 4).map(item => (
            <NavBtn key={item.id} item={item} active={seccion === item.id} onPress={() => setSeccion(item.id)} />
          ))}

          <Text style={s.navGroup}>SERVICIOS</Text>
          {NAV_ITEMS.slice(4, 7).map(item => (
            <NavBtn key={item.id} item={item} active={seccion === item.id} onPress={() => setSeccion(item.id)} />
          ))}

          <Text style={s.navGroup}>FINANZAS</Text>
          {NAV_ITEMS.slice(7, 9).map(item => (
            <NavBtn key={item.id} item={item} active={seccion === item.id} onPress={() => setSeccion(item.id)} />
          ))}

          <Text style={s.navGroup}>ADMINISTRACIÓN</Text>
          {NAV_ITEMS.slice(9).map(item => (
            <NavBtn key={item.id} item={item} active={seccion === item.id} onPress={() => setSeccion(item.id)} />
          ))}

          <View style={{ height: spacing[4] }} />
        </ScrollView>

        {/* Sign out */}
        <TouchableOpacity style={s.signOut} onPress={signOut} activeOpacity={0.7}>
          <Ionicons name="log-out-outline" size={16} color="#8FAF97" />
          <Text style={s.signOutText}>Cerrar sesión</Text>
        </TouchableOpacity>
      </View>

      {/* ── Content ── */}
      <View style={s.content}>
        <SeccionContent seccion={seccion} />
      </View>

    </View>
  );
}

// ─── NavBtn ───────────────────────────────────────────────────

function NavBtn({ item, active, onPress }: { item: NavItem; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[s.navItem, active && s.navItemActive]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {active && <View style={s.navActiveBar} />}
      <Ionicons
        name={(active ? item.iconActive : item.icon) as any}
        size={17}
        color={active ? '#E8F5EB' : '#7FA98A'}
      />
      <Text style={[s.navLabel, active && s.navLabelActive]}>{item.label}</Text>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const SIDEBAR_BG     = '#14352A';
const SIDEBAR_ACTIVE = '#1A4233';
const SIDEBAR_TEXT   = '#7FA98A';
const SIDEBAR_ACTIVE_TEXT = '#E8F5EB';

const s = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#F0EEE8',
  },

  // ── Sidebar
  sidebar: {
    width: 248,
    backgroundColor: SIDEBAR_BG,
    // height fills from parent flex
  },

  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingTop: spacing[5],
    paddingBottom: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: '#1F4D3A',
  },
  brandLogo: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#1F4D3A',
    alignItems: 'center', justifyContent: 'center',
  },
  brandLogoText: { fontFamily: 'DMSans_700Bold', fontSize: 18, color: '#A8D5B5' },
  brandNombre:   { fontFamily: 'DMSans_600SemiBold', fontSize: 14, color: '#E8F5EB' },
  brandRol:      { fontFamily: 'DMMono_400Regular', fontSize: 9, color: SIDEBAR_TEXT, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 2 },

  navScroll: { flex: 1, paddingTop: spacing[3] },

  navGroup: {
    fontFamily: 'DMMono_400Regular', fontSize: 9, color: '#4A6B55',
    letterSpacing: 1, textTransform: 'uppercase',
    paddingHorizontal: spacing[4], paddingTop: spacing[3], paddingBottom: spacing[1],
  },

  navItem: {
    flexDirection: 'row', alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[4], paddingVertical: spacing[2] + 3,
    marginHorizontal: spacing[2],
    borderRadius: borderRadius.md,
    marginBottom: 1,
    position: 'relative',
  },
  navItemActive: { backgroundColor: SIDEBAR_ACTIVE },
  navActiveBar: {
    position: 'absolute', left: 0, top: '20%' as any,
    width: 3, height: '60%' as any,
    backgroundColor: '#6DBF8C',
    borderRadius: 2,
  },
  navLabel:       { fontFamily: 'DMSans_400Regular', fontSize: 13, color: SIDEBAR_TEXT },
  navLabelActive: { fontFamily: 'DMSans_600SemiBold', color: SIDEBAR_ACTIVE_TEXT },

  signOut: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingHorizontal: spacing[5], paddingVertical: spacing[4],
    borderTopWidth: 1, borderTopColor: '#1F4D3A',
  },
  signOutText: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: SIDEBAR_TEXT },

  // ── Content
  content: {
    flex: 1,
    overflow: 'auto' as any,
    backgroundColor: '#F0EEE8',
  },
});
