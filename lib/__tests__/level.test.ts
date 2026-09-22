import {
  levelForXp,
  summarizeLevel,
  totalXp,
  XP_PER_BADGE,
  XP_PER_CHALLENGE,
  xpForLevel,
} from '../level';

describe('nivel de la cuenta', () => {
  it('cada nivel cuesta más que el anterior', () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(25);
    expect(xpForLevel(3)).toBe(75);
    expect(xpForLevel(4)).toBe(150);
    expect(xpForLevel(5)).toBe(250);
  });

  it('el nivel es el inverso de los puntos que exige', () => {
    for (let level = 1; level <= 20; level++) {
      expect(levelForXp(xpForLevel(level))).toBe(level);
      expect(levelForXp(xpForLevel(level + 1) - 1)).toBe(level);
    }
    expect(levelForXp(-5)).toBe(1);
  });

  it('el resumen da el progreso dentro del nivel', () => {
    const s = summarizeLevel(50);
    expect(s.level).toBe(2);
    expect(s.levelStart).toBe(25);
    expect(s.nextLevelAt).toBe(75);
    expect(s.progress).toBeCloseTo(25 / 50);
  });

  it('retos y logros suman puntos distintos', () => {
    expect(totalXp(3, 2)).toBe(3 * XP_PER_CHALLENGE + 2 * XP_PER_BADGE);
  });
});
