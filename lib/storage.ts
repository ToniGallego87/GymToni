import { WorkoutLog } from '@types/index';

const LOGS_STORAGE_KEY = 'gymtrack_logs';

export async function saveLogs(logs: WorkoutLog[]): Promise<void> {
  try {
    const jsonString = JSON.stringify(logs);
    localStorage.setItem(LOGS_STORAGE_KEY, jsonString);
  } catch (error) {
    console.error('Error saving logs:', error);
    throw error;
  }
}

export async function loadLogs(): Promise<WorkoutLog[]> {
  try {
    const jsonString = localStorage.getItem(LOGS_STORAGE_KEY);
    if (!jsonString) return [];
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Error loading logs:', error);
    return [];
  }
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const dayName = date.toLocaleDateString('es-ES', { weekday: 'long' });
  const capitalizedDay = dayName.charAt(0).toUpperCase() + dayName.slice(1);
  
  return date.toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).replace(/^[a-z]/, c => c.toUpperCase());
}

export function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getToday(): string {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

export function getWeekNumber(timestamp: number): number {
  const date = new Date(timestamp);
  const start = new Date(date.getFullYear(), 0, 1);
  const diff = date.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  const day = Math.floor(diff / oneDay);
  return Math.ceil((day + start.getDay() + 1) / 7);
}
