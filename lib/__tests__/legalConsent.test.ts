import {
  legalAcceptanceMetadata,
  MIN_ACCOUNT_AGE,
  needsLegalAcceptance,
} from '../legalConsent';

describe('legalAcceptanceMetadata', () => {
  it('guarda versión, edad mínima y las dos fechas', () => {
    const now = new Date('2026-11-19T10:00:00.000Z');
    expect(legalAcceptanceMetadata('2026-11-16', now)).toEqual({
      terms_version: '2026-11-16',
      terms_accepted_at: '2026-11-19T10:00:00.000Z',
      min_age: MIN_ACCOUNT_AGE,
      health_consent_at: '2026-11-19T10:00:00.000Z',
    });
  });
});

describe('needsLegalAcceptance', () => {
  const accepted = legalAcceptanceMetadata('v2');

  it('no pide nada si aceptó la versión vigente', () => {
    expect(needsLegalAcceptance({ ...accepted }, 'v2')).toBe(false);
  });

  it('pide aceptar a una cuenta anterior a los textos', () => {
    expect(needsLegalAcceptance({}, 'v2')).toBe(true);
    expect(needsLegalAcceptance(undefined, 'v2')).toBe(true);
  });

  it('pide aceptar otra vez si cambió la versión', () => {
    expect(needsLegalAcceptance({ ...accepted }, 'v3')).toBe(true);
  });

  it('pide aceptar si falta el consentimiento de los datos de salud', () => {
    const { health_consent_at: _, ...withoutHealth } = accepted;
    expect(needsLegalAcceptance(withoutHealth, 'v2')).toBe(true);
  });
});
