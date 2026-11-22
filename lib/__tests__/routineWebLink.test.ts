// Enlace web del QR del póster y deep link a una rutina pública.

jest.mock('expo-linking', () => ({
  // Lo mínimo de Linking.parse para gymbro://host?query.
  parse: (url: string) => {
    const match = /^[a-z]+:\/\/([^?/]*)\/?(?:\?(.*))?$/i.exec(url);
    if (!match) return { hostname: null, path: null, queryParams: {} };
    const params: Record<string, string> = {};
    new URLSearchParams(match[2] ?? '').forEach((value, key) => {
      params[key] = value;
    });
    return { hostname: match[1] || null, path: null, queryParams: params };
  },
}));
jest.mock('../theme', () => ({ getDisplayDayName: (name: string) => name }));

import {
  buildRoutineWebLink,
  parsePublicRoutineLink,
  ROUTINE_WEB_BASE,
} from '../routineShare';

describe('buildRoutineWebLink', () => {
  it('con id, la página de esa rutina', () => {
    expect(buildRoutineWebLink('abc-123')).toBe(
      `${ROUTINE_WEB_BASE}?id=abc-123`
    );
  });

  it('sin id, la página de descarga', () => {
    expect(buildRoutineWebLink()).toBe(ROUTINE_WEB_BASE);
  });

  it('es https (la cámara no abre gymbro://)', () => {
    expect(buildRoutineWebLink('x')).toMatch(/^https:\/\//);
  });
});

describe('parsePublicRoutineLink', () => {
  it('saca el id de gymbro://public-routine?id=...', () => {
    expect(
      parsePublicRoutineLink(
        'gymbro://public-routine?id=3f2c1a9e-1234-4abc-9def-0123456789ab'
      )
    ).toBe('3f2c1a9e-1234-4abc-9def-0123456789ab');
  });

  it('ignora otros deep links', () => {
    expect(parsePublicRoutineLink('gymbro://import-routine?data=%7B%7D')).toBe(
      null
    );
  });

  it('rechaza ids con caracteres raros o vacíos', () => {
    expect(parsePublicRoutineLink('gymbro://public-routine?id=a%20b')).toBe(
      null
    );
    expect(parsePublicRoutineLink('gymbro://public-routine')).toBe(null);
    expect(
      parsePublicRoutineLink(`gymbro://public-routine?id=${'a'.repeat(65)}`)
    ).toBe(null);
  });
});
