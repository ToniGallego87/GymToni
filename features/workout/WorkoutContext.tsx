import React, { createContext, ReactNode, useCallback, useReducer, useRef } from 'react';
import { DEFAULT_ACTIVE_ROUTINE_ID, INITIAL_LOGS } from '@data/seedData';
import { WORKOUT_ROUTINES } from '@data/workoutDays';
import { WorkoutAction, WorkoutState } from '../../types';
import { ensureParsedSets, resolveActiveRoutineId, syncActiveRoutine } from '@lib/normalize';
import { persistAction } from '@lib/persistence';

const initialState: WorkoutState = {
  routines: syncActiveRoutine(WORKOUT_ROUTINES, DEFAULT_ACTIVE_ROUTINE_ID || WORKOUT_ROUTINES[WORKOUT_ROUTINES.length - 1]?.id),
  activeRoutineId: DEFAULT_ACTIVE_ROUTINE_ID || WORKOUT_ROUTINES[WORKOUT_ROUTINES.length - 1]?.id,
  logs: ensureParsedSets(INITIAL_LOGS),
};

function workoutReducer(state: WorkoutState, action: WorkoutAction): WorkoutState {
  switch (action.type) {
    case 'SET_APP_DATA': {
      const activeRoutineId = resolveActiveRoutineId(
        action.payload.routines,
        action.payload.activeRoutineId
      );

      return {
        ...state,
        routines: syncActiveRoutine(action.payload.routines, activeRoutineId),
        activeRoutineId,
        logs: action.payload.logs,
      };
    }
    case 'SET_ROUTINES':
      return {
        ...state,
        routines: syncActiveRoutine(action.payload, state.activeRoutineId),
      };
    case 'ADD_ROUTINE':
      return {
        ...state,
        routines: syncActiveRoutine([...state.routines, action.payload], action.payload.id),
        activeRoutineId: action.payload.id,
      };
    case 'DELETE_ROUTINE': {
      const nextRoutines = state.routines.filter(routine => routine.id !== action.payload);
      const nextActiveRoutineId = state.activeRoutineId === action.payload
        ? nextRoutines[nextRoutines.length - 1]?.id
        : state.activeRoutineId;

      return {
        ...state,
        routines: syncActiveRoutine(nextRoutines, nextActiveRoutineId),
        activeRoutineId: nextActiveRoutineId,
        logs: state.logs.filter(log => log.routineId !== action.payload),
      };
    }
    case 'UPDATE_ROUTINE':
      return {
        ...state,
        routines: syncActiveRoutine(
          state.routines.map(routine =>
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
    case 'ADD_WORKOUT_LOG':
      return { ...state, logs: [...state.logs, action.payload] };
    case 'UPDATE_WORKOUT_LOG':
      return {
        ...state,
        logs: state.logs.map(log => (
          log.id === action.payload.id ? action.payload : log
        )),
      };
    case 'DELETE_WORKOUT_LOG':
      return {
        ...state,
        logs: state.logs.filter(log => log.id !== action.payload),
      };
    case 'SET_LOGS':
      return { ...state, logs: action.payload };
    case 'UPDATE_DAY': {
      return {
        ...state,
        routines: state.routines.map(routine => {
          if (routine.id === action.payload.routineId) {
            return {
              ...routine,
              days: routine.days.map(day => {
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
        logs: [],
        currentDay: undefined,
      };
    case 'SET_CURRENT_DAY':
      return { ...state, currentDay: action.payload };
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
