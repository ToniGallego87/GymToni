import { useMemo } from 'react';
import {
  buildExerciseKeyResolver,
  collectExerciseNames,
  ExerciseKeyResolver,
} from '@lib/exerciseIdentity';
import { WorkoutLog, WorkoutRoutine } from '../types';
import { useWorkout } from './useWorkout';

// Última construcción, compartida entre pantallas: recorre todo el historial y
// cada vista que lo pide (registro, detalle, cada fila de ejercicio al editar)
// lo rehacía al montarse con los mismos datos. Rutinas y logs son inmutables
// (el reducer crea arrays nuevos al cambiar), así que la identidad basta.
let lastResolver: {
  routines: WorkoutRoutine[];
  logs: WorkoutLog[];
  resolve: ExerciseKeyResolver;
} | null = null;
let lastNames: {
  routines: WorkoutRoutine[];
  logs: WorkoutLog[];
  resolve: ExerciseKeyResolver;
  namesByKey: Map<string, string[]>;
} | null = null;

function sharedResolver(
  routines: WorkoutRoutine[],
  logs: WorkoutLog[]
): ExerciseKeyResolver {
  if (lastResolver?.routines !== routines || lastResolver.logs !== logs) {
    lastResolver = {
      routines,
      logs,
      resolve: buildExerciseKeyResolver(routines, logs),
    };
  }
  return lastResolver.resolve;
}

function sharedNames(
  routines: WorkoutRoutine[],
  logs: WorkoutLog[],
  resolve: ExerciseKeyResolver
): Map<string, string[]> {
  if (
    lastNames?.routines !== routines ||
    lastNames.logs !== logs ||
    lastNames.resolve !== resolve
  ) {
    lastNames = {
      routines,
      logs,
      resolve,
      namesByKey: collectExerciseNames(routines, logs, resolve),
    };
  }
  return lastNames.namesByKey;
}

/**
 * Resolutor de la identidad de un ejercicio (ver lib/exerciseIdentity.ts) con
 * las rutinas y el historial de la persona. Se rehace solo cuando cambian.
 */
export function useExerciseKeyResolver(): ExerciseKeyResolver {
  const { state } = useWorkout();
  return useMemo(
    () => sharedResolver(state.routines, state.logs),
    [state.routines, state.logs]
  );
}

/**
 * Nombres de cada ejercicio por su clave ("también lo llamas"), junto al
 * resolutor con el que se calculan las claves.
 */
export function useExerciseNames(): {
  resolve: ExerciseKeyResolver;
  namesByKey: Map<string, string[]>;
} {
  const { state } = useWorkout();
  const resolve = useExerciseKeyResolver();
  const namesByKey = useMemo(
    () => sharedNames(state.routines, state.logs, resolve),
    [state.routines, state.logs, resolve]
  );
  return { resolve, namesByKey };
}
