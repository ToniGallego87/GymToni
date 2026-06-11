import { WorkoutLog } from '../types';

export function generateId(): string {
  const cryptoRef = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (cryptoRef?.randomUUID) {
    return cryptoRef.randomUUID();
  }

  // UUID v4 manual: Hermes no expone crypto.randomUUID.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
    const random = (Math.random() * 16) | 0;
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).replace(/^[a-z]/, c => c.toUpperCase());
}

export function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Devuelve un timestamp comparable para un log.
 * Prioriza createdAt; si falta, deriva de la fecha (YYYY-MM-DD); si no, 0.
 */
export function getLogTimestamp(log: WorkoutLog | null | undefined): number {
  if (!log) return 0;
  if (typeof log.createdAt === 'number' && Number.isFinite(log.createdAt)) {
    return log.createdAt;
  }
  if (log.date) {
    return new Date(`${log.date}T00:00:00`).getTime();
  }
  return 0;
}

export type ImprovementKind = 'up' | 'down' | 'neutral';

export interface ImprovementDisplay {
  symbol: string;
  display: string | number;
  kind: ImprovementKind;
}

/**
 * Normaliza una mejora ({ isImproved, percent }) a símbolo + texto + tipo,
 * para que cada pantalla solo tenga que mapear el tipo a su estilo/color.
 */
export function getImprovementDisplay(imp: { isImproved: boolean; percent: number }): ImprovementDisplay {
  const roundedPercent = imp.percent % 1 === 0 ? Math.round(imp.percent) : imp.percent.toFixed(1);

  if (imp.percent === 0) {
    return { symbol: '=', display: roundedPercent, kind: 'neutral' };
  }

  return {
    symbol: imp.isImproved ? '↑' : '↓',
    display: roundedPercent,
    kind: imp.isImproved ? 'up' : 'down',
  };
}
