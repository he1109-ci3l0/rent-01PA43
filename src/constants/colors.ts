// Cartas Bosque — paleta principal del proyecto
export const cartasBosque = {
  bosque: '#2C4A2E',       // verde bosque profundo
  musgo: '#4A6741',        // verde musgo medio
  helecho: '#7A9E7E',      // verde helecho claro
  niebla: '#B8CEBB',       // verde niebla suave
  pergamino: '#F2EAD3',    // crema pergamino (fondo)
  pergaminoOscuro: '#E4D8B4', // crema oscura / bordes
  corteza: '#5C3D1E',      // marrón corteza
  tierra: '#8C6239',       // marrón tierra cálido
  tinta: '#1A1F1A',        // casi negro (texto principal)
  bruma: '#FAFAF5',        // blanco brumoso (superficies)
} as const;

export const colors = {
  // Brand — usa Cartas Bosque
  primary: cartasBosque.bosque,
  primaryLight: cartasBosque.niebla,
  primaryDark: '#1A2E1B',
  primaryMid: cartasBosque.musgo,

  // Accent
  accent: cartasBosque.tierra,
  accentLight: cartasBosque.pergaminoOscuro,

  // Status
  success: '#3A7D44',
  successLight: '#D6EDD9',
  warning: '#B07D2A',
  warningLight: '#F5E8C8',
  error: '#A63228',
  errorLight: '#F5DAD8',
  info: cartasBosque.musgo,
  infoLight: cartasBosque.niebla,

  // Neutrals
  white: '#FFFFFF',
  black: '#000000',
  gray50: cartasBosque.bruma,
  gray100: '#F0EDE4',
  gray200: cartasBosque.pergaminoOscuro,
  gray300: '#CEC4A8',
  gray400: '#A89E84',
  gray500: '#7A7060',
  gray600: '#5A5246',
  gray700: '#3D3830',
  gray800: '#2A251F',
  gray900: cartasBosque.tinta,

  // Backgrounds
  background: cartasBosque.pergamino,
  surface: cartasBosque.bruma,
  surfaceSecondary: '#EDE6D0',

  // Text
  textPrimary: cartasBosque.tinta,
  textSecondary: '#5A5246',
  textDisabled: '#A89E84',
  textInverse: cartasBosque.bruma,
  textAccent: cartasBosque.bosque,

  // Borders
  border: cartasBosque.pergaminoOscuro,
  borderFocus: cartasBosque.musgo,

  // Transparent
  transparent: 'transparent',
  overlay: 'rgba(26, 31, 26, 0.55)',
} as const;

export type ColorKey = keyof typeof colors;
