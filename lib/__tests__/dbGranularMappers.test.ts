import { dayToRows, logToRows, routineToRows } from '../db/mappers';
import { WorkoutLog, WorkoutRoutine } from '../../types';

let idCounter = 0;
const stubId = () => `set-${++idCounter}`;

beforeEach(() => {
  idCounter = 0;
});

const routine: WorkoutRoutine = {
  id: 'r1',
  name: 'Rutina 1',
  description: 'desc',
  isActive: true,
  createdAt: 100,
  timerDuration: 90,
  days: [
    {
      id: 'd1',
      dayNumber: 1,
      name: 'Día 1',
      emoji: '💪',
      exercises: [
        { id: 'e1', name: 'Press', order: 1, targetSets: 4, targetReps: '8-12' },
        { id: 'e2', name: 'Aperturas', order: 2 },
      ],
    },
    {
      id: 'd2',
      dayNumber: 2,
      name: 'Día 2',
      emoji: '🏋️',
      description: 'opcional',
      exercises: [],
    },
  ],
};

describe('routineToRows', () => {
  it('aplana la rutina en filas con FKs y opcionales correctos', () => {
    const rows = routineToRows(routine);

    expect(rows.routine).toEqual({
      id: 'r1',
      name: 'Rutina 1',
      description: 'desc',
      timer_duration: 90,
      created_at: 100,
    });
    expect(rows.days.map(d => [d.id, d.routines_id, d.day_number])).toEqual([
      ['d1', 'r1', 1],
      ['d2', 'r1', 2],
    ]);
    expect(rows.days[1].description).toBe('opcional');
    expect(rows.exercises.map(e => [e.id, e.workout_days_id, e.exercise_order])).toEqual([
      ['e1', 'd1', 1],
      ['e2', 'd1', 2],
    ]);
    expect(rows.exercises[1].target_reps).toBeNull();
    expect(rows.exercises[1].target_sets).toBeNull();
  });
});

describe('dayToRows', () => {
  it('mapea un día y sus ejercicios con la rutina dada', () => {
    const rows = dayToRows('rX', routine.days[0]);

    expect(rows.day.routines_id).toBe('rX');
    expect(rows.exercises).toHaveLength(2);
    expect(rows.exercises.every(e => e.workout_days_id === 'd1')).toBe(true);
  });
});

describe('logToRows', () => {
  const log: WorkoutLog = {
    id: 'l1',
    routineId: 'r1',
    dayId: 'd1',
    date: '2026-06-11',
    createdAt: 200,
    updatedAt: 300,
    exercises: [
      {
        id: 'el1',
        exerciseId: 'e1',
        exerciseName: 'Press',
        order: 1,
        rawInput: '60x8 60x8',
        parsedSets: [
          { weight: 60, reps: 8 },
          { weight: 60, reps: 8 },
        ],
        notes: 'nota',
        timestamp: 250,
      },
    ],
    cardio: { id: 'c1', type: 'cinta', rawInput: '20', duration: 20 },
  };

  it('mantiene las FK directas (sin sanear) y numera las series', () => {
    const rows = logToRows(log, stubId);

    expect(rows.log).toMatchObject({ id: 'l1', routines_id: 'r1', workout_days_id: 'd1' });
    expect(rows.exerciseLogs[0]).toMatchObject({
      id: 'el1',
      workout_logs_id: 'l1',
      exercises_id: 'e1',
      created_at: 250,
    });
    expect(rows.logSets.map(s => [s.id, s.set_order, s.weight, s.reps])).toEqual([
      ['set-1', 1, 60, 8],
      ['set-2', 2, 60, 8],
    ]);
    expect(rows.cardio).toMatchObject({ id: 'c1', workout_logs_id: 'l1', duration: 20 });
  });

  it('convierte routineId/dayId vacíos en NULL y ausencia de cardio en null', () => {
    const rows = logToRows({ ...log, routineId: '', dayId: '', cardio: undefined }, stubId);

    expect(rows.log.routines_id).toBeNull();
    expect(rows.log.workout_days_id).toBeNull();
    expect(rows.cardio).toBeNull();
  });

  it('genera id para cardio sin id propio', () => {
    const rows = logToRows(
      { ...log, exercises: [], cardio: { type: 'bici', rawInput: '' } as WorkoutLog['cardio'] },
      stubId
    );

    expect(rows.cardio?.id).toBe('set-1');
  });
});
