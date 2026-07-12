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

  describe('selector de slots', () => {
    it('semana con mejora: pinta mejora global, mejor ejercicio y récord sin repetir categoría', () => {
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

      const ids = result.slots.map((slot) => slot.id);
      expect(ids).toContain('week-improvement');
      expect(ids).toContain('top-improvement');
      expect(ids).toContain('personal-record');
      expect(result.slots.length).toBe(4);
      // Máximo un slot por categoría en la primera pasada.
      const categories = result.slots.map((slot) => slot.category);
      expect(new Set(categories).size).toBe(categories.length);
    });

    it('primera semana: sin comparaciones, rellena con marca inicial y volumen', () => {
      const weekLogs = [
        makeLog('d1', [
          makeExercise('e1', 'Sentadilla', [
            { weight: 80, reps: 8 },
            { weight: 80, reps: 8 },
          ]),
        ]),
      ];

      const result = computeWeekAchievements({
        weekLogs,
        previousWeekLogs: [],
        weekNumber: 1,
        streakDays: 1,
        streakIsPerfect: true,
        totalWorkouts: 1,
      });

      expect(result.slots.length).toBe(4);
      const ids = result.slots.map((slot) => slot.id);
      expect(ids).toContain('max-lift');
      expect(ids).toContain('total-volume');
      // Nunca huecos vacíos ni datos sin valor ("—").
      result.slots.forEach((slot) => {
        expect(slot.centerMain).not.toBe('—');
      });
    });

    it('semana peor que la anterior: ningún slot negativo, siempre 4 positivos', () => {
      const previousWeekLogs = [
        makeLog('d1', [
          makeExercise('e1', 'Press banca', [{ weight: 100, reps: 8 }]),
          makeExercise('e2', 'Curl', [{ weight: 60, reps: 10 }]),
        ]),
      ];
      const weekLogs = [
        makeLog('d1', [
          makeExercise('e1', 'Press banca', [{ weight: 90, reps: 6 }]),
          makeExercise('e2', 'Curl', [{ weight: 50, reps: 8 }]),
        ]),
      ];

      const result = computeWeekAchievements({
        weekLogs,
        previousWeekLogs,
        weekNumber: 4,
        streakDays: 2,
        streakIsPerfect: false,
        totalWorkouts: 7,
      });

      expect(result.weekImprovementPercent).toBeLessThan(0);
      expect(result.slots.length).toBe(4);
      const ids = result.slots.map((slot) => slot.id);
      expect(ids).not.toContain('week-improvement');
      result.slots.forEach((slot) => {
        expect(slot.centerMain.startsWith('-')).toBe(false);
      });
    });

    it('récord personal: solo cuando se supera el máximo histórico del ejercicio', () => {
      const historyLogs = [
        makeLog('d1', [
          makeExercise('e1', 'Peso muerto', [{ weight: 120, reps: 5 }]),
        ]),
        makeLog('d1', [
          makeExercise('e1', 'Peso muerto', [{ weight: 130, reps: 4 }]),
        ]),
      ];
      const weekLogs = [
        makeLog('d1', [
          makeExercise('e1', 'Peso muerto', [{ weight: 140, reps: 3 }]),
        ]),
      ];

      const result = computeWeekAchievements({
        weekLogs,
        previousWeekLogs: historyLogs.slice(1),
        weekNumber: 3,
        streakDays: 2,
        streakIsPerfect: true,
        historyLogs,
      });

      const record = result.slots.find((slot) => slot.id === 'personal-record');
      expect(record).toBeDefined();
      expect(record!.centerMain).toBe('140');
      expect(record!.subLabel).toBe('Peso muerto');
    });

    it('con histórico y sin récord, el peso máximo no aparece (sería siempre el mismo)', () => {
      const historyLogs = [
        makeLog('d1', [
          makeExercise('e1', 'Press banca', [{ weight: 100, reps: 5 }]),
        ]),
      ];
      const weekLogs = [
        makeLog('d1', [
          makeExercise('e1', 'Press banca', [{ weight: 100, reps: 5 }]),
        ]),
      ];

      const result = computeWeekAchievements({
        weekLogs,
        previousWeekLogs: historyLogs,
        weekNumber: 2,
        streakDays: 1,
        streakIsPerfect: true,
        historyLogs,
      });

      const ids = result.slots.map((slot) => slot.id);
      expect(ids).not.toContain('max-lift');
      expect(ids).not.toContain('personal-record');
    });

    it('asistencia perfecta con ≥2 semanas: celebra el 100% en lugar de contar días', () => {
      const previousWeekLogs = [
        makeLog('d1', [
          makeExercise('e1', 'Press banca', [{ weight: 100, reps: 5 }]),
        ]),
        makeLog('d2', [makeExercise('e2', 'Curl', [{ weight: 50, reps: 10 }])]),
      ];
      const weekLogs = [
        makeLog('d1', [
          makeExercise('e1', 'Press banca', [{ weight: 105, reps: 5 }]),
        ]),
        makeLog('d2', [makeExercise('e2', 'Curl', [{ weight: 52, reps: 10 }])]),
      ];

      const result = computeWeekAchievements({
        weekLogs,
        previousWeekLogs,
        weekNumber: 2,
        streakDays: 6,
        streakIsPerfect: true,
        totalWorkouts: 6,
      });

      const attendance = result.slots.find(
        (slot) => slot.id === 'perfect-attendance'
      );
      expect(attendance).toBeDefined();
      expect(attendance!.centerMain).toBe('100%');
      expect(result.slots.map((slot) => slot.id)).not.toContain('streak-days');
    });

    it('racha corta o imperfecta: el contador de días no entra hasta 2 semanas', () => {
      const weekLogs = [
        makeLog('d1', [
          makeExercise('e1', 'Sentadilla', [{ weight: 80, reps: 8 }]),
        ]),
      ];

      const result = computeWeekAchievements({
        weekLogs,
        previousWeekLogs: [],
        weekNumber: 1,
        streakDays: 1,
        streakIsPerfect: true,
        totalWorkouts: 1,
      });

      const ids = result.slots.map((slot) => slot.id);
      expect(ids).not.toContain('streak-days');
      expect(ids).not.toContain('perfect-attendance');
    });
  });
});
