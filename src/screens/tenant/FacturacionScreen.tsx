import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, TextInput, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { cartasBosque } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/spacing';
import { useAuth } from '@/hooks/useAuth';
import type { SolicitudFactura, ConceptoFacturaCFDI, DatosFiscalesInquilino } from '@/types/firestore';
import {
  crearSolicitud, listenMisSolicitudes, CONCEPTOS_LABEL, emisorPorConcepto,
} from '@/services/firebase/facturas';

type Vista = 'lista' | 'nueva';

const CONCEPTOS: ConceptoFacturaCFDI[] = ['renta', 'lavanderia', 'almacenamiento', 'todo'];

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];

const ESTADO_COLOR: Record<SolicitudFactura['estado'], string> = {
  pendiente:   '#CDB29D',
  procesando:  cartasBosque.helecho,
  emitida:     cartasBosque.bosque,
  rechazada:   cartasBosque.alertaBorde,
  eliminada:   cartasBosque.niebla,
};

function formatFecha(ts: { toDate: () => Date } | undefined): string {
  if (!ts) return '—';
  return ts.toDate().toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Componente ───────────────────────────────────────────────

export default function FacturacionScreen({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const [vista, setVista] = useState<Vista>('lista');
  const [solicitudes, setSolicitudes] = useState<SolicitudFactura[]>([]);
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [exito, setExito] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const ahora = new Date();
  const [concepto, setConcepto] = useState<ConceptoFacturaCFDI>('renta');
  const [mes, setMes] = useState(ahora.getMonth() + 1);
  const [anio, setAnio] = useState(ahora.getFullYear());

  // Datos fiscales
  const [rfc, setRfc] = useState('');
  const [razonSocial, setRazonSocial] = useState('');
  const [regimenFiscal, setRegimenFiscal] = useState('');
  const [domicilio, setDomicilio] = useState('');
  const [cp, setCp] = useState('');
  const [emailFiscal, setEmailFiscal] = useState('');

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = listenMisSolicitudes(user.uid, data => {
      setSolicitudes(data.filter(s => s.estado !== 'eliminada'));
      setCargando(false);
    });
    return unsub;
  }, [user?.uid]);

  async function handleEnviar() {
    if (!rfc.trim() || !razonSocial.trim() || !cp.trim()) {
      setError('RFC, Razón Social y Código Postal son requeridos.');
      return;
    }
    if (!user?.uid) return;
    setEnviando(true);
    setError('');
    const datosFiscales: DatosFiscalesInquilino = {
      rfc: rfc.trim().toUpperCase(),
      razonSocial: razonSocial.trim(),
      regimenFiscal: regimenFiscal.trim(),
      domicilioFiscal: domicilio.trim(),
      codigoPostal: cp.trim(),
      emailFiscal: emailFiscal.trim(),
    };
    try {
      await crearSolicitud({
        inquilinoId: user.uid,
        habitacionId: solicitudes[0]?.habitacionId ?? 'sin-asignar',
        habitacionNumero: solicitudes[0]?.habitacionNumero,
        inquilinoNombre: solicitudes[0]?.inquilinoNombre,
        concepto,
        mes,
        anio,
        datosFiscales,
      });
      setExito(true);
    } catch (e: any) {
      setError('Error al enviar: ' + (e.message ?? 'intenta de nuevo'));
    } finally {
      setEnviando(false);
    }
  }

  // ── Vista nueva solicitud ────────────────────────────────────

  if (vista === 'nueva') {
    return (
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => { setVista('lista'); setExito(false); setError(''); }}>
            <Ionicons name="arrow-back" size={22} color={cartasBosque.tinta} />
          </TouchableOpacity>
          <Text style={styles.titulo}>Solicitar CFDI</Text>
          <View style={{ width: 22 }} />
        </View>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {exito ? (
            <View style={styles.exitoBox}>
              <Ionicons name="checkmark-circle" size={44} color={cartasBosque.bosque} />
              <Text style={styles.exitoTitulo}>Solicitud enviada</Text>
              <Text style={styles.exitoSub}>
                Recibirás una notificación cuando tu factura esté lista (máx. 3 descargas).
              </Text>
              <TouchableOpacity style={styles.btnPrimario} onPress={() => { setVista('lista'); setExito(false); }}>
                <Text style={styles.btnPrimarioText}>Ver mis facturas</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Concepto */}
              <Text style={styles.secLabel}>Concepto a facturar</Text>
              <View style={styles.chipGrid}>
                {CONCEPTOS.map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.chip, concepto === c && styles.chipActivo]}
                    onPress={() => setConcepto(c)}
                  >
                    <Text style={[styles.chipText, concepto === c && styles.chipTextActivo]}>
                      {CONCEPTOS_LABEL[c]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Emisor info */}
              <View style={styles.emisorBox}>
                <Ionicons
                  name={emisorPorConcepto(concepto) === 'fisica' ? 'person-outline' : 'business-outline'}
                  size={14}
                  color={cartasBosque.helecho}
                />
                <Text style={styles.emisorText}>
                  {emisorPorConcepto(concepto) === 'fisica'
                    ? 'Emite: Belem Cisneros Díaz · RESICO · Exento IVA'
                    : 'Emite: Servicios Kadamees Integrales · IVA 16%'}
                </Text>
              </View>

              {/* Periodo */}
              <Text style={styles.secLabel}>Periodo</Text>
              <View style={styles.periodoRow}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mesesScroll}>
                  {MESES.map((m, i) => (
                    <TouchableOpacity
                      key={m}
                      style={[styles.mesChip, mes === i + 1 && styles.mesChipActivo]}
                      onPress={() => setMes(i + 1)}
                    >
                      <Text style={[styles.mesChipText, mes === i + 1 && styles.mesChipTextActivo]}>
                        {m.slice(0, 3)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <View style={styles.anioRow}>
                  <TouchableOpacity onPress={() => setAnio(a => a - 1)}>
                    <Ionicons name="chevron-back" size={18} color={cartasBosque.helecho} />
                  </TouchableOpacity>
                  <Text style={styles.anioText}>{anio}</Text>
                  <TouchableOpacity onPress={() => setAnio(a => a + 1)}>
                    <Ionicons name="chevron-forward" size={18} color={cartasBosque.helecho} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Datos fiscales */}
              <Text style={styles.secLabel}>Datos fiscales</Text>
              <Field label="RFC *" value={rfc} onChange={t => setRfc(t.toUpperCase())} placeholder="XAXX010101000" caps="characters" />
              <Field label="Razón social *" value={razonSocial} onChange={setRazonSocial} placeholder="Nombre o empresa" />
              <Field label="Régimen fiscal" value={regimenFiscal} onChange={setRegimenFiscal} placeholder="ej. 625 RESICO" />
              <Field label="Domicilio fiscal" value={domicilio} onChange={setDomicilio} placeholder="Calle, número, colonia, ciudad" />
              <Field label="Código postal *" value={cp} onChange={setCp} placeholder="00000" keyboard="numeric" />
              <Field label="Email fiscal" value={emailFiscal} onChange={setEmailFiscal} placeholder="correo@ejemplo.com" keyboard="email-address" />

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <TouchableOpacity
                style={[styles.btnPrimario, enviando && { opacity: 0.6 }]}
                onPress={handleEnviar}
                disabled={enviando}
              >
                {enviando
                  ? <ActivityIndicator color={cartasBosque.bruma} />
                  : <Text style={styles.btnPrimarioText}>Enviar solicitud</Text>
                }
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Vista lista ──────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Ionicons name="arrow-back" size={22} color={cartasBosque.tinta} />
        </TouchableOpacity>
        <Text style={styles.titulo}>Mis facturas</Text>
        <TouchableOpacity style={styles.btnNueva} onPress={() => setVista('nueva')}>
          <Text style={styles.btnNuevaText}>+ Solicitar</Text>
        </TouchableOpacity>
      </View>
      {cargando ? (
        <View style={styles.center}><ActivityIndicator color={cartasBosque.bosque} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {solicitudes.length === 0 ? (
            <View style={styles.center}>
              <Ionicons name="receipt-outline" size={40} color={cartasBosque.niebla} />
              <Text style={styles.vacioText}>Sin facturas</Text>
              <Text style={styles.vacioSub}>Solicita tu primer CFDI con el botón "+ Solicitar"</Text>
            </View>
          ) : (
            solicitudes.map(s => (
              <View key={s.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardConcepto}>{CONCEPTOS_LABEL[s.concepto]}</Text>
                  <View style={[styles.estadoBadge, { backgroundColor: ESTADO_COLOR[s.estado] }]}>
                    <Text style={styles.estadoLabel}>{s.estado}</Text>
                  </View>
                </View>
                <Text style={styles.cardPeriodo}>
                  {MESES[s.mes - 1]} {s.anio} · {s.emisor === 'fisica' ? 'Persona física' : 'Empresa'}
                </Text>
                <Text style={styles.cardRfc}>{s.datosFiscales.rfc} · {s.datosFiscales.razonSocial}</Text>
                <Text style={styles.cardFecha}>Solicitada: {formatFecha(s.creadoEn as any)}</Text>
                {s.estado === 'emitida' && s.pdfUrl && (
                  <View style={styles.downloadRow}>
                    <Ionicons name="document-outline" size={14} color={cartasBosque.bosque} />
                    <Text style={styles.downloadText}>
                      PDF disponible · {s.descargasRestantes} descarga(s) restante(s)
                    </Text>
                  </View>
                )}
                {s.estado === 'rechazada' && s.notas && (
                  <Text style={styles.notasText}>Motivo: {s.notas}</Text>
                )}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─── Helper Field ─────────────────────────────────────────────

function Field({
  label, value, onChange, placeholder, caps, keyboard,
}: {
  label: string; value: string; onChange: (t: string) => void;
  placeholder: string; caps?: any; keyboard?: any;
}) {
  return (
    <>
      <Text style={fieldStyles.label}>{label}</Text>
      <TextInput
        style={fieldStyles.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={cartasBosque.niebla}
        autoCapitalize={caps ?? 'words'}
        keyboardType={keyboard ?? 'default'}
      />
    </>
  );
}

const fieldStyles = StyleSheet.create({
  label: {
    fontFamily: 'MonaSans_400Regular',
    fontSize: 10,
    color: cartasBosque.helecho,
    letterSpacing: 0.5,
    marginTop: spacing[3],
    marginBottom: spacing[1],
  },
  input: {
    backgroundColor: cartasBosque.pergamino,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: cartasBosque.pergaminoOscuro,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2] + 1,
    fontFamily: 'BricolageGrotesque_400Regular',
    fontSize: 13,
    color: cartasBosque.tinta,
  },
});

// ─── Estilos ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: cartasBosque.bruma },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingTop: spacing[4], paddingBottom: spacing[3],
    borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro,
  },
  titulo: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 17, color: cartasBosque.tinta },
  btnNueva: {
    backgroundColor: cartasBosque.bosque, borderRadius: borderRadius.sm,
    paddingHorizontal: spacing[3], paddingVertical: spacing[1] + 2,
  },
  btnNuevaText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 12, color: cartasBosque.bruma },
  scrollContent: { padding: spacing[4] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: spacing[8], gap: spacing[2] },
  vacioText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 16, color: cartasBosque.tinta },
  vacioSub: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: cartasBosque.helecho, textAlign: 'center' },
  secLabel: {
    fontFamily: 'MonaSans_400Regular', fontSize: 11, color: cartasBosque.helecho,
    letterSpacing: 0.6, textTransform: 'uppercase', marginTop: spacing[4], marginBottom: spacing[2],
  },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  chip: {
    borderRadius: borderRadius.sm, borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    paddingHorizontal: spacing[3], paddingVertical: spacing[1] + 2, backgroundColor: cartasBosque.pergamino,
  },
  chipActivo: { backgroundColor: cartasBosque.bosque, borderColor: cartasBosque.bosque },
  chipText: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: cartasBosque.tinta },
  chipTextActivo: { color: cartasBosque.bruma },
  emisorBox: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[1],
    backgroundColor: cartasBosque.pergamino, borderRadius: borderRadius.sm,
    padding: spacing[2], marginTop: spacing[2],
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
  },
  emisorText: { fontFamily: 'MonaSans_400Regular', fontSize: 10, color: cartasBosque.helecho, flex: 1 },
  periodoRow: { gap: spacing[2] },
  mesesScroll: { flexGrow: 0 },
  mesChip: {
    borderRadius: borderRadius.sm, borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    paddingHorizontal: spacing[2], paddingVertical: spacing[1], marginRight: spacing[1],
    backgroundColor: cartasBosque.pergamino,
  },
  mesChipActivo: { backgroundColor: cartasBosque.helecho, borderColor: cartasBosque.helecho },
  mesChipText: { fontFamily: 'MonaSans_400Regular', fontSize: 11, color: cartasBosque.tinta },
  mesChipTextActivo: { color: cartasBosque.bruma },
  anioRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  anioText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 16, color: cartasBosque.tinta },
  errorText: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: cartasBosque.alertaBorde, marginTop: spacing[2] },
  btnPrimario: {
    marginTop: spacing[4], backgroundColor: cartasBosque.bosque,
    borderRadius: borderRadius.sm, paddingVertical: spacing[3], alignItems: 'center',
  },
  btnPrimarioText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 14, color: cartasBosque.bruma },
  exitoBox: { alignItems: 'center', gap: spacing[3], paddingTop: spacing[8] },
  exitoTitulo: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 20, color: cartasBosque.tinta },
  exitoSub: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: cartasBosque.helecho, textAlign: 'center' },
  // Cards
  card: {
    backgroundColor: cartasBosque.pergamino, borderRadius: borderRadius.md,
    padding: spacing[4], marginBottom: spacing[3],
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing[1] },
  cardConcepto: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 14, color: cartasBosque.tinta, flex: 1 },
  estadoBadge: { borderRadius: borderRadius.sm, paddingHorizontal: spacing[2], paddingVertical: 2, marginLeft: spacing[2] },
  estadoLabel: { fontFamily: 'MonaSans_400Regular', fontSize: 10, color: cartasBosque.bruma },
  cardPeriodo: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: cartasBosque.helecho },
  cardRfc: { fontFamily: 'MonaSans_400Regular', fontSize: 11, color: cartasBosque.tinta, marginTop: 2 },
  cardFecha: { fontFamily: 'MonaSans_400Regular', fontSize: 10, color: cartasBosque.niebla, marginTop: spacing[1] },
  downloadRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], marginTop: spacing[2] },
  downloadText: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: cartasBosque.bosque },
  notasText: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: cartasBosque.alertaBorde, marginTop: spacing[1] },
});
