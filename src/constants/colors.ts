// Cartas Bosque — paleta definitiva · Junio 2026
export const cartasBosque = {
  // Fondos
  bruma:           '#F5F2EC',   // fondo general
  pergamino:       '#F5F2EC',   // cards (alias de bruma)
  pergaminoOscuro: '#E0DDD5',   // bordes suaves / separadores
  crema:           '#E8EBE0',   // texto claro sobre fondos medios

  // Verdes
  bosque:   '#2E3C2C',   // botones primarios
  helecho:  '#4A5E48',   // elementos secundarios / labels
  salvia:   '#8A9E80',   // texto secundario sobre fondos oscuros

  // Oscuros
  tinta:   '#14352A',   // texto principal / casi negro
  sidebar: '#122A1F',   // negro bosque / header / nav bar

  // Cálidos
  arena:  '#CDB29D',   // arena cálida / tipografía sobre alerta
  niebla: '#CDB29D',   // alias de arena (compatibilidad)
  acento: '#8A6A72',   // malva / acento secundario

  // Alertas
  alertaFondo: '#670010',   // fondo alertas críticas
  alertaBorde: '#960018',   // borde alertas / corteza
  corteza:     '#960018',   // alias de alertaBorde (compatibilidad)
} as const;

// Paleta secundaria — métricas y dashboards
// INTENCIONAL: estos colores dan carácter visual a las estadísticas
// NO reemplazar con tokens de cartasBosque
export const metricColors = {
  rojo:    '#C0392B',   // vencidos / pagos críticos
  azul:    '#3B82F6',   // servicios / info neutral
  verde:   '#4A9B6F',   // libre / disponible / OK
  ambar:   '#E8A838',   // advertencia / pendiente
  naranja: '#E05C2A',   // en proceso / en riesgo
} as const;

export const colors = {
  // Brand
  primary:      cartasBosque.bosque,
  primaryLight: cartasBosque.salvia,
  primaryDark:  cartasBosque.sidebar,
  primaryMid:   cartasBosque.helecho,

  // Accent
  accent:      cartasBosque.arena,
  accentLight: cartasBosque.pergaminoOscuro,

  // Status
  success:      cartasBosque.helecho,
  successLight: cartasBosque.crema,
  warning:      cartasBosque.acento,
  warningLight: cartasBosque.crema,
  error:        cartasBosque.alertaBorde,
  errorLight:   'rgba(150,0,24,0.15)',
  info:         cartasBosque.salvia,
  infoLight:    cartasBosque.salvia,

  // Neutrals
  white: '#FFFFFF',
  black: '#000000',
  gray50:  cartasBosque.bruma,
  gray100: '#F5F2EC',
  gray200: cartasBosque.pergaminoOscuro,
  gray300: cartasBosque.crema,
  gray400: cartasBosque.acento,
  gray500: cartasBosque.helecho,
  gray600: cartasBosque.helecho,
  gray700: cartasBosque.bosque,
  gray800: cartasBosque.sidebar,
  gray900: cartasBosque.tinta,

  // Backgrounds
  background:       cartasBosque.bruma,
  surface:          cartasBosque.pergamino,
  surfaceSecondary: cartasBosque.crema,

  // Text
  textPrimary:   cartasBosque.tinta,
  textSecondary: cartasBosque.helecho,
  textDisabled:  cartasBosque.salvia,
  textInverse:   '#FFFFFF',
  textAccent:    cartasBosque.bosque,

  // Borders
  border:      cartasBosque.pergaminoOscuro,
  borderFocus: cartasBosque.helecho,

  // Transparent
  transparent: 'transparent',
  overlay:     'rgba(18, 42, 31, 0.55)',
} as const;

export type ColorKey = keyof typeof colors;
