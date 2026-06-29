import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, FlatList,
  Modal, ImageBackground, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { cartasBosque } from '@/constants/colors';

const TAPIZ_HEIGHT = 50;

type Destino = { nombre: string; tab: string; keywords: string[] };

const DESTINOS_TENANT: Destino[] = [
  { nombre: 'Expediente / Documentos', tab: 'Dossier',   keywords: ['expediente','documentos','contrato','firma','ine','curp','prenda'] },
  { nombre: 'Comunidad / Noticias',    tab: 'Comunidad', keywords: ['comunidad','noticias','chat','mensajes','grupo','foro'] },
  { nombre: 'Inicio',                  tab: 'Home',      keywords: ['inicio','home','pago','renta','saldo'] },
  { nombre: 'Servicios',               tab: 'Servicios', keywords: ['servicios','lavandería','limpieza','almacenamiento','huéspedes','visitas','facturación'] },
  { nombre: 'Soporte',                 tab: 'Soporte',   keywords: ['soporte','reclamo','ticket','ayuda','reporte'] },
];

const DESTINOS_ADMIN: Destino[] = [
  { nombre: 'General — Pagos / Inquilinos / Habitaciones', tab: 'General',  keywords: ['general','pagos','inquilinos','habitaciones','renta','moroso','verificar'] },
  { nombre: 'Servicios — Lavandería / Limpieza / Almacén', tab: 'Servicios',keywords: ['servicios','lavandería','limpieza','almacenamiento','mobiliario','huéspedes'] },
  { nombre: 'Inicio / Dashboard',                          tab: 'Home',     keywords: ['inicio','home','dashboard','resumen','métricas'] },
  { nombre: 'Finanzas — Facturación / Cupones / Estado',   tab: 'Finanzas', keywords: ['finanzas','facturación','cupones','estado','facturas','cfdis'] },
  { nombre: 'Admin — Visitas / Tickets / Chat / Config',   tab: 'Admin',    keywords: ['admin','visitas','tickets','chat','sesiones','expedientes','config','configuración'] },
];

type Props = {
  role: 'tenant' | 'admin';
  onNavigate: (tab: string) => void;
};

export default function BarraSuperior({ role, onNavigate }: Props) {
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [query, setQuery]     = useState('');

  const destinos = role === 'admin' ? DESTINOS_ADMIN : DESTINOS_TENANT;
  const q        = query.toLowerCase().trim();
  const resultados = q
    ? destinos.filter(d =>
        d.nombre.toLowerCase().includes(q) ||
        d.keywords.some(k => k.includes(q))
      )
    : destinos;

  function cerrar() { setVisible(false); setQuery(''); }

  return (
    <>
      <View style={{ height: insets.top, backgroundColor: cartasBosque.sidebar }} />
      <ImageBackground
        source={require('../../../assets/papel-tapiz.jpg')}
        resizeMode="cover"
        style={[s.franja, { height: TAPIZ_HEIGHT }]}
      >
        <TouchableOpacity style={s.pill} onPress={() => setVisible(true)} activeOpacity={0.8}>
          <MaterialCommunityIcons name="magnify" size={18} color={cartasBosque.crema} />
          <Text style={s.placeholder} numberOfLines={1}>
            Buscar secciones, pagos, reclamos...
          </Text>
        </TouchableOpacity>
      </ImageBackground>

      <Modal
        visible={visible}
        animationType="fade"
        transparent
        onRequestClose={cerrar}
      >
        <KeyboardAvoidingView
          style={s.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={s.modal}>
            <View style={s.inputRow}>
              <MaterialCommunityIcons name="magnify" size={20} color={cartasBosque.helecho} />
              <TextInput
                style={s.input}
                placeholder="Buscar..."
                placeholderTextColor={cartasBosque.helecho}
                value={query}
                onChangeText={setQuery}
                autoFocus
              />
              <TouchableOpacity onPress={cerrar}>
                <MaterialCommunityIcons name="close" size={20} color={cartasBosque.helecho} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={resultados}
              keyExtractor={d => d.tab + d.nombre}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={s.resultado}
                  onPress={() => { onNavigate(item.tab); cerrar(); }}
                >
                  <MaterialCommunityIcons name="arrow-right" size={16} color={cartasBosque.bosque} />
                  <Text style={s.resultadoTxt}>{item.nombre}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  franja: {
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(18,42,31,0.55)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  placeholder: {
    flex: 1,
    color: cartasBosque.crema,
    fontFamily: 'MonaSans_400Regular',
    fontSize: 13,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-start',
    paddingTop: 60,
  },
  modal: {
    backgroundColor: cartasBosque.bruma,
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
    maxHeight: '70%',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: cartasBosque.pergaminoOscuro,
    gap: 8,
  },
  input: {
    flex: 1,
    fontFamily: 'MonaSans_400Regular',
    fontSize: 15,
    color: cartasBosque.tinta,
  },
  resultado: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: cartasBosque.pergaminoOscuro,
    gap: 10,
  },
  resultadoTxt: {
    flex: 1,
    fontFamily: 'MonaSans_400Regular',
    fontSize: 14,
    color: cartasBosque.tinta,
  },
});
