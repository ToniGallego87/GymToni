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
const REST_TIMER_KEY = 'restTimerSeconds';
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

// Descanso por defecto entre series, en segundos. Es un ajuste de la PERSONA
// (antes vivía en cada rutina; ver lib/restTimerStore). `null` = nunca fijado:
// la migración de la BD lo siembra con el de la rutina activa la primera vez.
export function getStoredRestTimerSeconds(): number | null {
  const raw = readSetting(REST_TIMER_KEY);
  const value = raw ? parseInt(raw, 10) : NaN;
  // 0 es un valor fijado de verdad ("sin descanso"), no un "nunca fijado":
  // devolverlo como null resucitaría el valor por defecto en cada arranque.
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function setStoredRestTimerSeconds(seconds: number): void {
  writeSetting(REST_TIMER_KEY, String(seconds));
}

// Retos semanales superados, como lista de claves `id@periodo` (ver
// lib/level.ts). Es lo ÚNICO de los retos que se guarda: el nivel de la cuenta
// sale de aquí y no debe bajar aunque se borre historial.
const CHALLENGE_WINS_KEY = 'challengeWins';

export function getStoredChallengeWins(): string[] {
  const raw = readSetting(CHALLENGE_WINS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === 'string')
      : [];
  } catch {
    return [];
  }
}

export function setStoredChallengeWins(wins: string[]): void {
  writeSetting(CHALLENGE_WINS_KEY, JSON.stringify(wins));
}

// Logros (insignias) de los que ya se ha avisado, por id. Sirve solo para no
// repetir el popup de "¡Nuevo logro!": las insignias en sí se rederivan del
// historial (lib/badges.ts). `null` = nunca guardado (primer arranque con
// esta versión): quien lo lea debe sembrarlo con lo ya desbloqueado sin
// avisar, para no soltar un popup por cada logro viejo.
const SEEN_BADGES_KEY = 'seenBadges';

export function getStoredSeenBadges(): string[] | null {
  const raw = readSetting(SEEN_BADGES_KEY);
  if (raw === null || raw === undefined) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === 'string')
      : [];
  } catch {
    return [];
  }
}

export function setStoredSeenBadges(ids: string[]): void {
  writeSetting(SEEN_BADGES_KEY, JSON.stringify(ids));
}

// Hitos de la Actividad ya publicados en la nube, por clave `kind:ref` (ver
// lib/activity.ts). Evita reenviar en cada arranque lo que ya está subido: la
// tabla es idempotente (`unique (user_id, kind, ref)`), así que esto es un
// ahorro de red, no la fuente de verdad. Borrarlo solo provoca una resubida.
const PUBLISHED_ACTIVITY_KEY = 'publishedActivity';

export function getStoredPublishedActivity(): string[] {
  const raw = readSetting(PUBLISHED_ACTIVITY_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === 'string')
      : [];
  } catch {
    return [];
  }
}

export function setStoredPublishedActivity(keys: string[]): void {
  writeSetting(PUBLISHED_ACTIVITY_KEY, JSON.stringify(keys));
}

// ¿Ya se separaron los registros que llevaban fuerza y cardio en un mismo log?
// (ver splitMixedCardioLogs). Se marca tras la primera pasada —también cuando no
// había ninguno que partir, como en una instalación nueva— y a partir de ahí no
// se vuelve a comprobar. OJO: un log mixto que llegue DESPUÉS por sync, desde un
// dispositivo con una versión anterior de la app, ya no se separará; borrar esta
// clave vuelve a armar la comprobación.
const CARDIO_SPLIT_KEY = 'cardioSplitDone';

export function getStoredCardioSplitDone(): boolean {
  return readSetting(CARDIO_SPLIT_KEY) === '1';
}

export function setStoredCardioSplitDone(): void {
  writeSetting(CARDIO_SPLIT_KEY, '1');
}
