// Configuración de tema GymToni
export const theme = {
  colors: {
    primary: '#FFD43B',
    primaryDark: '#F0BE26',
    primaryLight: '#FFE27A',
    primaryMuted: 'rgba(255, 212, 59, 0.14)',
    darkGray: '#101318',
    gray: '#1E232D',
    mediumGray: '#232734',
    lightGray: '#8A90A2',
    veryLightGray: '#D7DBE3',
    white: '#ffffff',
    background: '#0F1115',
    backgroundElevated: '#13161C',
    surface: '#171A21',
    surfaceAlt: '#1C2029',
    border: '#232734',
    text: '#F5F7FA',
    textSecondary: '#98A0AE',
    textMuted: '#697180',
    success: '#52C878',
    successLight: '#7CD99A',
    error: '#F06A6A',
    errorLight: '#F59898',
    warning: '#FFB347',
    current: '#52C878',
    previous: '#FFB347',
    accent: '#FFD43B',
    overlay: 'rgba(6, 8, 12, 0.72)',
    push: '#5F8CFF',
    pull: '#F36B7F',
    legs: '#5FCB8B',
  },

  typography: {
    h1: {
      fontSize: 30,
      fontWeight: '800' as const,
    },
    h2: {
      fontSize: 24,
      fontWeight: '800' as const,
    },
    h3: {
      fontSize: 18,
      fontWeight: '700' as const,
    },
    body: {
      fontSize: 14,
      fontWeight: '400' as const,
    },
    bodySmall: {
      fontSize: 12,
      fontWeight: '400' as const,
    },
    label: {
      fontSize: 12,
      fontWeight: '700' as const,
    },
  },

  spacing: {
    xs: 6,
    sm: 10,
    md: 16,
    lg: 22,
    xl: 28,
    xxl: 36,
  },

  borderRadius: {
    sm: 10,
    md: 16,
    lg: 22,
    xl: 28,
    pill: 999,
  },

  shadow: {
    card: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.22,
      shadowRadius: 18,
      elevation: 10,
    },
    soft: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.16,
      shadowRadius: 14,
      elevation: 8,
    },
  },
};

type DayAccentTarget = {
  emoji?: string;
  name?: string;
} | null | undefined;

export function getDisplayDayName(name?: string | null) {
  return name ? name.replace(/^Día\s+\d+\s*-\s*/i, '') : '';
}

export function getTrainingAccent(target?: DayAccentTarget) {
  if (!target) return theme.colors.primary;
  if (target.emoji === '🔵🔴') return theme.colors.primary;
  if (target.emoji?.includes('🔵') || /push/i.test(target.name || '')) return theme.colors.push;
  if (target.emoji?.includes('🔴') || /pull/i.test(target.name || '')) return theme.colors.pull;
  if (target.emoji?.includes('🟢') || /pierna|leg/i.test(target.name || '')) return theme.colors.legs;
  return theme.colors.primary;
}
