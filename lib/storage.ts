import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { DEFAULT_ACTIVE_ROUTINE_ID, INITIAL_LOGS } from '@data/seedData';
import { WORKOUT_ROUTINES } from '@data/workoutDays';
import { WorkoutAppData } from '../types';
import { normalizeAppData } from './normalize';

export { generateId, formatDate, getToday } from './utils';

const APP_STORAGE_KEY = 'gymtrack_app_data';
const LOGS_STORAGE_KEY = 'gymtrack_logs';

function getDefaultAppData(): WorkoutAppData {
  return {
    routines: WORKOUT_ROUTINES,
    activeRoutineId: DEFAULT_ACTIVE_ROUTINE_ID,
    logs: INITIAL_LOGS,
  };
}

async function setStorageItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    localStorage.setItem(key, value);
    return;
  }

  await AsyncStorage.setItem(key, value);
}

async function getStorageItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    return localStorage.getItem(key);
  }

  return AsyncStorage.getItem(key);
}

async function removeStorageItem(key: string): Promise<void> {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    localStorage.removeItem(key);
    return;
  }

  await AsyncStorage.removeItem(key);
}

export async function saveAppData(data: WorkoutAppData): Promise<void> {
  const normalized = normalizeAppData(data, getDefaultAppData());
  const jsonString = JSON.stringify(normalized);
  await setStorageItem(APP_STORAGE_KEY, jsonString);
  await setStorageItem(LOGS_STORAGE_KEY, JSON.stringify(normalized.logs));
}

export async function loadAppData(): Promise<WorkoutAppData | null> {
  try {
    const fallback = getDefaultAppData();
    const appJson = await getStorageItem(APP_STORAGE_KEY);
    if (appJson) {
      return normalizeAppData(JSON.parse(appJson), fallback);
    }

    const legacyLogsJson = await getStorageItem(LOGS_STORAGE_KEY);
    if (legacyLogsJson) {
      return normalizeAppData({
        ...fallback,
        logs: JSON.parse(legacyLogsJson),
      }, fallback);
    }

    return null;
  } catch (error) {
    console.error('Error loading app data:', error);
    return null;
  }
}

export async function clearAppData(): Promise<void> {
  await removeStorageItem(APP_STORAGE_KEY);
  await removeStorageItem(LOGS_STORAGE_KEY);
}
