import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { DEFAULT_ACTIVE_ROUTINE_ID, INITIAL_LOGS } from '@data/seedData';
import { WORKOUT_ROUTINES } from '@data/workoutDays';
import { WorkoutAppData } from '../types';
import { WeightSegment } from './cardio';
import { clearAppDataInDb, loadAppDataFromDb, saveAppDataToDb } from './db';
import { normalizeAppData } from './normalize';
import devWebSeed from '@data/devWebSeed.json';

// Claves del almacenamiento JSON. En nativo son legacy: solo se leen una vez
// para migrar a SQLite. En web siguen siendo el almacenamiento principal
// (expo-sqlite no está soportado en web en SDK 51).
const APP_STORAGE_KEY = 'gymbro_app_data';
const LOGS_STORAGE_KEY = 'gymbro_logs';
const LAST_SEEN_VERSION_KEY = 'gymbro_last_seen_version';

const isWeb = Platform.OS === 'web';

function getDefaultAppData(): WorkoutAppData {
  return {
    routines: WORKOUT_ROUTINES,
    activeRoutineId: DEFAULT_ACTIVE_ROUTINE_ID,
    logs: INITIAL_LOGS,
  };
}

// Datos de fábrica para sembrar el almacenamiento en el PRIMER arranque
// (solo corre si no hay datos previos; ver App.tsx). En builds de release
// (APK/AAB) __DEV__ es false: la app se instala completamente vacía, sin
// rutinas ni historial de ejemplo. Los datos seed solo se cargan en
// desarrollo. Esto no afecta a usuarios con datos: si ya existen, no se siembra.
export function getSeedAppData(): WorkoutAppData {
  if (!__DEV__) {
    return { routines: [], logs: [] };
  }
  // En web+dev se siembra desde el backup real (data/devWebSeed.json) para
  // poder probar las vistas con datos de verdad. En nativo dev se mantiene el
  // seed de fábrica (WORKOUT_ROUTINES / INITIAL_LOGS).
  if (isWeb) {
    return normalizeAppData(devWebSeed as Partial<WorkoutAppData>, {
      routines: [],
      logs: [],
    });
  }
  return getDefaultAppData();
}

// Historial de tramos de peso incluido en el backup de dev (solo web+dev),
// para que las kcal del cardio se calculen con el peso real y no con el
// valor por defecto. Vacío si el backup no lo trae o fuera de web+dev.
export function getSeedCardioWeightHistory(): WeightSegment[] {
  if (!__DEV__ || !isWeb) return [];
  const seed = devWebSeed as { cardioWeightHistory?: unknown };
  return isValidWeightSegments(seed.cardioWeightHistory)
    ? seed.cardioWeightHistory
    : [];
}

async function setStorageItem(key: string, value: string): Promise<void> {
  if (isWeb && typeof localStorage !== 'undefined') {
    localStorage.setItem(key, value);
    return;
  }

  await AsyncStorage.setItem(key, value);
}

async function getStorageItem(key: string): Promise<string | null> {
  if (isWeb && typeof localStorage !== 'undefined') {
    return localStorage.getItem(key);
  }

  return AsyncStorage.getItem(key);
}

async function removeStorageItem(key: string): Promise<void> {
  if (isWeb && typeof localStorage !== 'undefined') {
    localStorage.removeItem(key);
    return;
  }

  await AsyncStorage.removeItem(key);
}

async function readLegacyJsonData(
  fallback: WorkoutAppData
): Promise<WorkoutAppData | null> {
  const appJson = await getStorageItem(APP_STORAGE_KEY);
  if (appJson) {
    return normalizeAppData(JSON.parse(appJson), fallback);
  }

  const legacyLogsJson = await getStorageItem(LOGS_STORAGE_KEY);
  if (legacyLogsJson) {
    return normalizeAppData(
      {
        ...fallback,
        logs: JSON.parse(legacyLogsJson),
      },
      fallback
    );
  }

  return null;
}

// Ejercicios + series del historial: sirve para detectar si la normalización ha
// tenido que quitar duplicados (no para nada más; es un simple recuento).
function countLogEntries(logs: WorkoutAppData['logs']): number {
  return logs.reduce(
    (total, log) =>
      total +
      log.exercises.length +
      log.exercises.reduce(
        (sets, exercise) => sets + (exercise.parsedSets?.length ?? 0),
        0
      ),
    0
  );
}

export async function saveAppData(data: WorkoutAppData): Promise<void> {
  const normalized = normalizeAppData(data, getDefaultAppData());

  if (isWeb) {
    await setStorageItem(APP_STORAGE_KEY, JSON.stringify(normalized));
    return;
  }

  await saveAppDataToDb(normalized);
}

export async function loadAppData(): Promise<WorkoutAppData | null> {
  try {
    const fallback = getDefaultAppData();

    if (isWeb) {
      return readLegacyJsonData(fallback);
    }

    const fromDb = await loadAppDataFromDb();
    if (fromDb) {
      const normalized = normalizeAppData(fromDb, fallback);
      // Autorreparación: si al normalizar han desaparecido series o ejercicios,
      // eran duplicados del restore de la nube (ver normalize.ts). Hay que
      // reescribir la BD o la basura seguiría ahí y volvería a subir a la nube.
      if (countLogEntries(normalized.logs) < countLogEntries(fromDb.logs)) {
        await saveAppDataToDb(normalized);
      }
      return normalized;
    }

    // Migración única: primer arranque tras pasar a SQLite. Si hay JSON
    // del formato anterior en AsyncStorage, se vuelca a la BD y se borra.
    const legacy = await readLegacyJsonData(fallback);
    if (legacy) {
      await saveAppDataToDb(legacy);
      await removeStorageItem(APP_STORAGE_KEY);
      await removeStorageItem(LOGS_STORAGE_KEY);
      return legacy;
    }

    return null;
  } catch (error) {
    console.error('Error loading app data:', error);
    return null;
  }
}

// Historial de tramos de peso corporal (para estimar kcal del cardio). Se
// guarda siempre en AsyncStorage (funciona también en web), misma clave que
// venía usando CardioScreen.
const CARDIO_WEIGHT_HISTORY_KEY = 'cardioWeightHistory';
const LEGACY_CARDIO_WEIGHT_KEY = 'cardioWeightKg';

export function isValidWeightSegments(
  value: unknown
): value is WeightSegment[] {
  return (
    Array.isArray(value) &&
    value.every(
      (segment) =>
        segment &&
        typeof segment.weight === 'number' &&
        segment.weight > 0 &&
        typeof segment.appliesFrom === 'number' &&
        typeof segment.setAt === 'number'
    )
  );
}

export async function getCardioWeightHistory(): Promise<WeightSegment[]> {
  try {
    const raw = await AsyncStorage.getItem(CARDIO_WEIGHT_HISTORY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (isValidWeightSegments(parsed) && parsed.length) {
        return parsed;
      }
    }

    // Migración del peso único antiguo a un primer tramo.
    const legacy = await AsyncStorage.getItem(LEGACY_CARDIO_WEIGHT_KEY);
    const n = legacy ? parseFloat(legacy) : NaN;
    if (Number.isFinite(n) && n > 0) {
      return [{ weight: n, appliesFrom: 0, setAt: 0 }];
    }
  } catch {}

  return [];
}

export async function setCardioWeightHistory(
  segments: WeightSegment[]
): Promise<void> {
  await AsyncStorage.setItem(
    CARDIO_WEIGHT_HISTORY_KEY,
    JSON.stringify(segments)
  );
}

// Versión de la app que el usuario ya ha visto en el popup de novedades
// (components/WhatsNewModal.tsx). Independiente de los datos de entreno.
export async function getLastSeenVersion(): Promise<string | null> {
  return getStorageItem(LAST_SEEN_VERSION_KEY);
}

export async function setLastSeenVersion(version: string): Promise<void> {
  await setStorageItem(LAST_SEEN_VERSION_KEY, version);
}

export async function clearAppData(): Promise<void> {
  if (isWeb) {
    // Estado vacío explícito (no ausencia de clave) para que no se resucite la
    // seed al recargar; coherente con el "vacío inicializado" de SQLite.
    await setStorageItem(
      APP_STORAGE_KEY,
      JSON.stringify({ routines: [], logs: [] })
    );
    await removeStorageItem(LOGS_STORAGE_KEY);
    return;
  }

  await clearAppDataInDb();
  await removeStorageItem(APP_STORAGE_KEY);
  await removeStorageItem(LOGS_STORAGE_KEY);
}
