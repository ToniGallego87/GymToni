// Configuración de tema GymBro. El modo (oscuro/claro) se aplica EN CALIENTE,
// sin relanzar el bundle: `theme` es un singleton que se MUTA en su sitio al
// cambiar de tema (setThemeMode) y los componentes se suscriben con
// `useThemedStyles`, que recalcula sus StyleSheet y fuerza el re-render leyendo
// la nueva paleta. El idioma (i18n) sí sigue reiniciando la app.
import { useMemo } from 'react';
import { useSyncExternalStore } from 'react';
import {
  getStoredThemeMode,
  setStoredThemeMode,
  ThemeMode,
} from './appSettings';
import {
  getThemeVersion,
  notifyThemeChange,
  subscribeTheme,
} from './themeStore';

// Paleta original (modo noche). Se exporta para superficies que van SIEMPRE en
// oscuro con independencia del tema activo (p. ej. el póster de logros, que se
// pinta sobre lienzo oscuro fijo). El resto de la app usa `theme.colors`.
export const darkColors = {
  primary: '#F7CC3D',
  primaryDark: '#E5B82C',
  primaryLight: '#F9D85A',
  primaryMuted: 'rgba(247, 204, 61, 0.14)',
  // Oro de SUPERFICIE (heros, botones y badges dorados), con `onGold` de tinta
  // encima. En noche coincide con `primary`: el oro brillante ya sirve igual de
  // relleno que de tinta sobre el fondo oscuro. Ver lightColors.
  primaryFill: '#F7CC3D',
  primaryFillLight: '#F9D85A',
  primaryFillDark: '#E5B82C',
  // Oro de LÍNEA: aros/bordes del día en curso, borde izquierdo de la semana,
  // contorno de checkboxes. Como no es texto le basta 3:1, así que en día puede
  // ser bastante más amarillo que la tinta. En noche es el oro de siempre.
  primaryLine: '#F7CC3D',
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
  // Acento estructural: bordes de tarjeta, barras de semana y tinte de
  // GradientFill. Se separa de `white` (que es la TINTA de texto/iconos) porque
  // los dos roles no se invierten igual: en noche el aro blanco sobre superficie
  // oscura lee como un halo suave, pero su inverso literal en día (#171B23) da
  // un aro casi negro con aspecto de pegatina. Ver lightColors.
  accentLine: '#ffffff',
  // Fondo de inputs/controles hundidos.
  inputBg: '#101318',
  // Tinta sobre el oro de superficie (`primaryFill` / `gradients.primary`). El
  // oro es vivo en AMBOS temas, así que la tinta es oscura en ambos.
  onGold: '#101318',
  // Tinta sobre los rellenos sólidos de estado (rojo `error`, verde `success`).
  // Iba con `onGold`, pero al separar el oro de día los dos roles dejaron de
  // coincidir: sobre el rojo profundo de día la tinta tiene que ser blanca.
  onDanger: '#101318',
  success: '#52C878',
  error: '#F06A6A',
  errorLight: '#F59898',
  warning: '#FFB347',
  current: '#6F8FDF',
  accent: '#F7CC3D',
  overlay: 'rgba(6, 8, 12, 0.72)',
  emoji_blue: '#6F8FDF',
  emoji_orange: '#FF9500',
  // Tintes translúcidos (fondos de chip/badge) de los colores de arriba: mismo
  // tono, alfa baja. Igual que `primaryMuted`, para que el modo día pueda
  // ajustarlos (nada de rgba a mano sueltos en pantallas).
  emoji_blueMuted: 'rgba(111, 143, 223, 0.14)',
  emoji_orangeMuted: 'rgba(255, 149, 0, 0.12)',
  emoji_orangeMutedBorder: 'rgba(255, 149, 0, 0.35)',
  successMuted: 'rgba(82, 200, 120, 0.12)',
  errorMuted: 'rgba(240, 106, 106, 0.12)',
  warningMuted: 'rgba(255, 179, 71, 0.12)',
};

// Modo día: mismas CLAVES con roles invertidos donde toca. `white` funciona
// como "tinta de acento" (blanca en noche, oscura en día).
const lightColors: typeof darkColors = {
  // El oro de día se parte en dos roles porque un solo tono no puede servir a
  // los dos sobre un lienzo claro:
  //
  // - `primary` es TINTA (texto, iconos, bordes, tintes sobre el fondo claro):
  //   tiene que ser un ámbar oscuro para contrastar con `background` (>4.5:1).
  // - `primaryFill` es SUPERFICIE (heros, botones y badges dorados): tiene que
  //   ser un oro VIVO, con tinta oscura (`onGold`) encima.
  //
  // Antes ambos eran el mismo bronce oscuro con texto blanco: legible, pero el
  // relleno quedaba apagado y sucio sobre el fondo claro. En noche los dos roles
  // siguen coincidiendo en el mismo oro brillante.
  primary: '#966100',
  primaryDark: '#7A4F00',
  // Ojo: en día "light" significa MÁS contraste sobre el lienzo claro (se usa
  // como tinta), así que es más oscuro que `primary`, no más claro.
  primaryLight: '#7A5200',
  primaryMuted: 'rgba(150, 97, 0, 0.14)',
  primaryFill: '#F7C21A',
  primaryFillLight: '#FFD75A',
  primaryFillDark: '#E2A80C',
  // Ámbar: 3.2:1 sobre el fondo y 3.6:1 sobre las tarjetas. La tinta (`primary`)
  // aquí se leía marrón; el oro de relleno, en cambio, se perdería (1.6:1).
  primaryLine: '#B87A00',
  lightGray: '#7C8496',
  veryLightGray: '#3C4352',
  white: '#171B23',
  // Fondo frío y algo más profundo que antes para que las superficies blancas
  // de las tarjetas se separen del lienzo sin depender solo de la sombra.
  background: '#EDF0F6',
  backgroundElevated: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#E8EBF3',
  border: '#C7CDDB',
  text: '#151922',
  textSecondary: '#4E5565',
  textMuted: '#7C8496',
  // Pizarra medio, NO el inverso de `white`: el aro/barra queda definido pero
  // sin el canto negro de pegatina. Además deja el oro de la semana en curso
  // como el único acento fuerte, que es la jerarquía correcta.
  accentLine: '#6B7385',
  inputBg: '#E3E7F0',
  // Tinta oscura cálida sobre el oro vivo (≈7:1). El blanco de antes solo se
  // sostenía porque el oro era un bronce oscuro.
  onGold: '#3A2B04',
  // Sobre los rojos/verdes profundos de día el blanco es la tinta que contrasta.
  onDanger: '#FFFFFF',
  success: '#1F8A49',
  error: '#C93B3B',
  errorLight: '#A82F2F',
  warning: '#B26E0E',
  current: '#3E60B8',
  accent: '#966100',
  overlay: 'rgba(13, 16, 23, 0.5)',
  emoji_blue: '#3E60B8',
  emoji_orange: '#C26F00',
  emoji_blueMuted: 'rgba(62, 96, 184, 0.14)',
  emoji_orangeMuted: 'rgba(194, 111, 0, 0.12)',
  emoji_orangeMutedBorder: 'rgba(194, 111, 0, 0.35)',
  successMuted: 'rgba(31, 138, 73, 0.12)',
  errorMuted: 'rgba(201, 59, 59, 0.12)',
  warningMuted: 'rgba(178, 110, 14, 0.12)',
};

function buildTheme(mode: ThemeMode) {
  return {
  mode: mode,
  // Estilo de la barra de estado acorde al fondo del tema.
  statusBarStyle: (mode === 'light' ? 'dark' : 'light') as
    | 'light'
    | 'dark',
  colors: mode === 'light' ? lightColors : darkColors,

  // Fuente display (Anton) para titulares. Cargada en App.tsx vía expo-font.
  fonts: {
    display: 'Anton',
  },

  // Degradados de marca (claro → base → oscuro, diagonal). Única fuente para
  // todos los LinearGradient de acción/estado: no duplicar estos tríos en
  // pantallas ni componentes. Los oros (`primary`/`amber`) son SUPERFICIE: van
  // con tinta oscura (`onGold`) encima en ambos temas, así que en día también
  // son un oro vivo (el bronce oscuro de antes se veía apagado sobre el lienzo
  // claro). El resto (verde/rojo/naranja) ya contrasta en ambos.
  gradients: {
    primary: (mode === 'light'
      ? ['#FFD858', '#F7C21A', '#E0A50C']
      : ['#F9D85A', '#F7CC3D', '#E0B226']) as [string, string, string],
    success: ['#7CD99A', '#52C878', '#3DA866'] as [string, string, string],
    danger: ['#F59898', '#F06A6A', '#D85151'] as [string, string, string],
    warning: ['#FFC97A', '#FFB347', '#F2982C'] as [string, string, string],
    amber: (mode === 'light'
      ? ['#FFC94F', '#F0A81C', '#C98505']
      : ['#F9D85A', '#F2B33D', '#E08A26']) as [string, string, string],
    // Sombreado del "peldaño" de las flechas del carrusel de heros: tinta oscura
    // translúcida, intensa en el borde exterior y desvanecida a nada hacia el
    // centro (ver HeroCarousel). En día pesa menos: sobre el oro vivo la misma
    // tinta que en noche ennegrecía el escalón.
    heroStep: (mode === 'light'
      ? [
          'rgba(16, 19, 24, 0.15)',
          'rgba(16, 19, 24, 0.12)',
          'rgba(16, 19, 24, 0.06)',
          'rgba(16, 19, 24, 0)',
        ]
      : [
          'rgba(16, 19, 24, 0.26)',
          'rgba(16, 19, 24, 0.22)',
          'rgba(16, 19, 24, 0.10)',
          'rgba(16, 19, 24, 0)',
        ]) as [string, string, string, string],
    // Brillo superior (sheen) que da volumen a los botones/tarjetas con gradiente.
    sheen: ['rgba(255,255,255,0.32)', 'rgba(255,255,255,0)'] as [
      string,
      string,
    ],
    // Sheen de las tarjetas neutras (GradientFill). En noche es un velo mínimo;
    // en día tiene que ser mucho más blanco para dar volumen sobre superficies
    // ya claras (un 0.06 blanco sobre blanco es invisible).
    cardSheen: (mode === 'light'
      ? ['rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']
      : ['rgba(255,255,255,0.06)', 'rgba(255,255,255,0)']) as [string, string],
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

  // En día las sombras negras densas se ven como manchas grises: se sustituyen
  // por sombras azuladas más suaves y con menos elevation (la sombra de
  // elevation en Android es negra sí o sí, así que se baja su intensidad).
  shadow:
    mode === 'light'
      ? {
          card: {
            shadowColor: '#26314A',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.14,
            shadowRadius: 18,
            elevation: 6,
          },
          soft: {
            shadowColor: '#26314A',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.1,
            shadowRadius: 12,
            elevation: 4,
          },
        }
      : {
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
}

export type Theme = ReturnType<typeof buildTheme>;

// Singleton VIVO del tema. Se MUTA en su sitio en setThemeMode (Object.assign)
// para que el JSX (theme.colors.x) y las fábricas de estilos lean la paleta
// nueva en el siguiente render, sin recrear el módulo.
export const theme: Theme = buildTheme(getStoredThemeMode());

// Cambia el modo de tema en caliente: muta el singleton, persiste y avisa a los
// suscriptores (glassTokens recalcula sus tokens; los componentes se re-renderizan).
export function setThemeMode(mode: ThemeMode): void {
  if (mode === theme.mode) return;
  Object.assign(theme, buildTheme(mode));
  setStoredThemeMode(mode);
  notifyThemeChange();
}

// Suscribe el componente a los cambios de tema (re-render en cada cambio).
export function useThemeVersion(): number {
  return useSyncExternalStore(subscribeTheme, getThemeVersion, getThemeVersion);
}

// Crea (y memoiza por versión de tema) los estilos del componente a partir de
// una fábrica que lee el `theme` vivo. Sustituye al patrón de módulo
// `const styles = StyleSheet.create({...})`, que capturaba la paleta una vez.
export function useThemedStyles<T>(factory: () => T): T {
  const version = useThemeVersion();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(factory, [version]);
}

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
// acento visual (bordes, degradados, calendario, puntos) es el acento
// estructural del tema (blanco en noche, pizarra en día).
// Se mantiene la firma para no tocar los ~40 consumidores del acento.
export function getTrainingAccent(_target?: DayAccentTarget) {
  return theme.colors.accentLine;
}
