import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, Modal, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { cartasBosque } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/spacing';
import { useAuth } from '@/hooks/useAuth';
import CuadriculaAlmacenamiento from '@/components/common/CuadriculaAlmacenamiento';
import {
  listenEspacios, asignarEspacio, liberarEspacio,
  espaciosProximosVencer, montoConIva,
  PRECIO_SEMANA, PRECIO_MES, FACTURADOR,
} from '@/services/firebase/almacenamiento';
import type { EspacioAlmacenamiento, ModalidadEspacio } from '@/types/firestore';

export default function AlmacenamientoTenantScreen() {
  const { user } = useAuth();
  const [espacios, setEspacios]   = useState<EspacioAlmacenamiento[]>([]);
  const [cargando, setCargando]   = useState(true);
  const [selec, setSelec]         = useState<EspacioAlmacenamiento | null>(null);
  const [modalVis, setModalVis]   = useState(false);
  const [modalidad, setModalidad] = useState<ModalidadEspacio>('mensual');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    return listenEspacios(data => {
      setEspacios(data);
      setCargando(false);
    });
  }, []);

  const misEspacios  = user ? espacios.filter(e => e.inquilinoId === user.uid) : [];
  const proxVencer   = espaciosProximosVencer(misEspacios);
  const esMio        = !!selec && !!user && selec.inquilinoId === user.uid;
  const esLibre      = selec?.estado === 'libre';

  function handleTap(e: EspacioAlmacenamiento) {
    setSelec(e);
    setModalidad('mensual');
    setModalVis(true);
  }

  async function handleContratar() {
    if (!selec || !user) return;
    setGuardando(true);
    try {
      await asignarEspacio({
        espacioId: selec.id,
        inquilinoId: user.uid,
        inquilinoNombre: user.displayName ?? user.email ?? 'Inquilino',
        modalidad,
      });
      setModalVis(false);
    } catch (e: any) {
      Alert.alert('No disponible', e.message ?? 'Intenta de nuevo');
    } finally {
      setGuardando(false);
    }
  }

  function handleLiberar() {
    if (!selec) return;
    const label = selec.tipo === 'locker' ? 'locker' : 'refrigerador';
    Alert.alert(
      'Liberar espacio',
      `¿Confirmas liberar ${label} #${selec.numero}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Liberar', style: 'destructive',
          onPress: () => {
            setModalVis(false);
            liberarEspacio(selec.id).catch(() => {});
          },
        },
      ],
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {/* Aviso vencimiento */}
      {proxVencer.length > 0 && (
        <View style={styles.avisoBanner}>
          <Ionicons name="time-outline" size={16} color={cartasBosque.alertaBorde} />
          <Text style={styles.avisoText}>
            Vence pronto: {proxVencer
              .map(e => `${e.tipo === 'locker' ? 'locker' : 'refri'} #${e.numero}`)
              .join(' · ')}
          </Text>
        </View>
      )}

      {/* Mis espacios */}
      {misEspacios.length > 0 && (
        <View style={styles.misCard}>
          <Text style={styles.misTitle}>Mis espacios</Text>
          {misEspacios.map(e => (
            <View key={e.id} style={styles.misRow}>
              <Ionicons
                name={e.tipo === 'locker' ? 'archive-outline' : 'snow-outline'}
                size={14}
                color={cartasBosque.helecho}
              />
              <Text style={styles.misLabel}>
                {e.tipo === 'locker' ? 'Locker' : 'Refri'} #{e.numero}
              </Text>
              <Text style={styles.misModalidad}>{e.modalidad ?? '—'}</Text>
              <View style={{ flex: 1 }} />
              {e.fechaVencimiento && (
                <Text style={styles.misVence}>
                  vence {e.fechaVencimiento.toDate().toLocaleDateString('es-MX', {
                    day: 'numeric', month: 'short',
                  })}
                </Text>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Cuadrículas */}
      {cargando ? (
        <ActivityIndicator color={cartasBosque.bosque} style={{ marginTop: spacing[8] }} />
      ) : (
        <>
          <CuadriculaAlmacenamiento
            espacios={espacios}
            tipo="locker"
            miInquilinoId={user?.uid}
            onPress={handleTap}
          />
          <CuadriculaAlmacenamiento
            espacios={espacios}
            tipo="refrigerador"
            miInquilinoId={user?.uid}
            onPress={handleTap}
          />
        </>
      )}

      <Text style={styles.facturaNote}>
        Factura: {FACTURADOR} · IVA 16% incluido
      </Text>

      {/* Modal contratar / detalle */}
      <Modal
        visible={modalVis}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVis(false)}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setModalVis(false)}
        />
        <View style={styles.sheet}>
          {selec && (
            <>
              <Text style={styles.sheetTitulo}>
                {selec.tipo === 'locker' ? 'Locker' : 'Refrigerador'} #{selec.numero}
              </Text>

              {esMio ? (
                <>
                  <Text style={styles.sheetSub}>Modalidad: {selec.modalidad ?? '—'}</Text>
                  {selec.fechaVencimiento && (
                    <Text style={styles.sheetSub}>
                      Vencimiento: {selec.fechaVencimiento.toDate().toLocaleDateString('es-MX', {
                        weekday: 'short', day: 'numeric', month: 'long',
                      })}
                    </Text>
                  )}
                  <Text style={styles.sheetSub}>
                    Monto: ${selec.monto} MXN (IVA incluido)
                  </Text>
                  <TouchableOpacity style={styles.btnLiberar} onPress={handleLiberar}>
                    <Text style={styles.btnLiberarText}>Liberar espacio</Text>
                  </TouchableOpacity>
                </>
              ) : esLibre ? (
                <>
                  <Text style={styles.sheetSub}>Elige modalidad de pago:</Text>
                  <View style={styles.modalidadRow}>
                    {(['semanal', 'mensual'] as ModalidadEspacio[]).map(m => (
                      <TouchableOpacity
                        key={m}
                        style={[styles.modBtn, modalidad === m && styles.modBtnActivo]}
                        onPress={() => setModalidad(m)}
                      >
                        <Text style={[styles.modText, modalidad === m && styles.modTextActivo]}>
                          {m === 'semanal'
                            ? `Semanal · $${montoConIva('semanal')}`
                            : `Mensual · $${montoConIva('mensual')}`}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={styles.ivaNote}>
                    ${ PRECIO_SEMANA}/sem · ${PRECIO_MES}/mes · más IVA 16%
                  </Text>
                  <TouchableOpacity
                    style={[styles.btnContratar, guardando && { opacity: 0.6 }]}
                    onPress={handleContratar}
                    disabled={guardando}
                  >
                    {guardando
                      ? <ActivityIndicator color={cartasBosque.bruma} />
                      : <Text style={styles.btnContratarText}>Contratar</Text>
                    }
                  </TouchableOpacity>
                </>
              ) : (
                <Text style={styles.sheetSub}>Este espacio está ocupado.</Text>
              )}
            </>
          )}
        </View>
      </Modal>
    </ScrollView>
  );
}

// ─── Estilos ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: cartasBosque.bruma },
  content: { padding: spacing[4], paddingBottom: spacing[10] },
  avisoBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: 'rgba(205,178,157,0.15)', borderRadius: borderRadius.md,
    padding: spacing[3], marginBottom: spacing[3],
    borderWidth: 1, borderColor: '#FFEAA7',
  },
  avisoText: {
    fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12,
    color: cartasBosque.alertaBorde, flex: 1,
  },
  misCard: {
    backgroundColor: cartasBosque.pergamino, borderRadius: borderRadius.md,
    padding: spacing[3], marginBottom: spacing[4],
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
  },
  misTitle: {
    fontFamily: 'MonaSans_400Regular', fontSize: 10, color: cartasBosque.helecho,
    letterSpacing: 0.5, marginBottom: spacing[2],
  },
  misRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: 4,
  },
  misLabel: {
    fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: cartasBosque.tinta,
  },
  misModalidad: {
    fontFamily: 'MonaSans_400Regular', fontSize: 10, color: cartasBosque.helecho,
  },
  misVence: {
    fontFamily: 'MonaSans_400Regular', fontSize: 10, color: cartasBosque.niebla,
  },
  facturaNote: {
    fontFamily: 'MonaSans_400Regular', fontSize: 9, color: cartasBosque.niebla,
    textAlign: 'center', marginTop: spacing[2],
  },
  overlay: { flex: 1, backgroundColor: 'rgba(18,42,31,0.35)' },
  sheet: {
    backgroundColor: cartasBosque.bruma,
    borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl,
    padding: spacing[5], paddingBottom: spacing[8],
  },
  sheetTitulo: {
    fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 18, color: cartasBosque.tinta,
    marginBottom: spacing[2],
  },
  sheetSub: {
    fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: cartasBosque.helecho,
    marginBottom: spacing[1],
  },
  modalidadRow: { flexDirection: 'row', gap: spacing[2], marginVertical: spacing[3] },
  modBtn: {
    flex: 1, paddingVertical: spacing[2] + 2, alignItems: 'center',
    borderRadius: borderRadius.sm, borderWidth: 1,
    borderColor: cartasBosque.pergaminoOscuro, backgroundColor: cartasBosque.pergamino,
  },
  modBtnActivo: { borderColor: cartasBosque.bosque, backgroundColor: cartasBosque.bosque },
  modText: {
    fontFamily: 'MonaSans_400Regular', fontSize: 11, color: cartasBosque.helecho,
  },
  modTextActivo: { color: cartasBosque.bruma },
  ivaNote: {
    fontFamily: 'MonaSans_400Regular', fontSize: 9, color: cartasBosque.niebla,
    textAlign: 'center', marginBottom: spacing[3],
  },
  btnContratar: {
    backgroundColor: cartasBosque.bosque, borderRadius: borderRadius.sm,
    paddingVertical: spacing[3], alignItems: 'center',
  },
  btnContratarText: {
    fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 14, color: cartasBosque.bruma,
  },
  btnLiberar: {
    marginTop: spacing[3], borderWidth: 1, borderColor: cartasBosque.alertaBorde,
    borderRadius: borderRadius.sm, paddingVertical: spacing[2] + 2, alignItems: 'center',
  },
  btnLiberarText: {
    fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: cartasBosque.alertaBorde,
  },
});
