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
