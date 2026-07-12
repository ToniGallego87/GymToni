// Ajustes de apariencia de la app (tema e idioma). Se leen de forma SÍNCRONA
// al evaluar el bundle para que theme.ts e i18n.ts fijen sus valores antes de
// que el resto de módulos creen sus StyleSheets y textos; por eso un cambio de
// tema/idioma se aplica relanzando el bundle (SettingsScreen usa
// react-native-restart). Sin imports duros de react-native/expo-sqlite: este
// módulo también se evalúa en jest (node), donde cae a los valores por defecto.

export type ThemeMode = 'dark' | 'light';
export type Language = 'es' | 'en';

const THEME_KEY = 'themeMode';
const LANGUAGE_KEY = 'language';
// En web (sin SQLite en SDK 51) se usa localStorage con este prefijo.
const WEB_PREFIX = 'gymbro_setting_';

type SettingsDb = {
  execSync(source: string): void;
  getFirstSync<T>(source: string, params: unknown[]): T | null;
  runSync(source: string, params: unknown[]): void;
};

let db: SettingsDb | null = null;

function isWeb(): boolean {
  try {
    const { Platform } = require('react-native');
    return Platform.OS === 'web';
  } catch {
    return false;
  }
}

function getDb(): SettingsDb | null {
  if (db) return db;
  try {
    const sqlite = require('expo-sqlite');
    const opened = sqlite.openDatabaseSync('gymbro-settings.db') as SettingsDb;
    opened.execSync(
      'CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);'
    );
    db = opened;
    return db;
  } catch {
    return null;
  }
}

function readSetting(key: string): string | null {
  try {
    if (isWeb()) {
      return typeof localStorage !== 'undefined'
        ? localStorage.getItem(WEB_PREFIX + key)
        : null;
    }
    const row = getDb()?.getFirstSync<{ value: string }>(
      'SELECT value FROM settings WHERE key = ?',
      [key]
    );
    return row?.value ?? null;
  } catch {
    return null;
  }
}

function writeSetting(key: string, value: string): void {
  try {
    if (isWeb()) {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(WEB_PREFIX + key, value);
      }
      return;
    }
    getDb()?.runSync(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      [key, value]
    );
  } catch {}
}

export function getStoredThemeMode(): ThemeMode {
  return readSetting(THEME_KEY) === 'light' ? 'light' : 'dark';
}

export function setStoredThemeMode(mode: ThemeMode): void {
  writeSetting(THEME_KEY, mode);
}

export function getStoredLanguage(): Language {
  return readSetting(LANGUAGE_KEY) === 'en' ? 'en' : 'es';
}

export function setStoredLanguage(language: Language): void {
  writeSetting(LANGUAGE_KEY, language);
}

// Relanza el bundle JS para aplicar tema/idioma. En web recarga la página; en
// nativo usa react-native-restart (si no estuviera disponible, no hace nada y
// el cambio se aplicará en el siguiente arranque).
export function restartApp(): void {
  try {
    if (isWeb()) {
      if (typeof location !== 'undefined') location.reload();
      return;
    }
    const RNRestart = require('react-native-restart').default;
    RNRestart.restart();
  } catch {}
}
