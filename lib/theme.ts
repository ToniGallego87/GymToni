// Configuración de tema GymBro
export const theme = {
  colors: {
    primary: '#F7CC3D',
    primaryDark: '#E5B82C',
    primaryLight: '#F9D85A',
    primaryMuted: 'rgba(247, 204, 61, 0.14)',
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
    current: '#6F8FDF',
    previous: '#FFB347',
    accent: '#F7CC3D',
    overlay: 'rgba(6, 8, 12, 0.72)',
    emoji_blue: '#6F8FDF',
    emoji_purple: '#B189DA',
    emoji_green: '#67B58C',
    emoji_orange: '#FF9500',
    emoji_brown: '#A0633A',
  },

  // Fuente display (Anton) para titulares. Cargada en App.tsx vía expo-font.
  fonts: {
    display: 'Anton',
  },

  // Degradados de marca (claro → base → oscuro, diagonal). Única fuente para
  // todos los LinearGradient de acción/estado: no duplicar estos tríos en
  // pantallas ni componentes.
  gradients: {
    primary: ['#F9D85A', '#F7CC3D', '#E0B226'] as [string, string, string],
    success: ['#7CD99A', '#52C878', '#3DA866'] as [string, string, string],
    danger: ['#F59898', '#F06A6A', '#D85151'] as [string, string, string],
    warning: ['#FFC97A', '#FFB347', '#F2982C'] as [string, string, string],
    amber: ['#F9D85A', '#F2B33D', '#E08A26'] as [string, string, string],
    // Brillo superior (sheen) que da volumen a los botones/tarjetas con gradiente.
    sheen: ['rgba(255,255,255,0.32)', 'rgba(255,255,255,0)'] as [
      string,
      string,
    ],
  },

  typography: {
    h1: {
      fontSize: 28,
      fontWeight: '800' as const,
      lineHeight: 32,
    },
    h2: {
      fontSize: 22,
      fontWeight: '800' as const,
      lineHeight: 28,
    },
    h3: {
      fontSize: 18,
      fontWeight: '700' as const,
      lineHeight: 24,
    },
    body: {
      fontSize: 16,
      fontWeight: '400' as const,
      lineHeight: 22,
    },
    bodySmall: {
      fontSize: 13,
      fontWeight: '400' as const,
      lineHeight: 18,
    },
    label: {
      fontSize: 14,
      fontWeight: '700' as const,
      lineHeight: 18,
    },
    caption: {
      fontSize: 12,
      fontWeight: '600' as const,
      lineHeight: 16,
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

type DayAccentTarget =
  | {
      emoji?: string;
      name?: string;
    }
  | null
  | undefined;

export function getDisplayDayName(name?: string | null) {
  return name ? name.replace(/^Día\s+\d+\s*[-–—]\s*/i, '') : '';
}

// Los días ya no se distinguen por color sino por icono (ver GymIcon). El
// acento visual (bordes, degradados, calendario, puntos) es blanco uniforme.
// Se mantiene la firma para no tocar los ~40 consumidores del acento.
export function getTrainingAccent(_target?: DayAccentTarget) {
  return theme.colors.white;
}
