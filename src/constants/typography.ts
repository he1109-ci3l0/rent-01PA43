import { TextStyle } from 'react-native';

export const fonts = {
  sans:       'BricolageGrotesque_400Regular',
  sansMedium: 'BricolageGrotesque_400Regular',
  sansSemi:   'BricolageGrotesque_600SemiBold',
  sansBold:   'BricolageGrotesque_700Bold',
  mono:       'MonaSans_400Regular',
  monoBold:   'MonaSans_600SemiBold',
} as const;

export const fontSizes = {
  xs:    11,
  sm:    12,
  base:  13,
  md:    14,
  lg:    18,
  xl:    20,
  '2xl': 28,
  '3xl': 32,
} as const;

export const fontWeights = {
  regular:  '400',
  medium:   '500',
  semibold: '600',
  bold:     '700',
} as const;

export const lineHeights = {
  tight:   1.2,
  snug:    1.375,
  normal:  1.5,
  relaxed: 1.625,
} as const;

export const typography = {
  // Títulos principales
  h1: {
    fontFamily:  fonts.sansBold,
    fontSize:    fontSizes['3xl'],
    fontWeight:  fontWeights.bold,
    lineHeight:  fontSizes['3xl'] * lineHeights.tight,
    letterSpacing: 0,
  } as TextStyle,
  h2: {
    fontFamily:  fonts.sansBold,
    fontSize:    fontSizes['2xl'],
    fontWeight:  fontWeights.bold,
    lineHeight:  fontSizes['2xl'] * lineHeights.tight,
    letterSpacing: 0,
  } as TextStyle,

  // Títulos secundarios
  h3: {
    fontFamily:  fonts.sansMedium,
    fontSize:    fontSizes.xl,
    fontWeight:  fontWeights.medium,
    lineHeight:  fontSizes.xl * lineHeights.snug,
  } as TextStyle,
  h4: {
    fontFamily:  fonts.sansMedium,
    fontSize:    fontSizes.lg,
    fontWeight:  fontWeights.medium,
    lineHeight:  fontSizes.lg * lineHeights.snug,
  } as TextStyle,

  // Labels de sección
  label: {
    fontFamily:    fonts.sans,
    fontSize:      fontSizes.sm,
    fontWeight:    fontWeights.regular,
    letterSpacing: 0.08 * fontSizes.sm,
    lineHeight:    fontSizes.sm * lineHeights.snug,
  } as TextStyle,

  // Cuerpo
  body: {
    fontFamily:  fonts.sans,
    fontSize:    fontSizes.md,
    fontWeight:  fontWeights.regular,
    lineHeight:  fontSizes.md * lineHeights.normal,
  } as TextStyle,

  // Metadatos / texto pequeño
  caption: {
    fontFamily:  fonts.sans,
    fontSize:    fontSizes.base,
    fontWeight:  fontWeights.regular,
    lineHeight:  fontSizes.base * lineHeights.normal,
  } as TextStyle,

  // Monoespaciado — montos grandes
  monoLg: {
    fontFamily:  fonts.monoBold,
    fontSize:    fontSizes['2xl'],
    fontWeight:  fontWeights.bold,
    lineHeight:  fontSizes['2xl'] * lineHeights.tight,
  } as TextStyle,

  // Monoespaciado — montos pequeños / fechas
  monoSm: {
    fontFamily:  fonts.mono,
    fontSize:    fontSizes.md,
    fontWeight:  fontWeights.regular,
    lineHeight:  fontSizes.md * lineHeights.normal,
  } as TextStyle,

  // Botones
  button: {
    fontFamily:  fonts.sansMedium,
    fontSize:    fontSizes.md,
    fontWeight:  fontWeights.medium,
    lineHeight:  fontSizes.md * lineHeights.snug,
  } as TextStyle,

  // Nav bar activo
  navActive: {
    fontFamily:    fonts.sansSemi,
    fontSize:      fontSizes.xs,
    fontWeight:    fontWeights.semibold,
    letterSpacing: 0.6,
  } as TextStyle,

  // Nav bar inactivo
  navInactive: {
    fontFamily:    fonts.sans,
    fontSize:      fontSizes.xs,
    fontWeight:    fontWeights.regular,
    letterSpacing: 0.6,
  } as TextStyle,
} as const;

export type TypographyKey = keyof typeof typography;
