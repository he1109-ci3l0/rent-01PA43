// Cartas Bosque — paleta definitiva · Junio 2026
export const cartasBosque = {
  // Fondos
  bruma:           '#F7F7F5',   // fondo general — blanco neutro
  pergamino:       '#F7F7F5',   // cards (alias de bruma)
  pergaminoOscuro: '#E0DDD5',   // bordes suaves / separadores
  crema:           '#E8EBE0',   // texto claro sobre fondos medios
  niebla:          '#EAE6E0',   // gris piedra · fondos terciarios · elementos secundarios

  // Verdes
  bosque:   '#2E3C2C',   // botones primarios
  helecho:  '#4A5E48',   // elementos secundarios / labels / texto sobre fondo claro
  salvia:   '#8A9E80',   // SOLO texto sobre fondos oscuros (sidebar, header) — NO usar sobre fondo claro

  // Oscuros
  tinta:   '#14352A',   // texto principal / casi negro
  sidebar: '#122A1F',   // negro bosque / header / nav bar

  // Cálidos
  arena:  '#CDB29D',   // arena cálida / tipografía sobre alerta
  acento: '#8A6A72',   // malva / acento secundario

  // Alertas
  alertaFondo: '#670010',   // fondo alertas críticas
  alertaBorde: '#960018',   // borde alertas
  corteza:     '#960018',   // alias de alertaBorde (compatibilidad)
} as const;

export const metricColors = {
  rojo:    '#C0392B',
  azul:    '#3B82F6',
  verde:   '#4A9B6F',
  ambar:   '#E8A838',
  naranja: '#E05C2A',
} as const;

export const colors = {
  primary:      cartasBosque.bosque,
  primaryLight: cartasBosque.salvia,
  primaryDark:  cartasBosque.sidebar,
  primaryMid:   cartasBosque.helecho,
  accent:       cartasBosque.arena,
  accentLight:  cartasBosque.pergaminoOscuro,
  success:      cartasBosque.helecho,
  successLight: cartasBosque.crema,
  warning:      cartasBosque.acento,
  warningLight: cartasBosque.crema,
  error:        cartasBosque.alertaBorde,
  errorLight:   'rgba(150,0,24,0.15)',
  info:         cartasBosque.helecho,
  infoLight:    cartasBosque.niebla,
  white:        '#FFFFFF',
  black:        '#000000',
  gray50:       cartasBosque.bruma,
  gray100:      cartasBosque.niebla,
  gray200:      cartasBosque.pergaminoOscuro,
  gray300:      cartasBosque.crema,
  gray400:      cartasBosque.acento,
  gray500:      cartasBosque.helecho,
  gray600:      cartasBosque.helecho,
  gray700:      cartasBosque.bosque,
  gray800:      cartasBosque.sidebar,
  gray900:      cartasBosque.tinta,
  background:        cartasBosque.bruma,
  surface:           cartasBosque.pergamino,
  surfaceSecondary:  cartasBosque.niebla,
  textPrimary:       cartasBosque.tinta,
  textSecondary:     cartasBosque.helecho,
  textDisabled:      cartasBosque.salvia,
  textInverse:       '#FFFFFF',
  textAccent:        cartasBosque.bosque,
  border:            cartasBosque.pergaminoOscuro,
  borderFocus:       cartasBosque.helecho,
  transparent:       'transparent',
  overlay:           'rgba(18, 42, 31, 0.55)',
} as const;

export type ColorKey = keyof typeof colors;
