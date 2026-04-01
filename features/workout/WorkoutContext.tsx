import React, { createContext, useReducer, ReactNode } from 'react';
import { WorkoutState, WorkoutAction, WorkoutLog, WorkoutRoutine } from '@types/index';
import { WORKOUT_ROUTINES } from '@data/workoutDays';

const initialState: WorkoutState = {
  routines: WORKOUT_ROUTINES,
  activeRoutineId: 'routine3',
  logs: [],
};

function workoutReducer(state: WorkoutState, action: WorkoutAction): WorkoutState {
  switch (action.type) {
    case 'SET_ROUTINES':
      return { ...state, routines: action.payload };
    case 'SET_ACTIVE_ROUTINE':
      return { ...state, activeRoutineId: action.payload };
    case 'ADD_WORKOUT_LOG':
      return { ...state, logs: [...state.logs, action.payload] };
    case 'UPDATE_WORKOUT_LOG':
      return {
        ...state,
        logs: state.logs.map(log =>
          log.id === action.payload.id ? action.payload : log
        ),
      };
    case 'DELETE_WORKOUT_LOG':
      return {
        ...state,
        logs: state.logs.filter(log => log.id !== action.payload),
      };
    case 'SET_LOGS':
      return { ...state, logs: action.payload };
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
