import { Platform } from 'react-native';
import type { ThemeMode } from './appSettings';

// Tema del splash nativo (modules/splash-theme, solo Android). El splash se
// pinta antes de que exista JS: aquí se le deja dicho al nativo con qué modo
// arrancará la app la próxima vez (y se ajusta ya el fondo de la ventana).
// Como el módulo es local, un binario antiguo (o web) no lo trae: no-op.

type SplashThemeNative = { setMode: (mode: ThemeMode) => void };

let nativeModule: SplashThemeNative | null = null;

try {
  if (Platform.OS === 'android') {
    const core = require('expo-modules-core');
    nativeModule = core.requireNativeModule('SplashTheme') as SplashThemeNative;
  }
} catch {
  nativeModule = null;
}

export function syncSplashTheme(mode: ThemeMode): void {
  try {
    nativeModule?.setMode(mode);
  } catch {}
}
