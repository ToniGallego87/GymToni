import { Platform } from 'react-native';
import type { ThemeMode } from './appSettings';

// Splash nativo y tema. El tema lo manda la base de ajustes (appSettings.ts);
// el splash nativo se pinta antes de que exista JS, así que en Android el
// módulo local modules/splash-theme guarda un ESPEJO del modo
// (SharedPreferences) que lee MainActivity al arrancar.
// Como el módulo es local, un binario sin él (o iOS/web) degrada a no-op.

type SplashThemeNative = {
  getWindowMode(): ThemeMode;
  setMode(mode: ThemeMode, updateWindow: boolean): void;
};

let nativeModule: SplashThemeNative | null = null;

try {
  if (Platform.OS === 'android') {
    // Carga perezosa: requireNativeModule lanza si el binario no lo incluye.
    const core = require('expo-modules-core');
    nativeModule = core.requireNativeModule('SplashTheme') as SplashThemeNative;
  }
} catch {
  nativeModule = null;
}

/**
 * Fondo del splash nativo que se está viendo, para que SplashFade lo copie y
 * el relevo no se note. Android: el fondo de la ventana de MainActivity (lo
 * decide el nativo). iOS: fondo negro (app.json). Web: no hay splash nativo,
 * así que el de la app.
 */
export function nativeSplashMode(appMode: ThemeMode): ThemeMode {
  if (Platform.OS === 'web') return appMode;
  if (Platform.OS === 'ios') return 'dark';
  try {
    // Sin poder preguntar, el de la app: el espejo casi siempre coincide.
    return nativeModule?.getWindowMode() ?? appMode;
  } catch {
    return appMode;
  }
}

/**
 * Pone el espejo al modo de la app y lo aplica a MainActivity: el splash del
 * sistema del siguiente arranque y, con `updateWindow` (solo cuando la app ya
 * tapa la ventana; si no, el cambio se vería), el fondo de la ventana. Se
 * llama al arrancar y en cada cambio de tema: así también se migra quien venía
 * de antes del espejo y se corrige cualquier escritura perdida. Si falla, solo
 * se resiente el color de un splash.
 */
export function syncSplashTheme(mode: ThemeMode, updateWindow: boolean): void {
  try {
    nativeModule?.setMode(mode, updateWindow);
  } catch {}
}
