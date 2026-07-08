import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { DEFAULT_ACTIVE_ROUTINE_ID, INITIAL_LOGS } from '@data/seedData';
import { WORKOUT_ROUTINES } from '@data/workoutDays';
import { WorkoutAppData } from '../types';
import { clearAppDataInDb, loadAppDataFromDb, saveAppDataToDb } from './db';
import { normalizeAppData } from './normalize';

export { generateId, formatDate, getToday } from './utils';

// Claves del almacenamiento JSON. En nativo son legacy: solo se leen una vez
// para migrar a SQLite. En web siguen siendo el almacenamiento principal
// (expo-sqlite no está soportado en web en SDK 51).
const APP_STORAGE_KEY = 'gymbro_app_data';
const LOGS_STORAGE_KEY = 'gymbro_logs';

const isWeb = Platform.OS === 'web';

function getDefaultAppData(): WorkoutAppData {
  return {
    routines: WORKOUT_ROUTINES,
    activeRoutineId: DEFAULT_ACTIVE_ROUTINE_ID,
    logs: INITIAL_LOGS,
  };
}

// Datos de fábrica para sembrar el almacenamiento en el primer arranque.
export function getSeedAppData(): WorkoutAppData {
  return getDefaultAppData();
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
      return normalizeAppData(fromDb, fallback);
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
