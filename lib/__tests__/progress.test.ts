import {
  getEstimatedOneRepMax,
  getTotalSetsStrengthScore,
  buildImprovementFromStrengthScores,
  FIRST_TIME_IMPROVEMENT_PERCENT,
} from '../progress';

describe('getEstimatedOneRepMax (Epley)', () => {
  it('devuelve 0 con reps no válidas', () => {
    expect(getEstimatedOneRepMax(100, 0)).toBe(0);
    expect(getEstimatedOneRepMax(-5, 10)).toBe(0);
  });

  it('aplica la fórmula de Epley', () => {
    expect(getEstimatedOneRepMax(100, 10)).toBeCloseTo(133.33, 1);
  });
});

describe('getTotalSetsStrengthScore (1RM estimado)', () => {
  it('cuenta reps cuando no hay carga externa', () => {
    expect(getTotalSetsStrengthScore([{ weight: 0, reps: 20 }])).toBe(20);
  });

  it('devuelve 0 sin sets', () => {
    expect(getTotalSetsStrengthScore([])).toBe(0);
  });

  it('suma el 1RM estimado de todos los sets', () => {
    expect(
      getTotalSetsStrengthScore([
        { weight: 100, reps: 5 },
        { weight: 100, reps: 5 },
      ])
    ).toBeCloseTo(getEstimatedOneRepMax(100, 5) * 2, 5);
  });

  it('valora subir peso aunque baje alguna repetición', () => {
    const conMasPeso = getTotalSetsStrengthScore([{ weight: 47.5, reps: 8 }]);
    const original = getTotalSetsStrengthScore([{ weight: 45, reps: 10 }]);
    expect(conMasPeso).toBeGreaterThan(original);
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
