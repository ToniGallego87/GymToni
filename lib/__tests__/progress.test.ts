import {
  getEstimatedOneRepMax,
  getBestSetStrengthScore,
  buildImprovementFromStrengthScores,
  getExerciseImprovementPercent,
  FIRST_TIME_IMPROVEMENT_PERCENT,
} from '../progress';
import { ExerciseLog } from '../../types';

function exerciseLog(sets: { weight: number; reps: number }[]): ExerciseLog {
  return {
    id: 'x',
    exerciseId: 'x',
    exerciseName: 'Test',
    order: 1,
    rawInput: '',
    parsedSets: sets,
    timestamp: 0,
  };
}

describe('getEstimatedOneRepMax (Epley)', () => {
  it('devuelve 0 con reps no válidas', () => {
    expect(getEstimatedOneRepMax(100, 0)).toBe(0);
    expect(getEstimatedOneRepMax(-5, 10)).toBe(0);
  });

  it('aplica la fórmula de Epley', () => {
    expect(getEstimatedOneRepMax(100, 10)).toBeCloseTo(133.33, 1);
  });
});

describe('getBestSetStrengthScore', () => {
  it('toma el mejor set', () => {
    const score = getBestSetStrengthScore([
      { weight: 60, reps: 8 },
      { weight: 80, reps: 5 },
    ]);
    expect(score).toBeCloseTo(getEstimatedOneRepMax(80, 5), 5);
  });

  it('cuenta reps cuando no hay carga externa', () => {
    expect(getBestSetStrengthScore([{ weight: 0, reps: 20 }])).toBe(20);
  });

  it('devuelve 0 sin sets', () => {
    expect(getBestSetStrengthScore([])).toBe(0);
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

describe('getExerciseImprovementPercent', () => {
  it('devuelve null sin sesión anterior', () => {
    expect(getExerciseImprovementPercent(exerciseLog([{ weight: 60, reps: 8 }]), null)).toBeNull();
  });

  it('usa el valor de primera vez si la anterior no puntuaba', () => {
    const current = exerciseLog([{ weight: 60, reps: 8 }]);
    const previous = exerciseLog([]);
    expect(getExerciseImprovementPercent(current, previous)).toBe(FIRST_TIME_IMPROVEMENT_PERCENT);
  });

  it('cuenta las regresiones como 0', () => {
    const current = exerciseLog([{ weight: 50, reps: 8 }]);
    const previous = exerciseLog([{ weight: 80, reps: 8 }]);
    expect(getExerciseImprovementPercent(current, previous)).toBe(0);
  });
});
