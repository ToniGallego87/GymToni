import { Platform } from 'react-native';

// Ventana flotante del temporizador: el Picture-in-Picture nativo de Android
// (modules/pip-timer). Con un descanso corriendo, minimizar la app deja la
// cuenta atrás en una ventanita movible encima de lo que estés usando, igual que
// hace YouTube con el vídeo.
//
// Solo Android: iOS reserva el PiP para vídeo y no admite contenido arbitrario.
// Como el módulo es local, un binario antiguo (o web) no lo trae: todo el
// fichero degrada a no-op en vez de romper el bundle.

type PipTimerNative = {
  isSupported: () => boolean;
  setAutoEnter: (enabled: boolean) => void;
  enter: () => void;
};

type PipModeEvent = { inPip: boolean };
type PipEmitter = {
  addListener: (
    event: 'onPipModeChanged',
    listener: (payload: PipModeEvent) => void
  ) => { remove: () => void };
};

let nativeModule: PipTimerNative | null = null;
let emitter: PipEmitter | null = null;

try {
  if (Platform.OS === 'android') {
    // Carga perezosa: requireNativeModule lanza si el binario no lo incluye.
    const core = require('expo-modules-core');
    nativeModule = core.requireNativeModule('PipTimer') as PipTimerNative;
    emitter = new core.EventEmitter(nativeModule) as PipEmitter;
  }
} catch {
  nativeModule = null;
  emitter = null;
}

/**
 * Enciende o apaga la entrada automática en la ventanita. Se llama al arrancar y
 * al parar el descanso: minimizar la app solo la abre si hay cuenta atrás viva.
 */
export function setPipAutoEnter(enabled: boolean): void {
  if (!nativeModule) return;
  try {
    nativeModule.setAutoEnter(enabled);
  } catch {
    // Un dispositivo sin PiP (o con el permiso revocado) simplemente no la abre.
  }
}

/**
 * Avisa cuando la app entra o sale de la ventanita. El árbol de React sigue
 * montado dentro, así que la raíz solo tiene que pintar encima la vista compacta
 * (ver components/PipRestTimer.tsx).
 */
export function subscribePipMode(
  listener: (inPip: boolean) => void
): () => void {
  if (!emitter) return () => {};
  const subscription = emitter.addListener('onPipModeChanged', ({ inPip }) =>
    listener(!!inPip)
  );
  return () => subscription.remove();
}
