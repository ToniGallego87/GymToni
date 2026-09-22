// Canal mínimo para pedir que la píldora de nivel de la barra superior se
// anime: la dispara la raíz al cerrarse un popup de premio (reto, logro o
// subida de nivel) y la escucha <LevelPill/>, que es quien sabe animarse.
//
// Va aparte (como `themeTransition`) para que quien dispara no dependa del
// componente ni al revés: aquí solo viaja la petición.

type Listener = () => void;

// Solo hay una píldora visible (la de la barra de la pantalla en curso), pero
// puede haber varias montadas mientras se cambia de pantalla: se avisa a todas.
const listeners = new Set<Listener>();

export function subscribeLevelPulse(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Anima la píldora de nivel: acaba de sumar puntos. */
export function requestLevelPulse(): void {
  for (const listener of Array.from(listeners)) listener();
}
