// Canal mínimo para pedir que la píldora de nivel de la barra superior se
// anime: la dispara la raíz al cerrarse un popup de premio (reto, logro o
// subida de nivel) y la escucha <LevelPill/>, que es quien sabe animarse.
//
// Va aparte (como `themeTransition`) para que quien dispara no dependa del
// componente ni al revés: aquí solo viaja la petición (y, si el premio daba
// puntos, cuántos: la píldora los enseña entrando en ella, "+10 pts").

type Listener = (xp?: number) => void;

// Solo hay una píldora visible (la de la barra de la pantalla en curso), pero
// puede haber varias montadas mientras se cambia de pantalla: se avisa a todas.
const listeners = new Set<Listener>();

export function subscribeLevelPulse(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Anima la píldora de nivel: acaba de sumar puntos. Con `xp`, antes del
 * latido vuelan hacia ella esos puntos ("+10 pts") y se funden con ella.
 */
export function requestLevelPulse(xp?: number): void {
  for (const listener of Array.from(listeners)) listener(xp);
}
