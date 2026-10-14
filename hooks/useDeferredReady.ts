import { useEffect, useState } from 'react';
import { InteractionManager } from 'react-native';

// Devuelve `false` en el primer render y `true` tras las interacciones (una vez
// pintado el frame). Sirve para diferir el contenido PESADO de una pantalla: se
// pinta al instante lo ligero (hero, barra) y el resto se monta un instante
// después, para que abrir la vista se sienta inmediato aunque haya mucho que
// dibujar/computar debajo.
export function useDeferredReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => setReady(true));
    return () => task.cancel();
  }, []);
  return ready;
}

// Como `useDeferredReady`, pero garantizando que el primer frame (la barra y el
// fondo de la vista) LLEGA a la pantalla antes de montar lo pesado. Para las
// subpantallas que se abren con un toque (registro, detalle de un día):
// `runAfterInteractions` se resuelve en la misma tanda de JS que el toque, así
// que el contenido entero se pintaba antes de que la vista apareciese y el
// toque parecía no responder. `requestAnimationFrame` cae en el frame siguiente,
// con la vista ya en pantalla.
export function useAfterFirstPaint(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  return ready;
}
