import React, { createContext, ReactNode, useReducer } from 'react';
import { DEFAULT_ACTIVE_ROUTINE_ID, INITIAL_LOGS } from '@data/seedData';
import { WORKOUT_ROUTINES } from '@data/workoutDays';
import { WorkoutAction, WorkoutRoutine, WorkoutState } from '@types/index';
import { parseSeriesString } from '@lib/parsers';

const syncActiveRoutine = (routines: WorkoutRoutine[], activeRoutineId?: string) => {
  return routines.map(routine => ({
    ...routine,
    isActive: routine.id === activeRoutineId,
  }));
};

// Ensure all logs have parsedSets properly populated
const ensureParsedSets = (logs: typeof INITIAL_LOGS) => {
  return logs.map(log => ({
    ...log,
    exercises: (log.exercises || []).map(exercise => ({
      ...exercise,
      parsedSets: (exercise.parsedSets && exercise.parsedSets.length > 0)
        ? exercise.parsedSets
        : parseSeriesString(exercise.rawInput || ''),
    })),
  }));
};

const initialState: WorkoutState = {
  routines: syncActiveRoutine(WORKOUT_ROUTINES, DEFAULT_ACTIVE_ROUTINE_ID || WORKOUT_ROUTINES[WORKOUT_ROUTINES.length - 1]?.id),
  activeRoutineId: DEFAULT_ACTIVE_ROUTINE_ID || WORKOUT_ROUTINES[WORKOUT_ROUTINES.length - 1]?.id,
  logs: ensureParsedSets(INITIAL_LOGS),
};

function workoutReducer(state: WorkoutState, action: WorkoutAction): WorkoutState {
  switch (action.type) {
    case 'SET_APP_DATA': {
      const activeRoutineId = action.payload.activeRoutineId
        || action.payload.routines.find(routine => routine.isActive)?.id
        || action.payload.routines[action.payload.routines.length - 1]?.id
        || undefined;

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
  const [state, dispatch] = useReducer(workoutReducer, initialState);

  return (
    <WorkoutContext.Provider value={{ state, dispatch }}>
      {children}
    </WorkoutContext.Provider>
  );
}
