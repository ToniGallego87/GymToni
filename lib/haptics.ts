import { Platform, Vibration } from 'react-native';

/**
 * Los toques del vibrador de la app, en un solo sitio y por plataforma.
 *
 * Android: `Vibration` con duraciones en ms, afinadas a mano (un roce de 6 ms
 * no se confunde con la confirmación de 18 ms).
 * iOS: ignora esas duraciones (cada `vibrate` es un zumbido de ~400 ms y el
 * patrón se queda en uno), así que allí va el motor háptico (`expo-haptics`):
 * impactos para los toques y notificaciones para los avisos.
 */

// Cada paso de − / + (también al mantener pulsado): un roce apenas
// perceptible, como el "clic" de una rueda con muescas.
const STEP_VIBRATION_MS = 6;
// Toque al apuntar una serie: corto, de confirmación, nada que ver con el
// aviso largo del fin del descanso.
const ADD_SET_VIBRATION_MS = 18;
// Al borrar una serie, DOS toques cortos ("tac-tac", [espera, vibra, espera,
// vibra] en ms): se distingue sin mirar del toque único de añadir.
const REMOVE_SET_VIBRATION = [0, 22, 90, 22];
/** Fin del descanso: tres pulsos largos (también el de su notificación). */
export const REST_TIMER_VIBRATION = [0, 300, 150, 300, 150, 300];

type HapticsModule = typeof import('expo-haptics');

// Solo iOS, y cargado ahí: en Android el módulo nativo no entra en el binario
// (`expo.autolinking.android.exclude` en package.json) e importarlo lanzaría.
let Haptics: HapticsModule | null = null;
if (Platform.OS === 'ios') {
  try {
    Haptics = require('expo-haptics') as HapticsModule;
  } catch {
    Haptics = null;
  }
}

// Si el motor háptico falla (simulador, modo de bajo consumo), sin más.
function ignore(): void {}

export const haptics = {
  step(): void {
    if (Haptics) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(ignore);
    } else {
      Vibration.vibrate(STEP_VIBRATION_MS);
    }
  },
  addSet(): void {
    if (Haptics) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(ignore);
    } else {
      Vibration.vibrate(ADD_SET_VIBRATION_MS);
    }
  },
  removeSet(): void {
    if (Haptics) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
        ignore
      );
    } else {
      Vibration.vibrate(REMOVE_SET_VIBRATION);
    }
  },
  restDone(): void {
    if (Haptics) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        ignore
      );
    } else {
      Vibration.vibrate(REST_TIMER_VIBRATION);
    }
  },
};
