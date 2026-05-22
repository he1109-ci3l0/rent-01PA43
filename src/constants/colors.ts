// Cartas Bosque — paleta definitiva
export const cartasBosque = {
  bosque:          '#2E3C2C',   // botones primarios
  musgo:           '#4A5E48',   // elementos / labels importantes
  helecho:         '#8A9E80',   // verde salvia / texto secundario
  niebla:          '#8A9E80',   // alias helecho (compat. legado)
  pergamino:       '#FFFFFF',   // blanco / superficies
  pergaminoOscuro: '#E0DDD5',   // borde suave
  corteza:         '#960018',   // alerta borde
  tierra:          '#CDB29D',   // arena cálida / acento
  arena:           '#CDB29D',   // alias tierra
  tinta:           '#122A1F',   // texto principal
  bruma:           '#F5F2EC',   // fondo general
  noche:           '#122A1F',   // alias tinta
  terracota:       '#960018',   // alias corteza
} as const;

export const colors = {
  // Brand
  primary:      cartasBosque.bosque,
  primaryLight: cartasBosque.niebla,
  primaryDark:  '#122A1F',
  primaryMid:   cartasBosque.musgo,

  // Accent
  accent:      cartasBosque.tierra,
  accentLight: cartasBosque.pergaminoOscuro,

  // Status
  success:      '#4A5E48',
  successLight: '#E8EBE0',
  warning:      '#8A6A72',
  warningLight: '#E8EBE0',
  error:        '#960018',
  errorLight:   'rgba(150,0,24,0.15)',
  info:         cartasBosque.musgo,
  infoLight:    cartasBosque.niebla,

  // Neutrals
  white: '#FFFFFF',
  black: '#000000',
  gray50:  cartasBosque.bruma,
  gray100: '#F5F2EC',
  gray200: cartasBosque.pergaminoOscuro,
  gray300: '#E8EBE0',
  gray400: '#C8B0B8',
  gray500: '#4A5E48',
  gray600: '#4A5E48',
  gray700: '#2E3C2C',
  gray800: '#122A1F',
  gray900: cartasBosque.tinta,

  // Backgrounds
  background:        cartasBosque.bruma,
  surface:           cartasBosque.pergamino,
  surfaceSecondary:  '#E8EBE0',

  // Text
  textPrimary:  cartasBosque.tinta,
  textSecondary: cartasBosque.musgo,
  textDisabled: '#C8B0B8',
  textInverse:  '#FFFFFF',
  textAccent:   cartasBosque.bosque,

  // Borders
  border:      cartasBosque.pergaminoOscuro,
  borderFocus: cartasBosque.musgo,

  // Transparent
  transparent: 'transparent',
  overlay:     'rgba(18, 42, 31, 0.55)',
} as const;

export type ColorKey = keyof typeof colors;
