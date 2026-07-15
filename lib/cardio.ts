import { WorkoutDay, WorkoutLog } from '../types';

/**
 * Lógica pura del cardio "de primera clase".
 *
 * El cardio NO tiene modelo propio: se sigue registrando dentro del día de fuerza
 * (WorkoutLog.cardio). Aquí solo LEEMOS esos logs y los reinterpretamos como una
 * experiencia independiente: sesiones → semanas (calendario ISO) → progreso de
 * kcalorías quemadas semana a semana.
 *
 * Fuente de datos: `log.cardio.rawInput`, que puede contener varias entradas
 * unidas por " | " (ej: "Cinta: 22min, 11kmh | Bici: 30min"). Parseamos todas,
 * no solo la primera (a diferencia de parseCardioString en parsers.ts).
 */

/** Peso asumido para estimar kcal (la app no guarda el peso del usuario). */
export const ASSUMED_WEIGHT_KG = 70;

export const TREADMILL_WALK_LABEL = 'Andar en cinta';

// Reclasificación retroactiva: las entradas de cardio ANTERIORES a esta fecha
// que tengan pendiente insertada se consideran "Andar en cinta" (antes solo
// existía "Correr en cinta"). A partir de aquí el usuario elige la disciplina.
const TREADMILL_WALK_CUTOFF = '2026-07-05';

export interface CardioEntry {
  type: string;
  minutes: number | null;
  speed: number | null; // km/h
  pendiente: number | null; // % de inclinación (cinta)
  raw: string;
}

export interface CardioSession {
  logId: string;
  date: string; // YYYY-MM-DD
  entries: CardioEntry[];
  disciplines: MergedCardioEntry[]; // entradas fusionadas por disciplina (con kcal)
  totalMinutes: number;
  totalKm: number;
  avgSpeed: number | null;
  totalKcal: number;
}

export interface CardioWeek {
  weekNumber: number; // 1..N secuencial sobre semanas CON cardio
  weekKey: string; // clave de semana ISO (ej: "2026-W27")
  weekStart: string; // lunes de la semana (YYYY-MM-DD)
  weekEnd: string; // domingo de la semana (YYYY-MM-DD)
  sessions: CardioSession[];
  totalMinutes: number;
  avgSpeed: number | null; // media de km/h (referencia)
  totalKcal: number; // kcal quemadas en la semana
  kcalDelta: number | null; // diferencia de kcal vs semana anterior con datos
  sessionCount: number;
  improvement: number | null; // % de cambio de kcal vs semana anterior con datos
  isCurrent: boolean;
}

export interface MergedCardioEntry {
  type: string;
  totalMinutes: number;
  minSpeed: number | null;
  maxSpeed: number | null;
  minPendiente: number | null;
  maxPendiente: number | null;
  kcal: number;
}

export interface CardioMonth {
  monthKey: string; // "YYYY-MM"
  year: number;
  month: number; // 0-11
  avgSpeed: number | null;
  totalKcal: number;
  totalMinutes: number;
  totalKm: number;
  sessionCount: number;
  improvement: number | null; // % de cambio de kcal vs mes previo
  isCurrent: boolean;
}

// Un tramo de peso: se aplica a los cardios registrados a partir de `appliesFrom`
// (timestamp). El primer tramo usa appliesFrom = 0 (cubre todo lo anterior).
export interface WeightSegment {
  weight: number;
  appliesFrom: number;
  setAt: number;
}

/** Peso vigente para un instante dado (según los tramos ordenados asc.). */
export function weightForTimestamp(
  segments: WeightSegment[],
  ts: number
): number {
  if (!segments.length) return ASSUMED_WEIGHT_KG;
  let weight = segments[0].weight;
  for (const s of segments) {
    if (s.appliesFrom <= ts) weight = s.weight;
    else break;
  }
  return weight;
}

/** Redondea a 1 decimal y quita el ".0" innecesario. */
export const fmtNum = (n: number): string => {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
};

/** "12" o "12-12.6" según coincidan mín y máx. */
export const rangeStr = (min: number, max: number): string =>
  min === max ? fmtNum(min) : `${fmtNum(min)}-${fmtNum(max)}`;

/** Factor kcal/kg/km aproximado por disciplina. */
function disciplineKcalFactor(type: string): number {
  const t = type.toLowerCase();
  // Palabras clave en español e inglés (las etiquetas de disciplina se guardan
  // en el idioma activo de la app).
  if (t.includes('andar') || t.includes('walk')) return 0.5; // andar en cinta
  if (
    t.includes('bici') ||
    t.includes('bike') ||
    t.includes('elíptica') ||
    t.includes('eliptica') ||
    t.includes('elliptical')
  )
    return 0.28;
  if (t.includes('correr') || t.includes('cinta') || t.includes('run'))
    return 1.0;
  return 0.9;
}

/**
 * Estima kcal de una entrada. Para andar/correr usa las ecuaciones ACSM (VO2),
 * que incorporan la PENDIENTE; para bici/elíptica/otros, un modelo simple
 * distancia × factor. Sin velocidad → 0.
 *
 * kcal = VO2[ml/kg/min] × peso[kg] × min / 200  (≈ 5 kcal por litro de O2).
 */
export function estimateEntryKcal(
  e: CardioEntry,
  weightKg: number = ASSUMED_WEIGHT_KG
): number {
  if (e.speed == null || e.minutes == null) return 0;

  const t = e.type.toLowerCase();
  const grade = (e.pendiente ?? 0) / 100; // fracción de pendiente
  const speedMPerMin = (e.speed * 1000) / 60;

  if (t.includes('andar') || t.includes('walk')) {
    // ACSM andar: incluye la pendiente con peso 1.8 (mucho más que correr).
    const vo2 = 3.5 + 0.1 * speedMPerMin + 1.8 * speedMPerMin * grade;
    return (vo2 * weightKg * e.minutes) / 200;
  }
  if (t.includes('correr') || t.includes('cinta') || t.includes('run')) {
    // ACSM correr.
    const vo2 = 3.5 + 0.2 * speedMPerMin + 0.9 * speedMPerMin * grade;
    return (vo2 * weightKg * e.minutes) / 200;
  }

  // Bici, elíptica y otros: modelo simple distancia × factor.
  const distanceKm = e.speed * (e.minutes / 60);
  return weightKg * distanceKm * disciplineKcalFactor(e.type);
}

/** Parsea una entrada de cardio suelta ("Cinta: 22min, 11kmh, 2%"). */
export function parseCardioEntry(raw: string): CardioEntry {
  const trimmed = raw.trim();
  const typeMatch = trimmed.match(/^([^:]+):/);
  const minMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*mins?/i);
  // Solo velocidad real (km/h); ignoramos bpm/rpm que no son ritmo de avance.
  const speedMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*km\/?h/i);
  const pendMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*%/);

  return {
    type: typeMatch ? typeMatch[1].trim() : 'Cardio',
    minutes: minMatch ? parseFloat(minMatch[1]) : null,
    speed: speedMatch ? parseFloat(speedMatch[1]) : null,
    pendiente: pendMatch ? parseFloat(pendMatch[1]) : null,
    raw: trimmed,
  };
}

/** Parsea el rawInput completo de un log en sus entradas de cardio. */
export function parseCardioEntries(rawInput: string): CardioEntry[] {
  if (!rawInput || !rawInput.trim()) return [];
  return rawInput
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean)
    .map(parseCardioEntry);
}

/** ¿Hay al menos un log con cardio registrado? */
export function hasAnyCardio(logs: WorkoutLog[]): boolean {
  return logs.some(
    (l) => parseCardioEntries(l.cardio?.rawInput ?? '').length > 0
  );
}

/** Id del día sintético "Solo cardio" (sin ejercicios de fuerza). */
export const CARDIO_ONLY_DAY_ID = '__cardio_only__';

/**
 * Día sintético para las sesiones de "solo cardio": no pertenece a ninguna
 * rutina y no tiene ejercicios de fuerza. El log resultante se marca cardioOnly.
 * Compartido por App (inserción), Cardio y Calendario (para resolver el día al
 * abrir el detalle, ya que no existe en ninguna rutina).
 */
export const CARDIO_ONLY_DAY: WorkoutDay = {
  id: CARDIO_ONLY_DAY_ID,
  dayNumber: 0,
  name: 'Solo cardio',
  emoji: 'run-fast',
  exercises: [],
};

/** ¿Es un log de solo cardio (sin fuerza)? */
export function isCardioOnlyLog(log: WorkoutLog): boolean {
  return !!log.cardioOnly || log.dayId === CARDIO_ONLY_DAY_ID;
}

/**
 * Nombre del icono (MaterialCommunityIcons) de una disciplina de cardio.
 * `hasIncline` fuerza el icono de cuesta arriba. Se devuelve como string para
 * mantener esta librería libre de dependencias de UI; se castea en el consumidor.
 */
export function disciplineIconName(type: string, hasIncline = false): string {
  const tt = type.toLowerCase();
  if (hasIncline) return 'slope-uphill';
  if (tt.includes('andar') || tt.includes('walk')) return 'walk';
  if (tt.includes('bici') || tt.includes('bike')) return 'bike';
  if (
    tt.includes('elíptica') ||
    tt.includes('eliptica') ||
    tt.includes('elliptical')
  )
    return 'human-handsup';
  if (tt.includes('correr') || tt.includes('cinta') || tt.includes('run'))
    return 'run-fast';
  return 'run';
}

/**
 * Disciplina "más realizada" de una sesión: la que más minutos acumula (kcal
 * como desempate). Devuelve null si la sesión no tiene disciplinas.
 */
export function mostPerformedDiscipline(
  session: CardioSession
): MergedCardioEntry | null {
  if (!session.disciplines.length) return null;
  return session.disciplines.reduce((best, d) =>
    d.totalMinutes > best.totalMinutes ||
    (d.totalMinutes === best.totalMinutes && d.kcal > best.kcal)
      ? d
      : best
  );
}

/** Convierte un log en una sesión de cardio, o null si no tiene cardio. */
export function cardioSessionFromLog(
  log: WorkoutLog,
  weight: number | WeightSegment[] = ASSUMED_WEIGHT_KG
): CardioSession | null {
  const raw = log.cardio?.rawInput ?? '';
  const parsed = parseCardioEntries(raw);
  if (parsed.length === 0) return null;

  // Peso del log: constante, o el vigente cuando se registró (por createdAt).
  const weightKg =
    typeof weight === 'number'
      ? weight
      : weightForTimestamp(weight, log.createdAt);

  const date = log.date || new Date(log.createdAt).toISOString().split('T')[0];

  // Reclasificación retroactiva: entradas antiguas con pendiente = andar en cinta.
  const entries = parsed.map((e) =>
    e.pendiente != null &&
    date <= TREADMILL_WALK_CUTOFF &&
    !e.type.toLowerCase().includes('andar')
      ? { ...e, type: TREADMILL_WALK_LABEL }
      : e
  );

  const totalMinutes = entries.reduce((sum, e) => sum + (e.minutes ?? 0), 0);
  const totalKm = entries.reduce(
    (sum, e) =>
      sum +
      (e.speed != null && e.minutes != null ? e.speed * (e.minutes / 60) : 0),
    0
  );
  const speeds = entries
    .map((e) => e.speed)
    .filter((n): n is number => n != null);
  const avgSpeed = speeds.length
    ? speeds.reduce((a, b) => a + b, 0) / speeds.length
    : null;
  const disciplines = mergeSessionEntries(entries, weightKg);
  const totalKcal = disciplines.reduce((sum, d) => sum + d.kcal, 0);

  return {
    logId: log.id,
    date,
    entries,
    disciplines,
    totalMinutes,
    totalKm,
    avgSpeed,
    totalKcal,
  };
}

/** Clave de semana ISO 8601 (lunes-domingo) para una fecha YYYY-MM-DD. */
export function isoWeekKey(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.valueOf())) return '0000-W00';

  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7; // lunes = 0
  target.setDate(target.getDate() - dayNr + 3); // jueves de esta semana

  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const firstDayNr = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstDayNr + 3);

  const week =
    1 +
    Math.round(
      (target.valueOf() - firstThursday.valueOf()) / (7 * 24 * 3600 * 1000)
    );

  return `${target.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Rango lunes-domingo (YYYY-MM-DD) de la semana ISO que contiene la fecha. */
export function isoWeekRange(dateStr: string): { start: string; end: string } {
  const d = new Date(`${dateStr}T00:00:00`);
  const dayNr = (d.getDay() + 6) % 7; // lunes = 0
  const start = new Date(d);
  start.setDate(d.getDate() - dayNr);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const iso = (x: Date) =>
    `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(
      x.getDate()
    ).padStart(2, '0')}`;
  return { start: iso(start), end: iso(end) };
}

/**
 * Agrupa todos los logs con cardio en semanas de calendario, calculando las
 * kcal semanales y su mejora respecto a la semana previa con datos.
 */
export function buildCardioWeeks(
  logs: WorkoutLog[],
  weight: number | WeightSegment[] = ASSUMED_WEIGHT_KG
): CardioWeek[] {
  const sessions = logs
    .map((l) => cardioSessionFromLog(l, weight))
    .filter((s): s is CardioSession => s != null);
  if (sessions.length === 0) return [];

  const byWeek = new Map<string, CardioSession[]>();
  for (const session of sessions) {
    const key = isoWeekKey(session.date);
    const bucket = byWeek.get(key);
    if (bucket) bucket.push(session);
    else byWeek.set(key, [session]);
  }

  const keys = Array.from(byWeek.keys()).sort();
  const todayKey = isoWeekKey(new Date().toISOString().split('T')[0]);

  let prevKcal: number | null = null;
  return keys.map((key, index) => {
    const weekSessions = byWeek
      .get(key)!
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date));

    const totalMinutes = weekSessions.reduce((s, x) => s + x.totalMinutes, 0);
    const totalKcal = weekSessions.reduce((s, x) => s + x.totalKcal, 0);
    const allSpeeds = weekSessions
      .flatMap((s) => s.entries.map((e) => e.speed))
      .filter((n): n is number => n != null);
    const avgSpeed = allSpeeds.length
      ? allSpeeds.reduce((a, b) => a + b, 0) / allSpeeds.length
      : null;

    let improvement: number | null = null;
    let kcalDelta: number | null = null;
    if (prevKcal != null && totalKcal > 0) {
      kcalDelta = totalKcal - prevKcal;
      if (prevKcal > 0) improvement = (kcalDelta / prevKcal) * 100;
    }
    if (totalKcal > 0) prevKcal = totalKcal;

    const { start, end } = isoWeekRange(weekSessions[0].date);

    return {
      weekNumber: index + 1,
      weekKey: key,
      weekStart: start,
      weekEnd: end,
      sessions: weekSessions,
      totalMinutes,
      avgSpeed,
      totalKcal,
      kcalDelta,
      sessionCount: weekSessions.length,
      improvement,
      isCurrent: key === todayKey,
    };
  });
}

/**
 * Fusiona las entradas de una sesión por disciplina: suma los tiempos y guarda
 * el rango (mín-máx) de velocidad y de pendiente de cada disciplina.
 */
export function mergeSessionEntries(
  entries: CardioEntry[],
  weightKg: number = ASSUMED_WEIGHT_KG
): MergedCardioEntry[] {
  const map = new Map<string, MergedCardioEntry>();
  const order: string[] = [];
  for (const e of entries) {
    const key = e.type.trim().toLowerCase();
    let merged = map.get(key);
    if (!merged) {
      merged = {
        type: e.type,
        totalMinutes: 0,
        minSpeed: null,
        maxSpeed: null,
        minPendiente: null,
        maxPendiente: null,
        kcal: 0,
      };
      map.set(key, merged);
      order.push(key);
    }
    merged.totalMinutes += e.minutes ?? 0;
    merged.kcal += estimateEntryKcal(e, weightKg);
    if (e.speed != null) {
      merged.minSpeed =
        merged.minSpeed == null ? e.speed : Math.min(merged.minSpeed, e.speed);
      merged.maxSpeed =
        merged.maxSpeed == null ? e.speed : Math.max(merged.maxSpeed, e.speed);
    }
    if (e.pendiente != null) {
      merged.minPendiente =
        merged.minPendiente == null
          ? e.pendiente
          : Math.min(merged.minPendiente, e.pendiente);
      merged.maxPendiente =
        merged.maxPendiente == null
          ? e.pendiente
          : Math.max(merged.maxPendiente, e.pendiente);
    }
  }
  return order.map((k) => map.get(k)!);
}

/** Solo los resultados de una disciplina: "44 min, 12-12.6 km/h, 2%". */
export function formatMergedResults(m: MergedCardioEntry): string {
  const parts: string[] = [`${fmtNum(m.totalMinutes)} min`];
  if (m.minSpeed != null && m.maxSpeed != null) {
    parts.push(`${rangeStr(m.minSpeed, m.maxSpeed)} km/h`);
  }
  if (m.minPendiente != null && m.maxPendiente != null) {
    parts.push(`${rangeStr(m.minPendiente, m.maxPendiente)}%`);
  }
  return parts.join(', ');
}

/** Agrupa las sesiones por mes natural con sus kcal (para la gráfica). */
export function buildCardioMonths(
  logs: WorkoutLog[],
  weight: number | WeightSegment[] = ASSUMED_WEIGHT_KG
): CardioMonth[] {
  const sessions = logs
    .map((l) => cardioSessionFromLog(l, weight))
    .filter((s): s is CardioSession => s != null);
  if (sessions.length === 0) return [];

  const byMonth = new Map<string, CardioSession[]>();
  for (const session of sessions) {
    const key = session.date.slice(0, 7); // YYYY-MM
    const bucket = byMonth.get(key);
    if (bucket) bucket.push(session);
    else byMonth.set(key, [session]);
  }

  const keys = Array.from(byMonth.keys()).sort();
  const todayKey = new Date().toISOString().slice(0, 7);

  let prevKcal: number | null = null;
  return keys.map((key) => {
    const monthSessions = byMonth.get(key)!;
    const totalMinutes = monthSessions.reduce((s, x) => s + x.totalMinutes, 0);
    const totalKm = monthSessions.reduce((s, x) => s + x.totalKm, 0);
    const totalKcal = monthSessions.reduce((s, x) => s + x.totalKcal, 0);
    const allSpeeds = monthSessions
      .flatMap((s) => s.entries.map((e) => e.speed))
      .filter((n): n is number => n != null);
    const avgSpeed = allSpeeds.length
      ? allSpeeds.reduce((a, b) => a + b, 0) / allSpeeds.length
      : null;

    let improvement: number | null = null;
    if (prevKcal != null && prevKcal > 0 && totalKcal > 0) {
      improvement = ((totalKcal - prevKcal) / prevKcal) * 100;
    }
    if (totalKcal > 0) prevKcal = totalKcal;

    const [year, month] = key.split('-').map(Number);
    return {
      monthKey: key,
      year,
      month: month - 1,
      avgSpeed,
      totalKcal,
      totalMinutes,
      totalKm,
      sessionCount: monthSessions.length,
      improvement,
      isCurrent: key === todayKey,
    };
  });
}
