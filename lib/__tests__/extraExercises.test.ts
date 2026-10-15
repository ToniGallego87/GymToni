import {
  extraExercisesFromLog,
  isExtraExerciseId,
  makeExtraExerciseId,
  parseExtraExerciseId,
} from '../extraExercises';
import { getComparableWorkoutScores } from '../progress';
import { listExercises } from '../exerciseProgress';
import { appDataToRows } from '../db/mappers';
import { ExerciseLog, WorkoutLog } from '../../types';

const exerciseLog = (
  exerciseId: string,
  name: string,
  rawInput: string,
  order = 1
): ExerciseLog => ({
  id: `${exerciseId}-log`,
  exerciseId,
  exerciseName: name,
  order,
  rawInput,
  parsedSets: rawInput.split(', ').map((s) => {
    const [weight, reps] = s.split('x').map(Number);
    return { weight, reps };
  }),
  timestamp: 0,
});

const workoutLog = (id: string, date: string, exercises: ExerciseLog[]) =>
  ({
    id,
    routineId: 'r1',
    dayId: 'd1',
    date,
    exercises,
    createdAt: new Date(`${date}T10:00:00`).valueOf(),
    updatedAt: 0,
  }) as WorkoutLog;

describe('ejercicios adicionales', () => {
  it('el id lleva el objetivo y se reconoce', () => {
    const id = makeExtraExerciseId(4, '8-10/lado');
    expect(isExtraExerciseId(id)).toBe(true);
    expect(isExtraExerciseId('abc-123')).toBe(false);
    expect(parseExtraExerciseId(id)).toEqual({
      targetSets: 4,
      targetReps: '8-10/lado',
    });
  });

  it('se recuperan de un log guardado, en su orden', () => {
    const a = makeExtraExerciseId(3, '12');
    const b = makeExtraExerciseId(2, '30s');
    const extras = extraExercisesFromLog([
      exerciseLog('day-ex', 'Press banca', '60x8'),
      exerciseLog(b, 'Plancha', '0x30', 3),
      exerciseLog(a, 'Curl', '12x12', 2),
    ]);
    expect(extras.map((e) => [e.name, e.targetSets, e.targetReps])).toEqual([
      ['Curl', 3, '12'],
      ['Plancha', 2, '30s'],
    ]);
  });

  it('no cuentan para la mejora de la sesión', () => {
    const extra = makeExtraExerciseId(3, '10');
    const previous = workoutLog('p', '2026-10-01', [
      exerciseLog('day-ex', 'Press banca', '60x8'),
    ]);
    const current = workoutLog('c', '2026-10-08', [
      exerciseLog('day-ex', 'Press banca', '60x8'),
      // El mismo ejercicio como adicional: no se empareja con el de antes.
      exerciseLog(extra, 'Press banca', '100x10', 2),
    ]);
    const { current: now, previous: before } = getComparableWorkoutScores(
      current,
      previous
    );
    expect(now).toBe(before);
  });

  it('no entran en Progreso por ejercicio', () => {
    const extra = makeExtraExerciseId(3, '10');
    const list = listExercises([
      workoutLog('c', '2026-10-08', [exerciseLog(extra, 'Curl', '12x12')]),
    ]);
    expect(list).toHaveLength(0);
  });
});

describe('ejercicios adicionales en la base de datos', () => {
  it('appDataToRows conserva su id aunque no esté en ninguna rutina', () => {
    const extra = makeExtraExerciseId(3, '10');
    const rows = appDataToRows({
      routines: [],
      logs: [
        workoutLog('c', '2026-10-08', [
          exerciseLog('borrado', 'Viejo', '10x10'),
          exerciseLog(extra, 'Curl', '12x12', 2),
        ]),
      ],
    });
    expect(rows.exerciseLogs.map((r) => r.exercises_id)).toEqual([null, extra]);
  });
});
