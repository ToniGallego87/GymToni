import { startTextFit, stepTextFit, TextFit } from '../textFit';

// Repite medidas hasta decidir: cabe lo que no pase de `limit`.
function settle(base: number, min: number, limit: number) {
  let state: TextFit = startTextFit(base, min);
  let probes = 0;
  while (!state.done) {
    state = stepTextFit(state, state.size <= limit);
    probes += 1;
  }
  return { size: state.size, probes };
}

describe('textFit', () => {
  it('si cabe de partida no toca el tamaño', () => {
    expect(settle(13, 7, 13)).toEqual({ size: 13, probes: 1 });
  });

  it('elige el mayor tamaño que cabe, a medios puntos', () => {
    for (const limit of [12.5, 11, 9.5, 7.5]) {
      expect(settle(13, 7, limit).size).toBe(limit);
    }
  });

  it('no baja del mínimo aunque no quepa', () => {
    expect(settle(13, 7, 3).size).toBe(7);
  });

  it('acaba en pocas medidas también con un tamaño de partida impar', () => {
    expect(settle(10.5, 7, 8).size).toBe(8);
    expect(settle(13, 7, 8).probes).toBeLessThanOrEqual(5);
  });

  it('ya decidido, una medida que no cabe reabre la búsqueda hacia abajo', () => {
    const decided = stepTextFit(startTextFit(13, 7), true);
    expect(decided.done).toBe(true);
    const reopened = stepTextFit(decided, false);
    expect(reopened.done).toBe(false);
    expect(reopened.size).toBeLessThan(13);
    expect(stepTextFit(decided, true)).toBe(decided);
  });

  it('en el mínimo una medida que no cabe no reabre nada', () => {
    const atMin: TextFit = { size: 7, low: 7, high: 7.5, min: 7, done: true };
    expect(stepTextFit(atMin, false)).toBe(atMin);
  });
});
