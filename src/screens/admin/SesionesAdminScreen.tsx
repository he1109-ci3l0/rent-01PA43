import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { onSnapshot } from 'firebase/firestore';
import { collections } from '@/services/firebase/firestore';
import { cartasBosque } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/spacing';
import SesionCard from '@/components/common/SesionCard';
import {
  listenAlertasSeguridad,
  listenTodasSesionesActivas,
  cerrarSesion,
  cerrarTodasSesiones,
  liberarCuentaRobo,
  marcarAlertaVista,
} from '@/services/firebase/sesiones';
import type { Sesion, AlertaSeguridad, Inquilino } from '@/types/firestore';

type TabType = 'sesiones' | 'alertas';

const TIPO_LABEL: Record<string, string> = {
  dispositivo_nuevo: 'Dispositivo nuevo',
  reporte_robo:      'Reporte de robo / extravío',
};

const TIPO_COLOR: Record<string, string> = {
  dispositivo_nuevo: cartasBosque.bosque,
  reporte_robo:      '#A63228',
};

function formatFechaCorta(ts: any): string {
  try {
    return ts.toDate().toLocaleString('es-MX', {
      day: '2-digit', month: 'short',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return '—'; }
}

export default function SesionesAdminScreen() {
  const [tab, setTab]                 = useState<TabType>('sesiones');
  const [sesiones, setSesiones]       = useState<Sesion[]>([]);
  const [alertas, setAlertas]         = useState<AlertaSeguridad[]>([]);
  const [nombres, setNombres]         = useState<Record<string, string>>({});
  const [requiresAuth, setRequiresAuth] = useState<Set<string>>(new Set());
  const [cargando, setCargando]       = useState(true);

  useEffect(() => {
    const unsubSes = listenTodasSesionesActivas(list => {
      setSesiones(list);
      setCargando(false);
    });
    const unsubAl = listenAlertasSeguridad(setAlertas);
    const unsubInq = onSnapshot(collections.inquilinos, snap => {
      const map: Record<string, string> = {};
      const authSet = new Set<string>();
      snap.docs.forEach(d => {
        const data = d.data() as Inquilino;
        map[d.id] = `${data.nombre} ${data.apellido}`;
        if (data.requiresAdminAuth) authSet.add(d.id);
      });
      setNombres(map);
      setRequiresAuth(authSet);
    }, () => {});

    return () => { unsubSes(); unsubAl(); unsubInq(); };
  }, []);

  // Agrupar sesiones activas por usuarioId
  const grupos = sesiones.reduce<Record<string, Sesion[]>>((acc, ses) => {
    if (!acc[ses.usuarioId]) acc[ses.usuarioId] = [];
    acc[ses.usuarioId].push(ses);
    return acc;
  }, {});

  const sinVer = alertas.filter(a => !a.adminVio).length;

  async function handleCerrarSesion(sesionId: string) {
    try { await cerrarSesion(sesionId); }
    catch { Alert.alert('Error', 'No se pudo cerrar la sesión'); }
  }

  function handleCerrarTodas(uid: string) {
    Alert.alert(
      'Cerrar sesiones',
      `¿Cerrar todas las sesiones de ${nombres[uid] ?? uid}?`,
      [
        { text: 'Cancelar' },
        {
          text: 'Cerrar todas', style: 'destructive',
          onPress: async () => {
            try { await cerrarTodasSesiones(uid); }
            catch { Alert.alert('Error', 'No se pudieron cerrar las sesiones'); }
          },
        },
      ],
    );
  }

  async function handleLiberarCuenta(uid: string) {
    try {
      await liberarCuentaRobo(uid);
      Alert.alert('Listo', 'Acceso habilitado. El inquilino puede iniciar sesión nuevamente.');
    } catch {
      Alert.alert('Error', 'No se pudo habilitar el acceso');
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Text style={s.headerTitulo}>Seguridad</Text>
        {sinVer > 0 && (
          <View style={s.badge}>
            <Text style={s.badgeText}>{sinVer}</Text>
          </View>
        )}
      </View>

      {/* Tabs */}
      <View style={s.tabRow}>
        {(['sesiones', 'alertas'] as const).map(t => (
          <TouchableOpacity
            key={t}
            style={[s.tabBtn, tab === t && s.tabBtnActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[s.tabLabel, tab === t && s.tabLabelActive]}>
              {t === 'sesiones'
                ? `Activas (${sesiones.length})`
                : `Alertas${sinVer > 0 ? ` · ${sinVer} nueva${sinVer !== 1 ? 's' : ''}` : ''}`
              }
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {cargando ? (
        <ActivityIndicator color={cartasBosque.bosque} style={{ marginTop: spacing[8] }} />
      ) : tab === 'sesiones' ? (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {Object.keys(grupos).length === 0 ? (
            <View style={s.emptyCard}>
              <Ionicons name="shield-checkmark-outline" size={28} color={cartasBosque.niebla} style={{ marginBottom: spacing[2] }} />
              <Text style={s.emptyText}>No hay sesiones activas</Text>
            </View>
          ) : (
            Object.entries(grupos).map(([uid, sGroup]) => (
              <View key={uid} style={s.grupoCard}>
                {/* Cabecera del grupo */}
                <View style={s.grupoHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.grupoNombre}>{nombres[uid] ?? uid}</Text>
                    <Text style={s.grupoMeta}>
                      {sGroup.length} sesión{sGroup.length !== 1 ? 'es' : ''} activa{sGroup.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={s.cerrarTodasBtn}
                    onPress={() => handleCerrarTodas(uid)}
                  >
                    <Text style={s.cerrarTodasText}>Cerrar todas</Text>
                  </TouchableOpacity>
                </View>

                {/* Banner protocolo robo */}
                {requiresAuth.has(uid) && (
                  <TouchableOpacity
                    style={s.liberarBtn}
                    onPress={() => handleLiberarCuenta(uid)}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="shield-checkmark-outline" size={15} color="#A63228" />
                    <Text style={s.liberarText}>Autorizar acceso (protocolo robo activo)</Text>
                    <Ionicons name="chevron-forward" size={13} color="#A63228" />
                  </TouchableOpacity>
                )}

                {sGroup.map(ses => (
                  <SesionCard
                    key={ses.id}
                    sesion={ses}
                    onCerrar={() => handleCerrarSesion(ses.id)}
                  />
                ))}
              </View>
            ))
          )}
          <View style={{ height: spacing[8] }} />
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {alertas.length === 0 ? (
            <View style={s.emptyCard}>
              <Ionicons name="notifications-off-outline" size={28} color={cartasBosque.niebla} style={{ marginBottom: spacing[2] }} />
              <Text style={s.emptyText}>Sin alertas de seguridad</Text>
            </View>
          ) : (
            alertas.map(alerta => (
              <TouchableOpacity
                key={alerta.id}
                style={[s.alertaCard, !alerta.adminVio && s.alertaCardNoVista]}
                onPress={() => { if (!alerta.adminVio) marcarAlertaVista(alerta.id).catch(() => {}); }}
                activeOpacity={0.75}
              >
                <View style={[s.alertaIconBox, { backgroundColor: TIPO_COLOR[alerta.tipo] + '22' }]}>
                  <Ionicons
                    name={alerta.tipo === 'reporte_robo' ? 'warning-outline' : 'phone-portrait-outline'}
                    size={18}
                    color={TIPO_COLOR[alerta.tipo]}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={s.alertaHeaderRow}>
                    <Text style={[s.alertaTipo, { color: TIPO_COLOR[alerta.tipo] }]}>
                      {TIPO_LABEL[alerta.tipo] ?? alerta.tipo}
                    </Text>
                    {!alerta.adminVio && <View style={s.dotNoVisto} />}
                  </View>
                  <Text style={s.alertaNombre}>{alerta.inquilinoNombre}</Text>
                  <Text style={s.alertaMeta}>{alerta.dispositivo}</Text>
                  {alerta.ubicacion ? <Text style={s.alertaMeta}>{alerta.ubicacion}</Text> : null}
                  <Text style={s.alertaFecha}>{formatFechaCorta(alerta.creadoEn)}</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
          <View style={{ height: spacing[8] }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: cartasBosque.bruma },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro,
  },
  headerTitulo: { fontFamily: 'DMSans_600SemiBold', fontSize: 18, color: cartasBosque.tinta },
  badge: {
    minWidth: 20, height: 20, borderRadius: 10,
    backgroundColor: '#A63228',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: { fontFamily: 'DMMono_400Regular', fontSize: 11, color: '#fff' },

  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro,
  },
  tabBtn: {
    flex: 1, paddingVertical: spacing[3],
    alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabBtnActive: { borderBottomColor: cartasBosque.bosque },
  tabLabel:     { fontFamily: 'DMMono_400Regular', fontSize: 11, color: cartasBosque.helecho },
  tabLabelActive: { color: cartasBosque.bosque, fontFamily: 'DMSans_600SemiBold', fontSize: 11 },

  scroll: { padding: spacing[4] },

  emptyCard: {
    backgroundColor: cartasBosque.pergamino,
    borderRadius: borderRadius.md, padding: spacing[6],
    alignItems: 'center', marginTop: spacing[4],
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
  },
  emptyText: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: cartasBosque.helecho },

  // Grupos de sesiones
  grupoCard: {
    backgroundColor: cartasBosque.pergamino,
    borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    padding: spacing[3],
    marginBottom: spacing[3],
  },
  grupoHeader: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: spacing[3],
  },
  grupoNombre: { fontFamily: 'DMSans_600SemiBold', fontSize: 14, color: cartasBosque.tinta },
  grupoMeta:   { fontFamily: 'DMMono_400Regular', fontSize: 10, color: cartasBosque.helecho, marginTop: 1 },
  cerrarTodasBtn: {
    paddingHorizontal: spacing[3], paddingVertical: spacing[1] + 2,
    borderRadius: borderRadius.full,
    borderWidth: 1, borderColor: '#A63228' + '80',
  },
  cerrarTodasText: { fontFamily: 'DMMono_400Regular', fontSize: 10, color: '#A63228' },

  liberarBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[1] + 2,
    backgroundColor: '#F5DAD8' + '66',
    borderRadius: borderRadius.sm, padding: spacing[2],
    marginBottom: spacing[2],
  },
  liberarText: { flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#A63228' },

  // Alertas
  alertaCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3],
    backgroundColor: cartasBosque.pergamino,
    borderRadius: borderRadius.md, padding: spacing[3],
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    marginBottom: spacing[2],
  },
  alertaCardNoVista: {
    borderColor: cartasBosque.musgo + '55',
    backgroundColor: '#D6EDD9' + '22',
  },
  alertaIconBox: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  alertaHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  alertaTipo:   { fontFamily: 'DMSans_600SemiBold', fontSize: 12, color: cartasBosque.tinta },
  dotNoVisto:   { width: 7, height: 7, borderRadius: 4, backgroundColor: cartasBosque.bosque },
  alertaNombre: { fontFamily: 'DMMono_400Regular', fontSize: 11, color: cartasBosque.musgo, marginTop: 2 },
  alertaMeta:   { fontFamily: 'DMMono_400Regular', fontSize: 10, color: cartasBosque.helecho, marginTop: 1 },
  alertaFecha:  { fontFamily: 'DMMono_400Regular', fontSize: 10, color: cartasBosque.helecho + 'AA', marginTop: 2 },
});
