// Ajustes de apariencia de la app (tema e idioma). Se leen de forma SÍNCRONA
// al evaluar el bundle para que theme.ts e i18n.ts fijen sus valores iniciales
// antes de que el resto de módulos creen sus StyleSheets y textos. Tanto el tema
// como el idioma se cambian luego EN CALIENTE (theme.ts `setThemeMode`, i18n.ts
// `setLanguage`), sin reiniciar.
// Sin imports duros de react-native/expo-sqlite: este módulo también se evalúa
// en jest (node), donde cae a los valores por defecto.

export type ThemeMode = 'dark' | 'light';
export type Language = 'es' | 'en';

const THEME_KEY = 'themeMode';
const LANGUAGE_KEY = 'language';
const AUTO_BACKUP_KEY = 'autoBackupEnabled';
const LAST_AUTO_BACKUP_KEY = 'lastAutoBackupAt';
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

// Backup automático local: activado por defecto (la app es local-only, así que
// un backup silencioso es la única red de seguridad sin export manual).
export function getAutoBackupEnabled(): boolean {
  return readSetting(AUTO_BACKUP_KEY) !== 'false';
}

export function setAutoBackupEnabled(enabled: boolean): void {
  writeSetting(AUTO_BACKUP_KEY, enabled ? 'true' : 'false');
}

/** Marca de tiempo (ms) del último backup automático, o 0 si nunca. */
export function getLastAutoBackupAt(): number {
  const raw = readSetting(LAST_AUTO_BACKUP_KEY);
  const value = raw ? parseInt(raw, 10) : 0;
  return Number.isFinite(value) ? value : 0;
}

export function setLastAutoBackupAt(timestamp: number): void {
  writeSetting(LAST_AUTO_BACKUP_KEY, String(timestamp));
}
