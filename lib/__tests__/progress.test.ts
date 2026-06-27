import {
  getEstimatedOneRepMax,
  getBestSetStrengthScore,
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

describe('getBestSetStrengthScore (1RM estimado)', () => {
  it('toma el set con mayor 1RM estimado', () => {
    const score = getBestSetStrengthScore([
      { weight: 60, reps: 8 }, // e1RM 76.0
      { weight: 80, reps: 5 }, // e1RM 93.3
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

describe('getTotalSetsStrengthScore (1RM estimado)', () => {
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
