// Lógica pura de los iconos de grupo muscular / tipo de sesión. Sin dependencias
// de React ni react-native-svg para poder usarla en lib (parsers, share, tests).
// Los paths SVG y el componente viven en components/GymIcon.tsx.

export type GymIconName =
  | 'pecho'
  | 'hombro'
  | 'espalda'
  | 'biceps'
  | 'triceps'
  | 'abdominales'
  | 'piernas'
  | 'push'
  | 'pull'
  | 'torso'
  | 'fullbody';

export const GYM_ICON_NAMES: GymIconName[] = [
  'pecho',
  'hombro',
  'espalda',
  'biceps',
  'triceps',
  'abdominales',
  'piernas',
  'push',
  'pull',
  'torso',
  'fullbody',
];

export const GYM_ICON_LABELS: Record<GymIconName, string> = {
  pecho: 'Pecho',
  hombro: 'Hombro',
  espalda: 'Espalda',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  abdominales: 'Abdominales',
  piernas: 'Piernas',
  push: 'Push',
  pull: 'Pull',
  torso: 'Torso',
  fullbody: 'Full body',
};

export function isGymIconName(value?: string): value is GymIconName {
  return !!value && (GYM_ICON_NAMES as string[]).includes(value);
}

// Detecta el icono a partir del nombre del día. null si no se puede inferir
// (entonces la UI obliga a elegir a mano).
export function detectGymIcon(name?: string): GymIconName | null {
  const n = (name || '').toLowerCase();
  if (!n.trim()) return null;
  if (/\bpush\b|empuj/.test(n)) return 'push';
  if (/\bpull\b|jal[oó]n|tir[oó]n|dominad/.test(n)) return 'pull';
  if (/pierna|gl[uú]teo|cu[aá]driceps|sentadilla|squat|gemelo|\bleg/.test(n))
    return 'piernas';
  if (/b[ií]ceps/.test(n)) return 'biceps';
  if (/tr[ií]ceps/.test(n)) return 'triceps';
  if (/abdom|\babs\b|core/.test(n)) return 'abdominales';
  if (/hombro|deltoid|shoulder/.test(n)) return 'hombro';
  if (/espalda|dorsal|\bback\b|remo/.test(n)) return 'espalda';
  if (/pecho|pectoral|chest/.test(n)) return 'pecho';
  if (/torso/.test(n)) return 'torso';
  if (/full|cuerpo|completo/.test(n)) return 'fullbody';
  return null;
}

// Compatibilidad con datos antiguos: los días guardaban un emoji de color.
const LEGACY_EMOJI_ICON: Record<string, GymIconName> = {
  '🔵': 'pull',
  '🔴': 'push',
  '🟢': 'piernas',
  '🟣': 'torso',
};

// Resuelve el icono de un día a partir del valor guardado (nombre de icono nuevo
// o emoji antiguo) y, como último recurso, del nombre del día.
export function resolveDayIcon(stored?: string, dayName?: string): GymIconName {
  if (isGymIconName(stored)) return stored;
  if (stored && LEGACY_EMOJI_ICON[stored]) return LEGACY_EMOJI_ICON[stored];
  return detectGymIcon(dayName) ?? 'fullbody';
}
