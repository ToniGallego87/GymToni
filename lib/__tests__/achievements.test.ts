import { computeWeekAchievements } from '../achievements';
import { ExerciseLog, ParsedSet, WorkoutLog } from '../../types';

let timestamp = 1000;

function makeExercise(
  exerciseId: string,
  exerciseName: string,
  parsedSets: ParsedSet[]
): ExerciseLog {
  return {
    id: `${exerciseId}-log`,
    exerciseId,
    exerciseName,
    order: 1,
    rawInput: '',
    parsedSets,
    timestamp: timestamp,
  };
}

function makeLog(dayId: string, exercises: ExerciseLog[]): WorkoutLog {
  timestamp += 1000;
  return {
    id: `${dayId}-${timestamp}`,
    routineId: 'r1',
    dayId,
    date: '2026-06-01',
    exercises,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

describe('computeWeekAchievements', () => {
  it('elige el ejercicio con mayor mejora y el récord de peso de la semana', () => {
    const previousWeekLogs = [
      makeLog('d1', [
        makeExercise('e1', 'Press banca', [{ weight: 100, reps: 5 }]),
        makeExercise('e2', 'Curl', [{ weight: 50, reps: 10 }]),
      ]),
    ];
    const weekLogs = [
      makeLog('d1', [
        makeExercise('e1', 'Press banca', [{ weight: 110, reps: 5 }]),
        makeExercise('e2', 'Curl', [{ weight: 60, reps: 10 }]),
      ]),
    ];

    const result = computeWeekAchievements({
      weekLogs,
      previousWeekLogs,
      weekNumber: 3,
      streakDays: 5,
      streakIsPerfect: true,
    });

    expect(result.weekNumber).toBe(3);
    expect(result.streakDays).toBe(5);
    expect(result.streakIsPerfect).toBe(true);
    expect(result.daysTrained).toBe(1);
    // Curl mejora ~20% (mayor que el ~10% del press).
    expect(result.topImprovement?.exerciseName).toBe('Curl');
    expect(result.topImprovement!.percent).toBeGreaterThan(15);
    // El récord de peso es el press a 110 kg.
    expect(result.maxLift).toEqual({
      exerciseName: 'Press banca',
      weight: 110,
      reps: 5,
    });
    expect(result.weekImprovementPercent).not.toBeNull();
    expect(result.weekImprovementPercent!).toBeGreaterThan(0);
  });

  it('sin semana previa no hay mejora pero sí récord de peso', () => {
    const weekLogs = [
      makeLog('d1', [
        makeExercise('e1', 'Sentadilla', [{ weight: 80, reps: 8 }]),
      ]),
    ];

    const result = computeWeekAchievements({
      weekLogs,
      previousWeekLogs: [],
      weekNumber: 1,
      streakDays: 3,
      streakIsPerfect: false,
    });

    expect(result.topImprovement).toBeNull();
    expect(result.weekImprovementPercent).toBeNull();
    expect(result.maxLift).toEqual({
      exerciseName: 'Sentadilla',
      weight: 80,
      reps: 8,
    });
  });

  it('ignora series vacías (-1) y peso corporal (0) en el récord', () => {
    const weekLogs = [
      makeLog('d1', [
        makeExercise('e1', 'Dominadas', [{ weight: 0, reps: 12 }]),
        makeExercise('e2', 'Remo', [
          { weight: 70, reps: 8 },
          { weight: -1, reps: -1 },
        ]),
      ]),
    ];

    const result = computeWeekAchievements({
      weekLogs,
      previousWeekLogs: [],
      weekNumber: 2,
      streakDays: 3,
      streakIsPerfect: false,
    });

    expect(result.maxLift).toEqual({
      exerciseName: 'Remo',
      weight: 70,
      reps: 8,
    });
  });
});
