import {
  buildWorkoutImprovement,
  getEstimatedOneRepMax,
  getTotalSetsStrengthScore,
  buildImprovementFromStrengthScores,
  BODYWEIGHT_VIRTUAL_LOAD,
  FIRST_TIME_IMPROVEMENT_PERCENT,
} from '../progress';
import { ParsedSet, WorkoutLog } from '../../types';

describe('getEstimatedOneRepMax (Epley)', () => {
  it('devuelve 0 con reps no válidas', () => {
    expect(getEstimatedOneRepMax(100, 0)).toBe(0);
    expect(getEstimatedOneRepMax(-5, 10)).toBe(0);
  });

  it('aplica la fórmula de Epley', () => {
    expect(getEstimatedOneRepMax(100, 10)).toBeCloseTo(133.33, 1);
  });
});

describe('getTotalSetsStrengthScore (1RM estimado sobre carga virtual)', () => {
  it('puntúa sin carga externa con la carga virtual del cuerpo', () => {
    expect(getTotalSetsStrengthScore([{ weight: 0, reps: 20 }])).toBeCloseTo(
      getEstimatedOneRepMax(BODYWEIGHT_VIRTUAL_LOAD, 20),
      5
    );
  });

  it('mantiene la escala vieja del peso corporal a 15 reps', () => {
    expect(getTotalSetsStrengthScore([{ weight: 0, reps: 15 }])).toBeCloseTo(
      15,
      5
    );
  });

  it('devuelve 0 sin sets', () => {
    expect(getTotalSetsStrengthScore([])).toBe(0);
  });

  it('suma el 1RM estimado (con carga virtual) de todos los sets', () => {
    expect(
      getTotalSetsStrengthScore([
        { weight: 100, reps: 5 },
        { weight: 100, reps: 5 },
      ])
    ).toBeCloseTo(
      getEstimatedOneRepMax(100 + BODYWEIGHT_VIRTUAL_LOAD, 5) * 2,
      5
    );
  });

  it('valora subir peso aunque baje alguna repetición', () => {
    const conMasPeso = getTotalSetsStrengthScore([{ weight: 50, reps: 8 }]);
    const original = getTotalSetsStrengthScore([{ weight: 45, reps: 10 }]);
    expect(conMasPeso).toBeGreaterThan(original);
  });

  it('añadir lastre a una serie de peso corporal SIEMPRE sube la nota', () => {
    const sinLastre = getTotalSetsStrengthScore([{ weight: 0, reps: 15 }]);
    const conPocoLastre = getTotalSetsStrengthScore([{ weight: 5, reps: 15 }]);
    expect(conPocoLastre).toBeGreaterThan(sinLastre);
  });

  it('el caso real (0·5·10 vs 0·0·0 a 15 reps) sale como mejora', () => {
    const anterior = getTotalSetsStrengthScore([
      { weight: 0, reps: 15 },
      { weight: 0, reps: 15 },
      { weight: 0, reps: 15 },
    ]);
    const hoy = getTotalSetsStrengthScore([
      { weight: 0, reps: 15 },
      { weight: 5, reps: 15 },
      { weight: 10, reps: 15 },
    ]);
    const result = buildImprovementFromStrengthScores(hoy, anterior);
    expect(result?.isImproved).toBe(true);
  });
});

describe('buildImprovementFromStrengthScores', () => {
  it('asigna el valor de primera vez cuando no había base', () => {
    expect(buildImprovementFromStrengthScores(100, 0)).toEqual({
      isImproved: true,
      percent: FIRST_TIME_IMPROVEMENT_PERCENT,
    });
  });

  it('devuelve null si ambos son 0', () => {
    expect(buildImprovementFromStrengthScores(0, 0)).toBeNull();
  });

  it('detecta mejora', () => {
    const result = buildImprovementFromStrengthScores(110, 100);
    expect(result?.isImproved).toBe(true);
    expect(result?.percent).toBeCloseTo(10, 5);
  });

  it('detecta regresión', () => {
    const result = buildImprovementFromStrengthScores(90, 100);
    expect(result?.isImproved).toBe(false);
    expect(result?.percent).toBeCloseTo(10, 5);
  });
});

describe('buildWorkoutImprovement', () => {
  const set = (weight: number) => ({ weight, reps: 10 }) as ParsedSet;

  const makeLog = (
    id: string,
    exercises: { exerciseId: string; sets: ParsedSet[] }[]
  ): WorkoutLog =>
    ({
      id,
      routineId: 'r1',
      dayId: 'd1',
      date: '2026-08-21',
      createdAt: 1,
      updatedAt: 1,
      exercises: exercises.map((exercise, index) => ({
        id: `${id}-${index}`,
        exerciseId: exercise.exerciseId,
        exerciseName: exercise.exerciseId,
        order: index + 1,
        rawInput: '',
        parsedSets: exercise.sets,
        timestamp: 1,
      })),
    }) as WorkoutLog;

  it('un ejercicio que hoy no se hizo no cuenta como −100%', () => {
    const previous = makeLog('p', [
      { exerciseId: 'press', sets: [set(100)] },
      { exerciseId: 'remo', sets: [set(100)] },
    ]);
    // Hoy el remo se dejó a cero series: no debe hundir el porcentaje.
    const current = makeLog('c', [
      { exerciseId: 'press', sets: [set(110)] },
      { exerciseId: 'remo', sets: [] },
    ]);

    const improvement = buildWorkoutImprovement(current, previous);
    expect(improvement?.isImproved).toBe(true);
    expect(improvement?.percent).toBeCloseTo(9.090909, 5);
  });

  it('un ejercicio nuevo tampoco infla el porcentaje', () => {
    const previous = makeLog('p', [{ exerciseId: 'press', sets: [set(100)] }]);
    const current = makeLog('c', [
      { exerciseId: 'press', sets: [set(110)] },
      { exerciseId: 'peso muerto', sets: [set(200)] },
    ]);

    expect(buildWorkoutImprovement(current, previous)?.percent).toBeCloseTo(
      9.090909,
      5
    );
  });

  it('sin ejercicios en común no hay porcentaje', () => {
    const previous = makeLog('p', [{ exerciseId: 'press', sets: [set(100)] }]);
    const current = makeLog('c', [
      { exerciseId: 'sentadilla', sets: [set(100)] },
    ]);

    expect(buildWorkoutImprovement(current, previous)).toBeNull();
    expect(buildWorkoutImprovement(current, null)).toBeNull();
  });
});
