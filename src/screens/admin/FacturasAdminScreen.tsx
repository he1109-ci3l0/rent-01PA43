import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, TextInput, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { cartasBosque } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/spacing';
import { useAuth } from '@/hooks/useAuth';
import type { SolicitudFactura } from '@/types/firestore';
import {
  listenTodasSolicitudes, subirFactura, rechazarSolicitud,
  eliminarSolicitud, vaciarPapelera, CONCEPTOS_LABEL,
} from '@/services/firebase/facturas';
import CuponesAdminScreen from './CuponesAdminScreen';

type Tab = 'facturas' | 'cupones';
type SubTab = 'pendientes' | 'emitidas' | 'papelera';

const ESTADO_COLOR: Record<SolicitudFactura['estado'], string> = {
  pendiente:   '#D4A017',
  procesando:  cartasBosque.musgo,
  emitida:     cartasBosque.bosque,
  rechazada:   cartasBosque.corteza,
  eliminada:   cartasBosque.niebla,
};

const MESES = [
  '','Ene','Feb','Mar','Abr','May','Jun',
  'Jul','Ago','Sep','Oct','Nov','Dic',
];

function formatFecha(ts: any): string {
  if (!ts?.toDate) return '—';
  return ts.toDate().toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
}

// ─── Panel subir factura ──────────────────────────────────────

function PanelSubir({
  solicitud,
  onClose,
  adminUid,
}: { solicitud: SolicitudFactura; onClose: () => void; adminUid: string }) {
  const [pdfUrl, setPdfUrl] = useState('');
  const [rechazando, setRechazando] = useState(false);
  const [notas, setNotas] = useState('');
  const [cargando, setCargando] = useState(false);

  async function handleSubir() {
    if (!pdfUrl.trim()) return;
    setCargando(true);
    try {
      await subirFactura(solicitud.id, pdfUrl.trim(), adminUid);
      onClose();
    } finally { setCargando(false); }
  }

  async function handleRechazar() {
    if (!notas.trim()) return;
    setCargando(true);
    try {
      await rechazarSolicitud(solicitud.id, adminUid, notas.trim());
      onClose();
    } finally { setCargando(false); }
  }

  return (
    <View style={panelStyles.overlay}>
      <View style={panelStyles.panel}>
        <View style={panelStyles.header}>
          <Text style={panelStyles.titulo}>Procesar solicitud</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={20} color={cartasBosque.tinta} />
          </TouchableOpacity>
        </View>

        <Text style={panelStyles.label}>Inquilino</Text>
        <Text style={panelStyles.valor}>{solicitud.inquilinoNombre ?? solicitud.inquilinoId}</Text>

        <Text style={panelStyles.label}>Concepto</Text>
        <Text style={panelStyles.valor}>{CONCEPTOS_LABEL[solicitud.concepto]} · {MESES[solicitud.mes]} {solicitud.anio}</Text>

        <Text style={panelStyles.label}>RFC</Text>
        <Text style={panelStyles.valor}>{solicitud.datosFiscales.rfc} · {solicitud.datosFiscales.razonSocial}</Text>

        <Text style={panelStyles.label}>Régimen</Text>
        <Text style={panelStyles.valor}>{solicitud.datosFiscales.regimenFiscal || '—'}</Text>

        <Text style={panelStyles.label}>CP · Domicilio</Text>
        <Text style={panelStyles.valor}>
          {solicitud.datosFiscales.codigoPostal} · {solicitud.datosFiscales.domicilioFiscal || '—'}
        </Text>

        <Text style={panelStyles.label}>Email fiscal</Text>
        <Text style={panelStyles.valor}>{solicitud.datosFiscales.emailFiscal || '—'}</Text>

        <Text style={panelStyles.label}>Emisor</Text>
        <Text style={panelStyles.valor}>
          {solicitud.emisor === 'fisica'
            ? 'Persona física · RESICO · Exento IVA'
            : 'Servicios Kadamees Integrales · IVA 16%'}
        </Text>

        {!rechazando ? (
          <>
            <Text style={panelStyles.label}>URL del PDF (Storage o drive)</Text>
            <TextInput
              style={panelStyles.input}
              value={pdfUrl}
              onChangeText={setPdfUrl}
              placeholder="https://…"
              placeholderTextColor={cartasBosque.niebla}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={[panelStyles.btnPrimario, (!pdfUrl.trim() || cargando) && { opacity: 0.5 }]}
              onPress={handleSubir}
              disabled={!pdfUrl.trim() || cargando}
            >
              {cargando
                ? <ActivityIndicator color={cartasBosque.bruma} />
                : <Text style={panelStyles.btnText}>Subir y notificar</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity style={panelStyles.btnRechazo} onPress={() => setRechazando(true)}>
              <Text style={panelStyles.btnRechazoText}>Rechazar solicitud</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={panelStyles.label}>Motivo de rechazo</Text>
            <TextInput
              style={panelStyles.input}
              value={notas}
              onChangeText={setNotas}
              placeholder="ej. Datos fiscales incorrectos"
              placeholderTextColor={cartasBosque.niebla}
              multiline
            />
            <TouchableOpacity
              style={[panelStyles.btnRechazoConfirm, (!notas.trim() || cargando) && { opacity: 0.5 }]}
              onPress={handleRechazar}
              disabled={!notas.trim() || cargando}
            >
              {cargando
                ? <ActivityIndicator color={cartasBosque.bruma} />
                : <Text style={panelStyles.btnText}>Confirmar rechazo</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity style={panelStyles.btnRechazo} onPress={() => setRechazando(false)}>
              <Text style={panelStyles.btnRechazoText}>Cancelar</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

// ─── Componente principal ─────────────────────────────────────

export default function FacturasAdminScreen() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('facturas');
  const [subTab, setSubTab] = useState<SubTab>('pendientes');
  const [todas, setTodas] = useState<SolicitudFactura[]>([]);
  const [cargando, setCargando] = useState(true);
  const [seleccionada, setSeleccionada] = useState<SolicitudFactura | null>(null);

  useEffect(() => {
    return listenTodasSolicitudes(data => { setTodas(data); setCargando(false); });
  }, []);

  const pendientes = todas.filter(s => s.estado === 'pendiente' || s.estado === 'procesando');
  const emitidas   = todas.filter(s => s.estado === 'emitida' || s.estado === 'rechazada');
  const papelera   = todas.filter(s => s.estado === 'eliminada');

  const lista = subTab === 'pendientes' ? pendientes
              : subTab === 'emitidas'   ? emitidas
              : papelera;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Título */}
      <View style={styles.header}>
        <Text style={styles.titulo}>Facturación</Text>
      </View>

      {/* Tab principal: Facturas | Cupones */}
      <View style={styles.mainTabRow}>
        {(['facturas', 'cupones'] as Tab[]).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.mainTab, tab === t && styles.mainTabActivo]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.mainTabText, tab === t && styles.mainTabTextActivo]}>
              {t === 'facturas' ? 'Facturas' : 'Cupones'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'cupones' ? (
        <CuponesAdminScreen />
      ) : (
        <>
          {/* Sub-tabs */}
          <View style={styles.subTabRow}>
            {([
              ['pendientes', `Pendientes (${pendientes.length})`],
              ['emitidas', 'Emitidas'],
              ['papelera', 'Papelera'],
            ] as [SubTab, string][]).map(([st, label]) => (
              <TouchableOpacity
                key={st}
                style={[styles.subTab, subTab === st && styles.subTabActivo]}
                onPress={() => setSubTab(st)}
              >
                <Text style={[styles.subTabText, subTab === st && styles.subTabTextActivo]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Papelera: botón vaciar */}
          {subTab === 'papelera' && papelera.length > 0 && (
            <TouchableOpacity
              style={styles.vaciarBtn}
              onPress={() => user?.uid && vaciarPapelera(user.uid)}
            >
              <Ionicons name="trash-outline" size={14} color={cartasBosque.corteza} />
              <Text style={styles.vaciarText}>Vaciar papelera</Text>
            </TouchableOpacity>
          )}

          {cargando ? (
            <View style={styles.center}><ActivityIndicator color={cartasBosque.bosque} /></View>
          ) : lista.length === 0 ? (
            <View style={styles.center}>
              <Ionicons name="receipt-outline" size={36} color={cartasBosque.niebla} />
              <Text style={styles.vacioText}>
                {subTab === 'pendientes' ? 'Sin solicitudes pendientes'
                 : subTab === 'emitidas' ? 'Sin facturas emitidas'
                 : 'Papelera vacía'}
              </Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.scrollContent}>
              {lista.map(s => (
                <TouchableOpacity
                  key={s.id}
                  style={styles.card}
                  onPress={() => subTab === 'pendientes' && setSeleccionada(s)}
                  activeOpacity={subTab === 'pendientes' ? 0.7 : 1}
                >
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardNombre}>{s.inquilinoNombre ?? s.inquilinoId}</Text>
                    <View style={[styles.badge, { backgroundColor: ESTADO_COLOR[s.estado] }]}>
                      <Text style={styles.badgeText}>{s.estado}</Text>
                    </View>
                  </View>
                  <Text style={styles.cardConcepto}>
                    {CONCEPTOS_LABEL[s.concepto]} · {MESES[s.mes]} {s.anio}
                  </Text>
                  <Text style={styles.cardRfc}>{s.datosFiscales.rfc} · {s.datosFiscales.razonSocial}</Text>
                  <Text style={styles.cardFecha}>
                    Hab. {s.habitacionNumero ?? '—'} · {formatFecha(s.creadoEn)}
                  </Text>
                  <View style={styles.cardActions}>
                    {s.estado === 'emitida' && s.pdfUrl && (
                      <View style={styles.pdfRow}>
                        <Ionicons name="document" size={12} color={cartasBosque.bosque} />
                        <Text style={styles.pdfText}>PDF · desc. ilimitadas (admin)</Text>
                      </View>
                    )}
                    {subTab !== 'papelera' && s.estado !== 'eliminada' && (
                      <TouchableOpacity
                        style={styles.eliminarBtn}
                        onPress={() => eliminarSolicitud(s.id)}
                      >
                        <Ionicons name="trash-outline" size={14} color={cartasBosque.niebla} />
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </>
      )}

      {/* Panel subir */}
      {seleccionada && user?.uid && (
        <PanelSubir
          solicitud={seleccionada}
          onClose={() => setSeleccionada(null)}
          adminUid={user.uid}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Estilos ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: cartasBosque.bruma },
  header: {
    paddingHorizontal: spacing[4], paddingTop: spacing[4], paddingBottom: spacing[3],
    borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro,
  },
  titulo: { fontFamily: 'DMSans_600SemiBold', fontSize: 18, color: cartasBosque.tinta },
  mainTabRow: {
    flexDirection: 'row',
    backgroundColor: cartasBosque.pergaminoOscuro,
    margin: spacing[4],
    borderRadius: borderRadius.sm,
    padding: 2,
  },
  mainTab: { flex: 1, paddingVertical: spacing[2], alignItems: 'center', borderRadius: borderRadius.sm - 2 },
  mainTabActivo: { backgroundColor: cartasBosque.bruma },
  mainTabText: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: cartasBosque.helecho },
  mainTabTextActivo: { fontFamily: 'DMSans_600SemiBold', color: cartasBosque.tinta },
  subTabRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing[4],
    gap: spacing[2],
    marginBottom: spacing[2],
  },
  subTab: {
    paddingHorizontal: spacing[3], paddingVertical: spacing[1] + 2,
    borderRadius: borderRadius.sm, borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
  },
  subTabActivo: { backgroundColor: cartasBosque.musgo, borderColor: cartasBosque.musgo },
  subTabText: { fontFamily: 'DMMono_400Regular', fontSize: 11, color: cartasBosque.helecho },
  subTabTextActivo: { color: cartasBosque.bruma },
  vaciarBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[1],
    marginHorizontal: spacing[4], marginBottom: spacing[2],
  },
  vaciarText: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: cartasBosque.corteza },
  scrollContent: { padding: spacing[4] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[2] },
  vacioText: { fontFamily: 'DMSans_400Regular', fontSize: 14, color: cartasBosque.helecho },
  card: {
    backgroundColor: cartasBosque.pergamino, borderRadius: borderRadius.md,
    padding: spacing[3], marginBottom: spacing[3],
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 },
  cardNombre: { fontFamily: 'DMSans_600SemiBold', fontSize: 14, color: cartasBosque.tinta, flex: 1 },
  badge: { borderRadius: borderRadius.sm, paddingHorizontal: spacing[2], paddingVertical: 2, marginLeft: spacing[2] },
  badgeText: { fontFamily: 'DMMono_400Regular', fontSize: 10, color: cartasBosque.bruma },
  cardConcepto: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: cartasBosque.tinta },
  cardRfc: { fontFamily: 'DMMono_400Regular', fontSize: 11, color: cartasBosque.helecho, marginTop: 2 },
  cardFecha: { fontFamily: 'DMMono_400Regular', fontSize: 10, color: cartasBosque.niebla, marginTop: 2 },
  cardActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing[2] },
  pdfRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pdfText: { fontFamily: 'DMSans_400Regular', fontSize: 11, color: cartasBosque.bosque },
  eliminarBtn: { padding: spacing[1] },
});

const panelStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26,31,26,0.5)',
    justifyContent: 'flex-end',
  },
  panel: {
    backgroundColor: cartasBosque.bruma,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: spacing[4], maxHeight: '85%',
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[3] },
  titulo: { fontFamily: 'DMSans_600SemiBold', fontSize: 17, color: cartasBosque.tinta },
  label: {
    fontFamily: 'DMMono_400Regular', fontSize: 10, color: cartasBosque.helecho,
    letterSpacing: 0.5, marginTop: spacing[2],
  },
  valor: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: cartasBosque.tinta },
  input: {
    backgroundColor: cartasBosque.pergamino, borderRadius: borderRadius.sm,
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    fontFamily: 'DMSans_400Regular', fontSize: 13, color: cartasBosque.tinta,
    marginTop: spacing[1],
  },
  btnPrimario: {
    marginTop: spacing[3], backgroundColor: cartasBosque.bosque,
    borderRadius: borderRadius.sm, paddingVertical: spacing[2] + 2, alignItems: 'center',
  },
  btnText: { fontFamily: 'DMSans_600SemiBold', fontSize: 14, color: cartasBosque.bruma },
  btnRechazo: {
    marginTop: spacing[2], paddingVertical: spacing[2], alignItems: 'center',
  },
  btnRechazoText: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: cartasBosque.corteza },
  btnRechazoConfirm: {
    marginTop: spacing[3], backgroundColor: cartasBosque.corteza,
    borderRadius: borderRadius.sm, paddingVertical: spacing[2] + 2, alignItems: 'center',
  },
});
