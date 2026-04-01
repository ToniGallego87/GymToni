import { ParsedSet } from '@types/index';

/**
 * Parsea un string de formato "60x8, 65x6, 65x4" a array de sets
 * Soporta decimales como "12.5x15"
 * Retorna array vacío si no puede parsear
 */
export function parseSeriesString(input: string): ParsedSet[] {
  if (!input || !input.trim()) return [];

  const sets: ParsedSet[] = [];

  // Dividir por comas
  const seriesArray = input.split(',');

  for (const series of seriesArray) {
    const trimmed = series.trim();

    // Extraer patrón "PESO x REPS"
    const match = trimmed.match(/^([\d.]+)\s*x\s*([\d.]+)/i);

    if (match) {
      const weight = parseFloat(match[1]);
      const reps = parseFloat(match[2]);

      if (!isNaN(weight) && !isNaN(reps)) {
        sets.push({ weight, reps });
      }
    }
  }

  return sets;
}

/**
 * Parsea string de cardio formato "Cinta: 22.5mins, 11.5kmh"
 * Extrae: tipo, duración (minutos), velocidad/ritmo
 */
export interface ParsedCardio {
  type: string;
  duration?: number;
  pace?: string;
  rawInput: string;
}

export function parseCardioString(input: string): ParsedCardio {
  const parsed: ParsedCardio = {
    type: 'Cardio',
    rawInput: input,
  };

  if (!input || !input.trim()) return parsed;

  // Buscar tipo (Cinta, Bici, Elíptica, etc)
  const typeMatch = input.match(/^([^:]+):/);
  if (typeMatch) {
    parsed.type = typeMatch[1].trim();
  }

  // Buscar duración en minutos
  const durationMatch = input.match(/(\d+(?:\.\d+)?)\s*mins?/i);
  if (durationMatch) {
    parsed.duration = parseFloat(durationMatch[1]);
  }

  // Buscar velocidad/ritmo
  const paceMatch = input.match(/(\d+(?:\.\d+)?)\s*(?:km\/h|kmh|bpm|rpm)/i);
  if (paceMatch) {
    parsed.pace = paceMatch[0];
  }

  return parsed;
}

/**
 * Formatea un set parseado a string legible
 */
export function formatParsedSet(set: ParsedSet): string {
  return `${set.weight}x${set.reps}`;
}

/**
 * Formatea array de sets a string
 */
export function formatSets(sets: ParsedSet[]): string {
  return sets.map(s => formatParsedSet(s)).join(', ');
}
