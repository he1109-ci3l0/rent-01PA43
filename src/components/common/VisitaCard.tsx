import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { cartasBosque } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/spacing';
import type { Visita, EstadoEstacionaria } from '@/types/firestore';
import {
  calcularHorasActiva,
  calcularEstadoEstacionaria,
  registrarSalida,
  elegirRuta,
  MONTO_CARGO_ESTACIONARIA,
} from '@/services/firebase/visitas';

// ─── Colores por estado ───────────────────────────────────────

const ESTADO_COLORS: Record<EstadoEstacionaria, string> = {
  normal:        cartasBosque.helecho,
  alerta_40h:    '#CDB29D',
  alerta_50h:    '#C87941',
  cargo_72h:     '#670010',
  deposito_102h: cartasBosque.alertaBorde,
};

const ESTADO_LABELS: Record<EstadoEstacionaria, string> = {
  normal:        'activo',
  alerta_40h:    'alerta 40h',
  alerta_50h:    'alerta 50h',
  cargo_72h:     'cargo $200',
  deposito_102h: 'depósito',
};

function formatHoras(horas: number): string {
  const h = Math.floor(horas);
  const m = Math.floor((horas - h) * 60);
  return `${h}h ${m}m`;
}

function formatFecha(ts: { toDate: () => Date } | null): string {
  if (!ts) return '—';
  const d = ts.toDate();
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }) +
    ' · ' + d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

// ─── Textos del protocolo ─────────────────────────────────────

function AlertaTexto({ estado }: { estado: EstadoEstacionaria }) {
  if (estado === 'normal') return null;

  const textos: Partial<Record<EstadoEstacionaria, string>> = {
    alerta_40h:    'Tu visita lleva más de 40 horas. Si continúa, se aplicará un cargo.',
    alerta_50h:    'Aviso final: más de 50 horas. El cargo de $200 se aplicará a las 72h.',
    cargo_72h:     `Se aplicó un cargo de $${MONTO_CARGO_ESTACIONARIA} M.N. y se abrió un perfil temporal en el expediente.`,
    deposito_102h: 'Más de 102 horas sin pago. El depósito será afectado. Elige tu camino:',
  };

  return (
    <View style={styles.alertaBox}>
      <Text style={styles.alertaText}>{textos[estado]}</Text>
      <Text style={styles.verMas}>ver más →  §4.3 Contrato de Hospedaje</Text>
    </View>
  );
}

// ─── Props ────────────────────────────────────────────────────

interface VisitaCardProps {
  visita: Visita;
  modo?: 'tenant' | 'admin';
  onActualizar?: () => void;
}

// ─── Componente ───────────────────────────────────────────────

export default function VisitaCard({ visita, modo = 'tenant', onActualizar }: VisitaCardProps) {
  const [horas, setHoras] = useState(() => calcularHorasActiva(visita.fechaEntrada));
  const [estado, setEstado] = useState<EstadoEstacionaria>(() =>
    visita.fechaSalida ? 'normal' : calcularEstadoEstacionaria(horas),
  );
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (visita.fechaSalida) return;
    const tick = setInterval(() => {
      const h = calcularHorasActiva(visita.fechaEntrada);
      setHoras(h);
      setEstado(calcularEstadoEstacionaria(h));
    }, 60_000);
    return () => clearInterval(tick);
  }, [visita.fechaEntrada, visita.fechaSalida]);

  const colorEstado = visita.fechaSalida ? cartasBosque.niebla : ESTADO_COLORS[estado];
  const bgCard = visita.esRecurrente ? '#CDB29D' : cartasBosque.pergamino;
  const activa = !visita.fechaSalida;

  async function handleSalida() {
    setCargando(true);
    try {
      await registrarSalida(visita.id);
      onActualizar?.();
    } finally {
      setCargando(false);
    }
  }

  async function handleRuta(ruta: 'A' | 'B') {
    setCargando(true);
    try {
      await elegirRuta(visita.id, ruta);
      onActualizar?.();
    } finally {
      setCargando(false);
    }
  }

  const nombre = visita.nombreVisitante || visita.documentoNumero;

  return (
    <View style={[styles.card, { backgroundColor: bgCard }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.nombre}>{nombre}</Text>
          {visita.esRecurrente && (
            <Text style={styles.recurrenteBadge}>recurrente</Text>
          )}
        </View>
        <View style={[styles.estadoBadge, { backgroundColor: colorEstado }]}>
          <Text style={styles.estadoLabel}>
            {visita.fechaSalida ? 'finalizada' : ESTADO_LABELS[estado]}
          </Text>
        </View>
      </View>

      {/* Info */}
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Documento</Text>
        <Text style={styles.infoValue}>{visita.documentoTipo} · {visita.documentoNumero}</Text>
      </View>
      {modo === 'admin' && (visita.inquilinoNombre || visita.habitacionNumero) && (
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Inquilino</Text>
          <Text style={styles.infoValue}>
            {visita.inquilinoNombre ?? '—'} · Hab. {visita.habitacionNumero ?? '—'}
          </Text>
        </View>
      )}
      {visita.motivo ? (
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Motivo</Text>
          <Text style={styles.infoValue}>{visita.motivo}</Text>
        </View>
      ) : null}
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Entrada</Text>
        <Text style={styles.infoValue}>{formatFecha(visita.fechaEntrada)}</Text>
      </View>
      {activa ? (
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Tiempo activo</Text>
          <Text style={[styles.infoValue, { color: colorEstado, fontFamily: 'MonaSans_400Regular' }]}>
            {formatHoras(horas)}
          </Text>
        </View>
      ) : (
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Salida</Text>
          <Text style={styles.infoValue}>{formatFecha(visita.fechaSalida)}</Text>
        </View>
      )}

      {/* Alerta protocolo */}
      {activa && <AlertaTexto estado={estado} />}

      {/* Camino A / B — solo en 102h */}
      {activa && estado === 'deposito_102h' && !visita.rutaElegida && modo === 'tenant' && (
        <View style={styles.rutaRow}>
          <TouchableOpacity
            style={[styles.rutaBtn, { borderColor: cartasBosque.bosque }]}
            onPress={() => handleRuta('A')}
            disabled={cargando}
          >
            <Text style={[styles.rutaBtnText, { color: cartasBosque.bosque }]}>
              Camino A — acepto
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.rutaBtn, { borderColor: cartasBosque.alertaBorde }]}
            onPress={() => handleRuta('B')}
            disabled={cargando}
          >
            <Text style={[styles.rutaBtnText, { color: cartasBosque.alertaBorde }]}>
              Camino B — impugno
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Ruta elegida */}
      {visita.rutaElegida && (
        <Text style={styles.rutaElegida}>
          Camino {visita.rutaElegida} elegido
        </Text>
      )}

      {/* Checkout — solo tenant, solo activa */}
      {activa && modo === 'tenant' && (
        <TouchableOpacity
          style={styles.checkoutBtn}
          onPress={handleSalida}
          disabled={cargando}
        >
          <Text style={styles.checkoutBtnText}>
            {cargando ? 'Registrando…' : 'Registrar salida'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.md,
    padding: spacing[4],
    marginBottom: spacing[3],
    borderWidth: 1,
    borderColor: cartasBosque.pergaminoOscuro,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing[2],
  },
  headerLeft: {
    flex: 1,
    gap: 4,
  },
  nombre: {
    fontFamily: 'BricolageGrotesque_600SemiBold',
    fontSize: 15,
    color: cartasBosque.tinta,
  },
  recurrenteBadge: {
    fontFamily: 'MonaSans_400Regular',
    fontSize: 10,
    color: cartasBosque.alertaBorde,
    letterSpacing: 0.5,
  },
  estadoBadge: {
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing[2],
    paddingVertical: 3,
    marginLeft: spacing[2],
  },
  estadoLabel: {
    fontFamily: 'MonaSans_400Regular',
    fontSize: 10,
    color: cartasBosque.bruma,
    letterSpacing: 0.5,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing[1],
  },
  infoLabel: {
    fontFamily: 'MonaSans_400Regular',
    fontSize: 11,
    color: cartasBosque.helecho,
  },
  infoValue: {
    fontFamily: 'BricolageGrotesque_400Regular',
    fontSize: 12,
    color: cartasBosque.tinta,
    flexShrink: 1,
    textAlign: 'right',
  },
  alertaBox: {
    marginTop: spacing[3],
    padding: spacing[3],
    backgroundColor: cartasBosque.bruma,
    borderRadius: borderRadius.sm,
    borderLeftWidth: 3,
    borderLeftColor: cartasBosque.alertaBorde,
    gap: 4,
  },
  alertaText: {
    fontFamily: 'BricolageGrotesque_400Regular',
    fontSize: 12,
    color: cartasBosque.tinta,
    lineHeight: 18,
  },
  verMas: {
    fontFamily: 'MonaSans_400Regular',
    fontSize: 10,
    color: cartasBosque.helecho,
    marginTop: 2,
  },
  rutaRow: {
    flexDirection: 'row',
    gap: spacing[2],
    marginTop: spacing[3],
  },
  rutaBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing[2],
    alignItems: 'center',
  },
  rutaBtnText: {
    fontFamily: 'BricolageGrotesque_600SemiBold',
    fontSize: 12,
  },
  rutaElegida: {
    marginTop: spacing[2],
    fontFamily: 'MonaSans_400Regular',
    fontSize: 11,
    color: cartasBosque.helecho,
    textAlign: 'center',
  },
  checkoutBtn: {
    marginTop: spacing[3],
    backgroundColor: cartasBosque.bosque,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing[2] + 2,
    alignItems: 'center',
  },
  checkoutBtnText: {
    fontFamily: 'BricolageGrotesque_600SemiBold',
    fontSize: 13,
    color: cartasBosque.bruma,
  },
});
