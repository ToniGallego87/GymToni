// Tokens del sistema glass. Dependen del modo del tema (día/noche). Ahora el
// tema cambia EN CALIENTE (lib/theme.ts): estos tokens son bindings `let` vivos
// que se recalculan al cambiar de tema (subscribeTheme) leyendo `theme.mode`.
// Los consumidores los leen en render y se re-renderizan cuando la raíz aplica
// el cambio de tema (useThemeVersion), recogiendo el valor nuevo sin reiniciar.
import { theme } from '@lib/theme';
import { subscribeTheme } from '@lib/themeStore';

export const GLASS_BLUR_INTENSITY = 82;
export const GLASS_TOP_BAR_BLUR_INTENSITY = 32;

// Tinta sobre el cristal flotante (botón Volver, barra). El cristal es oscuro
// TRANSLÚCIDO en ambos temas, así que su texto es SIEMPRE claro: token fijo, no
// se invierte con el tema (en día `theme.colors.white` sería oscuro y no leería).
export const GLASS_FLOATING_TEXT = '#F5F7FA';

// Tinte del BlurView acorde al tema.
export let GLASS_TINT: 'light' | 'dark' = 'dark';

export let GLASS_TOP_BAR_BG = 'rgba(30, 34, 44, 0.62)';
export let GLASS_TOP_BAR_OVERLAY = 'rgba(255, 255, 255, 0.04)';
// Filo inferior de la top bar: en día separa la barra del contenido que pasa
// por debajo (en noche el contraste del blur ya lo hace y no lleva borde).
export let GLASS_TOP_BAR_HAIRLINE = 'rgba(255, 255, 255, 0.08)';

export let GLASS_FLOATING_BG = 'rgba(28, 32, 42, 0.24)';
export let GLASS_FLOATING_OVERLAY = 'rgba(8, 12, 16, 0)';
export let GLASS_FLOATING_BORDER = 'rgba(255, 255, 255, 0.12)';
export let GLASS_FLOATING_HIGHLIGHT = 'rgba(255, 255, 255, 0.1)';
export let GLASS_FLOATING_INNER_STROKE = 'rgba(255, 255, 255, 0.04)';

// Estado activo de los items de la barra de navegación flotante.
export let GLASS_ACTIVE_ITEM_BG = 'rgba(255, 255, 255, 0.12)';
export let GLASS_ACTIVE_ITEM_BORDER = 'rgba(255, 255, 255, 0.14)';

// Botón "Volver". No reutiliza los tokens de la barra flotante: en día esa
// barra es cristal CLARO, mientras el "Volver" sigue siendo cristal OSCURO
// translúcido (un ahumado que se lee sobre el lienzo claro sin opacarlo). Por
// eso lleva su propia terna, y su tinta es clara en ambos temas.
export let GLASS_BACK_BUTTON_BG = 'rgba(28, 32, 42, 0.24)';
export let GLASS_BACK_BUTTON_BORDER = 'rgba(255, 255, 255, 0.12)';
export let GLASS_BACK_BUTTON_OVERLAY = 'rgba(8, 12, 16, 0.05)';
export let GLASS_BACK_BUTTON_TEXT = '#ffffff';

function recomputeGlassTokens() {
  const isLight = theme.mode === 'light';

  GLASS_TINT = isLight ? 'light' : 'dark';

  GLASS_TOP_BAR_BG = isLight
    ? 'rgba(237, 240, 246, 0.5)'
    : 'rgba(30, 34, 44, 0.62)';
  GLASS_TOP_BAR_OVERLAY = isLight
    ? 'rgba(237, 240, 246, 0.08)'
    : 'rgba(255, 255, 255, 0.04)';
  GLASS_TOP_BAR_HAIRLINE = isLight
    ? 'rgba(21, 25, 34, 0.14)'
    : 'rgba(255, 255, 255, 0.08)';

  GLASS_FLOATING_BG = isLight
    ? 'rgba(255, 255, 255, 0.38)'
    : 'rgba(28, 32, 42, 0.24)';
  GLASS_FLOATING_OVERLAY = isLight
    ? 'rgba(255, 255, 255, 0)'
    : 'rgba(8, 12, 16, 0)';
  GLASS_FLOATING_BORDER = isLight
    ? 'rgba(15, 18, 24, 0.14)'
    : 'rgba(255, 255, 255, 0.12)';
  GLASS_FLOATING_HIGHLIGHT = isLight
    ? 'rgba(255, 255, 255, 0.9)'
    : 'rgba(255, 255, 255, 0.1)';
  GLASS_FLOATING_INNER_STROKE = isLight
    ? 'rgba(255, 255, 255, 0.5)'
    : 'rgba(255, 255, 255, 0.04)';

  GLASS_ACTIVE_ITEM_BG = isLight
    ? 'rgba(21, 25, 34, 0.09)'
    : 'rgba(255, 255, 255, 0.12)';
  GLASS_ACTIVE_ITEM_BORDER = isLight
    ? 'rgba(21, 25, 34, 0.14)'
    : 'rgba(255, 255, 255, 0.14)';

  GLASS_BACK_BUTTON_BG = isLight
    ? 'rgba(18, 22, 30, 0.30)'
    : 'rgba(28, 32, 42, 0.24)';
  GLASS_BACK_BUTTON_BORDER = isLight
    ? 'rgba(255, 255, 255, 0.16)'
    : 'rgba(255, 255, 255, 0.12)';
  GLASS_BACK_BUTTON_OVERLAY = isLight
    ? 'rgba(8, 12, 16, 0.06)'
    : 'rgba(8, 12, 16, 0.05)';
  GLASS_BACK_BUTTON_TEXT = isLight ? GLASS_FLOATING_TEXT : '#ffffff';
}

// Valor inicial acorde al tema guardado, y recálculo en cada cambio de tema.
recomputeGlassTokens();
subscribeTheme(recomputeGlassTokens);
