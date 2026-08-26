import React, {
  createContext,
  ReactNode,
  useCallback,
  useReducer,
  useRef,
} from 'react';
import { DEFAULT_ACTIVE_ROUTINE_ID, INITIAL_LOGS } from '@data/seedData';
import { WORKOUT_ROUTINES } from '@data/workoutDays';
import { WorkoutAction, WorkoutState } from '../../types';
import {
  ensureParsedSets,
  resolveActiveRoutineId,
  syncActiveRoutine,
} from '@lib/normalize';
import { persistAction } from '@lib/persistence';

const initialActiveRoutineId = resolveActiveRoutineId(
  WORKOUT_ROUTINES,
  DEFAULT_ACTIVE_ROUTINE_ID
);

const initialState: WorkoutState = {
  routines: syncActiveRoutine(WORKOUT_ROUTINES, initialActiveRoutineId),
  activeRoutineId: initialActiveRoutineId,
  selectedRoutineId: initialActiveRoutineId,
  logs: ensureParsedSets(INITIAL_LOGS),
};

// Una rutina está "preparada" si no es la activa y aún no tiene ningún
// entrenamiento registrado. Al registrar el primer día de una preparada,
// pasa a ser la activa (ver ADD_WORKOUT_LOG).
function isPreparedRoutine(
  state: WorkoutState,
  routineId: string | undefined
): boolean {
  if (!routineId || routineId === state.activeRoutineId) return false;
  return !state.logs.some((log) => log.routineId === routineId);
}

function workoutReducer(
  state: WorkoutState,
  action: WorkoutAction
): WorkoutState {
  switch (action.type) {
    case 'SET_APP_DATA': {
      const activeRoutineId = resolveActiveRoutineId(
        action.payload.routines,
        action.payload.activeRoutineId
      );
      // La seleccionada solo se conserva si sigue existiendo; si no, cae a la
      // activa (misma rutina que se muestra en Inicio por defecto).
      const selectedRoutineId = action.payload.routines.some(
        (routine) => routine.id === action.payload.selectedRoutineId
      )
        ? action.payload.selectedRoutineId
        : activeRoutineId;

      return {
        ...state,
        routines: syncActiveRoutine(action.payload.routines, activeRoutineId),
        activeRoutineId,
        selectedRoutineId,
        logs: action.payload.logs,
      };
    }
    case 'ADD_ROUTINE':
      // Una rutina nueva NO pasa a ser la activa: queda "preparada" y
      // seleccionada (se muestra en Inicio). Se activará al registrar en ella
      // el primer día de entrenamiento (ver ADD_WORKOUT_LOG).
      return {
        ...state,
        routines: syncActiveRoutine(
          [...state.routines, action.payload],
          state.activeRoutineId
        ),
        selectedRoutineId: action.payload.id,
      };
    case 'DELETE_ROUTINE': {
      const nextRoutines = state.routines.filter(
        (routine) => routine.id !== action.payload
      );
      const nextActiveRoutineId =
        state.activeRoutineId === action.payload
          ? nextRoutines[nextRoutines.length - 1]?.id
          : state.activeRoutineId;
      // Si se borra la seleccionada, la selección cae a la activa resultante.
      const nextSelectedRoutineId =
        state.selectedRoutineId === action.payload
          ? nextActiveRoutineId
          : state.selectedRoutineId;

      return {
        ...state,
        routines: syncActiveRoutine(nextRoutines, nextActiveRoutineId),
        activeRoutineId: nextActiveRoutineId,
        selectedRoutineId: nextSelectedRoutineId,
        logs: state.logs.filter((log) => log.routineId !== action.payload),
      };
    }
    case 'UPDATE_ROUTINE':
      return {
        ...state,
        routines: syncActiveRoutine(
          state.routines.map((routine) =>
            routine.id === action.payload.id ? action.payload : routine
          ),
          state.activeRoutineId
        ),
      };
    case 'SET_ACTIVE_ROUTINE':
      return {
        ...state,
        activeRoutineId: action.payload,
        routines: syncActiveRoutine(state.routines, action.payload),
      };
    case 'SET_SELECTED_ROUTINE':
      return { ...state, selectedRoutineId: action.payload };
    case 'ADD_WORKOUT_LOG': {
      // Registrar el primer día en una rutina "preparada" la convierte en la
      // activa (el usuario ha empezado a entrenarla de verdad). Una sesión de
      // solo cardio NO cuenta como entrenamiento de fuerza: no activa nada.
      const promoteToActive =
        !action.payload.cardioOnly &&
        isPreparedRoutine(state, action.payload.routineId);
      return {
        ...state,
        logs: [...state.logs, action.payload],
        activeRoutineId: promoteToActive
          ? action.payload.routineId
          : state.activeRoutineId,
        routines: promoteToActive
          ? syncActiveRoutine(state.routines, action.payload.routineId)
          : state.routines,
      };
    }
    case 'UPDATE_WORKOUT_LOG': {
      // Upsert: el registro autoguarda siempre sobre el mismo id, así que si el
      // log ya no está (p. ej. lo quitó un SET_APP_DATA venido de la nube en
      // mitad de la sesión) se reinserta en vez de perder lo insertado.
      const exists = state.logs.some((log) => log.id === action.payload.id);
      return {
        ...state,
        logs: exists
          ? state.logs.map((log) =>
              log.id === action.payload.id ? action.payload : log
            )
          : [...state.logs, action.payload],
      };
    }
    case 'DELETE_WORKOUT_LOG':
      return {
        ...state,
        logs: state.logs.filter((log) => log.id !== action.payload),
      };
    case 'UPDATE_DAY': {
      return {
        ...state,
        routines: state.routines.map((routine) => {
          if (routine.id === action.payload.routineId) {
            return {
              ...routine,
              days: routine.days.map((day) => {
                if (day.id === action.payload.dayId) {
                  return action.payload.day;
                }
                return day;
              }),
            };
          }
          return routine;
        }),
      };
    }
    case 'CLEAR_DATA':
      return {
        ...state,
        routines: [],
        activeRoutineId: undefined,
        selectedRoutineId: undefined,
        logs: [],
      };
    default:
      return state;
  }
}

export const WorkoutContext = createContext<{
  state: WorkoutState;
  dispatch: React.Dispatch<WorkoutAction>;
}>({
  state: initialState,
  dispatch: () => {},
});

export function WorkoutProvider({ children }: { children: ReactNode }) {
  const [state, baseDispatch] = useReducer(workoutReducer, initialState);

  // Espejo síncrono del estado: permite derivar el resultado de una acción
  // (y persistirlo) incluso para dispatches encadenados en el mismo tick,
  // antes de que React confirme el re-render.
  const stateRef = useRef(state);
  stateRef.current = state;

  const dispatch = useCallback((action: WorkoutAction) => {
    const next = workoutReducer(stateRef.current, action);
    stateRef.current = next;
    baseDispatch(action);
    persistAction(action, next);
  }, []);

  return (
    <WorkoutContext.Provider value={{ state, dispatch }}>
      {children}
    </WorkoutContext.Provider>
  );
}
