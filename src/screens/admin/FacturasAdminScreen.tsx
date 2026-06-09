import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, TextInput, ActivityIndicator,
  Platform, Linking,
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

type SubTab = 'pendientes' | 'emitidas' | 'papelera';

const ESTADO_COLOR: Record<SolicitudFactura['estado'], string> = {
  pendiente:  '#E8A838',
  procesando: '#3B82F6',
  emitida:    '#4A9B6F',
  rechazada:  '#C0392B',
  eliminada:  cartasBosque.niebla,
};

const ESTADO_LABEL: Record<SolicitudFactura['estado'], string> = {
  pendiente:  'PENDIENTE',
  procesando: 'PROCESANDO',
  emitida:    'EMITIDA',
  rechazada:  'RECHAZADA',
  eliminada:  'ELIMINADA',
};

const MESES = [
  '','Ene','Feb','Mar','Abr','May','Jun',
  'Jul','Ago','Sep','Oct','Nov','Dic',
];

function formatFecha(ts: any): string {
  if (!ts?.toDate) return '—';
  return ts.toDate().toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
}

// ─── Tarjeta de solicitud ─────────────────────────────────────

function SolicitudCard({
  s, activa, onPress, onEliminar, mostrarEliminar,
}: {
  s: SolicitudFactura;
  activa: boolean;
  onPress: () => void;
  onEliminar: () => void;
  mostrarEliminar: boolean;
}) {
  return (
    <TouchableOpacity
      style={[sc.card, activa && sc.cardActiva]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={sc.top}>
        <Text style={sc.nombre} numberOfLines={1}>{s.inquilinoNombre ?? s.inquilinoId}</Text>
        <View style={[sc.badge, { backgroundColor: ESTADO_COLOR[s.estado] }]}>
          <Text style={sc.badgeText}>{ESTADO_LABEL[s.estado]}</Text>
        </View>
      </View>
      <Text style={sc.hab}>Hab. {s.habitacionNumero ?? '—'} · {formatFecha(s.creadoEn)}</Text>
      <Text style={sc.concepto}>{CONCEPTOS_LABEL[s.concepto]} · {MESES[s.mes]} {s.anio}</Text>
      <Text style={sc.rfc}>{s.datosFiscales.rfc} · {s.datosFiscales.razonSocial}</Text>
      <View style={sc.bottom}>
        {s.emisor === 'fisica'
          ? <View style={[sc.chip, { backgroundColor: '#8A6A7218' }]}>
              <Text style={[sc.chipText, { color: '#8A6A72' }]}>RESICO · Sin IVA</Text>
            </View>
          : <View style={[sc.chip, { backgroundColor: '#3B82F618' }]}>
              <Text style={[sc.chipText, { color: '#3B82F6' }]}>IVA 16%</Text>
            </View>
        }
        {mostrarEliminar && (
          <TouchableOpacity style={sc.eliminarBtn} onPress={onEliminar}>
            <Ionicons name="trash-outline" size={13} color={cartasBosque.niebla} />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── Columna lista ────────────────────────────────────────────

function ColumnaLista({
  lista, subTab, setSubTab,
  pendientesCount, emitidasCount, rechazadasCount,
  papelera, seleccionadaId, onSeleccionar, cargando, userUid, isWeb,
}: {
  lista: SolicitudFactura[];
  subTab: SubTab;
  setSubTab: (t: SubTab) => void;
  pendientesCount: number;
  emitidasCount: number;
  rechazadasCount: number;
  papelera: SolicitudFactura[];
  seleccionadaId: string | null;
  onSeleccionar: (id: string | null) => void;
  cargando: boolean;
  userUid: string | undefined;
  isWeb: boolean;
}) {
  return (
    <View style={isWeb ? cl.containerWeb : cl.container}>
      {/* Header */}
      <View style={cl.header}>
        <Text style={cl.titulo}>Facturación</Text>
        <View style={cl.metricas}>
          <View style={cl.metrica}>
            <Text style={[cl.metricaNum, { color: '#E8A838' }]}>{pendientesCount}</Text>
            <Text style={cl.metricaLabel}>Pendientes</Text>
          </View>
          <View style={cl.metricaSep} />
          <View style={cl.metrica}>
            <Text style={[cl.metricaNum, { color: '#4A9B6F' }]}>{emitidasCount}</Text>
            <Text style={cl.metricaLabel}>Emitidas</Text>
          </View>
          <View style={cl.metricaSep} />
          <View style={cl.metrica}>
            <Text style={[cl.metricaNum, { color: '#C0392B' }]}>{rechazadasCount}</Text>
            <Text style={cl.metricaLabel}>Rechazadas</Text>
          </View>
        </View>
      </View>

      {/* Subtabs */}
      <View style={cl.subTabRow}>
        {([
          ['pendientes', `Pendientes (${pendientesCount})`],
          ['emitidas', 'Emitidas'],
          ['papelera', 'Papelera'],
        ] as [SubTab, string][]).map(([st, label]) => (
          <TouchableOpacity
            key={st}
            style={[cl.subTab, subTab === st && cl.subTabActivo]}
            onPress={() => setSubTab(st)}
          >
            <Text style={[cl.subTabText, subTab === st && cl.subTabTextActivo]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Vaciar papelera */}
      {subTab === 'papelera' && papelera.length > 0 && (
        <TouchableOpacity
          style={cl.vaciarBtn}
          onPress={() => userUid && vaciarPapelera(userUid)}
        >
          <Ionicons name="trash-outline" size={13} color={cartasBosque.alertaBorde} />
          <Text style={cl.vaciarText}>Vaciar papelera</Text>
        </TouchableOpacity>
      )}

      {/* Lista */}
      {cargando ? (
        <View style={cl.centro}><ActivityIndicator color={cartasBosque.bosque} /></View>
      ) : lista.length === 0 ? (
        <View style={cl.centro}>
          <Ionicons name="receipt-outline" size={32} color={cartasBosque.niebla} />
          <Text style={cl.vacioText}>
            {subTab === 'pendientes' ? 'Sin solicitudes pendientes'
             : subTab === 'emitidas' ? 'Sin facturas emitidas'
             : 'Papelera vacía'}
          </Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={cl.scroll}>
          {lista.map(s => (
            <SolicitudCard
              key={s.id}
              s={s}
              activa={seleccionadaId === s.id}
              onPress={() => onSeleccionar(seleccionadaId === s.id ? null : s.id)}
              onEliminar={() => eliminarSolicitud(s.id)}
              mostrarEliminar={subTab !== 'papelera' && s.estado !== 'eliminada'}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

// ─── Panel derecho (web) ──────────────────────────────────────

function PanelDerechoWeb({
  solicitud,
  adminUid,
}: { solicitud: SolicitudFactura | null; adminUid: string }) {
  const [pdfUrl, setPdfUrl]         = useState('');
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo]         = useState('');
  const [cargando, setCargando]     = useState(false);

  async function handleSubir() {
    if (!pdfUrl.trim() || !solicitud) return;
    setCargando(true);
    try { await subirFactura(solicitud.id, pdfUrl.trim(), adminUid); }
    finally { setCargando(false); }
  }

  async function handleRechazar() {
    if (!motivo.trim() || !solicitud) return;
    setCargando(true);
    try { await rechazarSolicitud(solicitud.id, adminUid, motivo.trim()); }
    finally { setCargando(false); }
  }

  function handleVerPdf() {
    if (!solicitud?.pdfUrl) return;
    if (typeof window !== 'undefined') window.open(solicitud.pdfUrl, '_blank');
  }

  function handleCorreo() {
    if (!solicitud) return;
    const nombre   = solicitud.inquilinoNombre ?? solicitud.inquilinoId;
    const concepto = CONCEPTOS_LABEL[solicitud.concepto];
    const mes      = MESES[solicitud.mes];
    const subject  = encodeURIComponent(
      `Tu factura CFDI — ${concepto} ${mes} ${solicitud.anio} — Antioquia 43`,
    );
    const body = encodeURIComponent(
      `Hola ${nombre}, adjuntamos tu factura. URL: ${solicitud.pdfUrl ?? ''}`,
    );
    Linking.openURL(`mailto:${solicitud.datosFiscales.emailFiscal}?subject=${subject}&body=${body}`);
  }

  if (!solicitud) {
    return (
      <View style={pd.empty}>
        <Ionicons name="receipt-outline" size={48} color={cartasBosque.niebla} />
        <Text style={pd.emptyText}>Selecciona una solicitud para procesarla</Text>
      </View>
    );
  }

  const df = solicitud.datosFiscales;
  const filas: [string, string][] = [
    ['Inquilino',      solicitud.inquilinoNombre ?? solicitud.inquilinoId],
    ['Habitación',     solicitud.habitacionNumero ?? '—'],
    ['Concepto',       `${CONCEPTOS_LABEL[solicitud.concepto]} · ${MESES[solicitud.mes]} ${solicitud.anio}`],
    ['RFC',            df.rfc],
    ['Razón social',   df.razonSocial],
    ['Régimen fiscal', df.regimenFiscal || '—'],
    ['CP',             df.codigoPostal || '—'],
    ['Domicilio',      df.domicilioFiscal || '—'],
    ['Email fiscal',   df.emailFiscal || '—'],
    ['Emisor',         solicitud.emisor === 'fisica'
                         ? 'Persona física RESICO · Exento IVA'
                         : 'Servicios Kadamees Integrales · IVA 16%'],
  ];

  return (
    <ScrollView style={pd.scroll} contentContainerStyle={pd.content}>

      {/* Datos fiscales */}
      <Text style={pd.seccionLabel}>DATOS FISCALES DEL INQUILINO</Text>
      <View style={pd.tabla}>
        {filas.map(([label, valor], i) => (
          <View key={label} style={[pd.fila, i === filas.length - 1 && pd.filaUltima]}>
            <Text style={pd.filaLabel}>{label}</Text>
            <Text style={pd.filaValor}>{valor}</Text>
          </View>
        ))}
      </View>

      {/* Subir factura */}
      {(solicitud.estado === 'pendiente' || solicitud.estado === 'procesando') && (
        <>
          <Text style={pd.seccionLabel}>SUBIR FACTURA</Text>
          <View style={pd.instrCard}>
            <Text style={pd.instrTexto}>
              {'1. Genera el CFDI en tu PAC con los datos fiscales de arriba\n' +
               '2. Sube el PDF a Firebase Storage en facturas/[solicitudId].pdf\n' +
               '3. Copia la URL de descarga y pégala abajo\n' +
               '4. El inquilino recibirá notificación automática en la app'}
            </Text>
          </View>

          {!rechazando ? (
            <>
              <Text style={pd.inputLabel}>URL del PDF (Storage o drive)</Text>
              <TextInput
                style={pd.input}
                value={pdfUrl}
                onChangeText={setPdfUrl}
                placeholder="https://…"
                placeholderTextColor={cartasBosque.niebla}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={[pd.btnPrimario, (!pdfUrl.trim() || cargando) && { opacity: 0.5 }]}
                onPress={handleSubir}
                disabled={!pdfUrl.trim() || cargando}
              >
                {cargando
                  ? <ActivityIndicator color={cartasBosque.bruma} />
                  : <Text style={pd.btnText}>Subir y notificar</Text>
                }
              </TouchableOpacity>
              <TouchableOpacity style={pd.btnSecundario} onPress={() => setRechazando(true)}>
                <Text style={pd.btnSecText}>Rechazar solicitud</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={pd.inputLabel}>Motivo de rechazo</Text>
              <TextInput
                style={[pd.input, { minHeight: 80 }]}
                value={motivo}
                onChangeText={setMotivo}
                placeholder="ej. Datos fiscales incorrectos"
                placeholderTextColor={cartasBosque.niebla}
                multiline
              />
              <TouchableOpacity
                style={[pd.btnRechazo, (!motivo.trim() || cargando) && { opacity: 0.5 }]}
                onPress={handleRechazar}
                disabled={!motivo.trim() || cargando}
              >
                {cargando
                  ? <ActivityIndicator color={cartasBosque.bruma} />
                  : <Text style={pd.btnText}>Confirmar rechazo</Text>
                }
              </TouchableOpacity>
              <TouchableOpacity style={pd.btnSecundario} onPress={() => setRechazando(false)}>
                <Text style={pd.btnSecText}>Cancelar</Text>
              </TouchableOpacity>
            </>
          )}
        </>
      )}

      {/* Factura emitida */}
      {solicitud.estado === 'emitida' && solicitud.pdfUrl && (
        <>
          <Text style={pd.seccionLabel}>FACTURA EMITIDA</Text>
          <View style={pd.emitidaCard}>
            <Text style={pd.emitidaTitulo}>Factura emitida correctamente</Text>
            {solicitud.adminSubidoEn && (
              <Text style={pd.emitidaFecha}>Emitida: {formatFecha(solicitud.adminSubidoEn)}</Text>
            )}
            <View style={pd.descargasRow}>
              <Text style={pd.descargasLabel}>Descargas restantes:</Text>
              <Text style={[pd.descargasNum, {
                color: solicitud.descargasRestantes > 1 ? '#4A9B6F'
                     : solicitud.descargasRestantes === 1 ? '#E8A838'
                     : '#C0392B',
              }]}>
                {solicitud.descargasRestantes}
              </Text>
            </View>
          </View>
          <TouchableOpacity style={pd.btnPrimario} onPress={handleVerPdf}>
            <View style={pd.btnInner}>
              <Ionicons name="document-outline" size={15} color={cartasBosque.bruma} />
              <Text style={pd.btnText}>Ver PDF</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={pd.btnCorreo} onPress={handleCorreo}>
            <View style={pd.btnInner}>
              <Ionicons name="mail-outline" size={15} color={cartasBosque.bosque} />
              <Text style={pd.btnCorreoText} numberOfLines={1}>
                Enviar al correo — {df.emailFiscal || '—'}
              </Text>
            </View>
          </TouchableOpacity>
        </>
      )}

      {/* Rechazada */}
      {solicitud.estado === 'rechazada' && (
        <>
          <Text style={pd.seccionLabel}>SOLICITUD RECHAZADA</Text>
          <View style={pd.rechazadaCard}>
            <Text style={pd.rechazadaTitulo}>Motivo de rechazo</Text>
            <Text style={pd.rechazadaMotivo}>{solicitud.notas || '—'}</Text>
          </View>
          <TouchableOpacity style={pd.btnPapelera} onPress={() => eliminarSolicitud(solicitud.id)}>
            <View style={pd.btnInner}>
              <Ionicons name="trash-outline" size={15} color={cartasBosque.bruma} />
              <Text style={pd.btnText}>Mover a papelera</Text>
            </View>
          </TouchableOpacity>
        </>
      )}

    </ScrollView>
  );
}

// ─── Panel subir (móvil — overlay) ───────────────────────────

function PanelSubir({
  solicitud, onClose, adminUid,
}: { solicitud: SolicitudFactura; onClose: () => void; adminUid: string }) {
  const [pdfUrl, setPdfUrl]         = useState('');
  const [rechazando, setRechazando] = useState(false);
  const [notas, setNotas]           = useState('');
  const [cargando, setCargando]     = useState(false);

  async function handleSubir() {
    if (!pdfUrl.trim()) return;
    setCargando(true);
    try { await subirFactura(solicitud.id, pdfUrl.trim(), adminUid); onClose(); }
    finally { setCargando(false); }
  }

  async function handleRechazar() {
    if (!notas.trim()) return;
    setCargando(true);
    try { await rechazarSolicitud(solicitud.id, adminUid, notas.trim()); onClose(); }
    finally { setCargando(false); }
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
  const [subTab, setSubTab]               = useState<SubTab>('pendientes');
  const [todas, setTodas]                 = useState<SolicitudFactura[]>([]);
  const [cargando, setCargando]           = useState(true);
  const [seleccionadaId, setSeleccionadaId] = useState<string | null>(null);

  useEffect(() => {
    return listenTodasSolicitudes(data => { setTodas(data); setCargando(false); });
  }, []);

  const pendientes      = todas.filter(s => s.estado === 'pendiente' || s.estado === 'procesando');
  const emitidasTab     = todas.filter(s => s.estado === 'emitida' || s.estado === 'rechazada');
  const papelera        = todas.filter(s => s.estado === 'eliminada');
  const emitidasCount   = todas.filter(s => s.estado === 'emitida').length;
  const rechazadasCount = todas.filter(s => s.estado === 'rechazada').length;

  const lista = subTab === 'pendientes' ? pendientes
              : subTab === 'emitidas'   ? emitidasTab
              : papelera;

  const seleccionada = seleccionadaId
    ? todas.find(s => s.id === seleccionadaId) ?? null
    : null;

  if (Platform.OS === 'web') {
    return (
      <View style={web.root}>
        <ColumnaLista
          lista={lista}
          subTab={subTab}
          setSubTab={setSubTab}
          pendientesCount={pendientes.length}
          emitidasCount={emitidasCount}
          rechazadasCount={rechazadasCount}
          papelera={papelera}
          seleccionadaId={seleccionadaId}
          onSeleccionar={setSeleccionadaId}
          cargando={cargando}
          userUid={user?.uid}
          isWeb
        />
        <View style={web.divider} />
        <PanelDerechoWeb
          key={seleccionadaId ?? 'empty'}
          solicitud={seleccionada}
          adminUid={user?.uid ?? ''}
        />
      </View>
    );
  }

  // ── Móvil ──────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <ColumnaLista
        lista={lista}
        subTab={subTab}
        setSubTab={setSubTab}
        pendientesCount={pendientes.length}
        emitidasCount={emitidasCount}
        rechazadasCount={rechazadasCount}
        papelera={papelera}
        seleccionadaId={seleccionadaId}
        onSeleccionar={id => { if (subTab === 'pendientes') setSeleccionadaId(id); }}
        cargando={cargando}
        userUid={user?.uid}
        isWeb={false}
      />
      {seleccionada && user?.uid && (
        <PanelSubir
          solicitud={seleccionada}
          onClose={() => setSeleccionadaId(null)}
          adminUid={user.uid}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Estilos — web layout ─────────────────────────────────────

const web = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: cartasBosque.bruma,
    overflow: 'hidden' as any,
  },
  divider: {
    width: 1,
    backgroundColor: cartasBosque.pergaminoOscuro,
  },
});

// ─── Estilos — ColumnaLista ───────────────────────────────────

const cl = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: cartasBosque.bruma,
  },
  containerWeb: {
    width: 380,
    flexShrink: 0,
    backgroundColor: cartasBosque.bruma,
    borderRightWidth: 1,
    borderRightColor: cartasBosque.pergaminoOscuro,
  },
  header: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
    paddingBottom: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: cartasBosque.pergaminoOscuro,
  },
  titulo: {
    fontFamily: 'BricolageGrotesque_700Bold',
    fontSize: 18,
    color: cartasBosque.tinta,
    marginBottom: spacing[3],
  },
  metricas: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metrica: {
    flex: 1,
    alignItems: 'center',
  },
  metricaNum: {
    fontFamily: 'MonaSans_400Regular',
    fontSize: 20,
    lineHeight: 24,
  },
  metricaLabel: {
    fontFamily: 'MonaSans_400Regular',
    fontSize: 10,
    color: cartasBosque.helecho,
    marginTop: 2,
  },
  metricaSep: {
    width: 1,
    height: 28,
    backgroundColor: cartasBosque.pergaminoOscuro,
  },
  subTabRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    gap: spacing[2],
    marginBottom: spacing[2],
  },
  subTab: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1] + 2,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: cartasBosque.pergaminoOscuro,
  },
  subTabActivo: {
    backgroundColor: cartasBosque.helecho,
    borderColor: cartasBosque.helecho,
  },
  subTabText: {
    fontFamily: 'MonaSans_400Regular',
    fontSize: 10,
    color: cartasBosque.helecho,
  },
  subTabTextActivo: { color: cartasBosque.bruma },
  vaciarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    marginHorizontal: spacing[4],
    marginBottom: spacing[2],
  },
  vaciarText: {
    fontFamily: 'BricolageGrotesque_400Regular',
    fontSize: 12,
    color: cartasBosque.alertaBorde,
  },
  centro: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    padding: spacing[4],
  },
  vacioText: {
    fontFamily: 'BricolageGrotesque_400Regular',
    fontSize: 14,
    color: cartasBosque.helecho,
  },
  scroll: { padding: spacing[3] },
});

// ─── Estilos — SolicitudCard ──────────────────────────────────

const sc = StyleSheet.create({
  card: {
    backgroundColor: cartasBosque.pergamino,
    borderRadius: borderRadius.md,
    padding: spacing[3],
    marginBottom: spacing[2],
    borderWidth: 1,
    borderColor: cartasBosque.pergaminoOscuro,
  },
  cardActiva: {
    borderColor: cartasBosque.bosque,
    borderWidth: 2,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  nombre: {
    fontFamily: 'BricolageGrotesque_600SemiBold',
    fontSize: 13,
    color: cartasBosque.tinta,
    flex: 1,
    marginRight: spacing[2],
  },
  badge: {
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
  },
  badgeText: {
    fontFamily: 'MonaSans_400Regular',
    fontSize: 9,
    color: '#FFFFFF',
  },
  hab: {
    fontFamily: 'MonaSans_400Regular',
    fontSize: 10,
    color: cartasBosque.helecho,
    marginBottom: 2,
  },
  concepto: {
    fontFamily: 'BricolageGrotesque_400Regular',
    fontSize: 12,
    color: cartasBosque.tinta,
    marginBottom: 2,
  },
  rfc: {
    fontFamily: 'MonaSans_400Regular',
    fontSize: 10,
    color: cartasBosque.helecho,
    marginBottom: spacing[2],
  },
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chip: {
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
  },
  chipText: {
    fontFamily: 'MonaSans_400Regular',
    fontSize: 9,
  },
  eliminarBtn: { padding: spacing[1] },
});

// ─── Estilos — PanelDerechoWeb ────────────────────────────────

const pd = StyleSheet.create({
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[3],
    backgroundColor: cartasBosque.bruma,
  },
  emptyText: {
    fontFamily: 'BricolageGrotesque_400Regular',
    fontSize: 14,
    color: cartasBosque.helecho,
    textAlign: 'center',
  },
  scroll: {
    flex: 1,
    backgroundColor: cartasBosque.bruma,
  },
  content: {
    padding: spacing[5],
    paddingBottom: spacing[5],
  },
  seccionLabel: {
    fontFamily: 'MonaSans_400Regular',
    fontSize: 10,
    color: cartasBosque.helecho,
    letterSpacing: 1,
    marginTop: spacing[5],
    marginBottom: spacing[3],
  },
  tabla: {
    backgroundColor: cartasBosque.pergamino,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: cartasBosque.pergaminoOscuro,
    overflow: 'hidden',
  },
  fila: {
    flexDirection: 'row',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: cartasBosque.pergaminoOscuro,
    alignItems: 'flex-start',
  },
  filaUltima: { borderBottomWidth: 0 },
  filaLabel: {
    fontFamily: 'MonaSans_400Regular',
    fontSize: 9,
    color: cartasBosque.helecho,
    width: 110,
    paddingTop: 2,
  },
  filaValor: {
    fontFamily: 'BricolageGrotesque_400Regular',
    fontSize: 13,
    color: cartasBosque.tinta,
    flex: 1,
  },
  instrCard: {
    backgroundColor: '#E8A83811',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#E8A83844',
    padding: spacing[3],
    marginBottom: spacing[3],
  },
  instrTexto: {
    fontFamily: 'BricolageGrotesque_400Regular',
    fontSize: 12,
    color: '#E8A838',
    lineHeight: 20,
  },
  inputLabel: {
    fontFamily: 'MonaSans_400Regular',
    fontSize: 10,
    color: cartasBosque.helecho,
    letterSpacing: 0.5,
    marginBottom: spacing[1],
  },
  input: {
    backgroundColor: cartasBosque.pergamino,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: cartasBosque.pergaminoOscuro,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    fontFamily: 'BricolageGrotesque_400Regular',
    fontSize: 13,
    color: cartasBosque.tinta,
    marginBottom: spacing[3],
  },
  btnPrimario: {
    backgroundColor: cartasBosque.bosque,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing[2] + 2,
    alignItems: 'center',
    marginBottom: spacing[2],
  },
  btnRechazo: {
    backgroundColor: cartasBosque.alertaBorde,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing[2] + 2,
    alignItems: 'center',
    marginBottom: spacing[2],
  },
  btnPapelera: {
    backgroundColor: '#C0392B',
    borderRadius: borderRadius.sm,
    paddingVertical: spacing[2] + 2,
    alignItems: 'center',
    marginBottom: spacing[2],
  },
  btnSecundario: {
    paddingVertical: spacing[2],
    alignItems: 'center',
    marginBottom: spacing[2],
  },
  btnText: {
    fontFamily: 'BricolageGrotesque_600SemiBold',
    fontSize: 14,
    color: cartasBosque.bruma,
  },
  btnSecText: {
    fontFamily: 'BricolageGrotesque_400Regular',
    fontSize: 13,
    color: cartasBosque.alertaBorde,
  },
  btnCorreo: {
    backgroundColor: cartasBosque.pergamino,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing[2] + 2,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: cartasBosque.bosque,
    marginBottom: spacing[2],
  },
  btnCorreoText: {
    fontFamily: 'BricolageGrotesque_400Regular',
    fontSize: 13,
    color: cartasBosque.bosque,
  },
  btnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  emitidaCard: {
    backgroundColor: '#4A9B6F11',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#4A9B6F44',
    padding: spacing[3],
    marginBottom: spacing[3],
  },
  emitidaTitulo: {
    fontFamily: 'BricolageGrotesque_600SemiBold',
    fontSize: 14,
    color: '#4A9B6F',
    marginBottom: spacing[1],
  },
  emitidaFecha: {
    fontFamily: 'MonaSans_400Regular',
    fontSize: 11,
    color: cartasBosque.helecho,
    marginBottom: spacing[2],
  },
  descargasRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  descargasLabel: {
    fontFamily: 'BricolageGrotesque_400Regular',
    fontSize: 13,
    color: cartasBosque.tinta,
  },
  descargasNum: {
    fontFamily: 'BricolageGrotesque_700Bold',
    fontSize: 16,
  },
  rechazadaCard: {
    backgroundColor: '#C0392B11',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#C0392B44',
    padding: spacing[3],
    marginBottom: spacing[3],
  },
  rechazadaTitulo: {
    fontFamily: 'BricolageGrotesque_600SemiBold',
    fontSize: 13,
    color: '#C0392B',
    marginBottom: spacing[1],
  },
  rechazadaMotivo: {
    fontFamily: 'BricolageGrotesque_400Regular',
    fontSize: 13,
    color: cartasBosque.tinta,
  },
});

// ─── Estilos — heredados (móvil) ──────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: cartasBosque.bruma },
  header: {
    paddingHorizontal: spacing[4], paddingTop: spacing[4], paddingBottom: spacing[3],
    borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro,
  },
  titulo: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 18, color: cartasBosque.tinta },
  mainTabRow: {
    flexDirection: 'row',
    backgroundColor: cartasBosque.pergaminoOscuro,
    margin: spacing[4],
    borderRadius: borderRadius.sm,
    padding: 2,
  },
  mainTab: { flex: 1, paddingVertical: spacing[2], alignItems: 'center', borderRadius: borderRadius.sm - 2 },
  mainTabActivo: { backgroundColor: cartasBosque.bruma },
  mainTabText: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: cartasBosque.helecho },
  mainTabTextActivo: { fontFamily: 'BricolageGrotesque_600SemiBold', color: cartasBosque.tinta },
  subTabRow: {
    flexDirection: 'row', paddingHorizontal: spacing[4], gap: spacing[2], marginBottom: spacing[2],
  },
  subTab: {
    paddingHorizontal: spacing[3], paddingVertical: spacing[1] + 2,
    borderRadius: borderRadius.sm, borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
  },
  subTabActivo: { backgroundColor: cartasBosque.helecho, borderColor: cartasBosque.helecho },
  subTabText: { fontFamily: 'MonaSans_400Regular', fontSize: 11, color: cartasBosque.helecho },
  subTabTextActivo: { color: cartasBosque.bruma },
  vaciarBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[1],
    marginHorizontal: spacing[4], marginBottom: spacing[2],
  },
  vaciarText: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: cartasBosque.alertaBorde },
  scrollContent: { padding: spacing[4] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[2] },
  vacioText: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 14, color: cartasBosque.helecho },
  card: {
    backgroundColor: cartasBosque.pergamino, borderRadius: borderRadius.md,
    padding: spacing[3], marginBottom: spacing[3],
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 },
  cardNombre: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 14, color: cartasBosque.tinta, flex: 1 },
  badge: { borderRadius: borderRadius.sm, paddingHorizontal: spacing[2], paddingVertical: 2, marginLeft: spacing[2] },
  badgeText: { fontFamily: 'MonaSans_400Regular', fontSize: 10, color: cartasBosque.bruma },
  cardConcepto: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: cartasBosque.tinta },
  cardRfc: { fontFamily: 'MonaSans_400Regular', fontSize: 11, color: cartasBosque.helecho, marginTop: 2 },
  cardFecha: { fontFamily: 'MonaSans_400Regular', fontSize: 10, color: cartasBosque.niebla, marginTop: 2 },
  cardActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing[2] },
  pdfRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pdfText: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 11, color: cartasBosque.bosque },
  eliminarBtn: { padding: spacing[1] },
});

const panelStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(18,42,31,0.5)',
    justifyContent: 'flex-end',
  },
  panel: {
    backgroundColor: cartasBosque.bruma,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: spacing[4], maxHeight: '85%' as any,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[3] },
  titulo: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 17, color: cartasBosque.tinta },
  label: {
    fontFamily: 'MonaSans_400Regular', fontSize: 10, color: cartasBosque.helecho,
    letterSpacing: 0.5, marginTop: spacing[2],
  },
  valor: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: cartasBosque.tinta },
  input: {
    backgroundColor: cartasBosque.pergamino, borderRadius: borderRadius.sm,
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: cartasBosque.tinta,
    marginTop: spacing[1],
  },
  btnPrimario: {
    marginTop: spacing[3], backgroundColor: cartasBosque.bosque,
    borderRadius: borderRadius.sm, paddingVertical: spacing[2] + 2, alignItems: 'center',
  },
  btnText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 14, color: cartasBosque.bruma },
  btnRechazo: { marginTop: spacing[2], paddingVertical: spacing[2], alignItems: 'center' },
  btnRechazoText: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: cartasBosque.alertaBorde },
  btnRechazoConfirm: {
    marginTop: spacing[3], backgroundColor: cartasBosque.alertaBorde,
    borderRadius: borderRadius.sm, paddingVertical: spacing[2] + 2, alignItems: 'center',
  },
});
