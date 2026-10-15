import { createContext, useContext, useEffect, useRef } from 'react';

/**
 * ¿Es esta pestaña la elegida en la barra de navegación? Lo da `App.tsx` a
 * cada pestaña. Abrir una subpantalla encima (un detalle, el registro) NO le
 * quita el foco: sigue siendo la pestaña de la que se viene y a la que se
 * vuelve. Solo lo pierde al elegir otra pestaña.
 */
export const TabFocusContext = createContext(true);

/**
 * Llama a `onLeave` cada vez que la pestaña deja de ser la elegida en la
 * barra. Inicio y Cardio lo usan para volver arriba y plegarlo todo: al volver
 * a ellas se encuentran como recién abiertas.
 */
export function useOnTabLeave(onLeave: () => void) {
  const focused = useContext(TabFocusContext);
  const onLeaveRef = useRef(onLeave);
  onLeaveRef.current = onLeave;
  const wasFocused = useRef(focused);
  useEffect(() => {
    if (wasFocused.current && !focused) onLeaveRef.current();
    wasFocused.current = focused;
  }, [focused]);
}
