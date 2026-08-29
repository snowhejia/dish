import { Platform, type TextStyle, type ViewStyle } from 'react-native';

export const colors = {
  purple: '#6B4EFF',
  purpleLogo: '#5B3FE8',
  purpleDark: '#4A32C7',
  lavender: '#EDE9FF',
  yellow: '#FFD166',
  orange: '#E8913A',
  blush: '#FFC7CD',
  mascotBody: '#FDFCF8',
  ink: '#1A1A2E',
  titleInk: '#1B1740',
  body: '#3E3B57',
  bodySoft: '#4A4766',
  muted: '#8A87A3',
  inactive: '#9C99AE',
  disabled: '#B0AEC0',
  iconMuted: '#C6C3D4',
  borderStrong: '#DCD8EE',
  border: '#E7E5F0',
  borderSoft: '#EDECF4',
  track: '#EDEBF6',
  disabledSurface: '#EFEEF5',
  chipSurface: '#F1EFFB',
  divider: '#F1F0F6',
  imageSurface: '#F2F1F7',
  controlSurface: '#F4F3F9',
  softSurface: '#F7F6FC',
  surface: '#FFFFFF',
  success: '#1F7A4D',
  successSurface: '#E6F5EC',
  pending: '#8B6B00',
  pendingSurface: '#FFF3D1',
  map: '#EEF0F7',
  mapPark: '#E4EEE3',
  mapCampus: '#E9E7F2',
  white: '#FFFFFF',
} as const;

export const spacing = {
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  7: 7,
  8: 8,
  9: 9,
  10: 10,
  11: 11,
  12: 12,
  13: 13,
  14: 14,
  15: 15,
  16: 16,
  18: 18,
  20: 20,
  22: 22,
  24: 24,
  26: 26,
} as const;

export const radii = {
  badge: 7,
  segment: 9,
  compact: 10,
  control: 12,
  button: 14,
  card: 16,
  choice: 18,
  large: 20,
  hero: 26,
  pill: 999,
} as const;

export const sizes = {
  pageGutter: 18,
  navGutter: 16,
  denseGutter: 14,
  backButton: 34,
  floatingButton: 36,
  catalogThumb: 56,
  savedThumb: 64,
  restaurantThumb: 70,
  mapThumb: 76,
  versionThumb: 88,
  addPhoto: 96,
  relatedWidth: 142,
  relatedHeight: 106,
  progressWidth: 34,
  progressHeight: 5,
  tabIcon: 23,
  compareLabel: 74,
} as const;

export const fonts = {
  pixelRegular: 'Silkscreen_400Regular',
  pixelBold: 'Silkscreen_700Bold',
} as const;

export const type = {
  displayLarge: { fontSize: 28, lineHeight: 31.4, fontWeight: '700', letterSpacing: -0.8 } as TextStyle,
  display: { fontSize: 27, lineHeight: 32, fontWeight: '700', letterSpacing: -0.7 } as TextStyle,
  hero: { fontSize: 25, lineHeight: 29, fontWeight: '700', letterSpacing: -0.6 } as TextStyle,
  title: { fontSize: 21, lineHeight: 26, fontWeight: '700', letterSpacing: -0.5 } as TextStyle,
  sectionTitle: { fontSize: 18, lineHeight: 23, fontWeight: '700', letterSpacing: -0.4 } as TextStyle,
  bodyStrong: { fontSize: 15, lineHeight: 20, fontWeight: '600', letterSpacing: -0.2 } as TextStyle,
  body: { fontSize: 13.5, lineHeight: 20.25, fontWeight: '400' } as TextStyle,
  meta: { fontSize: 12.5, lineHeight: 17, fontWeight: '400' } as TextStyle,
  caption: { fontSize: 11.5, lineHeight: 15, fontWeight: '400' } as TextStyle,
  tab: { fontSize: 10.5, lineHeight: 13, fontWeight: '600', letterSpacing: -0.1 } as TextStyle,
  pixelEyebrow: {
    fontFamily: fonts.pixelRegular,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1.2,
  } as TextStyle,
} as const;

const iosShadow = (y: number, blur: number, opacity: number, color = '#19143C'): ViewStyle => ({
  shadowColor: color,
  shadowOffset: { width: 0, height: y },
  shadowRadius: blur / 2,
  shadowOpacity: opacity,
});

export const shadows = {
  search: Platform.select<ViewStyle>({ ios: iosShadow(2, 8, 0.07, '#3C288C'), android: { elevation: 2 }, default: {} }),
  primary: Platform.select<ViewStyle>({
    ios: iosShadow(6, 18, 0.32, '#6A5AE0'),
    android: { elevation: 6 },
    web: { boxShadow: '0 6px 18px rgba(106,90,224,0.32)' },
    default: {},
  }),
  floating: Platform.select<ViewStyle>({ ios: iosShadow(4, 14, 0.14), android: { elevation: 5 }, default: {} }),
  mapCard: Platform.select<ViewStyle>({ ios: iosShadow(12, 34, 0.22), android: { elevation: 12 }, default: {} }),
} as const;
