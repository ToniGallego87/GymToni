import { ParsedSet } from '../types';

/**
 * Parsea un string de formato "60x8, 65x6, 65x4" a array de sets.
 * - Soporta decimales: "12.5x15".
 * - Soporta pesos combinados (p. ej. mancuernas) sumándolos: "8+8x11" -> { weight: 16, reps: 11 }.
 * - Ignora entradas sin reps ("80x") o con formato no reconocido.
 * Retorna array vacío si no puede parsear nada.
 */
export function parseSeriesString(input: string): ParsedSet[] {
  if (!input || !input.trim()) return [];

  const sets: ParsedSet[] = [];

  // Dividir por comas
  const seriesArray = input.split(',');

  for (const series of seriesArray) {
    const trimmed = series.trim();

    // Extraer patrón "PESO x REPS". El peso admite sumas (8+8) para cargas combinadas.
    const match = trimmed.match(/^([\d.+]+)\s*x\s*([\d.]+)/i);

    if (match) {
      const weight = match[1]
        .split('+')
        .reduce((total, part) => total + (parseFloat(part) || 0), 0);
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
  if (set.weight === -1 || set.reps === -1) {
    return '—';
  }
  return `${set.weight}x${set.reps}`;
}
