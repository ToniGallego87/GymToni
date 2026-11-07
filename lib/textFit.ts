/**
 * Búsqueda del mayor cuerpo de letra con el que un texto cabe en su caja (ver
 * `FitText`). Solo el sistema sabe cómo parte las líneas, así que no se calcula:
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
export function stepTextFit(state: TextFit, fits: boolean): TextFit {
  const { size, min } = state;
  if (state.done) {
    return fits || size <= min ? state : nextProbe(min, size, min);
  }
  return fits
    ? nextProbe(size, state.high, min)
    : nextProbe(state.low, size, min);
}
