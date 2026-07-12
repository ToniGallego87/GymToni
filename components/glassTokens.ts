// Tokens del sistema glass. Dependen del modo del tema (día/noche), resuelto
// una sola vez al evaluar el módulo (igual que lib/theme.ts).
import { themeMode } from '@lib/theme';

const isLight = themeMode === 'light';

export const GLASS_BLUR_INTENSITY = 82;
export const GLASS_TOP_BAR_BLUR_INTENSITY = 32;

// Tinte del BlurView acorde al tema.
export const GLASS_TINT = isLight ? 'light' : 'dark';

export const GLASS_TOP_BAR_BG = isLight
  ? 'rgba(244, 245, 248, 0.6)'
  : 'rgba(15, 17, 21, 0.56)';
export const GLASS_TOP_BAR_OVERLAY = isLight
  ? 'rgba(244, 245, 248, 0.08)'
  : 'rgba(15, 17, 21, 0.08)';

export const GLASS_FLOATING_BG = isLight
  ? 'rgba(255, 255, 255, 0.28)'
  : 'rgba(14, 20, 27, 0.05)';
export const GLASS_FLOATING_OVERLAY = isLight
  ? 'rgba(255, 255, 255, 0)'
  : 'rgba(8, 12, 16, 0)';
export const GLASS_FLOATING_BORDER = isLight
  ? 'rgba(15, 18, 24, 0.1)'
  : 'rgba(255, 255, 255, 0.1)';
export const GLASS_FLOATING_HIGHLIGHT = isLight
  ? 'rgba(255, 255, 255, 0.75)'
  : 'rgba(255, 255, 255, 0.1)';
export const GLASS_FLOATING_INNER_STROKE = isLight
  ? 'rgba(255, 255, 255, 0.4)'
  : 'rgba(255, 255, 255, 0.04)';

// Estado activo de los items de la barra de navegación flotante.
export const GLASS_ACTIVE_ITEM_BG = isLight
  ? 'rgba(15, 18, 24, 0.07)'
  : 'rgba(255, 255, 255, 0.06)';
export const GLASS_ACTIVE_ITEM_BORDER = isLight
  ? 'rgba(15, 18, 24, 0.1)'
  : 'rgba(255, 255, 255, 0.08)';
