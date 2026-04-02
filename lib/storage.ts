import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { DEFAULT_ACTIVE_ROUTINE_ID, INITIAL_LOGS } from '@data/seedData';
import { WORKOUT_ROUTINES } from '@data/workoutDays';
import { WorkoutAppData, WorkoutRoutine } from '@types/index';
import { parseSeriesString } from './parsers';

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

function normalizeRoutines(routines: WorkoutRoutine[], activeRoutineId?: string) {
  return routines.map(routine => ({
    ...routine,
    isActive: routine.id === activeRoutineId,
  }));
}

function normalizeAppData(payload?: Partial<WorkoutAppData> | null): WorkoutAppData {
  const fallback = getDefaultAppData();
  const routines = Array.isArray(payload?.routines) ? payload.routines : fallback.routines;
  let logs = Array.isArray(payload?.logs) ? payload.logs : fallback.logs;
  
  // Ensure all logs have parsedSets properly populated
  logs = logs.map(log => ({
    ...log,
    exercises: (log.exercises || []).map(exercise => ({
      ...exercise,
      parsedSets: (exercise.parsedSets && exercise.parsedSets.length > 0)
        ? exercise.parsedSets
        : parseSeriesString(exercise.rawInput || ''),
    })),
  }));

  const activeRoutineId = payload?.activeRoutineId
    || routines.find(routine => routine.isActive)?.id
    || routines[0]?.id
    || undefined;

  return {
    routines: normalizeRoutines(routines, activeRoutineId),
    activeRoutineId,
    logs,
  };
}

export async function saveAppData(data: WorkoutAppData): Promise<void> {
  const normalized = normalizeAppData(data);
  const jsonString = JSON.stringify(normalized);
  await setStorageItem(APP_STORAGE_KEY, jsonString);
  await setStorageItem(LOGS_STORAGE_KEY, JSON.stringify(normalized.logs));
}

export async function loadAppData(): Promise<WorkoutAppData | null> {
  try {
    const appJson = await getStorageItem(APP_STORAGE_KEY);
    if (appJson) {
      return normalizeAppData(JSON.parse(appJson));
    }

    const legacyLogsJson = await getStorageItem(LOGS_STORAGE_KEY);
    if (legacyLogsJson) {
      return normalizeAppData({
        ...getDefaultAppData(),
        logs: JSON.parse(legacyLogsJson),
      });
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

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).replace(/^[a-z]/, c => c.toUpperCase());
}

export function getToday(): string {
  return new Date().toISOString().split('T')[0];
}
