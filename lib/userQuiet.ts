// ¿Está el usuario tocando la pantalla? Lo usa el arranque (app/App.tsx) para
// colocar su trabajo de fondo —montar las pestañas que no se ven, el sync, el
// backup— en los huecos en que nadie toca, en vez de a reloj fijo.
//
// Con relojes fijos el trabajo caía donde cayera: montar una pestaña son
// 80-210 ms de JS más crear sus vistas nativas, y si coincidía con un toque o
// con un scroll, ese toque tardaba en responder y el scroll daba un tirón. Es el
// "va a trompicones los primeros segundos". Ahora cada trozo espera a que el
// dedo lleve un rato fuera de la pantalla.
//
// Los toques los apunta la vista raíz (onTouchStart/End/Cancel, que suben desde
// cualquier vista hija). Un `cancel` es que una vista nativa (scroll, pager) se
// ha quedado el gesto: desde ahí no llega el final del arrastre, así que se le
// da más margen para que acabe el arrastre y la inercia.

/** Margen tras levantar el dedo de un toque normal. */
const QUIET_AFTER_TOUCH_MS = 700;

/** Margen tras un gesto que se ha quedado un scroll o el pager (arrastre + inercia). */
const QUIET_AFTER_NATIVE_GESTURE_MS = 1500;

let fingerDown = false;
let busyUntil = 0;

export function noteTouchStart(): void {
  fingerDown = true;
}

/** `remaining`: dedos que siguen en la pantalla después de este. */
export function noteTouchEnd(remaining = 0): void {
  fingerDown = remaining > 0;
  busyUntil = Date.now() + QUIET_AFTER_TOUCH_MS;
}

export function noteTouchCancel(): void {
  fingerDown = false;
  busyUntil = Date.now() + QUIET_AFTER_NATIVE_GESTURE_MS;
}

/** Cuánto falta para que el usuario lleve un rato sin tocar (0: ya). */
export function msUntilQuiet(now: number = Date.now()): number {
  if (fingerDown) return QUIET_AFTER_TOUCH_MS;
  return Math.max(0, busyUntil - now);
}

/**
 * Ejecuta `task` pasados `delayMs` y, además, en un momento en que el usuario no
 * esté tocando. Si en `maxWaitMs` no hay hueco, se ejecuta igual: nada se queda
 * esperando para siempre (y un final de toque perdido no lo bloquea todo).
 * Devuelve la cancelación.
 */
export function runWhenQuiet(
  task: () => void,
  delayMs: number,
  maxWaitMs: number
): () => void {
  const deadline = Date.now() + delayMs + maxWaitMs;
  let timer: ReturnType<typeof setTimeout>;
  const check = () => {
    const now = Date.now();
    const wait = msUntilQuiet(now);
    if (wait > 0 && now < deadline) {
      timer = setTimeout(check, Math.min(wait, deadline - now));
      return;
    }
    task();
  };
  timer = setTimeout(check, delayMs);
  return () => clearTimeout(timer);
}
