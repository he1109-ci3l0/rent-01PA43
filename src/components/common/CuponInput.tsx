import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { cartasBosque } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/spacing';
import type { ConceptoCupon } from '@/types/firestore';
import { validarCupon, type ResultadoValidacion } from '@/services/firebase/cupones';

interface CuponInputProps {
  habitacionId: string;
  concepto: ConceptoCupon;
  montoBruto: number;
  onAplicado: (resultado: ResultadoValidacion & { valido: true }) => void;
  onLimpiado: () => void;
}

export default function CuponInput({
  habitacionId,
  concepto,
  montoBruto,
  onAplicado,
  onLimpiado,
}: CuponInputProps) {
  const [codigo, setCodigo] = useState('');
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoValidacion | null>(null);

  async function handleValidar() {
    if (!codigo.trim()) return;
    setCargando(true);
    try {
      const r = await validarCupon(codigo.trim(), habitacionId, concepto, montoBruto);
      setResultado(r);
      if (r.valido) onAplicado(r);
    } finally {
      setCargando(false);
    }
  }

  function handleLimpiar() {
    setCodigo('');
    setResultado(null);
    onLimpiado();
  }

  const aplicado = resultado?.valido === true;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Código de cupón</Text>
      <View style={styles.row}>
        <TextInput
          style={[styles.input, aplicado && styles.inputAplicado]}
          value={codigo}
          onChangeText={t => { setCodigo(t.toUpperCase()); if (resultado) handleLimpiar(); }}
          placeholder="CÓDIGO"
          placeholderTextColor={cartasBosque.niebla}
          autoCapitalize="characters"
          editable={!aplicado}
        />
        {aplicado ? (
          <TouchableOpacity style={styles.btnLimpiar} onPress={handleLimpiar}>
            <Ionicons name="close-circle" size={20} color={cartasBosque.helecho} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.btnAplicar, (!codigo.trim() || cargando) && { opacity: 0.5 }]}
            onPress={handleValidar}
            disabled={!codigo.trim() || cargando}
          >
            {cargando
              ? <ActivityIndicator size="small" color={cartasBosque.bruma} />
              : <Text style={styles.btnAplicarText}>Aplicar</Text>
            }
          </TouchableOpacity>
        )}
      </View>

      {resultado && (
        resultado.valido ? (
          <View style={styles.exitoBox}>
            <Ionicons name="checkmark-circle" size={16} color={cartasBosque.bosque} />
            <Text style={styles.exitoText}>
              {resultado.cupon.nombre} — descuento{' '}
              <Text style={styles.exitoMonto}>
                {resultado.cupon.tipo === 'porcentaje'
                  ? `${resultado.cupon.valor}% (−$${resultado.descuento})`
                  : `−$${resultado.descuento}`}
              </Text>
            </Text>
          </View>
        ) : (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={16} color={cartasBosque.alertaBorde} />
            <Text style={styles.errorText}>{resultado.mensaje}</Text>
          </View>
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing[3],
  },
  label: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 11,
    color: cartasBosque.helecho,
    letterSpacing: 0.5,
    marginBottom: spacing[1],
  },
  row: {
    flexDirection: 'row',
    gap: spacing[2],
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: cartasBosque.pergamino,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: cartasBosque.pergaminoOscuro,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 14,
    color: cartasBosque.tinta,
    letterSpacing: 1,
  },
  inputAplicado: {
    borderColor: cartasBosque.bosque,
    backgroundColor: '#EEF4EE',
  },
  btnAplicar: {
    backgroundColor: cartasBosque.helecho,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2] + 1,
    minWidth: 72,
    alignItems: 'center',
  },
  btnAplicarText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: cartasBosque.bruma,
  },
  btnLimpiar: {
    padding: spacing[1],
  },
  exitoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    marginTop: spacing[1],
  },
  exitoText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: cartasBosque.bosque,
    flex: 1,
  },
  exitoMonto: {
    fontFamily: 'Inter_600SemiBold',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    marginTop: spacing[1],
  },
  errorText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: cartasBosque.alertaBorde,
  },
});
