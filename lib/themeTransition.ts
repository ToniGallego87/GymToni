// Canal mínimo para disparar la animación de revelado del cambio de tema desde
// cualquier pantalla (el botón vive en la top bar) hacia el overlay que se pinta
// en la raíz de la app (ThemeRevealOverlay). Se mantiene aparte de `themeStore`
// y `theme.ts` para no crear ciclos de import: aquí solo viaja la petición.
import type { ThemeMode } from './appSettings';

export interface ThemeRevealRequest {
  // Centro del círculo, en coordenadas de ventana (measureInWindow).
  x: number;
  y: number;
  // Modo al que se cambia y color de fondo de esa piel (para pintar el círculo
  // con los colores de destino mientras crece).
  mode: ThemeMode;
  color: string;
}

type Listener = (request: ThemeRevealRequest) => void;

// Solo hay un overlay (en la raíz), así que basta con un único suscriptor.
let listener: Listener | null = null;

export function subscribeThemeReveal(next: Listener): () => void {
  listener = next;
  return () => {
    if (listener === next) listener = null;
  };
}

export function requestThemeReveal(request: ThemeRevealRequest): void {
  listener?.(request);
}
