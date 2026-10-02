// Medidas de la cuadrícula de casillas cuadradas, tres por fila: el menú de
// Perfil y el catálogo de Logros. Viven aquí (como `glassTokens`) para que las
// dos pantallas tengan EXACTAMENTE el mismo ancho y alto de casilla: antes
// cada una llevaba sus números y las de Logros salían más anchas y más altas.

import { theme } from '@lib/theme';

/** Separación entre casillas de la misma fila. */
export const MENU_TILE_GAP = 12;
/** Margen a los lados de la fila: el cuadrado es algo menor que el tercio. */
export const MENU_TILE_INSET = 8;
/** Aire interior de la casilla. */
export const MENU_TILE_PADDING = 8;
/** Casillas por fila. */
export const MENU_TILES_PER_ROW = 3;

/**
 * Ancho (y, por `aspectRatio: 1`, alto) de la casilla para el ancho de ventana
 * dado. Se aplica como ANCHO FIJO y no como `flex: 1`: con flex, Yoga reparte
 * el hueco sobrante SOBRE la base medida de cada casilla, así que las de
 * etiqueta larga ("Configuración", "Logros") salían más anchas —y más altas—
 * que las de una fila de etiquetas cortas.
 */
export const getMenuTileWidth = (windowWidth: number): number =>
  (windowWidth -
    theme.spacing.md * 2 -
    MENU_TILE_INSET * 2 -
    MENU_TILE_GAP * (MENU_TILES_PER_ROW - 1)) /
  MENU_TILES_PER_ROW;
