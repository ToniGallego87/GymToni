import { Platform } from 'react-native';
import { WorkoutAction, WorkoutAppData, WorkoutState } from '../types';
import {
  dbDeleteRoutine,
  dbDeleteWorkoutLog,
  dbSetActiveRoutine,
  dbSetSelectedRoutine,
  dbUpdateDay,
  dbUpsertRoutine,
  dbUpsertWorkoutLog,
} from './db';
import { saveAppData } from './storage';

const isWeb = Platform.OS === 'web';
const WEB_SAVE_DEBOUNCE_MS = 500;

function toAppData(state: WorkoutState): WorkoutAppData {
  return {
    routines: state.routines,
    activeRoutineId: state.activeRoutineId,
    selectedRoutineId: state.selectedRoutineId,
    logs: state.logs,
  };
}

// Cola serie: garantiza que las escrituras se aplican en el orden de despacho
// (p. ej. el DELETE + ADD del autoguardado de un log no se solapan).
let writeChain: Promise<unknown> = Promise.resolve();

function enqueue(operation: () => Promise<void>): void {
  const run = () =>
    operation().catch((error) => {
      console.error('Error persisting change:', error);
    });
  writeChain = writeChain.then(run, run);
}

let webSaveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingWebData: WorkoutAppData | null = null;

function scheduleWebSave(data: WorkoutAppData): void {
  pendingWebData = data;
  if (webSaveTimer) {
    clearTimeout(webSaveTimer);
  }
  webSaveTimer = setTimeout(() => {
    webSaveTimer = null;
    const snapshot = pendingWebData;
    pendingWebData = null;
    if (snapshot) {
      saveAppData(snapshot).catch((error) => {
        console.error('Error persisting change:', error);
      });
    }
  }, WEB_SAVE_DEBOUNCE_MS);
}

/**
 * Persiste el efecto de una acción ya aplicada por el reducer.
 *
 * - SET_APP_DATA / CLEAR_DATA se persisten explícitamente en sus handlers
 *   (import, clear): aquí se ignoran.
 * - En web se mantiene el guardado completo en JSON (con debounce).
 * - En nativo se hacen escrituras granulares en SQLite.
 *
 * `next` es el estado resultante: de él se derivan valores que el reducer
 * calcula (p. ej. la rutina activa tras crear/borrar).
 */
export function persistAction(action: WorkoutAction, next: WorkoutState): void {
  if (action.type === 'SET_APP_DATA' || action.type === 'CLEAR_DATA') {
    return;
  }

  if (isWeb) {
    scheduleWebSave(toAppData(next));
    return;
  }

  switch (action.type) {
    case 'ADD_ROUTINE':
      enqueue(async () => {
        await dbUpsertRoutine(action.payload);
        // Una rutina nueva no cambia la activa pero sí pasa a ser la
        // seleccionada (queda "preparada").
        await dbSetActiveRoutine(next.activeRoutineId);
        await dbSetSelectedRoutine(next.selectedRoutineId);
      });
      break;
    case 'UPDATE_ROUTINE':
      enqueue(() => dbUpsertRoutine(action.payload));
      break;
    case 'DELETE_ROUTINE':
      enqueue(async () => {
        await dbDeleteRoutine(action.payload);
        await dbSetActiveRoutine(next.activeRoutineId);
        await dbSetSelectedRoutine(next.selectedRoutineId);
      });
      break;
    case 'SET_ACTIVE_ROUTINE':
      enqueue(() => dbSetActiveRoutine(next.activeRoutineId));
      break;
    case 'SET_SELECTED_ROUTINE':
      enqueue(() => dbSetSelectedRoutine(next.selectedRoutineId));
      break;
    case 'ADD_WORKOUT_LOG':
      enqueue(async () => {
        await dbUpsertWorkoutLog(action.payload);
        // Registrar el primer día de una rutina preparada la activa: hay que
        // persistir también el cambio de rutina activa.
        await dbSetActiveRoutine(next.activeRoutineId);
      });
      break;
    case 'UPDATE_WORKOUT_LOG':
      enqueue(() => dbUpsertWorkoutLog(action.payload));
      break;
    case 'DELETE_WORKOUT_LOG':
      enqueue(() => dbDeleteWorkoutLog(action.payload));
      break;
    case 'UPDATE_DAY':
      enqueue(() => dbUpdateDay(action.payload.routineId, action.payload.day));
      break;
    default:
      break;
  }
}
