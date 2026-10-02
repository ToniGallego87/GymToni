import { useEffect } from 'react';
import { AppState } from 'react-native';
import {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useRestTimer } from './restTimerStore';

/**
 * Relleno del descanso: lo YA consumido, de izquierda a derecha (lleno = se
 * acabó). Es el ÚNICO lenguaje del paso del descanso en la app y lo comparten
 * sus tres caras —la tarjeta del registro, la barra flotante y la ventanita
 * PiP—: antes solo se rellenaba la del registro y en las otras dos el mismo
 * descanso era un número suelto, sin decir cuánto quedaba de un vistazo.
 *
 * Se anima con reanimated hasta el final (`withTiming` lineal con lo que queda)
 * en vez de calcularse de la cuenta atrás: esa solo cambia una vez por segundo
 * y el relleno avanzaba a saltos. Se re-arma cuando cambia el descanso (un
 * "+30s" mueve `endAt`, así que el relleno retrocede: es lo honesto, queda más
 * por delante) y al volver de segundo plano, donde las animaciones se congelan
 * mientras el reloj sigue corriendo.
 *
 * @param active Falso mientras esa cara no se pinta (no gasta animación).
 */
export function useRestFillStyle(active = true) {
  const restTimer = useRestTimer();
  const fill = useSharedValue(0);

  useEffect(() => {
    if (!restTimer || !active) {
      fill.value = 0;
      return;
    }
    const armFill = () => {
      const total = Math.max(1, restTimer.endAt - restTimer.startAt);
      const remaining = Math.max(0, restTimer.endAt - Date.now());
      fill.value = Math.min(1, Math.max(0, 1 - remaining / total));
      fill.value = withTiming(1, {
        duration: remaining,
        easing: Easing.linear,
      });
    };
    armFill();
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') armFill();
    });
    return () => subscription.remove();
  }, [restTimer, active, fill]);

  return useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));
}
