/**
 * Búsqueda del mayor cuerpo de letra con el que un texto cabe en su caja (ver
 * `FitText`) sin partir ninguna palabra a media línea. Solo el sistema sabe cómo parte las líneas, así que no se calcula:
 * se prueba un tamaño, se mide lo que ocupa y se sigue por bisección (unas cuatro
 * medidas de 13 a 7).
 *
 * El `adjustsFontSizeToFit` de Android no sirve: en su bucle la reducción se
 * acumula sobre el tamaño ya reducido, salta de 13 a 12, 10 y 7,7 y deja la
 * letra mucho más pequeña de lo necesario.
 */

const STEP = 0.5;

export interface TextFit {
  /** Tamaño que se está probando, o el elegido si `done`. */
  size: number;
  /** El mayor que se sabe que cabe (al empezar, el mínimo: de ahí no se baja). */
  low: number;
  /** El menor que se sabe que no cabe (al empezar, el de partida). */
  high: number;
  min: number;
  done: boolean;
}

export function startTextFit(size: number, min: number): TextFit {
  return { size, low: min, high: size, min, done: false };
}

function nextProbe(low: number, high: number, min: number): TextFit {
  if (high - low <= STEP) {
    return { size: low, low, high, min, done: true };
  }
  const steps = Math.max(1, Math.floor((high - low) / 2 / STEP));
  return { size: low + steps * STEP, low, high, min, done: false };
}

/**
 * Siguiente paso tras medir `state.size`. Ya decidido, una medida que no cabe
 * reabre la búsqueda hacia abajo (la caja puede cambiar de ancho al maquetarse):
 * que sobre algo de hueco se nota poco, que se salga de la caja no.
 */
// Fin de línea que no parte palabra: espacio (o salto) o un guion/barra puestos
// por quien escribió el texto.
const BREAK_AFTER = /[\s\-‐–—/]$/;
const BREAK_BEFORE = /^\s/;

/**
 * Si el sistema ha tenido que partir una palabra entre dos líneas porque no
 * cabía entera ("Complementario" / "s"). Recibe el texto de cada línea tal
 * como lo da `onTextLayout`.
 */
export function breaksWord(lines: readonly string[]): boolean {
  for (let i = 0; i < lines.length - 1; i += 1) {
    const current = lines[i];
    const next = lines[i + 1];
    if (!current || !next) continue;
    if (BREAK_AFTER.test(current) || BREAK_BEFORE.test(next)) continue;
    return true;
  }
  return false;
}

export function stepTextFit(state: TextFit, fits: boolean): TextFit {
  const { size, min } = state;
  if (state.done) {
    return fits || size <= min ? state : nextProbe(min, size, min);
  }
  return fits
    ? nextProbe(size, state.high, min)
    : nextProbe(state.low, size, min);
}
