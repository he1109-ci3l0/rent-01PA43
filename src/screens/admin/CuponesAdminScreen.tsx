import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, TextInput, ActivityIndicator, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Timestamp } from 'firebase/firestore';
import { cartasBosque } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/spacing';
import type { Cupon, TipoCupon, ConceptoCupon } from '@/types/firestore';
import { listenCupones, crearCupon, toggleDisponible, seedCupones } from '@/services/firebase/cupones';

type Vista = 'lista' | 'nuevo';

const TIPOS: TipoCupon[] = ['monto', 'porcentaje'];
const CONCEPTOS: ConceptoCupon[] = ['renta', 'servicios', 'total'];

function formatFecha(ts: Timestamp | undefined): string {
  if (!ts) return '—';
  return ts.toDate().toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

function estadoCupon(c: Cupon): { label: string; color: string } {
  if (!c.disponible) return { label: 'inactivo', color: cartasBosque.niebla };
  const ahora = Date.now();
  if (c.vigenciaFin.toDate().getTime() < ahora) return { label: 'vencido', color: cartasBosque.corteza };
  if (c.limiteUsos !== null && c.usosActuales >= c.limiteUsos) return { label: 'agotado', color: '#670010' };
  return { label: 'activo', color: cartasBosque.bosque };
}

// ─── Componente ───────────────────────────────────────────────

export default function CuponesAdminScreen() {
  const [cupones, setCupones] = useState<Cupon[]>([]);
  const [cargando, setCargando] = useState(true);
  const [vista, setVista] = useState<Vista>('lista');
  const [seeded, setSeeded] = useState(false);

  // Form nuevo cupón
  const [nombre, setNombre] = useState('');
  const [codigo, setCodigo] = useState('');
  const [tipo, setTipo] = useState<TipoCupon>('porcentaje');
  const [valor, setValor] = useState('');
  const [concepto, setConcepto] = useState<ConceptoCupon>('total');
  const [disponible, setDisponible] = useState(true);
  const [reutilizable, setReutilizable] = useState(false);
  const [limiteUsos, setLimiteUsos] = useState('');
  const [apilable, setApilable] = useState(false);
  const [vigDias, setVigDias] = useState('365');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (__DEV__ && !seeded) {
      seedCupones().catch(() => {}).finally(() => setSeeded(true));
    }
    return listenCupones(data => { setCupones(data); setCargando(false); });
  }, []);

  async function handleCrear() {
    if (!nombre.trim() || !codigo.trim() || !valor.trim()) {
      setError('Nombre, código y valor son requeridos.');
      return;
    }
    setEnviando(true);
    setError('');
    try {
      const ahora = Timestamp.now();
      const fin = Timestamp.fromDate(
        new Date(Date.now() + Number(vigDias || 365) * 24 * 60 * 60 * 1000),
      );
      await crearCupon({
        nombre: nombre.trim(),
        codigo: codigo.trim().toUpperCase(),
        tipo,
        valor: Number(valor),
        concepto,
        disponible,
        reutilizable,
        limiteUsos: limiteUsos.trim() ? Number(limiteUsos) : null,
        vigenciaInicio: ahora,
        vigenciaFin: fin,
        eligibilidad: 'todos',
        apilable,
      });
      // Reset form
      setNombre(''); setCodigo(''); setValor(''); setLimiteUsos(''); setVigDias('365');
      setVista('lista');
    } catch (e: any) {
      setError('Error: ' + (e.message ?? 'intenta de nuevo'));
    } finally {
      setEnviando(false);
    }
  }

  // ── Form nuevo ───────────────────────────────────────────────

  if (vista === 'nuevo') {
    return (
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.formHeader}>
          <TouchableOpacity onPress={() => { setVista('lista'); setError(''); }}>
            <Ionicons name="arrow-back" size={20} color={cartasBosque.tinta} />
          </TouchableOpacity>
          <Text style={styles.formTitulo}>Nuevo cupón</Text>
        </View>

        <FLabel>Nombre del cupón</FLabel>
        <FInput value={nombre} onChange={setNombre} placeholder="ej. Bienvenida 10%" />

        <FLabel>Código</FLabel>
        <FInput value={codigo} onChange={t => setCodigo(t.toUpperCase())} placeholder="CÓDIGO" caps="characters" mono />

        <FLabel>Tipo</FLabel>
        <View style={styles.chipRow}>
          {TIPOS.map(t => (
            <TouchableOpacity key={t} style={[styles.chip, tipo === t && styles.chipActivo]} onPress={() => setTipo(t)}>
              <Text style={[styles.chipText, tipo === t && styles.chipTextActivo]}>
                {t === 'monto' ? '$ Monto fijo' : '% Porcentaje'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <FLabel>Valor ({tipo === 'monto' ? 'MXN' : '%'})</FLabel>
        <FInput value={valor} onChange={setValor} placeholder={tipo === 'monto' ? '200' : '10'} keyboard="numeric" />

        <FLabel>Concepto</FLabel>
        <View style={styles.chipRow}>
          {CONCEPTOS.map(c => (
            <TouchableOpacity key={c} style={[styles.chip, concepto === c && styles.chipActivo]} onPress={() => setConcepto(c)}>
              <Text style={[styles.chipText, concepto === c && styles.chipTextActivo]}>
                {c === 'renta' ? 'Renta' : c === 'servicios' ? 'Servicios' : 'Total'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <FLabel>Vigencia (días desde hoy)</FLabel>
        <FInput value={vigDias} onChange={setVigDias} placeholder="365" keyboard="numeric" />

        <FLabel>Límite de usos (vacío = ilimitado)</FLabel>
        <FInput value={limiteUsos} onChange={setLimiteUsos} placeholder="—" keyboard="numeric" />

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Disponible</Text>
          <Switch value={disponible} onValueChange={setDisponible} trackColor={{ true: cartasBosque.bosque }} />
        </View>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Reutilizable (mismo inquilino)</Text>
          <Switch value={reutilizable} onValueChange={setReutilizable} trackColor={{ true: cartasBosque.bosque }} />
        </View>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Apilable con otros cupones</Text>
          <Switch value={apilable} onValueChange={setApilable} trackColor={{ true: cartasBosque.bosque }} />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.btnPrimario, enviando && { opacity: 0.6 }]}
          onPress={handleCrear}
          disabled={enviando}
        >
          {enviando
            ? <ActivityIndicator color={cartasBosque.bruma} />
            : <Text style={styles.btnPrimarioText}>Crear cupón</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ── Lista ────────────────────────────────────────────────────

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.listaHeader}>
        <Text style={styles.listaCount}>{cupones.length} cupón(es)</Text>
        <TouchableOpacity style={styles.btnNuevo} onPress={() => setVista('nuevo')}>
          <Ionicons name="add" size={16} color={cartasBosque.bruma} />
          <Text style={styles.btnNuevoText}>Nuevo</Text>
        </TouchableOpacity>
      </View>

      {cargando ? (
        <View style={styles.center}><ActivityIndicator color={cartasBosque.bosque} /></View>
      ) : cupones.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="pricetag-outline" size={36} color={cartasBosque.niebla} />
          <Text style={styles.vacioText}>Sin cupones</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {cupones.map(c => {
            const est = estadoCupon(c);
            return (
              <View key={c.id} style={styles.cuponCard}>
                <View style={styles.cuponHeader}>
                  <View style={styles.cuponHeaderLeft}>
                    <Text style={styles.cuponCodigo}>{c.codigo}</Text>
                    <Text style={styles.cuponNombre}>{c.nombre}</Text>
                  </View>
                  <View style={[styles.estadoBadge, { backgroundColor: est.color }]}>
                    <Text style={styles.estadoLabel}>{est.label}</Text>
                  </View>
                </View>
                <View style={styles.cuponRow}>
                  <InfoChip label={c.tipo === 'monto' ? `$${c.valor}` : `${c.valor}%`} />
                  <InfoChip label={c.concepto} />
                  {c.apilable && <InfoChip label="apilable" />}
                  {!c.reutilizable && <InfoChip label="1 uso/inquilino" />}
                </View>
                <Text style={styles.cuponVig}>
                  Vence: {formatFecha(c.vigenciaFin)} ·{' '}
                  {c.limiteUsos !== null ? `${c.usosActuales}/${c.limiteUsos} usos` : `${c.usosActuales} usos`}
                </Text>
                <View style={styles.toggleRow}>
                  <Text style={styles.switchLabel}>Disponible</Text>
                  <Switch
                    value={c.disponible}
                    onValueChange={v => toggleDisponible(c.id, v)}
                    trackColor={{ true: cartasBosque.bosque }}
                  />
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

// ─── Helpers UI ───────────────────────────────────────────────

function FLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.fLabel}>{children}</Text>;
}

function FInput({ value, onChange, placeholder, keyboard, caps, mono }: {
  value: string; onChange: (t: string) => void;
  placeholder: string; keyboard?: any; caps?: any; mono?: boolean;
}) {
  return (
    <TextInput
      style={[styles.fInput, mono && { fontFamily: 'DMMono_400Regular', letterSpacing: 1 }]}
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={cartasBosque.niebla}
      keyboardType={keyboard ?? 'default'}
      autoCapitalize={caps ?? 'sentences'}
    />
  );
}

function InfoChip({ label }: { label: string }) {
  return (
    <View style={styles.infoChip}>
      <Text style={styles.infoChipText}>{label}</Text>
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  scrollContent: { padding: spacing[4], paddingBottom: spacing[8] },
  formHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginBottom: spacing[4] },
  formTitulo: { fontFamily: 'DMSans_600SemiBold', fontSize: 16, color: cartasBosque.tinta },
  fLabel: {
    fontFamily: 'DMMono_400Regular', fontSize: 10, color: cartasBosque.helecho,
    letterSpacing: 0.5, marginTop: spacing[3], marginBottom: spacing[1],
  },
  fInput: {
    backgroundColor: cartasBosque.pergamino, borderRadius: borderRadius.sm,
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    fontFamily: 'DMSans_400Regular', fontSize: 13, color: cartasBosque.tinta,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  chip: {
    borderRadius: borderRadius.sm, borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
    paddingHorizontal: spacing[3], paddingVertical: spacing[1] + 2, backgroundColor: cartasBosque.pergamino,
  },
  chipActivo: { backgroundColor: cartasBosque.bosque, borderColor: cartasBosque.bosque },
  chipText: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: cartasBosque.tinta },
  chipTextActivo: { color: cartasBosque.bruma },
  switchRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacing[2], borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro,
  },
  switchLabel: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: cartasBosque.tinta },
  errorText: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: cartasBosque.corteza, marginTop: spacing[2] },
  btnPrimario: {
    marginTop: spacing[4], backgroundColor: cartasBosque.bosque,
    borderRadius: borderRadius.sm, paddingVertical: spacing[3], alignItems: 'center',
  },
  btnPrimarioText: { fontFamily: 'DMSans_600SemiBold', fontSize: 14, color: cartasBosque.bruma },
  listaHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: cartasBosque.pergaminoOscuro,
  },
  listaCount: { fontFamily: 'DMMono_400Regular', fontSize: 12, color: cartasBosque.helecho },
  btnNuevo: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: cartasBosque.bosque, borderRadius: borderRadius.sm,
    paddingHorizontal: spacing[3], paddingVertical: spacing[1] + 2,
  },
  btnNuevoText: { fontFamily: 'DMSans_600SemiBold', fontSize: 12, color: cartasBosque.bruma },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[2] },
  vacioText: { fontFamily: 'DMSans_400Regular', fontSize: 14, color: cartasBosque.helecho },
  cuponCard: {
    backgroundColor: cartasBosque.pergamino, borderRadius: borderRadius.md,
    padding: spacing[3], marginBottom: spacing[3],
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
  },
  cuponHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: spacing[1] },
  cuponHeaderLeft: { flex: 1 },
  cuponCodigo: { fontFamily: 'DMMono_400Regular', fontSize: 14, color: cartasBosque.tinta, letterSpacing: 1 },
  cuponNombre: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: cartasBosque.helecho },
  estadoBadge: { borderRadius: borderRadius.sm, paddingHorizontal: spacing[2], paddingVertical: 2 },
  estadoLabel: { fontFamily: 'DMMono_400Regular', fontSize: 10, color: cartasBosque.bruma },
  cuponRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[1], marginBottom: spacing[1] },
  infoChip: {
    borderRadius: borderRadius.sm, paddingHorizontal: spacing[2], paddingVertical: 2,
    backgroundColor: cartasBosque.niebla,
  },
  infoChipText: { fontFamily: 'DMMono_400Regular', fontSize: 10, color: cartasBosque.tinta },
  cuponVig: { fontFamily: 'DMMono_400Regular', fontSize: 10, color: cartasBosque.helecho, marginBottom: spacing[1] },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: spacing[1],
  },
});
