import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Alert, Modal, Pressable, ActivityIndicator, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { onSnapshot, collection, query, where, doc as fsDoc } from 'firebase/firestore';
import { db } from '@/services/firebase/firestore';
import { cartasBosque } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/spacing';
import { useAuth } from '@/hooks/useAuth';
import DocumentoCard from '@/components/common/DocumentoCard';
import {
  listenExpediente, listenDocumentos,
  actualizarNotasAdmin, congelarCuenta, cambiarHabitacion,
  resetearContador, subirDocumento,
} from '@/services/firebase/expedientes';
import type {
  Inquilino, Expediente, DocumentoExpediente,
  HuespedExtra, ScoreReputacion, SolicitudFactura,
  Pago, Ticket, Visita,
} from '@/types/firestore';

// ─── Helpers ──────────────────────────────────────────────────

function formatFecha(ts: any): string {
  try { return ts.toDate().toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return '—'; }
}

function formatHora(ts: any): string {
  try { return ts.toDate().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }); }
  catch { return '—'; }
}

const NIVEL_COLOR: Record<string, string> = {
  pesimo: '#960018', moroso: '#8A6A72', regular: '#8A9E80',
  bueno: cartasBosque.helecho, excelente: cartasBosque.bosque,
};
const NIVEL_LABEL: Record<string, string> = {
  pesimo: 'Pésimo', moroso: 'Moroso', regular: 'Regular',
  bueno: 'Bueno', excelente: 'Excelente',
};
const NIVEL_ABREV: Record<string, string> = {
  pesimo: 'PÉS', moroso: 'MOR', regular: 'REG', bueno: 'BUE', excelente: 'EXC',
};
const PAGO_ESTADO_COLOR: Record<string, string> = {
  pendiente: '#E8A838', en_revision: '#3B82F6', pagado: '#4A9B6F',
  rechazado: '#E05C2A', vencido: '#C0392B', parcial: '#E8A838', anulado: '#8A9E80',
};
const AVATAR_COLOR: Record<string, string> = {
  activo: cartasBosque.bosque, moroso: '#8A6A72',
  pendiente: '#E8A838', inactivo: cartasBosque.helecho,
};

function Seccion({ label }: { label: string }) {
  return <Text style={secStyles.label}>{label}</Text>;
}

// ─── SubirUrlModal ─────────────────────────────────────────────

function SubirUrlModal({ docNombre, onGuardar, onCancelar }: {
  docNombre: string;
  onGuardar: (url: string) => void;
  onCancelar: () => void;
}) {
  const [url, setUrl] = useState('');
  return (
    <View style={urlStyles.sheet}>
      <Text style={urlStyles.titulo}>Subir documento</Text>
      <Text style={urlStyles.sub}>{docNombre}</Text>
      <TextInput
        style={urlStyles.input}
        placeholder="URL del archivo en Storage"
        placeholderTextColor={cartasBosque.helecho}
        value={url}
        onChangeText={setUrl}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <View style={urlStyles.btnRow}>
        <TouchableOpacity style={urlStyles.btnCancel} onPress={onCancelar}>
          <Text style={urlStyles.btnCancelText}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[urlStyles.btnOk, !url.trim() && { opacity: 0.4 }]}
          disabled={!url.trim()}
          onPress={() => onGuardar(url.trim())}
        >
          <Text style={urlStyles.btnOkText}>Guardar URL</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── CambiarHabModal ──────────────────────────────────────────

function CambiarHabModal({ onGuardar, onCancelar }: {
  onGuardar: (num: string) => void;
  onCancelar: () => void;
}) {
  const [num, setNum] = useState('');
  return (
    <View style={urlStyles.sheet}>
      <Text style={urlStyles.titulo}>Cambiar habitación</Text>
      <Text style={urlStyles.sub}>Número de habitación destino (ej. 05)</Text>
      <TextInput
        style={urlStyles.input}
        placeholder="Número"
        placeholderTextColor={cartasBosque.helecho}
        value={num}
        onChangeText={setNum}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <View style={urlStyles.btnRow}>
        <TouchableOpacity style={urlStyles.btnCancel} onPress={onCancelar}>
          <Text style={urlStyles.btnCancelText}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[urlStyles.btnOk, !num.trim() && { opacity: 0.4 }]}
          disabled={!num.trim()}
          onPress={() => onGuardar(num.trim())}
        >
          <Text style={urlStyles.btnOkText}>Confirmar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── exportarPerfilPDF ─────────────────────────────────────────

function exportarPerfilPDF(
  inquilino: Inquilino,
  expediente: Expediente | null,
  score: ScoreReputacion | null,
  pagos: Pago[],
  tickets: Ticket[],
) {
  if (typeof window === 'undefined') return;
  const nombre = `${inquilino.nombre} ${inquilino.apellido}`;
  const scoreLabel = score ? (NIVEL_LABEL[score.nivel] ?? '—') : '—';
  const pagoRows = pagos.slice(0, 10).map(p =>
    `<tr><td>${formatFecha(p.fechaVencimiento)}</td><td>${p.concepto}</td><td>$${p.monto.toLocaleString('es-MX')}</td><td>${p.estado}</td></tr>`
  ).join('');
  const ticketRows = tickets.slice(0, 10).map(t =>
    `<tr><td>${formatFecha(t.creadoEn)}</td><td>${t.categoria.replace(/_/g, ' ')}</td><td>${t.estado}</td></tr>`
  ).join('');
  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Expediente: ${nombre}</title>
<style>body{font-family:sans-serif;color:#122A1F;padding:32px}h1{font-size:22px;margin-bottom:4px}h2{font-size:14px;margin-top:24px;border-bottom:1px solid #ccc;padding-bottom:4px}p{font-size:13px;margin:4px 0}table{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #e0e0e0}th{background:#f5f2ec;font-weight:600}</style>
</head><body>
<h1>${nombre}</h1>
<p>Habitación: ${inquilino.habitacionId ?? '—'} · Email: ${inquilino.email} · Estado: ${inquilino.estado}</p>
<p>Score: ${score?.puntos ?? '—'} / 100 · Nivel: ${scoreLabel}${expediente?.congelado ? ' · <strong>CUENTA CONGELADA</strong>' : ''}</p>
<h2>Pagos recientes</h2>
<table><thead><tr><th>Vencimiento</th><th>Concepto</th><th>Monto</th><th>Estado</th></tr></thead>
<tbody>${pagoRows || '<tr><td colspan="4">Sin pagos</td></tr>'}</tbody></table>
<h2>Tickets recientes</h2>
<table><thead><tr><th>Fecha</th><th>Categoría</th><th>Estado</th></tr></thead>
<tbody>${ticketRows || '<tr><td colspan="3">Sin tickets</td></tr>'}</tbody></table>
${expediente?.notasAdmin ? `<h2>Notas internas</h2><p>${expediente.notasAdmin}</p>` : ''}
</body></html>`;
  const ventana = window.open('', '_blank');
  if (ventana) {
    ventana.document.write(html);
    ventana.document.close();
    ventana.print();
  }
}

// ─── ProfilePanel (web) ────────────────────────────────────────

type TabId = 'resumen' | 'documentos' | 'pagos' | 'tickets' | 'visitas' | 'servicios';

const TABS: { id: TabId; label: string }[] = [
  { id: 'resumen',    label: 'RESUMEN' },
  { id: 'documentos', label: 'DOCUMENTOS' },
  { id: 'pagos',      label: 'PAGOS' },
  { id: 'tickets',    label: 'TICKETS' },
  { id: 'visitas',    label: 'VISITAS' },
  { id: 'servicios',  label: 'SERVICIOS' },
];

function ProfilePanel({ inquilino }: { inquilino: Inquilino }) {
  const { user } = useAuth();
  const uid = inquilino.uid;

  const [tabActiva, setTabActiva]           = useState<TabId>('resumen');
  const [expediente, setExpediente]         = useState<Expediente | null>(null);
  const [documentos, setDocumentos]         = useState<DocumentoExpediente[]>([]);
  const [huespedes, setHuespedes]           = useState<HuespedExtra[]>([]);
  const [score, setScore]                   = useState<ScoreReputacion | null>(null);
  const [solicitudes, setSolicitudes]       = useState<SolicitudFactura[]>([]);
  const [notas, setNotas]                   = useState('');
  const [notasDirty, setNotasDirty]         = useState(false);
  const [subirModal, setSubirModal]         = useState<DocumentoExpediente | null>(null);
  const [cambiarHabVisible, setCambiarHabVisible] = useState(false);
  const [pagos, setPagos]                   = useState<Pago[]>([]);
  const [tickets, setTickets]               = useState<Ticket[]>([]);
  const [visitas, setVisitas]               = useState<Visita[]>([]);

  useEffect(() => {
    const unsubExp  = listenExpediente(uid, e => {
      setExpediente(e);
      if (e && !notasDirty) setNotas(e.notasAdmin ?? '');
    });
    const unsubDocs = listenDocumentos(uid, setDocumentos);

    const unsubScore = onSnapshot(
      fsDoc(db, 'scores', uid),
      snap => { if (snap.exists()) setScore({ ...snap.data(), id: snap.id } as ScoreReputacion); },
    );

    const qH = query(collection(db, 'huespedes_extra'), where('inquilinoId', '==', uid), where('activo', '==', true));
    const unsubH = onSnapshot(qH, snap => {
      setHuespedes(snap.docs.map(d2 => ({ ...d2.data(), id: d2.id } as HuespedExtra)));
    }, () => {});

    const qS = query(collection(db, 'solicitudes_factura'), where('inquilinoId', '==', uid), where('estado', '==', 'pendiente'));
    const unsubS = onSnapshot(qS, snap => {
      setSolicitudes(snap.docs.map(d2 => ({ ...d2.data(), id: d2.id } as SolicitudFactura)));
    }, () => {});

    const qP = query(collection(db, 'pagos'), where('inquilinoId', '==', uid));
    const unsubP = onSnapshot(qP, snap => {
      const lista = snap.docs.map(d2 => ({ ...d2.data(), id: d2.id } as Pago));
      lista.sort((a, b) => (b.fechaVencimiento?.toDate?.()?.getTime() ?? 0) - (a.fechaVencimiento?.toDate?.()?.getTime() ?? 0));
      setPagos(lista);
    }, () => {});

    const qT = query(collection(db, 'tickets'), where('inquilinoId', '==', uid));
    const unsubT = onSnapshot(qT, snap => {
      const lista = snap.docs.map(d2 => ({ ...d2.data(), id: d2.id } as Ticket));
      lista.sort((a, b) => (b.creadoEn?.toDate?.()?.getTime() ?? 0) - (a.creadoEn?.toDate?.()?.getTime() ?? 0));
      setTickets(lista);
    }, () => {});

    const qV = query(collection(db, 'visitas'), where('inquilinoId', '==', uid));
    const unsubV = onSnapshot(qV, snap => {
      const lista = snap.docs.map(d2 => ({ ...d2.data(), id: d2.id } as Visita));
      lista.sort((a, b) => (b.fechaEntrada?.toDate?.()?.getTime() ?? 0) - (a.fechaEntrada?.toDate?.()?.getTime() ?? 0));
      setVisitas(lista);
    }, () => {});

    return () => {
      unsubExp(); unsubDocs(); unsubScore();
      unsubH(); unsubS(); unsubP(); unsubT(); unsubV();
    };
  }, [uid]);

  const nombreCompleto = `${inquilino.nombre} ${inquilino.apellido}`;
  const avatarColor    = AVATAR_COLOR[inquilino.estado] ?? cartasBosque.helecho;
  const scoreColor     = score ? (NIVEL_COLOR[score.nivel] ?? cartasBosque.helecho) : cartasBosque.helecho;
  const scoreLabel     = score ? (NIVEL_LABEL[score.nivel] ?? '—') : '—';
  const diasIngreso    = inquilino.fechaIngreso
    ? Math.floor((Date.now() - inquilino.fechaIngreso.toDate().getTime()) / 86_400_000)
    : null;

  async function guardarNotas() {
    try {
      await actualizarNotasAdmin(uid, notas);
      setNotasDirty(false);
    } catch { Alert.alert('Error', 'No se pudieron guardar las notas'); }
  }

  async function toggleCongelar() {
    if (!expediente) return;
    const nuevo = !expediente.congelado;
    Alert.alert(
      nuevo ? 'Congelar cuenta' : 'Descongelar cuenta',
      `¿${nuevo ? 'Congelar' : 'Descongelar'} la cuenta de ${nombreCompleto}?`,
      [
        { text: 'Cancelar' },
        { text: nuevo ? 'Congelar' : 'Activar', onPress: () => congelarCuenta(uid, nuevo) },
      ],
    );
  }

  function renderTab(): React.ReactElement | null {
    switch (tabActiva) {

      case 'resumen': return (
        <ScrollView contentContainerStyle={cr.tabScroll}>
          {/* Score */}
          <View style={cr.scoreRow}>
            <View style={[cr.scoreRing, { borderColor: scoreColor }]}>
              <Text style={[cr.scoreNum, { color: scoreColor }]}>{score?.puntos ?? '—'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={cr.scoreNivel}>{scoreLabel}</Text>
              <View style={cr.progressTrack}>
                <View style={[cr.progressBar, { width: `${score?.puntos ?? 0}%` as any, backgroundColor: scoreColor }]} />
              </View>
              {score?.ajusteManual && (
                <Text style={cr.scoreMeta}>Ajuste manual · {formatFecha(score.ajustadoEn)}</Text>
              )}
            </View>
          </View>

          {/* Métricas */}
          <View style={cr.metricRow}>
            <View style={cr.metricCard}>
              <Text style={[cr.metricVal, { color: '#3B82F6' }]}>{diasIngreso ?? '—'}</Text>
              <Text style={cr.metricLabel}>días hospedado</Text>
            </View>
            <View style={cr.metricCard}>
              <Text style={[cr.metricVal, { color: '#4A9B6F' }]}>
                {inquilino.rentaMensual ? `$${inquilino.rentaMensual.toLocaleString('es-MX')}` : '—'}
              </Text>
              <Text style={cr.metricLabel}>renta mensual</Text>
            </View>
            <View style={cr.metricCard}>
              <Text style={[cr.metricVal, { color: '#E8A838' }]}>{huespedes.length}</Text>
              <Text style={cr.metricLabel}>huéspedes extra</Text>
            </View>
            <View style={cr.metricCard}>
              <Text style={[cr.metricVal, { color: '#E05C2A' }]}>{solicitudes.length}</Text>
              <Text style={cr.metricLabel}>CFDI pendientes</Text>
            </View>
          </View>

          {/* Notas */}
          <Seccion label="Notas internas" />
          <View style={cr.notasCard}>
            <TextInput
              style={cr.notasInput}
              multiline
              value={notas}
              onChangeText={t => { setNotas(t); setNotasDirty(true); }}
              placeholder="Agrega notas privadas sobre este inquilino…"
              placeholderTextColor={cartasBosque.helecho}
            />
            {notasDirty && (
              <TouchableOpacity style={cr.notasGuardarBtn} onPress={guardarNotas}>
                <Text style={cr.notasGuardarText}>Guardar notas</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Acciones */}
          <View style={cr.accionesRow}>
            <TouchableOpacity
              style={[cr.accionBtn, expediente?.congelado && cr.accionBtnDanger]}
              onPress={toggleCongelar}
            >
              <Ionicons
                name={expediente?.congelado ? 'lock-closed' : 'lock-open-outline'}
                size={14}
                color={expediente?.congelado ? '#C0392B' : cartasBosque.helecho}
              />
              <Text style={[cr.accionBtnText, expediente?.congelado && { color: '#C0392B' }]}>
                {expediente?.congelado ? 'Descongelar' : 'Congelar'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={cr.accionBtn} onPress={() => setCambiarHabVisible(true)}>
              <Ionicons name="home-outline" size={14} color={cartasBosque.helecho} />
              <Text style={cr.accionBtnText}>Cambiar hab.</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={cr.accionBtn}
              onPress={() => exportarPerfilPDF(inquilino, expediente, score, pagos, tickets)}
            >
              <Ionicons name="print-outline" size={14} color={cartasBosque.helecho} />
              <Text style={cr.accionBtnText}>Exportar PDF</Text>
            </TouchableOpacity>
          </View>
          <View style={{ height: spacing[6] }} />
        </ScrollView>
      );

      case 'documentos': return (
        <ScrollView contentContainerStyle={cr.tabScroll}>
          <Seccion label={`Documentos (${documentos.filter(d2 => d2.estado === 'subido').length}/${documentos.length})`} />
          {documentos.map(dc => (
            <DocumentoCard
              key={dc.id}
              doc={dc}
              esAdmin
              onDescargar={() => {}}
              onSubir={() => setSubirModal(dc)}
              onResetContador={() => resetearContador(uid, dc.id).catch(() => {})}
            />
          ))}
          <View style={{ height: spacing[6] }} />
        </ScrollView>
      );

      case 'pagos': return (
        <ScrollView contentContainerStyle={cr.tabScroll}>
          <Seccion label={`Pagos (${pagos.length})`} />
          {pagos.length === 0 ? (
            <Text style={cr.emptyText}>Sin pagos registrados</Text>
          ) : pagos.map(p => {
            const color = PAGO_ESTADO_COLOR[p.estado] ?? '#8A9E80';
            return (
              <View key={p.id} style={cr.listRow}>
                <View style={{ flex: 1 }}>
                  <Text style={cr.rowTitle}>{p.concepto} · {formatFecha(p.fechaVencimiento)}</Text>
                  <Text style={cr.rowMeta}>${p.monto.toLocaleString('es-MX')} · {p.metodoPago ?? 'sin método'}</Text>
                </View>
                <View style={[cr.estadoBadge, { backgroundColor: `${color}22`, borderColor: `${color}55` }]}>
                  <Text style={[cr.estadoBadgeText, { color }]}>{p.estado.replace(/_/g, ' ')}</Text>
                </View>
              </View>
            );
          })}
          <View style={{ height: spacing[6] }} />
        </ScrollView>
      );

      case 'tickets': return (
        <ScrollView contentContainerStyle={cr.tabScroll}>
          <Seccion label={`Tickets (${tickets.length})`} />
          {tickets.length === 0 ? (
            <Text style={cr.emptyText}>Sin tickets registrados</Text>
          ) : tickets.map(t => {
            const color = t.estado === 'resuelto' ? '#4A9B6F'
              : t.estado === 'en_proceso' ? '#E05C2A' : '#E8A838';
            return (
              <View key={t.id} style={cr.listRow}>
                <View style={{ flex: 1 }}>
                  <Text style={cr.rowTitle}>{t.categoria.replace(/_/g, ' ')} · {t.folio}</Text>
                  <Text style={cr.rowMeta}>{formatFecha(t.creadoEn)}{t.descripcion ? ` · ${t.descripcion.slice(0, 60)}` : ''}</Text>
                </View>
                <View style={[cr.estadoBadge, { backgroundColor: `${color}22`, borderColor: `${color}55` }]}>
                  <Text style={[cr.estadoBadgeText, { color }]}>{t.estado.replace(/_/g, ' ')}</Text>
                </View>
              </View>
            );
          })}
          <View style={{ height: spacing[6] }} />
        </ScrollView>
      );

      case 'visitas': return (
        <ScrollView contentContainerStyle={cr.tabScroll}>
          <Seccion label={`Visitas (${visitas.length})`} />
          {visitas.length === 0 ? (
            <Text style={cr.emptyText}>Sin visitas registradas</Text>
          ) : visitas.map(v => {
            const entrada = v.fechaEntrada?.toDate?.();
            const salida  = v.fechaSalida?.toDate?.();
            const hrs = entrada && salida
              ? Math.round((salida.getTime() - entrada.getTime()) / 360_000) / 10
              : null;
            return (
              <View key={v.id} style={cr.listRow}>
                <View style={{ flex: 1 }}>
                  <Text style={cr.rowTitle}>{v.nombreVisitante ?? v.documentoNumero}</Text>
                  <Text style={cr.rowMeta}>
                    {formatFecha(v.fechaEntrada)} · Entrada: {formatHora(v.fechaEntrada)}
                    {v.fechaSalida ? ` · Salida: ${formatHora(v.fechaSalida)}` : ' · Activa'}
                    {hrs !== null ? ` · ${hrs}h` : ''}
                  </Text>
                </View>
                {v.estadoEstacionaria !== 'normal' && (
                  <View style={[cr.estadoBadge, { backgroundColor: '#E05C2A22', borderColor: '#E05C2A55' }]}>
                    <Text style={[cr.estadoBadgeText, { color: '#E05C2A' }]}>{v.estadoEstacionaria.replace(/_/g, ' ')}</Text>
                  </View>
                )}
              </View>
            );
          })}
          <View style={{ height: spacing[6] }} />
        </ScrollView>
      );

      case 'servicios': return (
        <ScrollView contentContainerStyle={cr.tabScroll}>
          <Seccion label={`Huéspedes extra (${huespedes.length})`} />
          {huespedes.length === 0 ? (
            <Text style={cr.emptyText}>Sin huéspedes activos</Text>
          ) : huespedes.map(h => {
            const color = h.estado === 'activo' ? '#4A9B6F' : '#E8A838';
            return (
              <View key={h.id} style={cr.listRow}>
                <View style={{ flex: 1 }}>
                  <Text style={cr.rowTitle}>{h.nombre} {h.apellido}</Text>
                  <Text style={cr.rowMeta}>
                    {h.modalidad === 'mensual' ? 'Permanente' : 'Temporal'} · ${h.montoMensual.toLocaleString('es-MX')}/mes
                  </Text>
                  <Text style={cr.rowMeta}>Desde: {formatFecha(h.fechaEntrada)}</Text>
                </View>
                <View style={[cr.estadoBadge, { backgroundColor: `${color}22`, borderColor: `${color}55` }]}>
                  <Text style={[cr.estadoBadgeText, { color }]}>{h.estado.replace(/_/g, ' ')}</Text>
                </View>
              </View>
            );
          })}
          {solicitudes.length > 0 && (
            <>
              <Seccion label={`CFDI pendientes (${solicitudes.length})`} />
              {solicitudes.map(sf => (
                <View key={sf.id} style={cr.listRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={cr.rowTitle}>{sf.concepto} · {sf.mes}/{sf.anio}</Text>
                    <Text style={cr.rowMeta}>
                      {sf.emisor === 'fisica' ? 'Persona física' : 'Empresa'} · {sf.datosFiscales?.rfc}
                    </Text>
                  </View>
                  <View style={[cr.estadoBadge, { backgroundColor: '#E8A83822', borderColor: '#E8A83855' }]}>
                    <Text style={[cr.estadoBadgeText, { color: '#E8A838' }]}>PENDIENTE</Text>
                  </View>
                </View>
              ))}
            </>
          )}
          <View style={{ height: spacing[6] }} />
        </ScrollView>
      );

      default: return null;
    }
  }

  return (
    <View style={cr.panel}>

      {/* Header */}
      <View style={cr.panelHeader}>
        <View style={[cr.panelAvatar, { backgroundColor: avatarColor }]}>
          <Text style={cr.panelAvatarInitial}>{(inquilino.nombre?.[0] ?? '?').toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={cr.panelNombre}>{nombreCompleto}</Text>
          <Text style={cr.panelMeta}>Hab {inquilino.habitacionId ?? '—'} · {inquilino.email}</Text>
          <Text style={cr.panelMeta}>Ingreso: {formatFecha(inquilino.fechaIngreso)}</Text>
        </View>
        {expediente?.congelado && (
          <View style={cr.congeladoBadge}>
            <Ionicons name="lock-closed" size={12} color="#C0392B" />
            <Text style={cr.congeladoBadgeText}>CONGELADA</Text>
          </View>
        )}
      </View>

      {/* Tab bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={cr.tabBar}
        contentContainerStyle={cr.tabBarContent}
      >
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[cr.tabBtn, tabActiva === tab.id && cr.tabBtnActive]}
            onPress={() => setTabActiva(tab.id)}
          >
            <Text style={[cr.tabBtnText, tabActiva === tab.id && cr.tabBtnTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Tab content */}
      <View style={{ flex: 1 }}>
        {renderTab()}
      </View>

      {/* SubirUrl Modal */}
      <Modal visible={!!subirModal} animationType="slide" transparent onRequestClose={() => setSubirModal(null)}>
        <Pressable style={d.overlay} onPress={() => setSubirModal(null)}>
          <Pressable onPress={e => e.stopPropagation()}>
            {subirModal && (
              <SubirUrlModal
                docNombre={subirModal.nombre}
                onGuardar={async url => {
                  try {
                    await subirDocumento(uid, subirModal.id, url, user?.uid ?? '');
                    setSubirModal(null);
                  } catch { Alert.alert('Error', 'No se pudo guardar'); }
                }}
                onCancelar={() => setSubirModal(null)}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* CambiarHab Modal */}
      <Modal visible={cambiarHabVisible} animationType="slide" transparent onRequestClose={() => setCambiarHabVisible(false)}>
        <Pressable style={d.overlay} onPress={() => setCambiarHabVisible(false)}>
          <Pressable onPress={e => e.stopPropagation()}>
            <CambiarHabModal
              onGuardar={async num => {
                try {
                  await cambiarHabitacion(uid, num, num);
                  setCambiarHabVisible(false);
                } catch { Alert.alert('Error', 'No se pudo cambiar la habitación'); }
              }}
              onCancelar={() => setCambiarHabVisible(false)}
            />
          </Pressable>
        </Pressable>
      </Modal>

    </View>
  );
}

// ─── DetalleExpediente (mobile) ────────────────────────────────

function DetalleExpediente({
  inquilino, onBack,
}: {
  inquilino: Inquilino;
  onBack: () => void;
}) {
  const { user } = useAuth();
  const uid = inquilino.uid;

  const [expediente, setExpediente]   = useState<Expediente | null>(null);
  const [documentos, setDocumentos]   = useState<DocumentoExpediente[]>([]);
  const [huespedes, setHuespedes]     = useState<HuespedExtra[]>([]);
  const [score, setScore]             = useState<ScoreReputacion | null>(null);
  const [solicitudes, setSolicitudes] = useState<SolicitudFactura[]>([]);
  const [notas, setNotas]             = useState('');
  const [notasDirty, setNotasDirty]   = useState(false);
  const [subirModal, setSubirModal]   = useState<DocumentoExpediente | null>(null);

  useEffect(() => {
    const unsubExp  = listenExpediente(uid, e => {
      setExpediente(e);
      if (e && !notasDirty) setNotas(e.notasAdmin ?? '');
    });
    const unsubDocs = listenDocumentos(uid, setDocumentos);

    const unsubScore = onSnapshot(
      fsDoc(db, 'scores', uid),
      (snap) => { if (snap.exists()) setScore({ ...snap.data(), id: snap.id } as ScoreReputacion); },
    );
    const qH = query(collection(db, 'huespedes_extra'), where('inquilinoId', '==', uid), where('activo', '==', true));
    const unsubH = onSnapshot(qH, snap => {
      setHuespedes(snap.docs.map(d2 => ({ ...d2.data(), id: d2.id } as HuespedExtra)));
    }, () => {});

    const qS = query(collection(db, 'solicitudes_factura'), where('inquilinoId', '==', uid), where('estado', '==', 'pendiente'));
    const unsubS = onSnapshot(qS, snap => {
      setSolicitudes(snap.docs.map(d2 => ({ ...d2.data(), id: d2.id } as SolicitudFactura)));
    }, () => {});

    return () => { unsubExp(); unsubDocs(); unsubScore(); unsubH(); unsubS(); };
  }, [uid]);

  const nombreCompleto = `${inquilino.nombre} ${inquilino.apellido}`;
  const scoreColor = score ? (NIVEL_COLOR[score.nivel] ?? cartasBosque.helecho) : cartasBosque.helecho;
  const scoreLabel = score ? (NIVEL_LABEL[score.nivel] ?? '') : '—';

  async function guardarNotas() {
    try {
      await actualizarNotasAdmin(uid, notas);
      setNotasDirty(false);
    } catch { Alert.alert('Error', 'No se pudieron guardar las notas'); }
  }

  async function toggleCongelar() {
    if (!expediente) return;
    const nuevo = !expediente.congelado;
    Alert.alert(
      nuevo ? 'Congelar cuenta' : 'Descongelar cuenta',
      `¿${nuevo ? 'Congelar' : 'Descongelar'} la cuenta de ${nombreCompleto}?`,
      [
        { text: 'Cancelar' },
        { text: nuevo ? 'Congelar' : 'Activar', onPress: () => congelarCuenta(uid, nuevo) },
      ],
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Header detalle */}
      <View style={d.header}>
        <TouchableOpacity onPress={onBack} style={d.backBtn}>
          <Ionicons name="arrow-back" size={22} color={cartasBosque.tinta} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={d.headerNombre}>{nombreCompleto}</Text>
          <Text style={d.headerHab}>Hab {inquilino.habitacionId ?? '—'}</Text>
        </View>
        <TouchableOpacity
          style={[d.congelarBtn, expediente?.congelado && d.congelarBtnActivo]}
          onPress={toggleCongelar}
        >
          <Ionicons
            name={expediente?.congelado ? 'lock-closed' : 'lock-open-outline'}
            size={16}
            color={expediente?.congelado ? '#960018' : cartasBosque.helecho}
          />
          <Text style={[d.congelarText, expediente?.congelado && { color: '#960018' }]}>
            {expediente?.congelado ? 'Congelada' : 'Congelar'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={d.scroll}>

        {/* Score */}
        <Seccion label="Score de reputación" />
        <View style={d.scoreCard}>
          <View style={[d.scoreRing, { borderColor: scoreColor }]}>
            <Text style={[d.scoreNum, { color: scoreColor }]}>{score?.puntos ?? '—'}</Text>
          </View>
          <View>
            <Text style={d.scoreLabel}>{scoreLabel}</Text>
            {score?.ajusteManual && (
              <Text style={d.scoreMeta}>Ajuste manual · {formatFecha(score.ajustadoEn)}</Text>
            )}
          </View>
        </View>

        {/* Notas internas */}
        <Seccion label="Notas internas (invisible al inquilino)" />
        <View style={d.notasCard}>
          <TextInput
            style={d.notasInput}
            multiline
            value={notas}
            onChangeText={t => { setNotas(t); setNotasDirty(true); }}
            placeholder="Agrega notas privadas sobre este inquilino…"
            placeholderTextColor={cartasBosque.helecho}
          />
          {notasDirty && (
            <TouchableOpacity style={d.notasGuardarBtn} onPress={guardarNotas}>
              <Text style={d.notasGuardarText}>Guardar notas</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Solicitudes CFDI pendientes */}
        {solicitudes.length > 0 && (
          <>
            <Seccion label={`CFDI pendientes (${solicitudes.length})`} />
            {solicitudes.map(sf => (
              <View key={sf.id} style={d.cfdiCard}>
                <View style={{ flex: 1 }}>
                  <Text style={d.cfdiTitulo}>
                    {sf.concepto} · {sf.mes}/{sf.anio}
                  </Text>
                  <Text style={d.cfdiMeta}>
                    {sf.emisor === 'fisica' ? 'Persona física' : 'Empresa'} · {sf.datosFiscales?.rfc}
                  </Text>
                </View>
                <TouchableOpacity
                  style={d.cfdiBtn}
                  onPress={() => Alert.alert(
                    'Subir CFDI',
                    'Usa el panel web de administración para subir el PDF y actualizar el estado de la solicitud.',
                    [{ text: 'Entendido' }],
                  )}
                >
                  <Ionicons name="cloud-upload-outline" size={14} color={cartasBosque.bruma} />
                  <Text style={d.cfdiBtnText}>Subir CFDI</Text>
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}

        {/* Documentos */}
        <Seccion label={`Documentos (${documentos.filter(d2 => d2.estado === 'subido').length}/${documentos.length})`} />
        {documentos.map(dc => (
          <DocumentoCard
            key={dc.id}
            doc={dc}
            esAdmin
            onDescargar={() => {}}
            onSubir={() => setSubirModal(dc)}
            onResetContador={() => resetearContador(uid, dc.id).catch(() => {})}
          />
        ))}

        {/* Ocupantes */}
        <Seccion label="Ocupantes activos" />
        <View style={d.ocupantesCard}>
          <View style={d.ocupanteRow}>
            <Ionicons name="star" size={12} color={cartasBosque.bosque} />
            <Text style={d.ocupanteNombre}>{nombreCompleto}</Text>
            <Text style={d.ocupanteTipo}>Titular</Text>
          </View>
          {huespedes.map(h => (
            <View key={h.id}>
              <View style={d.divider} />
              <View style={d.ocupanteRow}>
                <Ionicons name="person-outline" size={12} color={cartasBosque.helecho} />
                <Text style={d.ocupanteNombre}>{h.nombre} {h.apellido}</Text>
                <Text style={d.ocupanteTipo}>
                  {h.modalidad === 'mensual' ? 'Permanente' : 'Temporal'} · ${h.montoMensual.toLocaleString('es-MX')}/mes
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Contactos de emergencia */}
        {(expediente?.contactosEmergencia ?? []).length > 0 && (
          <>
            <Seccion label="Contactos de emergencia" />
            {expediente!.contactosEmergencia.map(c => (
              <View key={c.id} style={d.contactoCard}>
                <Text style={d.contactoNombre}>{c.nombre} · {c.parentesco} · {c.edad} años</Text>
                {c.telefono && <Text style={d.contactoMeta}>{c.telefono}</Text>}
                {c.redesSociales && <Text style={d.contactoMeta}>{c.redesSociales}</Text>}
                {c.direccion && <Text style={d.contactoMeta}>{c.direccion}</Text>}
              </View>
            ))}
          </>
        )}

        {/* Mascotas */}
        {(expediente?.mascotas ?? []).length > 0 && (
          <>
            <Seccion label="Mascotas" />
            {expediente!.mascotas.map(m => (
              <View key={m.id} style={d.mascotaRow}>
                <Ionicons name="paw-outline" size={13} color={cartasBosque.helecho} />
                <Text style={d.mascotaText}>{m.descripcion}</Text>
              </View>
            ))}
          </>
        )}

        {/* Firma */}
        <Seccion label="Firma digital" />
        <View style={d.firmaCard}>
          {expediente?.firmaDigital ? (
            <View style={d.firmaSignedRow}>
              <Ionicons name="checkmark-circle" size={16} color="#4A5E48" />
              <Text style={d.firmaSignedText}>Firmado el {formatFecha(expediente.firmadoEn)}</Text>
            </View>
          ) : (
            <Text style={d.firmaPendiente}>Sin firma digital</Text>
          )}
        </View>

        <View style={{ height: spacing[8] }} />
      </ScrollView>

      {/* Modal subir URL */}
      <Modal
        visible={!!subirModal}
        animationType="slide"
        transparent
        onRequestClose={() => setSubirModal(null)}
      >
        <Pressable style={d.overlay} onPress={() => setSubirModal(null)}>
          <Pressable onPress={e => e.stopPropagation()}>
            {subirModal && (
              <SubirUrlModal
                docNombre={subirModal.nombre}
                onGuardar={async (url) => {
                  try {
                    await subirDocumento(uid, subirModal.id, url, user?.uid ?? '');
                    setSubirModal(null);
                  } catch { Alert.alert('Error', 'No se pudo guardar'); }
                }}
                onCancelar={() => setSubirModal(null)}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ─── ExpedienteAdminScreen ─────────────────────────────────────

export default function ExpedienteAdminScreen() {
  const [inquilinos, setInquilinos]     = useState<Inquilino[]>([]);
  const [seleccionado, setSeleccionado] = useState<Inquilino | null>(null);
  const [scores, setScores]             = useState<Record<string, ScoreReputacion>>({});
  const [cargando, setCargando]         = useState(true);
  const [busqueda, setBusqueda]         = useState('');

  useEffect(() => {
    const q = query(collection(db, 'inquilinos'), where('estado', '!=', 'inactivo'));
    const unsub = onSnapshot(q, snap => {
      const lista = snap.docs.map(d2 => ({ ...d2.data(), id: d2.id } as Inquilino));
      lista.sort((a, b) => (a.habitacionId ?? '').localeCompare(b.habitacionId ?? ''));
      setInquilinos(lista);
      setCargando(false);
    }, () => setCargando(false));
    return unsub;
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const unsub = onSnapshot(collection(db, 'scores'), snap => {
      const map: Record<string, ScoreReputacion> = {};
      snap.docs.forEach(sd => { map[sd.id] = { ...sd.data(), id: sd.id } as ScoreReputacion; });
      setScores(map);
    }, () => {});
    return unsub;
  }, []);

  const filtrados = inquilinos.filter(inq => {
    const q = busqueda.toLowerCase();
    return !q
      || `${inq.nombre} ${inq.apellido}`.toLowerCase().includes(q)
      || (inq.habitacionId ?? '').includes(q);
  });

  // ── Mobile ─────────────────────────────────────────────────
  if (Platform.OS !== 'web') {
    if (seleccionado) {
      return (
        <DetalleExpediente
          inquilino={seleccionado}
          onBack={() => setSeleccionado(null)}
        />
      );
    }
    return (
      <View style={{ flex: 1, backgroundColor: cartasBosque.bruma }}>
        <View style={l.searchWrap}>
          <Ionicons name="search-outline" size={16} color={cartasBosque.helecho} />
          <TextInput
            style={l.searchInput}
            placeholder="Buscar inquilino o habitación…"
            placeholderTextColor={cartasBosque.helecho}
            value={busqueda}
            onChangeText={setBusqueda}
          />
        </View>
        {cargando ? (
          <ActivityIndicator color={cartasBosque.bosque} style={{ marginTop: spacing[8] }} />
        ) : filtrados.length === 0 ? (
          <View style={l.empty}>
            <Text style={l.emptyText}>Sin resultados</Text>
          </View>
        ) : (
          <ScrollView>
            {filtrados.map(inq => (
              <TouchableOpacity key={inq.id} style={l.card} onPress={() => setSeleccionado(inq)}>
                <View style={l.avatar}>
                  <Text style={l.avatarInitial}>{(inq.nombre?.[0] ?? '?').toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={l.nombre}>{inq.nombre} {inq.apellido}</Text>
                  <Text style={l.meta}>Hab {inq.habitacionId ?? '—'} · {inq.email}</Text>
                </View>
                <View style={[l.estadoChip, inq.estado === 'moroso' && { backgroundColor: '#E8EBE0' }]}>
                  <Text style={[l.estadoText, inq.estado === 'moroso' && { color: '#8A6A72' }]}>{inq.estado}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={cartasBosque.niebla} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
    );
  }

  // ── Web CRM ────────────────────────────────────────────────
  return (
    <View style={cr.root}>

      {/* Left column */}
      <View style={cr.leftCol}>
        <View style={cr.searchWrap}>
          <Ionicons name="search-outline" size={15} color={cartasBosque.helecho} />
          <TextInput
            style={cr.searchInput}
            placeholder="Buscar…"
            placeholderTextColor={cartasBosque.helecho}
            value={busqueda}
            onChangeText={setBusqueda}
          />
        </View>
        {cargando ? (
          <ActivityIndicator color={cartasBosque.bosque} style={{ marginTop: spacing[6] }} />
        ) : (
          <ScrollView style={{ flex: 1 }}>
            {filtrados.map(inq => {
              const sc         = scores[inq.uid];
              const avatarBg   = AVATAR_COLOR[inq.estado] ?? cartasBosque.helecho;
              const active     = seleccionado?.id === inq.id;
              const nivelColor = sc ? (NIVEL_COLOR[sc.nivel] ?? cartasBosque.helecho) : cartasBosque.helecho;
              return (
                <TouchableOpacity
                  key={inq.id}
                  style={[cr.leftRow, active && cr.leftRowActive]}
                  onPress={() => setSeleccionado(inq)}
                  activeOpacity={0.75}
                >
                  <View style={[cr.leftAvatar, { backgroundColor: avatarBg }]}>
                    <Text style={cr.leftAvatarInitial}>{(inq.nombre?.[0] ?? '?').toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[cr.leftNombre, active && { color: cartasBosque.tinta }]} numberOfLines={1}>
                      {inq.nombre} {inq.apellido}
                    </Text>
                    <Text style={cr.leftHab}>Hab {inq.habitacionId ?? '—'}</Text>
                    {inq.estado === 'moroso' && (
                      <View style={cr.morosoBadge}>
                        <Text style={cr.morosoBadgeText}>MOROSO</Text>
                      </View>
                    )}
                  </View>
                  {sc && (
                    <View style={[cr.scoreBadge, { backgroundColor: `${nivelColor}22`, borderColor: `${nivelColor}55` }]}>
                      <Text style={[cr.scoreBadgeText, { color: nivelColor }]}>{NIVEL_ABREV[sc.nivel] ?? sc.nivel}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* Right column */}
      <View style={cr.rightCol}>
        {seleccionado ? (
          <ProfilePanel key={seleccionado.id} inquilino={seleccionado} />
        ) : (
          <View style={cr.emptyState}>
            <Ionicons name="person-circle-outline" size={48} color={cartasBosque.niebla} />
            <Text style={cr.emptyStateText}>Selecciona un inquilino para ver su expediente</Text>
          </View>
        )}
      </View>

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const secStyles = StyleSheet.create({
  label: {
    fontFamily: 'MonaSans_400Regular', fontSize: 10, color: cartasBosque.helecho,
    letterSpacing: 0.8, textTransform: 'uppercase',
    marginBottom: spacing[2], marginTop: spacing[1],
  },
});

const d = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro,
    backgroundColor: cartasBosque.bruma,
  },
  backBtn: { padding: spacing[1] },
  headerNombre: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 15, color: cartasBosque.tinta },
  headerHab:    { fontFamily: 'MonaSans_400Regular',  fontSize: 11, color: cartasBosque.helecho },
  congelarBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing[2] + 2, paddingVertical: spacing[1] + 2,
    borderRadius: borderRadius.full, borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
  },
  congelarBtnActivo: { borderColor: '#960018', backgroundColor: 'rgba(103,0,16,0.15)' },
  congelarText: { fontFamily: 'MonaSans_400Regular', fontSize: 10, color: cartasBosque.helecho },
  scroll: { padding: spacing[4] },

  scoreCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    backgroundColor: cartasBosque.pergamino, borderRadius: borderRadius.md,
    padding: spacing[3], borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    marginBottom: spacing[5],
  },
  scoreRing: {
    width: 52, height: 52, borderRadius: 26, borderWidth: 4,
    alignItems: 'center', justifyContent: 'center',
  },
  scoreNum:   { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 16, color: cartasBosque.tinta },
  scoreLabel: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: cartasBosque.tinta },
  scoreMeta:  { fontFamily: 'MonaSans_400Regular',  fontSize: 10, color: cartasBosque.helecho },

  notasCard: {
    backgroundColor: cartasBosque.pergamino, borderRadius: borderRadius.md,
    padding: spacing[3], borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    marginBottom: spacing[5],
  },
  notasInput: {
    fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: cartasBosque.tinta,
    minHeight: 72, textAlignVertical: 'top',
  },
  notasGuardarBtn: {
    alignSelf: 'flex-end', marginTop: spacing[2],
    paddingHorizontal: spacing[3], paddingVertical: spacing[1] + 2,
    backgroundColor: cartasBosque.bosque, borderRadius: borderRadius.full,
  },
  notasGuardarText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 11, color: cartasBosque.bruma },

  cfdiCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    backgroundColor: '#E8EBE0', borderRadius: borderRadius.md,
    padding: spacing[3], marginBottom: spacing[2],
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
  },
  cfdiTitulo: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 12, color: cartasBosque.tinta },
  cfdiMeta:   { fontFamily: 'MonaSans_400Regular',  fontSize: 10, color: '#8A6A72' },
  cfdiBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: cartasBosque.bosque, borderRadius: borderRadius.md,
    paddingHorizontal: spacing[2] + 2, paddingVertical: spacing[1] + 2,
  },
  cfdiBtnText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 11, color: cartasBosque.bruma },

  ocupantesCard: {
    backgroundColor: cartasBosque.pergamino, borderRadius: borderRadius.md,
    padding: spacing[3], borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    marginBottom: spacing[5],
  },
  ocupanteRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  ocupanteNombre: { flex: 1, fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 12, color: cartasBosque.tinta },
  ocupanteTipo:   { fontFamily: 'MonaSans_400Regular', fontSize: 10, color: cartasBosque.helecho },
  divider: { height: 1, backgroundColor: cartasBosque.pergaminoOscuro, marginVertical: spacing[2] },

  contactoCard: {
    backgroundColor: cartasBosque.pergamino, borderRadius: borderRadius.md,
    padding: spacing[3], marginBottom: spacing[2],
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
  },
  contactoNombre: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 12, color: cartasBosque.tinta },
  contactoMeta:   { fontFamily: 'MonaSans_400Regular',  fontSize: 10, color: cartasBosque.helecho, marginTop: 2 },

  mascotaRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingVertical: spacing[2],
  },
  mascotaText: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: cartasBosque.tinta },

  firmaCard: {
    backgroundColor: cartasBosque.pergamino, borderRadius: borderRadius.md,
    padding: spacing[3], borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    marginBottom: spacing[5],
  },
  firmaSignedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  firmaSignedText:{ fontFamily: 'MonaSans_400Regular', fontSize: 11, color: '#4A5E48' },
  firmaPendiente: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: cartasBosque.helecho, fontStyle: 'italic' },

  overlay: {
    flex: 1, backgroundColor: 'rgba(18,42,31,0.45)', justifyContent: 'flex-end',
  },
});

const l = StyleSheet.create({
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    margin: spacing[4], paddingHorizontal: spacing[3], paddingVertical: spacing[2] + 2,
    backgroundColor: cartasBosque.pergamino, borderRadius: borderRadius.full,
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
  },
  searchInput: {
    flex: 1, fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: cartasBosque.tinta,
  },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro,
    backgroundColor: cartasBosque.bruma,
  },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: cartasBosque.bosque,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 16, color: cartasBosque.bruma },
  nombre: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: cartasBosque.tinta },
  meta:   { fontFamily: 'MonaSans_400Regular',  fontSize: 10, color: cartasBosque.helecho },
  estadoChip: {
    paddingHorizontal: spacing[2], paddingVertical: 2,
    borderRadius: borderRadius.full,
    backgroundColor: '#E8EBE0',
  },
  estadoText: { fontFamily: 'MonaSans_400Regular', fontSize: 9, color: '#4A5E48' },
  empty:     { alignItems: 'center', marginTop: spacing[12] },
  emptyText: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: cartasBosque.helecho },
});

const urlStyles = StyleSheet.create({
  sheet: {
    backgroundColor: cartasBosque.bruma,
    borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl,
    padding: spacing[5], paddingBottom: spacing[8],
  },
  titulo:      { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 17, color: cartasBosque.tinta, marginBottom: spacing[1] },
  sub:         { fontFamily: 'BricolageGrotesque_400Regular',  fontSize: 12, color: cartasBosque.helecho, marginBottom: spacing[3] },
  input: {
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    borderRadius: borderRadius.md, padding: spacing[3],
    fontFamily: 'BricolageGrotesque_400Regular', fontSize: 14, color: cartasBosque.tinta,
    backgroundColor: cartasBosque.pergamino, marginBottom: spacing[2],
  },
  btnRow:       { flexDirection: 'row', gap: spacing[2], marginTop: spacing[2] },
  btnCancel: {
    flex: 1, paddingVertical: spacing[3], borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro, alignItems: 'center',
  },
  btnCancelText:{ fontFamily: 'BricolageGrotesque_400Regular',  fontSize: 14, color: cartasBosque.helecho },
  btnOk: {
    flex: 1, paddingVertical: spacing[3],
    borderRadius: borderRadius.md, backgroundColor: cartasBosque.bosque, alignItems: 'center',
  },
  btnOkText:    { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 14, color: cartasBosque.bruma },
});

const cr = StyleSheet.create({
  // ── Two-column root
  root: {
    flex: 1, flexDirection: 'row', backgroundColor: cartasBosque.bruma,
  },

  // ── Left column
  leftCol: {
    width: 280,
    borderRightWidth: 1, borderRightColor: cartasBosque.pergaminoOscuro,
    backgroundColor: cartasBosque.bruma,
  },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    margin: spacing[3],
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    backgroundColor: cartasBosque.pergamino, borderRadius: borderRadius.full,
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
  },
  searchInput: {
    flex: 1, fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: cartasBosque.tinta,
  },
  leftRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingHorizontal: spacing[3], paddingVertical: spacing[2] + 2,
    borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro,
  },
  leftRowActive: { backgroundColor: cartasBosque.pergaminoOscuro },
  leftAvatar: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  leftAvatarInitial: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 16, color: cartasBosque.bruma },
  leftNombre: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: cartasBosque.helecho },
  leftHab:    { fontFamily: 'MonaSans_400Regular', fontSize: 10, color: cartasBosque.helecho },
  morosoBadge: {
    alignSelf: 'flex-start', marginTop: 2,
    paddingHorizontal: 4, paddingVertical: 1,
    backgroundColor: '#C0392B22', borderRadius: 3,
    borderWidth: 1, borderColor: '#C0392B55',
  },
  morosoBadgeText: { fontFamily: 'MonaSans_400Regular', fontSize: 8, color: '#C0392B' },
  scoreBadge: {
    paddingHorizontal: spacing[1] + 2, paddingVertical: 2,
    borderRadius: borderRadius.full, borderWidth: 1,
  },
  scoreBadgeText: { fontFamily: 'MonaSans_400Regular', fontSize: 9 },

  // ── Right column
  rightCol: { flex: 1, backgroundColor: cartasBosque.bruma },
  emptyState: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[2],
  },
  emptyStateText: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 14, color: cartasBosque.helecho },

  // ── ProfilePanel
  panel: { flex: 1 },
  panelHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    padding: spacing[4],
    borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro,
    backgroundColor: cartasBosque.pergamino,
  },
  panelAvatar: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
  },
  panelAvatarInitial: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 22, color: cartasBosque.bruma },
  panelNombre: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 16, color: cartasBosque.tinta },
  panelMeta:   { fontFamily: 'MonaSans_400Regular', fontSize: 10, color: cartasBosque.helecho, marginTop: 2 },
  congeladoBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing[2], paddingVertical: spacing[1],
    backgroundColor: '#C0392B22', borderRadius: borderRadius.full,
    borderWidth: 1, borderColor: '#C0392B55',
  },
  congeladoBadgeText: { fontFamily: 'MonaSans_400Regular', fontSize: 9, color: '#C0392B' },

  // ── Tab bar
  tabBar: {
    borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro,
    backgroundColor: cartasBosque.pergamino,
    maxHeight: 42,
  },
  tabBarContent:    { paddingHorizontal: spacing[3] },
  tabBtn: {
    paddingHorizontal: spacing[3], paddingVertical: spacing[2] + 2,
    marginRight: spacing[1],
  },
  tabBtnActive:     { borderBottomWidth: 2, borderBottomColor: cartasBosque.bosque },
  tabBtnText:       { fontFamily: 'MonaSans_400Regular', fontSize: 10, color: cartasBosque.helecho, letterSpacing: 0.5 },
  tabBtnTextActive: { color: cartasBosque.bosque },

  // ── Tab scroll
  tabScroll: { padding: spacing[4] },

  // ── Score row (resumen)
  scoreRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    backgroundColor: cartasBosque.pergamino, borderRadius: borderRadius.md,
    padding: spacing[3], borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    marginBottom: spacing[4],
  },
  scoreRing: {
    width: 56, height: 56, borderRadius: 28, borderWidth: 4,
    alignItems: 'center', justifyContent: 'center',
  },
  scoreNum:   { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 18 },
  scoreNivel: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 14, color: cartasBosque.tinta, marginBottom: spacing[1] },
  scoreMeta:  { fontFamily: 'MonaSans_400Regular', fontSize: 10, color: cartasBosque.helecho, marginTop: 4 },
  progressTrack: {
    height: 6, backgroundColor: cartasBosque.pergaminoOscuro, borderRadius: 3, overflow: 'hidden',
  },
  progressBar: { height: 6, borderRadius: 3 },

  // ── Metrics (resumen)
  metricRow: { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[4] },
  metricCard: {
    flex: 1, backgroundColor: cartasBosque.pergamino,
    borderRadius: borderRadius.md, padding: spacing[2] + 2,
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    alignItems: 'center',
  },
  metricVal:   { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 20 },
  metricLabel: { fontFamily: 'MonaSans_400Regular', fontSize: 9, color: cartasBosque.helecho, textAlign: 'center', marginTop: 2 },

  // ── Notas (resumen)
  notasCard: {
    backgroundColor: cartasBosque.pergamino, borderRadius: borderRadius.md,
    padding: spacing[3], borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    marginBottom: spacing[4],
  },
  notasInput: {
    fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: cartasBosque.tinta,
    minHeight: 80, textAlignVertical: 'top',
  },
  notasGuardarBtn: {
    alignSelf: 'flex-end', marginTop: spacing[2],
    paddingHorizontal: spacing[3], paddingVertical: spacing[1] + 2,
    backgroundColor: cartasBosque.bosque, borderRadius: borderRadius.full,
  },
  notasGuardarText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 11, color: cartasBosque.bruma },

  // ── Acciones (resumen)
  accionesRow: { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[4] },
  accionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[1],
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    backgroundColor: cartasBosque.pergamino,
    borderRadius: borderRadius.md, borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
  },
  accionBtnDanger: { borderColor: '#C0392B55', backgroundColor: '#C0392B11' },
  accionBtnText:   { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: cartasBosque.helecho },

  // ── List rows (pagos, tickets, visitas, servicios)
  listRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    paddingVertical: spacing[2] + 2,
    borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro,
  },
  rowTitle: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 12, color: cartasBosque.tinta },
  rowMeta:  { fontFamily: 'MonaSans_400Regular', fontSize: 10, color: cartasBosque.helecho, marginTop: 2 },
  estadoBadge: {
    paddingHorizontal: spacing[2], paddingVertical: 3,
    borderRadius: borderRadius.full, borderWidth: 1,
  },
  estadoBadgeText: { fontFamily: 'MonaSans_400Regular', fontSize: 9 },
  emptyText: {
    fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: cartasBosque.helecho,
    fontStyle: 'italic', marginTop: spacing[2],
  },
});
