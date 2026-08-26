import { isNewerVersion, parseVersion, playStoreUrls } from '../appUpdate';

// El aviso de "hay versión nueva" se dispara con esta comparación: si se
// equivoca, o no avisa nunca o molesta en cada arranque con una versión que ya
// tienes. Los casos raros (0.10 vs 0.9, partes que faltan, basura en la nube)
// son justo los que se cuelan sin darte cuenta.
describe('isNewerVersion', () => {
  it('avisa solo cuando la publicada es posterior', () => {
    expect(isNewerVersion('0.7.2', '0.7.3')).toBe(true);
    expect(isNewerVersion('0.7.2', '0.8.0')).toBe(true);
    expect(isNewerVersion('0.7.2', '1.0.0')).toBe(true);
    expect(isNewerVersion('0.7.2', '0.7.2')).toBe(false);
    expect(isNewerVersion('0.7.3', '0.7.2')).toBe(false);
  });

  it('compara número a número, no como texto', () => {
    // Alfabéticamente "0.10.0" < "0.9.0", pero es una versión posterior.
    expect(isNewerVersion('0.9.0', '0.10.0')).toBe(true);
    expect(isNewerVersion('0.10.0', '0.9.0')).toBe(false);
    expect(isNewerVersion('1.2.9', '1.2.10')).toBe(true);
  });

  it('las partes que faltan cuentan como cero', () => {
    expect(isNewerVersion('0.8', '0.8.0')).toBe(false);
    expect(isNewerVersion('0.8', '0.8.1')).toBe(true);
    expect(isNewerVersion('0.8.0', '0.8')).toBe(false);
  });

  it('ignora los sufijos de precompilación', () => {
    expect(isNewerVersion('0.7.2', '0.7.3-beta')).toBe(true);
    expect(isNewerVersion('0.7.2-beta', '0.7.2')).toBe(false);
  });

  it('ante un dato ilegible no avisa', () => {
    // Fila corrupta en la nube: mejor quedarse callado que sacar un popup.
    expect(isNewerVersion('0.7.2', 'próximamente')).toBe(false);
    expect(isNewerVersion('0.7.2', '')).toBe(false);
    expect(isNewerVersion('0.7.2', '0.7.x')).toBe(false);
    expect(isNewerVersion('', '0.7.3')).toBe(false);
  });
});

describe('parseVersion', () => {
  it('trocea la versión y rechaza lo que no lo es', () => {
    expect(parseVersion('0.7.2')).toEqual([0, 7, 2]);
    expect(parseVersion(' 1.0 ')).toEqual([1, 0]);
    expect(parseVersion('0.7.2-rc.1')).toEqual([0, 7, 2]);
    expect(parseVersion('v0.7.2')).toBeNull();
    expect(parseVersion('0.-7.2')).toBeNull();
    expect(parseVersion('')).toBeNull();
  });
});

describe('playStoreUrls', () => {
  it('da el enlace de la app de Play y el de respaldo por navegador', () => {
    const { app, web } = playStoreUrls('com.tonigallego.gymbro');
    expect(app).toBe('market://details?id=com.tonigallego.gymbro');
    expect(web).toBe(
      'https://play.google.com/store/apps/details?id=com.tonigallego.gymbro'
    );
  });
});
