// Configuración de tema GymBro. El modo (oscuro/claro) se lee de forma
// síncrona al evaluar el módulo (lib/appSettings) para que TODOS los
// StyleSheet.create de la app, creados a nivel de módulo, capturen la paleta
// correcta. Cambiar de tema requiere relanzar el bundle (SettingsScreen).
import { getStoredThemeMode, ThemeMode } from './appSettings';

export const themeMode: ThemeMode = getStoredThemeMode();

// Paleta original (modo noche).
const darkColors = {
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
  // Fondo de inputs/controles hundidos. En oscuro coincide con darkGray (que
  // se mantiene como tinta oscura sobre amarillo en AMBOS temas).
  inputBg: '#101318',
  // Tinta para texto/iconos sobre fondos dorados (hero, botones oro). En noche
  // el oro es brillante → tinta oscura; en día el oro es profundo → texto blanco.
  onGold: '#101318',
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
};

// Modo día: mismas CLAVES con roles invertidos donde toca. `white` funciona
// como "tinta de acento" (blanca en noche, oscura en día); `darkGray` sigue
// siendo tinta oscura porque siempre se pinta sobre el degradado amarillo.
const lightColors: typeof darkColors = {
  // Oro de día algo más profundo que antes: los rellenos dorados sólidos
  // (botones, badges) llevan ahora texto blanco (onGold) y necesitan que el oro
  // sea oscuro para que el blanco contraste.
  primary: '#B0790F',
  primaryDark: '#946409',
  primaryLight: '#8F6B00',
  primaryMuted: 'rgba(176, 121, 15, 0.16)',
  darkGray: '#101318',
  gray: '#E4E7EE',
  mediumGray: '#D9DDE6',
  lightGray: '#8A90A2',
  veryLightGray: '#3C4352',
  white: '#171B23',
  background: '#F3F4F8',
  backgroundElevated: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#EAEDF3',
  border: '#D7DBE4',
  text: '#171A21',
  textSecondary: '#59606F',
  textMuted: '#8A90A2',
  inputBg: '#E7EAF1',
  onGold: '#FFFFFF',
  success: '#2E9E58',
  successLight: '#237D45',
  error: '#D84B4B',
  errorLight: '#B23A3A',
  warning: '#C77F1A',
  current: '#4A6CC4',
  previous: '#C77F1A',
  accent: '#B0790F',
  overlay: 'rgba(15, 18, 24, 0.45)',
  emoji_blue: '#4A6CC4',
  emoji_purple: '#8B5FBF',
  emoji_green: '#3E8E63',
  emoji_orange: '#D97E00',
  emoji_brown: '#A0633A',
};

export const theme = {
  mode: themeMode,
  // Estilo de la barra de estado acorde al fondo del tema.
  statusBarStyle: (themeMode === 'light' ? 'dark' : 'light') as
    | 'light'
    | 'dark',
  colors: themeMode === 'light' ? lightColors : darkColors,

  // Fuente display (Anton) para titulares. Cargada en App.tsx vía expo-font.
  fonts: {
    display: 'Anton',
  },

  // Degradados de marca (claro → base → oscuro, diagonal). Única fuente para
  // todos los LinearGradient de acción/estado: no duplicar estos tríos en
  // pantallas ni componentes. En modo día los oros (`primary`/`amber`) se
  // vuelven más profundos: el oro claro de noche se perdía sobre el fondo
  // claro; con la tinta oscura del texto encima el contraste sube y las
  // tarjetas destacan. El resto (verde/rojo/naranja) ya contrasta en ambos.
  gradients: {
    primary: (themeMode === 'light'
      ? ['#D3960F', '#B67D0C', '#946409']
      : ['#F9D85A', '#F7CC3D', '#E0B226']) as [string, string, string],
    success: ['#7CD99A', '#52C878', '#3DA866'] as [string, string, string],
    danger: ['#F59898', '#F06A6A', '#D85151'] as [string, string, string],
    warning: ['#FFC97A', '#FFB347', '#F2982C'] as [string, string, string],
    amber: (themeMode === 'light'
      ? ['#D9A424', '#BE8817', '#9C6D10']
      : ['#F9D85A', '#F2B33D', '#E08A26']) as [string, string, string],
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
  // Acepta el prefijo en español ("Día 1 - ") y en inglés ("Day 1 - "): los
  // días se guardan con el idioma activo al crearlos.
  return name ? name.replace(/^(d[ií]a|day)\s+\d+\s*[-–—]\s*/i, '') : '';
}

// Los días ya no se distinguen por color sino por icono (ver GymIcon). El
// acento visual (bordes, degradados, calendario, puntos) es la tinta de acento
// del tema (blanca en noche, oscura en día).
// Se mantiene la firma para no tocar los ~40 consumidores del acento.
export function getTrainingAccent(_target?: DayAccentTarget) {
  return theme.colors.white;
}
