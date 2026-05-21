import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { cartasBosque } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/spacing';
import type { DocumentoExpediente } from '@/types/firestore';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const TIPO_ICON: Record<string, IoniconsName> = {
  INE_FRENTE:            'card-outline',
  INE_REVERSO:           'card-outline',
  CURP:                  'person-outline',
  COMPROBANTE_DOMICILIO: 'home-outline',
  PRENDA_1_1:            'shield-outline',
  PRENDA_1_2:            'shield-outline',
  CONTRATO:              'document-text-outline',
  REGLAMENTO:            'book-outline',
  AVISO_PRIVACIDAD:      'lock-closed-outline',
  ADDENDUM_SERVICIOS:    'add-circle-outline',
  CLAUSULA_CUPONES:      'pricetag-outline',
};

const ESTADO_LABEL: Record<DocumentoExpediente['estado'], string> = {
  pendiente: 'Pendiente',
  subido:    'Disponible',
  rechazado: 'Rechazado',
};

const ESTADO_COLORS: Record<DocumentoExpediente['estado'], { bg: string; text: string }> = {
  pendiente: { bg: cartasBosque.niebla + '55', text: cartasBosque.helecho },
  subido:    { bg: '#D6EDD9',                  text: '#3A7D44'            },
  rechazado: { bg: '#F5DAD8',                  text: '#A63228'            },
};

interface Props {
  doc: DocumentoExpediente;
  esAdmin: boolean;
  onDescargar: () => void;
  onSubir?: () => void;
  onResetContador?: () => void;
}

export default function DocumentoCard({
  doc, esAdmin, onDescargar, onSubir, onResetContador,
}: Props) {
  const icono = TIPO_ICON[doc.tipo] ?? 'document-outline';
  const disponible = doc.estado === 'subido' && !!doc.url;
  const agotado = disponible && !esAdmin && doc.descargas >= doc.maxDescargas;
  const restantes = doc.maxDescargas - doc.descargas;
  const colores = ESTADO_COLORS[doc.estado];

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.iconBox}>
          <Ionicons name={icono} size={18} color={cartasBosque.bosque} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.nombre}>{doc.nombre}</Text>
          <View style={styles.metaRow}>
            <View style={[styles.chip, { backgroundColor: colores.bg }]}>
              <Text style={[styles.chipText, { color: colores.text }]}>
                {ESTADO_LABEL[doc.estado]}
              </Text>
            </View>
            {disponible && !esAdmin && (
              <Text style={[styles.restante, agotado && { color: '#A63228' }]}>
                {agotado
                  ? 'Límite alcanzado'
                  : `${restantes} descarga${restantes !== 1 ? 's' : ''} restante${restantes !== 1 ? 's' : ''}`
                }
              </Text>
            )}
            {esAdmin && disponible && (
              <Text style={styles.restante}>
                {doc.descargas}/{doc.maxDescargas} descargas
              </Text>
            )}
          </View>
        </View>

        {/* Botón de acción */}
        {disponible && !esAdmin && (
          <TouchableOpacity
            style={[styles.accionBtn, agotado && styles.accionBtnDisabled]}
            onPress={agotado ? undefined : onDescargar}
            disabled={agotado}
          >
            <Ionicons
              name={agotado ? 'lock-closed-outline' : 'download-outline'}
              size={16}
              color={agotado ? cartasBosque.niebla : cartasBosque.bosque}
            />
          </TouchableOpacity>
        )}

        {esAdmin && (
          <TouchableOpacity
            style={styles.accionBtn}
            onPress={disponible ? onDescargar : onSubir}
          >
            <Ionicons
              name={disponible ? 'eye-outline' : 'cloud-upload-outline'}
              size={16}
              color={cartasBosque.bosque}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Resetear contador — solo admin, solo si tiene descargas */}
      {esAdmin && doc.descargas > 0 && (
        <TouchableOpacity style={styles.resetRow} onPress={onResetContador}>
          <Ionicons name="refresh-outline" size={11} color={cartasBosque.helecho} />
          <Text style={styles.resetText}>Resetear contador</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: cartasBosque.pergamino,
    borderRadius: borderRadius.md,
    padding: spacing[3],
    marginBottom: spacing[2],
    borderWidth: 1,
    borderColor: cartasBosque.pergaminoOscuro,
  },
  row:     { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  iconBox: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: cartasBosque.niebla + '44',
    alignItems: 'center', justifyContent: 'center',
  },
  nombre:  { fontFamily: 'DMSans_600SemiBold', fontSize: 13, color: cartasBosque.tinta, marginBottom: 3 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  chip: {
    paddingHorizontal: spacing[2], paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  chipText: { fontFamily: 'DMMono_400Regular', fontSize: 9, letterSpacing: 0.4 },
  restante: { fontFamily: 'DMMono_400Regular', fontSize: 9, color: cartasBosque.helecho },
  accionBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: cartasBosque.niebla + '44',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: cartasBosque.pergaminoOscuro,
  },
  accionBtnDisabled: { opacity: 0.35 },
  resetRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: spacing[2], alignSelf: 'flex-end',
  },
  resetText: {
    fontFamily: 'DMMono_400Regular', fontSize: 10, color: cartasBosque.helecho,
    textDecorationLine: 'underline',
  },
});
