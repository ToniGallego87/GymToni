// Tokens del sistema glass. Dependen del modo del tema (día/noche). Ahora el
// tema cambia EN CALIENTE (lib/theme.ts): estos tokens son bindings `let` vivos
// que se recalculan al cambiar de tema (subscribeTheme) leyendo `theme.mode`.
// Los consumidores los leen en render y se re-renderizan vía useThemedStyles,
// por lo que recogen el valor nuevo sin reiniciar la app.
import { theme } from '@lib/theme';
import { subscribeTheme } from '@lib/themeStore';

export const GLASS_BLUR_INTENSITY = 82;
export const GLASS_TOP_BAR_BLUR_INTENSITY = 32;

// Tinte del BlurView acorde al tema.
export let GLASS_TINT: 'light' | 'dark' = 'dark';

export let GLASS_TOP_BAR_BG = 'rgba(15, 17, 21, 0.56)';
export let GLASS_TOP_BAR_OVERLAY = 'rgba(15, 17, 21, 0.08)';
// Filo inferior de la top bar: en día separa la barra del contenido que pasa
// por debajo (en noche el contraste del blur ya lo hace y no lleva borde).
export let GLASS_TOP_BAR_HAIRLINE = 'rgba(255, 255, 255, 0.08)';

export let GLASS_FLOATING_BG = 'rgba(14, 20, 27, 0.05)';
export let GLASS_FLOATING_OVERLAY = 'rgba(8, 12, 16, 0)';
export let GLASS_FLOATING_BORDER = 'rgba(255, 255, 255, 0.1)';
export let GLASS_FLOATING_HIGHLIGHT = 'rgba(255, 255, 255, 0.1)';
export let GLASS_FLOATING_INNER_STROKE = 'rgba(255, 255, 255, 0.04)';

// Estado activo de los items de la barra de navegación flotante.
export let GLASS_ACTIVE_ITEM_BG = 'rgba(255, 255, 255, 0.06)';
export let GLASS_ACTIVE_ITEM_BORDER = 'rgba(255, 255, 255, 0.08)';

function recomputeGlassTokens() {
  const isLight = theme.mode === 'light';

  GLASS_TINT = isLight ? 'light' : 'dark';

  GLASS_TOP_BAR_BG = isLight
    ? 'rgba(237, 240, 246, 0.7)'
    : 'rgba(15, 17, 21, 0.56)';
  GLASS_TOP_BAR_OVERLAY = isLight
    ? 'rgba(237, 240, 246, 0.08)'
    : 'rgba(15, 17, 21, 0.08)';
  GLASS_TOP_BAR_HAIRLINE = isLight
    ? 'rgba(21, 25, 34, 0.14)'
    : 'rgba(255, 255, 255, 0.08)';

  GLASS_FLOATING_BG = isLight
    ? 'rgba(255, 255, 255, 0.55)'
    : 'rgba(14, 20, 27, 0.05)';
  GLASS_FLOATING_OVERLAY = isLight
    ? 'rgba(255, 255, 255, 0)'
    : 'rgba(8, 12, 16, 0)';
  GLASS_FLOATING_BORDER = isLight
    ? 'rgba(15, 18, 24, 0.14)'
    : 'rgba(255, 255, 255, 0.1)';
  GLASS_FLOATING_HIGHLIGHT = isLight
    ? 'rgba(255, 255, 255, 0.9)'
    : 'rgba(255, 255, 255, 0.1)';
  GLASS_FLOATING_INNER_STROKE = isLight
    ? 'rgba(255, 255, 255, 0.5)'
    : 'rgba(255, 255, 255, 0.04)';

  GLASS_ACTIVE_ITEM_BG = isLight
    ? 'rgba(21, 25, 34, 0.09)'
    : 'rgba(255, 255, 255, 0.06)';
  GLASS_ACTIVE_ITEM_BORDER = isLight
    ? 'rgba(21, 25, 34, 0.14)'
    : 'rgba(255, 255, 255, 0.08)';
}

// Valor inicial acorde al tema guardado, y recálculo en cada cambio de tema.
recomputeGlassTokens();
subscribeTheme(recomputeGlassTokens);
