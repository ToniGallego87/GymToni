import { parseCardioString, parseSeriesString } from '@lib/parsers';
import { CardioLog, ExerciseLog, WorkoutLog } from '../types';
import { WORKOUT_ROUTINES } from './workoutDays';

export const DEFAULT_ACTIVE_ROUTINE_ID = 'routine3';

function createTimestamp(date: string, hour = 18, minute = 0) {
  return new Date(`${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`).getTime();
}

function createExerciseLog(
  exerciseId: string,
  exerciseName: string,
  order: number,
  rawInput: string,
  notes = '',
  timestamp = Date.now()
): ExerciseLog {
  return {
    id: `${exerciseId}-${timestamp}-${order}`,
    exerciseId,
    exerciseName,
    order,
    rawInput,
    parsedSets: parseSeriesString(rawInput),
    notes: notes || undefined,
    timestamp,
  };
}

function createCardioLog(id: string, rawInput?: string | null): CardioLog | undefined {
  if (!rawInput?.trim()) return undefined;

  return {
    id: `${id}-cardio`,
    ...parseCardioString(rawInput),
  };
}

function createSeedLog(entry: {
  id: string;
  routineId: string;
  dayId: string;
  date: string;
  cardio?: string | null;
  exercises: Array<{
    exerciseId: string;
    exerciseName: string;
    order: number;
    rawInput: string;
    notes?: string;
  }>;
}): WorkoutLog {
  const createdAt = createTimestamp(entry.date);

  return {
    id: entry.id,
    routineId: entry.routineId,
    dayId: entry.dayId,
    date: entry.date,
    exercises: entry.exercises.map((exercise, index) =>
      createExerciseLog(
        exercise.exerciseId,
        exercise.exerciseName,
        exercise.order,
        exercise.rawInput,
        exercise.notes,
        createdAt + index * 60_000
      )
    ),
    cardio: createCardioLog(entry.id, entry.cardio),
    createdAt,
    updatedAt: createdAt + 45 * 60_000,
  };
}

function createLogFromDayInputs(
  id: string,
  routineId: string,
  dayId: string,
  date: string,
  setInputs: string[],
  cardioRawInput?: string | null
): WorkoutLog {
  const routine = WORKOUT_ROUTINES.find((item) => item.id === routineId);
  const day = routine?.days.find((item) => item.id === dayId);
  const createdAt = createTimestamp(date);

  const exercises = (day?.exercises || []).map((exercise, idx) =>
    createExerciseLog(
      exercise.id,
      exercise.name,
      exercise.order,
      String(setInputs[idx] || '-'),
      '',
      createdAt + idx * 60_000
    )
  );

  return {
    id,
    routineId,
    dayId,
    date,
    exercises,
    cardio: createCardioLog(id, cardioRawInput),
    createdAt,
    updatedAt: createdAt + 45 * 60_000,
  };
}

const ROUTINE_2_HISTORY = [
  { id: 'log201', dayId: 'r2-day1', date: '2026-01-03', sets: ['50x8, 60x8, 60x8, 65x5', '30x8, 40x8, 40x8, 40x6', '20x15, 22x14, 22x10', '10x15, 10x15, 10x15', '25x15, 30x15'], cardio: 'Cinta 15 mins 10km/h' },
  { id: 'log202', dayId: 'r2-day2', date: '2026-01-04', sets: ['0x8, 0x6, 0x5, 0x4', '60x8, 65x8, 70x8, 70x8', '20x10, 25x10, 30x9', '14x11, 16x10, 16x9', '14x15, 14x14, 14x12'], cardio: 'Cinta hiit 17mins 6-13km/h' },
  { id: 'log203', dayId: 'r2-day3', date: '2026-01-06', sets: ['20x8, 30x8, 40x8, 45x8', '16x8, 24x8, 30x8', '40x12, 50x12, 60x12', '40x12, 50x12, 50x10', '20x14, 20x18, 20x15', '0x15, 0x12, 0x7', '0x12, 0x12, 0x10'] },
  { id: 'log204', dayId: 'r2-day4', date: '2026-01-07', sets: ['30x12, 30x12, 30x8', '15x13, 15x12, 15x8', '12x12, 16x8, 16x7', '12x15, 14x15, 14x15', '80x15, 80x15, 80x'], cardio: 'Cinta: 20mins 10/10.6km/h' },
  { id: 'log205', dayId: 'r2-day5', date: '2026-01-09', sets: ['65x8, 70x10, 70x10', '40x12, 50x12, 50x10', '20x12, 25x12, 25x12', '18x12, 20x12, 20x12', '12x15, 12x15, 12x12', '0x30, 0x35, 0x30', '0x15, 0x15, 0x15'] },
  { id: 'log206', dayId: 'r2-day1', date: '2026-01-11', sets: ['60x8, 65x8, 65x6, 65x6', '30x8, 40x8, 40x8, 40x6', '22x15, 22x13, 22x12', '10x15, 10x15, 10x15', '30x15, 32.5x12'], cardio: 'Cinta: 20mins 10.3/10.6kmh' },
  { id: 'log207', dayId: 'r2-day2', date: '2026-01-12', sets: ['0x9, 0x7, 0x5, -', '65x8, 70x8, 75x8, 80x8', '25x10, 30x10, 30x10', '14x12, 16x12, 16x12', '14x15, 14x15, 14x13'], cardio: 'Cinta: hiit 20mins 6/13kmh' },
  { id: 'log208', dayId: 'r2-day3', date: '2026-01-13', sets: ['30x8, 40x8, 45x8, 50x5', '26x8, 30x8, 34x8', '50x12, 55x12, 60x10', '50x7, 40x12, 40x10', '0x15, 0x15, 0x', '0x15, 0x15, 0x15', '0x12, 0x12, 0x12'] },
  { id: 'log209', dayId: 'r2-day4', date: '2026-01-14', sets: ['30x12, 34x10, 34x9', '15x15, 15x13, 15x10', '14x11, 14x9, 14x8', '20x12, 20x11, 20x10', '80x12, 90x15, 100x15'], cardio: 'Cinta: 12mins, 10.8kmh' },
  { id: 'log210', dayId: 'r2-day5', date: '2026-01-16', sets: ['65x12, 70x8, 70x9', '40x12, 50x11, 50x11', '22.5x15, 25x15, 27.5x15', '20x12, 20x12, 22x12', '14x13, 14x13, 14x11', '0x30, 0x30, 0x35', '0x15, 0x15, 0x'] },
  { id: 'log211', dayId: 'r2-day1', date: '2026-01-18', sets: ['60x8, 65x8, 65x5, -', '35x8, 40x8, 40x8, 40x7', '22x15, 22x15, 22x13', '10x15, 10x15, 12x12', '32.5x15, 35x12'], cardio: 'Cinta: 20mins 10.6kmh' },
  { id: 'log212', dayId: 'r2-day2', date: '2026-01-19', sets: ['0x9, 0x8, 0x6, 0x5', '70x8, 75x8, 80x8, 80x8', '27.5x12, 30x10, 32.5x10', '16x10, 18x10, 18x9', '14x15, 16x15, 16x12'], cardio: 'Cinta: hiit 19mins 6/13kmh' },
  { id: 'log213', dayId: 'r2-day3', date: '2026-01-21', sets: ['35x8, 40x8, 45x8, 50x7', '30x8, 34x8, 36x8', '55x12, 60x12, 60x11', '40x12, 45x12, 50x12', '20x15, 20x20, 25x18', '0x15, 0x15, 0x15', '0x12, 0x12, 0x12'] },
  { id: 'log214', dayId: 'r2-day4', date: '2026-01-22', sets: ['30x12, 34x12, 34x9', '15x14, 15x13, 15x12', '14x11, 14x10, 14x9', '20x12, 20x15, 20x12', '90x15, 100x15, 100x12'] },
  { id: 'log215', dayId: 'r2-day5', date: '2026-01-23', sets: ['65x12, 70x9, 70x10', '40x12, 50x12, 55x12', '25x15, 27.5x15, 30x15', '22.5x12, 22.5x12, 22.5x12', '14x13, 14x13, 14x10', '0x38, 0x27, 0x32', '0x15, 0x15, 0x15'] },
  { id: 'log216', dayId: 'r2-day1', date: '2026-01-25', sets: ['60x8, 65x8, 65x8, 70x5', '35x8, 40x8, 40x8, 45x7', '22x15, 22x15, 22x15', '10x15, 12x13, 12x13', '35x15, 35x11'], cardio: 'Cinta: 20mins 10.7kmh' },
  { id: 'log217', dayId: 'r2-day2', date: '2026-01-26', sets: ['0x10, 0x8, 0x6, 0x5', '75x8, 80x8, 80x8, 85x6', '30x10, 32.5x10, 35x9', '18x10, 18x10, 18x10', '16x15, 16x15, 16x'], cardio: 'Cinta: hiit 19mins 6/13kmh' },
  { id: 'log218', dayId: 'r2-day3', date: '2026-01-28', sets: ['40x8, 45x8, 50x8, 50x8', '34x8, 36x8, 40x8', '60x12, 60x11, 60x10', '45x13, 50x12, 50x11', '20x20, 20x20, 25x16', '0x15, 0x15, 0x15', '0x12, 0x12, 0x12'] },
  { id: 'log219', dayId: 'r2-day4', date: '2026-01-29', sets: ['34x12, 34x11, 34x8', '15x15, 15x15, 15x13', '14x12, 14x11, 14x7', '20x15, 20x15, 20x', '100x15, 100x15, 100x13'], cardio: 'Cinta: 20mins 10.8kmh' },
  { id: 'log220', dayId: 'r2-day5', date: '2026-01-30', sets: ['65x12, 70x11, 70x8', '50x12, 50x12, 55x9', '27.5x15, 27.5x15, 32.5x15', '22x12, 24x10, 24x9', '14x14, 14x14, 14x12', '-', '-'] },
  { id: 'log221', dayId: 'r2-day1', date: '2026-02-01', sets: ['60x8, 65x8, 65x8, 70x5', '40x8, 40x8, 45x7, 45x7', '22x15, 22x15, 22x15', '10x15, 12x14, 12x13', '35x15, 35x13'], cardio: 'Cinta: 20mins 10.8/11/11.2kmh' },
  { id: 'log222', dayId: 'r2-day2', date: '2026-02-02', sets: ['0x10, 0x8, 0x7, 0x6', '75x8, 80x8, 85x8, 85x8', '33x10, 36x9, 36x5', '18x10, 18x10, 20x7', '16x15, 16x15, 16x'], cardio: 'Cinta: hiit 21mins 6/13kmh' },
  { id: 'log223', dayId: 'r2-day3', date: '2026-02-03', sets: ['45x8, 50x8, 50x8, 52.5x6', '36x8, 38x8, 40x8', '60x12, 60x12, 60x10', '50x12, 52.5x12, 55x10', '0x15, 0x13, 0x12', '0x20, 0x20, 0x20', '0x12, 0x12, 0x12'] },
  { id: 'log224', dayId: 'r2-day4', date: '2026-02-05', sets: ['34x12, 34x12, 34x8', '15x15, 17.5x14, 17.5x11', '14x10, 14x10, 14x10', '20x15, 22.5x12, 22.5x10', '90x15, 100x15, 100x12'], cardio: 'Cinta: 22mins 11/11.3kmh' },
  { id: 'log225', dayId: 'r2-day5', date: '2026-02-06', sets: ['65x12, 70x12, 70x10', '50x12, 50x12, 55x10', '27.5x12, 32.5x15, 35x15', '22x12, 24x12, 24x12', '14x14, 14x12, 14x10', '0x35, 0x35, 0x25', '0x15, 0x15, 0x13'] },
  { id: 'log226', dayId: 'r2-day1', date: '2026-02-08', sets: ['60x8, 65x8, 65x6, 65x7', '40x8, 45x8, 45x8, 50x6', '22x15, 22x15, 24x15', '12x12, 14x14, 14x14', '35x15, 35x13'], cardio: 'Cinta: 20mins 11.2/11.4kmh' },
  { id: 'log227', dayId: 'r2-day2', date: '2026-02-09', sets: ['0x8, 0x8, 0x8, 0x6', '80x10, 80x8, 85x8, 85x8', '32.5x10, 35x10, 35x10', '18x10, 18x10, 20x7', '16x15, 16x15, 16x14'], cardio: 'Cinta: 15mins 11.5kmh' },
];

const ROUTINE_3_LOGS = [
  {
    id: 'log001', routineId: 'routine3', dayId: 'day1', date: '2026-02-15', cardio: 'Cinta: 22.5mins, 11.5/11.7kmh',
    exercises: [
      { exerciseId: 'day1-ex1', exerciseName: 'Press banca plano con barra', order: 1, rawInput: '60x8, 65x6, 65x4' },
      { exerciseId: 'day1-ex2', exerciseName: 'Aperturas declinadas en polea', order: 2, rawInput: '12.5x15, 15x15' },
      { exerciseId: 'day1-ex3', exerciseName: 'Press inclinado mancuernas', order: 3, rawInput: '28x10, 30x10, 32x9' },
      { exerciseId: 'day1-ex4', exerciseName: 'Press militar barra o mancuernas', order: 4, rawInput: '18x8, 22x8, 22x6' },
      { exerciseId: 'day1-ex5', exerciseName: 'Elevaciones laterales mancuernas', order: 5, rawInput: '7.5x13, 7.5x12, 7.5x14', notes: 'En polea' },
      { exerciseId: 'day1-ex6', exerciseName: 'Extensión tríceps polea barra', order: 6, rawInput: '30x12, 32.5x12, 35x12' },
      { exerciseId: 'day1-ex7', exerciseName: 'Extensión tras nuca cuerda', order: 7, rawInput: '22.5x12, 22.5x12' },
    ],
  },
  {
    id: 'log002', routineId: 'routine3', dayId: 'day2', date: '2026-02-16', cardio: 'Cinta: 18mins 11.8kmh',
    exercises: [
      { exerciseId: 'day2-ex1', exerciseName: 'Dominadas prono', order: 1, rawInput: '0x6, 0x7, 0x5, 0x5' },
      { exerciseId: 'day2-ex2', exerciseName: 'Remo con barra', order: 2, rawInput: '45x8, 55x8, 65x8, 70x6', notes: 'Peso + barra' },
      { exerciseId: 'day2-ex3', exerciseName: 'Pullover polea alta', order: 3, rawInput: '30x12, 32.5x12, 35x10' },
      { exerciseId: 'day2-ex4', exerciseName: 'Face pull pesado', order: 4, rawInput: '27.5x15, 30x15, 32x12' },
      { exerciseId: 'day2-ex5', exerciseName: 'Curl barra recta', order: 5, rawInput: '30x10, 30x10, 35x8' },
      { exerciseId: 'day2-ex6', exerciseName: 'Curl martillo alterno', order: 6, rawInput: '14x12, 16x11' },
    ],
  },
  {
    id: 'log003', routineId: 'routine3', dayId: 'day3', date: '2026-02-17', cardio: null,
    exercises: [
      { exerciseId: 'day3-ex1', exerciseName: 'Sentadilla libre o hack', order: 1, rawInput: '20x8, 20x8, 30x8, 35x7' },
      { exerciseId: 'day3-ex2', exerciseName: 'Prensa inclinada', order: 2, rawInput: '40x10, 80x10, 90x10' },
      { exerciseId: 'day3-ex3', exerciseName: 'Extensión cuádriceps unilateral', order: 3, rawInput: '25x12, 27.5x11, 27.5x10' },
      { exerciseId: 'day3-ex4', exerciseName: 'Gemelos de pie', order: 4, rawInput: '0x12, 0x12, 0x12' },
      { exerciseId: 'day3-ex5', exerciseName: 'Elevación piernas tumbado', order: 5, rawInput: '0x20, 0x15, 0x15' },
      { exerciseId: 'day3-ex6', exerciseName: 'Plancha lateral', order: 6, rawInput: '0x30, 0x35, 0x30' },
    ],
  },
  {
    id: 'log004', routineId: 'routine3', dayId: 'day4', date: '2026-02-18', cardio: 'Cinta: 12m 5kmh 9p, 10mins 12kmh',
    exercises: [
      { exerciseId: 'day4-ex1', exerciseName: 'Press pecho en máquina convergente', order: 1, rawInput: '30x12, 50x12, 50x10', notes: 'Kg por brazo' },
      { exerciseId: 'day4-ex2', exerciseName: 'Remo hammer o pecho apoyado', order: 2, rawInput: '50x12, 52.5x11, 52.5x8', notes: 'Kg por brazo' },
      { exerciseId: 'day4-ex3', exerciseName: 'Arnold press', order: 3, rawInput: '14x10, 14x10, 14x10' },
      { exerciseId: 'day4-ex4', exerciseName: 'Pájaros en peck-deck', order: 4, rawInput: '20x15, 22.5x13, 22.5x10, -' },
      { exerciseId: 'day4-ex5', exerciseName: 'Curl inclinado mancuernas', order: 5, rawInput: '14x12, 14x12' },
      { exerciseId: 'day4-ex6', exerciseName: 'Fondos máquina o polea tríceps', order: 6, rawInput: '100x12, 120x12' },
    ],
  },
  {
    id: 'log005', routineId: 'routine3', dayId: 'day5', date: '2026-02-19', cardio: null,
    exercises: [
      { exerciseId: 'day5-ex1', exerciseName: 'Peso muerto rumano', order: 1, rawInput: '55x8, 65x8, 70x8, 70x8', notes: 'Peso con barra' },
      { exerciseId: 'day5-ex2', exerciseName: 'Hip thrust barra', order: 2, rawInput: '40x10, 40x10, 40x7' },
      { exerciseId: 'day5-ex3', exerciseName: 'Curl femoral sentado o tumbado', order: 3, rawInput: '40x10, 40x9, 40x8' },
      { exerciseId: 'day5-ex4', exerciseName: 'Zancadas con mancuernas', order: 4, rawInput: '8+8x11, 8+8x9', notes: 'Peso por mancuerna' },
      { exerciseId: 'day5-ex5', exerciseName: 'Gemelos sentado', order: 5, rawInput: '20x20, 20x18, 20x15' },
      { exerciseId: 'day5-ex6', exerciseName: 'Crunch oblicuo', order: 6, rawInput: '0x20, 0x20, 0x20' },
      { exerciseId: 'day5-ex7', exerciseName: 'Crunch encogimiento', order: 7, rawInput: '0x15, 0x15, 0x15' },
    ],
  },
  {
    id: 'log006', routineId: 'routine3', dayId: 'day1', date: '2026-02-22', cardio: 'Cinta: 22mins, 11.8/12/12.2kmh',
    exercises: [
      { exerciseId: 'day1-ex1', exerciseName: 'Press banca plano con barra', order: 1, rawInput: '60x8, 65x6, 65x6' },
      { exerciseId: 'day1-ex2', exerciseName: 'Aperturas declinadas en polea', order: 2, rawInput: '15x15, 15x14' },
      { exerciseId: 'day1-ex3', exerciseName: 'Press inclinado mancuernas', order: 3, rawInput: '30x10, 32x10, 34x8' },
      { exerciseId: 'day1-ex4', exerciseName: 'Press militar barra o mancuernas', order: 4, rawInput: '20x11, 24x6, 24x5' },
      { exerciseId: 'day1-ex5', exerciseName: 'Elevaciones laterales mancuernas', order: 5, rawInput: '7.5x12, 7.5x12, 7.5x12' },
      { exerciseId: 'day1-ex6', exerciseName: 'Extensión tríceps polea barra', order: 6, rawInput: '32.5x12, 35x12, 37.5x11' },
      { exerciseId: 'day1-ex7', exerciseName: 'Extensión tras nuca cuerda', order: 7, rawInput: '22.5x12, 22.5x10' },
    ],
  },
  {
    id: 'log007', routineId: 'routine3', dayId: 'day2', date: '2026-02-23', cardio: 'Cinta: 20mins 10p 5kmh',
    exercises: [
      { exerciseId: 'day2-ex1', exerciseName: 'Dominadas prono', order: 1, rawInput: '0x8, 0x7, 0x6, 0x5' },
      { exerciseId: 'day2-ex2', exerciseName: 'Remo con barra', order: 2, rawInput: '60x8, 65x8, 70x8, 70x8', notes: 'Peso + barra' },
      { exerciseId: 'day2-ex3', exerciseName: 'Pullover polea alta', order: 3, rawInput: '31.5x12, 34.5x12, 34.5x11' },
      { exerciseId: 'day2-ex4', exerciseName: 'Face pull pesado', order: 4, rawInput: '28.5x15, 31.5x15, 34.5x14' },
      { exerciseId: 'day2-ex5', exerciseName: 'Curl barra recta', order: 5, rawInput: '30x12, 30x12, 30x11' },
      { exerciseId: 'day2-ex6', exerciseName: 'Curl martillo alterno', order: 6, rawInput: '14x12, 16x11' },
    ],
  },
  {
    id: 'log008', routineId: 'routine3', dayId: 'day3', date: '2026-02-24', cardio: null,
    exercises: [
      { exerciseId: 'day3-ex1', exerciseName: 'Sentadilla libre o hack', order: 1, rawInput: '25x8, 30x8, 30x8, 35x8' },
      { exerciseId: 'day3-ex2', exerciseName: 'Prensa inclinada', order: 2, rawInput: '80x10, 100x10, 110x10' },
      { exerciseId: 'day3-ex3', exerciseName: 'Extensión cuádriceps unilateral', order: 3, rawInput: '25x12, 27.5x12, 27.5x12' },
      { exerciseId: 'day3-ex4', exerciseName: 'Gemelos de pie', order: 4, rawInput: '0x20, 0x20, 0x20' },
      { exerciseId: 'day3-ex5', exerciseName: 'Elevación piernas tumbado', order: 5, rawInput: '0x15, 0x15, 0x15' },
      { exerciseId: 'day3-ex6', exerciseName: 'Plancha lateral', order: 6, rawInput: '0x30, 0x30, 0x30' },
    ],
  },
  {
    id: 'log009', routineId: 'routine3', dayId: 'day4', date: '2026-02-26', cardio: null,
    exercises: [
      { exerciseId: 'day4-ex1', exerciseName: 'Press pecho en máquina convergente', order: 1, rawInput: '40x12, 50x12, 50x12', notes: 'Kg por brazo' },
      { exerciseId: 'day4-ex2', exerciseName: 'Remo hammer o pecho apoyado', order: 2, rawInput: '50x12, 52.5x12, -', notes: 'Kg por brazo' },
      { exerciseId: 'day4-ex3', exerciseName: 'Arnold press', order: 3, rawInput: '14x10, 14x10, 16x10' },
      { exerciseId: 'day4-ex4', exerciseName: 'Pájaros en peck-deck', order: 4, rawInput: '22.5x14, 22.5x11, 22.5x10' },
      { exerciseId: 'day4-ex5', exerciseName: 'Curl inclinado mancuernas', order: 5, rawInput: '14x12, 16x9' },
      { exerciseId: 'day4-ex6', exerciseName: 'Fondos máquina o polea tríceps', order: 6, rawInput: '120x12, 120x12' },
    ],
  },
  {
    id: 'log010', routineId: 'routine3', dayId: 'day5', date: '2026-02-27', cardio: null,
    exercises: [
      { exerciseId: 'day5-ex1', exerciseName: 'Peso muerto rumano', order: 1, rawInput: '55x8, 65x8, 70x8, 75x8', notes: 'Peso con barra' },
      { exerciseId: 'day5-ex2', exerciseName: 'Hip thrust barra', order: 2, rawInput: '40x10, 40x10, 40x10' },
      { exerciseId: 'day5-ex3', exerciseName: 'Curl femoral sentado o tumbado', order: 3, rawInput: '20x5, 10x12, 15x10', notes: 'Por pierna, hammer' },
      { exerciseId: 'day5-ex4', exerciseName: 'Zancadas con mancuernas', order: 4, rawInput: '10x11, 10x10', notes: 'Peso por mancuerna' },
      { exerciseId: 'day5-ex5', exerciseName: 'Gemelos sentado', order: 5, rawInput: '20x20, 20x19, 20x17' },
      { exerciseId: 'day5-ex6', exerciseName: 'Crunch oblicuo', order: 6, rawInput: '0x15, 0x15, 0x15' },
      { exerciseId: 'day5-ex7', exerciseName: 'Crunch encogimiento', order: 7, rawInput: '0x20, 0x15, 0x15', notes: 'Encogimiento' },
    ],
  },
  {
    id: 'log011', routineId: 'routine3', dayId: 'day1', date: '2026-03-01', cardio: null,
    exercises: [
      { exerciseId: 'day1-ex1', exerciseName: 'Press banca plano con barra', order: 1, rawInput: '60x8, 65x8, 70x7' },
      { exerciseId: 'day1-ex2', exerciseName: 'Aperturas declinadas en polea', order: 2, rawInput: '15x15, 17.5x12' },
      { exerciseId: 'day1-ex3', exerciseName: 'Press inclinado mancuernas', order: 3, rawInput: '32x10, 34x8, 34x6' },
      { exerciseId: 'day1-ex4', exerciseName: 'Press militar barra o mancuernas', order: 4, rawInput: '22x8, 22x7, 22x6' },
      { exerciseId: 'day1-ex5', exerciseName: 'Elevaciones laterales mancuernas', order: 5, rawInput: '12x15, 14x15, 14x13', notes: 'Mancuernas' },
      { exerciseId: 'day1-ex6', exerciseName: 'Extensión tríceps polea barra', order: 6, rawInput: '35x12, 37.5x11, 37.5x10' },
      { exerciseId: 'day1-ex7', exerciseName: 'Extensión tras nuca cuerda', order: 7, rawInput: '22.5x14, 22.5x12' },
    ],
  },
  {
    id: 'log012', routineId: 'routine3', dayId: 'day2', date: '2026-03-02', cardio: 'Cinta: 14mins, 12kmh',
    exercises: [
      { exerciseId: 'day2-ex1', exerciseName: 'Dominadas prono', order: 1, rawInput: '0x8, 0x7, 0x6, 0x6' },
      { exerciseId: 'day2-ex2', exerciseName: 'Remo con barra', order: 2, rawInput: '65x8, 70x8, 75x8, 75x7', notes: 'Peso + barra' },
      { exerciseId: 'day2-ex3', exerciseName: 'Pullover polea alta', order: 3, rawInput: '31.5x12, 31.5x12, 34.5x12' },
      { exerciseId: 'day2-ex4', exerciseName: 'Face pull pesado', order: 4, rawInput: '31.5x12, 34.5x15, 36x14' },
      { exerciseId: 'day2-ex5', exerciseName: 'Curl barra recta', order: 5, rawInput: '30x10, 35x10, 35x9' },
      { exerciseId: 'day2-ex6', exerciseName: 'Curl martillo alterno', order: 6, rawInput: '14x12, 16x12' },
    ],
  },
  {
    id: 'log013', routineId: 'routine3', dayId: 'day3', date: '2026-03-03', cardio: null,
    exercises: [
      { exerciseId: 'day3-ex1', exerciseName: 'Sentadilla libre o hack', order: 1, rawInput: '25x8, 30x8, 35x8, 35x7' },
      { exerciseId: 'day3-ex2', exerciseName: 'Prensa inclinada', order: 2, rawInput: '90x10, 110x10, 120x10' },
      { exerciseId: 'day3-ex3', exerciseName: 'Extensión cuádriceps unilateral', order: 3, rawInput: '25x12, 27.5x12, 30x12' },
      { exerciseId: 'day3-ex4', exerciseName: 'Gemelos de pie', order: 4, rawInput: '0x20, 0x20, 0x20, 0x20' },
      { exerciseId: 'day3-ex5', exerciseName: 'Elevación piernas tumbado', order: 5, rawInput: '0x15, 0x15, -' },
      { exerciseId: 'day3-ex6', exerciseName: 'Plancha lateral', order: 6, rawInput: '0x40, -' },
    ],
  },
  {
    id: 'log014', routineId: 'routine3', dayId: 'day4', date: '2026-03-05', cardio: 'Cinta: 10m 10.5p 5.5kmh, 10m 12kmh',
    exercises: [
      { exerciseId: 'day4-ex1', exerciseName: 'Press pecho en máquina convergente', order: 1, rawInput: '40x12, 50x12, 52.5x10', notes: 'Kg por brazo' },
      { exerciseId: 'day4-ex2', exerciseName: 'Remo hammer o pecho apoyado', order: 2, rawInput: '50x12, 52.5x12, 55x10', notes: 'Kg por brazo' },
      { exerciseId: 'day4-ex3', exerciseName: 'Arnold press', order: 3, rawInput: '14x10, 16x10, 16x8' },
      { exerciseId: 'day4-ex4', exerciseName: 'Pájaros en peck-deck', order: 4, rawInput: '20x15, 22.5x12, 22.5x10' },
      { exerciseId: 'day4-ex5', exerciseName: 'Curl inclinado mancuernas', order: 5, rawInput: '14x12, 16x11' },
      { exerciseId: 'day4-ex6', exerciseName: 'Fondos máquina o polea tríceps', order: 6, rawInput: '120x12, 130x12' },
    ],
  },
  {
    id: 'log015', routineId: 'routine3', dayId: 'day5', date: '2026-03-06', cardio: null,
    exercises: [
      { exerciseId: 'day5-ex1', exerciseName: 'Peso muerto rumano', order: 1, rawInput: '65x8, 70x8, 75x8, 80x8', notes: 'Peso con barra' },
      { exerciseId: 'day5-ex2', exerciseName: 'Hip thrust barra', order: 2, rawInput: '40x10, 40x10, 40x9' },
      { exerciseId: 'day5-ex3', exerciseName: 'Curl femoral sentado o tumbado', order: 3, rawInput: '35x12, 37.5x11, 37.5x10' },
      { exerciseId: 'day5-ex4', exerciseName: 'Zancadas con mancuernas', order: 4, rawInput: '10x12, 10x11', notes: 'Peso por mancuerna' },
      { exerciseId: 'day5-ex5', exerciseName: 'Gemelos sentado', order: 5, rawInput: '20x20, 20x19, 20x18' },
      { exerciseId: 'day5-ex6', exerciseName: 'Crunch oblicuo', order: 6, rawInput: '0x15, 0x15, 0x15' },
      { exerciseId: 'day5-ex7', exerciseName: 'Crunch encogimiento', order: 7, rawInput: '0x15, 0x15, 0x15', notes: 'Encogimiento' },
    ],
  },
  {
    id: 'log016', routineId: 'routine3', dayId: 'day1', date: '2026-03-08', cardio: 'Cinta: 22mins 11.8/12kmh',
    exercises: [
      { exerciseId: 'day1-ex1', exerciseName: 'Press banca plano con barra', order: 1, rawInput: '65x8, 70x7, 70x6' },
      { exerciseId: 'day1-ex2', exerciseName: 'Aperturas declinadas en polea', order: 2, rawInput: '15x15, 15x14' },
      { exerciseId: 'day1-ex3', exerciseName: 'Press inclinado mancuernas', order: 3, rawInput: '32x10, 32x9, 32x6' },
      { exerciseId: 'day1-ex4', exerciseName: 'Press militar barra o mancuernas', order: 4, rawInput: '22x10, 22x8, 22x8' },
      { exerciseId: 'day1-ex5', exerciseName: 'Elevaciones laterales mancuernas', order: 5, rawInput: '14x15, 14x14, 14x15', notes: 'Mancuernas' },
      { exerciseId: 'day1-ex6', exerciseName: 'Extensión tríceps polea barra', order: 6, rawInput: '35x12, 35x12, 37.5x9' },
      { exerciseId: 'day1-ex7', exerciseName: 'Extensión tras nuca cuerda', order: 7, rawInput: '22.5x11, 22.5x10' },
    ],
  },
  {
    id: 'log017', routineId: 'routine3', dayId: 'day2', date: '2026-03-09', cardio: 'Cinta: 15mins 10.5p 5.5kmh',
    exercises: [
      { exerciseId: 'day2-ex1', exerciseName: 'Dominadas prono', order: 1, rawInput: '0x8, 0x8, 0x7, 0x6' },
      { exerciseId: 'day2-ex2', exerciseName: 'Remo con barra', order: 2, rawInput: '70x8, 70x8, 75x7, 75x6', notes: 'Peso + barra' },
      { exerciseId: 'day2-ex3', exerciseName: 'Pullover polea alta', order: 3, rawInput: '32.5x12, 35x12, 37.5x10' },
      { exerciseId: 'day2-ex4', exerciseName: 'Face pull pesado', order: 4, rawInput: '32.5x15, 35x15, 37.5x15' },
      { exerciseId: 'day2-ex5', exerciseName: 'Curl barra recta', order: 5, rawInput: '30x10, 35x10, 35x10' },
      { exerciseId: 'day2-ex6', exerciseName: 'Curl martillo alterno', order: 6, rawInput: '16x12, 16x12' },
    ],
  },
  {
    id: 'log018', routineId: 'routine3', dayId: 'day3', date: '2026-03-11', cardio: null,
    exercises: [
      { exerciseId: 'day3-ex1', exerciseName: 'Sentadilla libre o hack', order: 1, rawInput: '25x8, 30x8, 35x8, 35x8' },
      { exerciseId: 'day3-ex2', exerciseName: 'Prensa inclinada', order: 2, rawInput: '100x10, 120x10, 130x10' },
      { exerciseId: 'day3-ex3', exerciseName: 'Extensión cuádriceps unilateral', order: 3, rawInput: '27.5x12, 27.5x12, 30x12' },
      { exerciseId: 'day3-ex4', exerciseName: 'Gemelos de pie', order: 4, rawInput: '0x20, 0x20, 0x20, 0x20' },
      { exerciseId: 'day3-ex5', exerciseName: 'Elevación piernas tumbado', order: 5, rawInput: '0x15, 0x15, 0x15' },
      { exerciseId: 'day3-ex6', exerciseName: 'Plancha lateral', order: 6, rawInput: '0x40, 0x30, 0x30' },
    ],
  },
  {
    id: 'log019', routineId: 'routine3', dayId: 'day4', date: '2026-03-12', cardio: null,
    exercises: [
      { exerciseId: 'day4-ex1', exerciseName: 'Press pecho en máquina convergente', order: 1, rawInput: '45x12, 50x12, 52.5x12', notes: 'Kg por brazo' },
      { exerciseId: 'day4-ex2', exerciseName: 'Remo hammer o pecho apoyado', order: 2, rawInput: '50x12, 52.5x12, 52.5x10', notes: 'Kg por brazo' },
      { exerciseId: 'day4-ex3', exerciseName: 'Arnold press', order: 3, rawInput: '14x10, 16x10, 16x9' },
      { exerciseId: 'day4-ex4', exerciseName: 'Pájaros en peck-deck', order: 4, rawInput: '20x15, 22.5x13, 22.5x11' },
      { exerciseId: 'day4-ex5', exerciseName: 'Curl inclinado mancuernas', order: 5, rawInput: '14x12, 16x12' },
      { exerciseId: 'day4-ex6', exerciseName: 'Fondos máquina o polea tríceps', order: 6, rawInput: '120x12, 130x12' },
    ],
  },
  {
    id: 'log020', routineId: 'routine3', dayId: 'day5', date: '2026-03-13', cardio: null,
    exercises: [
      { exerciseId: 'day5-ex1', exerciseName: 'Peso muerto rumano', order: 1, rawInput: '70x8, 75x8, 80x8, 85x7', notes: 'Peso con barra' },
      { exerciseId: 'day5-ex2', exerciseName: 'Hip thrust barra', order: 2, rawInput: '40x10, 40x10, 42.5x8' },
      { exerciseId: 'day5-ex3', exerciseName: 'Curl femoral sentado o tumbado', order: 3, rawInput: '35x12, 37.5x12, 37.5x10' },
      { exerciseId: 'day5-ex4', exerciseName: 'Zancadas con mancuernas', order: 4, rawInput: '10x10, -', notes: 'Peso por mancuerna' },
      { exerciseId: 'day5-ex5', exerciseName: 'Gemelos sentado', order: 5, rawInput: '20x20, 20x18, 20x18' },
      { exerciseId: 'day5-ex6', exerciseName: 'Crunch oblicuo', order: 6, rawInput: '0x15, 0x15, 0x15' },
      { exerciseId: 'day5-ex7', exerciseName: 'Crunch encogimiento', order: 7, rawInput: '0x15, 0x15, 0x15', notes: 'Encogimiento' },
    ],
  },
  {
    id: 'log021', routineId: 'routine3', dayId: 'day1', date: '2026-03-15', cardio: null,
    exercises: [
      { exerciseId: 'day1-ex1', exerciseName: 'Press banca plano con barra', order: 1, rawInput: '65x6, 65x7, 65x6' },
      { exerciseId: 'day1-ex2', exerciseName: 'Aperturas declinadas en polea', order: 2, rawInput: '15x15, 15x14' },
      { exerciseId: 'day1-ex3', exerciseName: 'Press inclinado mancuernas', order: 3, rawInput: '32x10, 32x8, 32x8' },
      { exerciseId: 'day1-ex4', exerciseName: 'Press militar barra o mancuernas', order: 4, rawInput: '22x9, 22x8, 22x6' },
      { exerciseId: 'day1-ex5', exerciseName: 'Elevaciones laterales mancuernas', order: 5, rawInput: '14x15, 15x14, -', notes: 'Mancuernas' },
      { exerciseId: 'day1-ex6', exerciseName: 'Extensión tríceps polea barra', order: 6, rawInput: '35x12, 35x12, 37.5x10' },
      { exerciseId: 'day1-ex7', exerciseName: 'Extensión tras nuca cuerda', order: 7, rawInput: '22.5x12, 22.5x14' },
    ],
  },
  {
    id: 'log022', routineId: 'routine3', dayId: 'day2', date: '2026-03-16', cardio: 'Cinta: 20mins 10p 5.5kmh',
    exercises: [
      { exerciseId: 'day2-ex1', exerciseName: 'Dominadas prono', order: 1, rawInput: '0x8, 0x8, 0x6, 0x6' },
      { exerciseId: 'day2-ex2', exerciseName: 'Remo con barra', order: 2, rawInput: '80x6, 70x8, 75x8, 75x8', notes: 'Peso + barra' },
      { exerciseId: 'day2-ex3', exerciseName: 'Pullover polea alta', order: 3, rawInput: '35x15, 37.5x12, 37.5x10' },
      { exerciseId: 'day2-ex4', exerciseName: 'Face pull pesado', order: 4, rawInput: '35x15, 37.5x15, 37.5x15' },
      { exerciseId: 'day2-ex5', exerciseName: 'Curl barra recta', order: 5, rawInput: '30x10, 35x10, 35x10' },
      { exerciseId: 'day2-ex6', exerciseName: 'Curl martillo alterno', order: 6, rawInput: '16x12, 18x9' },
    ],
  },
  {
    id: 'log023', routineId: 'routine3', dayId: 'day3', date: '2026-03-17', cardio: null,
    exercises: [
      { exerciseId: 'day3-ex1', exerciseName: 'Sentadilla libre o hack', order: 1, rawInput: '25x8, 30x8, 35x8, 40x7' },
      { exerciseId: 'day3-ex2', exerciseName: 'Prensa inclinada', order: 2, rawInput: '120x10, 130x10, 140x10' },
      { exerciseId: 'day3-ex3', exerciseName: 'Extensión cuádriceps unilateral', order: 3, rawInput: '27.5x12, 30x11, 30x11' },
      { exerciseId: 'day3-ex4', exerciseName: 'Gemelos de pie', order: 4, rawInput: '0x20, 0x20, 0x20, 0x20' },
      { exerciseId: 'day3-ex5', exerciseName: 'Elevación piernas tumbado', order: 5, rawInput: '0x15, 0x15, 0x15' },
      { exerciseId: 'day3-ex6', exerciseName: 'Plancha lateral', order: 6, rawInput: '0x45, 0x40, 0x30' },
    ],
  },
  {
    id: 'log024', routineId: 'routine3', dayId: 'day4', date: '2026-03-19', cardio: null,
    exercises: [
      { exerciseId: 'day4-ex1', exerciseName: 'Press pecho en máquina convergente', order: 1, rawInput: '45x12, 45x11, 45x9', notes: 'Kg por brazo, menos incl.' },
      { exerciseId: 'day4-ex2', exerciseName: 'Remo hammer o pecho apoyado', order: 2, rawInput: '50x12, 52.5x11, 52.5x9', notes: 'Kg por brazo' },
      { exerciseId: 'day4-ex3', exerciseName: 'Arnold press', order: 3, rawInput: '16x10, 16x9, 16x7' },
      { exerciseId: 'day4-ex4', exerciseName: 'Pájaros en peck-deck', order: 4, rawInput: '20x15, 22.5x13, 22.5x9' },
      { exerciseId: 'day4-ex5', exerciseName: 'Curl inclinado mancuernas', order: 5, rawInput: '16x12, 18x10' },
      { exerciseId: 'day4-ex6', exerciseName: 'Fondos máquina o polea tríceps', order: 6, rawInput: '130x12, 130x12' },
    ],
  },
  {
    id: 'log025', routineId: 'routine3', dayId: 'day5', date: '2026-03-21', cardio: null,
    exercises: [
      { exerciseId: 'day5-ex1', exerciseName: 'Peso muerto rumano', order: 1, rawInput: '70x8, 80x8, 80x8, 85x7', notes: 'Peso con barra' },
      { exerciseId: 'day5-ex2', exerciseName: 'Hip thrust barra', order: 2, rawInput: '40x10, 40x10, 40x9' },
      { exerciseId: 'day5-ex3', exerciseName: 'Curl femoral sentado o tumbado', order: 3, rawInput: '35x12, 37.5x12, 37.5x12' },
      { exerciseId: 'day5-ex4', exerciseName: 'Zancadas con mancuernas', order: 4, rawInput: '10x12, 10x11', notes: 'Peso por mancuerna' },
      { exerciseId: 'day5-ex5', exerciseName: 'Gemelos sentado', order: 5, rawInput: '20x20, 20x17, 20x15' },
      { exerciseId: 'day5-ex6', exerciseName: 'Crunch oblicuo', order: 6, rawInput: '0x15, 0x15, -' },
      { exerciseId: 'day5-ex7', exerciseName: 'Crunch encogimiento', order: 7, rawInput: '0x15, 0x15, -', notes: 'Encogimiento' },
    ],
  },
  {
    id: 'log026', routineId: 'routine3', dayId: 'day1', date: '2026-03-22', cardio: 'Cinta: 16mins, 11.8kmh',
    exercises: [
      { exerciseId: 'day1-ex1', exerciseName: 'Press banca plano con barra', order: 1, rawInput: '60x8, 65x7, 65x6' },
      { exerciseId: 'day1-ex2', exerciseName: 'Aperturas declinadas en polea', order: 2, rawInput: '15x15, 15x15' },
      { exerciseId: 'day1-ex3', exerciseName: 'Press inclinado mancuernas', order: 3, rawInput: '30x9, 30x10, 30x9' },
      { exerciseId: 'day1-ex4', exerciseName: 'Press militar barra o mancuernas', order: 4, rawInput: '22x8, 22x8, 22x8' },
      { exerciseId: 'day1-ex5', exerciseName: 'Elevaciones laterales mancuernas', order: 5, rawInput: '14x15, 15x15, 15x14', notes: 'Mancuernas' },
      { exerciseId: 'day1-ex6', exerciseName: 'Extensión tríceps polea barra', order: 6, rawInput: '35x12, 35x12, 37.5x12' },
      { exerciseId: 'day1-ex7', exerciseName: 'Extensión tras nuca cuerda', order: 7, rawInput: '22.5x15, 22.5x15' },
    ],
  },
  {
    id: 'log027', routineId: 'routine3', dayId: 'day2', date: '2026-03-23', cardio: null,
    exercises: [
      { exerciseId: 'day2-ex1', exerciseName: 'Dominadas prono', order: 1, rawInput: '0x8, 0x8, 0x7, 0x7' },
      { exerciseId: 'day2-ex2', exerciseName: 'Remo con barra', order: 2, rawInput: '70x8, 75x8, 75x8, 80x6', notes: 'Peso + barra' },
      { exerciseId: 'day2-ex3', exerciseName: 'Pullover polea alta', order: 3, rawInput: '35x12, 37.5x12, 37.5x10' },
      { exerciseId: 'day2-ex4', exerciseName: 'Face pull pesado', order: 4, rawInput: '35x15, 37.5x15, 40x13' },
      { exerciseId: 'day2-ex5', exerciseName: 'Curl barra recta', order: 5, rawInput: '35x10, 35x10, 35x10' },
      { exerciseId: 'day2-ex6', exerciseName: 'Curl martillo alterno', order: 6, rawInput: '16x12, 18x10' },
    ],
  },
  {
    id: 'log028', routineId: 'routine3', dayId: 'day3', date: '2026-03-24', cardio: null,
    exercises: [
      { exerciseId: 'day3-ex1', exerciseName: 'Sentadilla libre o hack', order: 1, rawInput: '30x8, 35x8, 35x8, 40x6' },
      { exerciseId: 'day3-ex2', exerciseName: 'Prensa inclinada', order: 2, rawInput: '80x12, 100x10, 120x10', notes: 'Technogym' },
      { exerciseId: 'day3-ex3', exerciseName: 'Extensión cuádriceps unilateral', order: 3, rawInput: '25x12, 30x12, 32.5x11', notes: 'Technogym' },
      { exerciseId: 'day3-ex4', exerciseName: 'Gemelos de pie', order: 4, rawInput: '0x20, 10x20, 15x18, 15x18' },
      { exerciseId: 'day3-ex5', exerciseName: 'Elevación piernas tumbado', order: 5, rawInput: '-' },
      { exerciseId: 'day3-ex6', exerciseName: 'Plancha lateral', order: 6, rawInput: '-' },
    ],
  },
  {
    id: 'log029', routineId: 'routine3', dayId: 'day4', date: '2026-03-26', cardio: 'Cinta: 13mins, 11.8/11kmh',
    exercises: [
      { exerciseId: 'day4-ex1', exerciseName: 'Press pecho en máquina convergente', order: 1, rawInput: '45x12, 47.5x12, 50x10', notes: 'Kg por brazo' },
      { exerciseId: 'day4-ex2', exerciseName: 'Remo hammer o pecho apoyado', order: 2, rawInput: '50x12, 52.5x12, 55x11', notes: 'Kg por brazo' },
      { exerciseId: 'day4-ex3', exerciseName: 'Arnold press', order: 3, rawInput: '16x10, 16x9, 16x8' },
      { exerciseId: 'day4-ex4', exerciseName: 'Pájaros en peck-deck', order: 4, rawInput: '20x15, 22.5x12, 22.5x11' },
      { exerciseId: 'day4-ex5', exerciseName: 'Curl inclinado mancuernas', order: 5, rawInput: '16x12, 18x10' },
      { exerciseId: 'day4-ex6', exerciseName: 'Fondos máquina o polea tríceps', order: 6, rawInput: '130x12, 140x10' },
    ],
  },
  {
    id: 'log030', routineId: 'routine3', dayId: 'day5', date: '2026-03-27', cardio: null,
    exercises: [
      { exerciseId: 'day5-ex1', exerciseName: 'Peso muerto rumano', order: 1, rawInput: '70x8, 80x8, 85x8, 90x8', notes: 'Peso con barra' },
      { exerciseId: 'day5-ex2', exerciseName: 'Hip thrust barra', order: 2, rawInput: '35x10, 37.5x10, 37.5x10' },
      { exerciseId: 'day5-ex3', exerciseName: 'Curl femoral sentado o tumbado', order: 3, rawInput: '35x12, 37.5x12, 37.5x10' },
      { exerciseId: 'day5-ex4', exerciseName: 'Zancadas con mancuernas', order: 4, rawInput: '10x12, 10x11', notes: 'Peso por mancuerna' },
      { exerciseId: 'day5-ex5', exerciseName: 'Gemelos sentado', order: 5, rawInput: '-' },
      { exerciseId: 'day5-ex6', exerciseName: 'Crunch oblicuo', order: 6, rawInput: '0x15, 0x15, 0x15' },
      { exerciseId: 'day5-ex7', exerciseName: 'Crunch encogimiento', order: 7, rawInput: '0x15, 0x15, 0x15', notes: 'Encogimiento' },
    ],
  },
  {
    id: 'log031', routineId: 'routine3', dayId: 'day1', date: '2026-03-29', cardio: 'Cinta: 25mins 10p 5kmh',
    exercises: [
      { exerciseId: 'day1-ex1', exerciseName: 'Press banca plano con barra', order: 1, rawInput: '75x8, 80x8, 85x6', notes: 'Peso + barra' },
      { exerciseId: 'day1-ex2', exerciseName: 'Aperturas declinadas en polea', order: 2, rawInput: '15x15, 16.5x15' },
      { exerciseId: 'day1-ex3', exerciseName: 'Press inclinado mancuernas', order: 3, rawInput: '30x9, 30x8, 30x7' },
      { exerciseId: 'day1-ex4', exerciseName: 'Press militar barra o mancuernas', order: 4, rawInput: '22x8, 22x8, 22x8' },
      { exerciseId: 'day1-ex5', exerciseName: 'Elevaciones laterales mancuernas', order: 5, rawInput: '14x15, 14x15, 14x14', notes: 'Mancuernas' },
      { exerciseId: 'day1-ex6', exerciseName: 'Extensión tríceps polea barra', order: 6, rawInput: '35x12, 37.5x12, 37.5x12' },
      { exerciseId: 'day1-ex7', exerciseName: 'Extensión tras nuca cuerda', order: 7, rawInput: '22.5x15, 22.5x12' },
    ],
  },
  {
    id: 'log032', routineId: 'routine3', dayId: 'day2', date: '2026-03-30', cardio: null,
    exercises: [
      { exerciseId: 'day2-ex1', exerciseName: 'Dominadas prono', order: 1, rawInput: '0x8, 0x8, 0x8, 0x6' },
      { exerciseId: 'day2-ex2', exerciseName: 'Remo con barra', order: 2, rawInput: '70x8, 75x8, 75x8, 80x7', notes: 'Peso + barra' },
      { exerciseId: 'day2-ex3', exerciseName: 'Pullover polea alta', order: 3, rawInput: '34.5x12, 37.5x11, 37.5x11' },
      { exerciseId: 'day2-ex4', exerciseName: 'Face pull pesado', order: 4, rawInput: '34.5x15, 34.5x15, 37.5x14' },
      { exerciseId: 'day2-ex5', exerciseName: 'Curl barra recta', order: 5, rawInput: '35x10, 35x10, 35x10' },
      { exerciseId: 'day2-ex6', exerciseName: 'Curl martillo alterno', order: 6, rawInput: '16x12, 18x10' },
    ],
  },
  {
    id: 'log033', routineId: 'routine3', dayId: 'day3', date: '2026-03-31', cardio: null,
    exercises: [
      { exerciseId: 'day3-ex1', exerciseName: 'Sentadilla libre o hack', order: 1, rawInput: '30x8, 35x8, 35x8, 35x7' },
      { exerciseId: 'day3-ex2', exerciseName: 'Prensa inclinada', order: 2, rawInput: '130x10, 130x10, 130x9' },
      { exerciseId: 'day3-ex3', exerciseName: 'Extensión cuádriceps unilateral', order: 3, rawInput: '20x12, 25x12, 27.5x11', notes: 'Hammer' },
      { exerciseId: 'day3-ex4', exerciseName: 'Gemelos de pie', order: 4, rawInput: '10x20, 15x20, 15x20, 20x20' },
      { exerciseId: 'day3-ex5', exerciseName: 'Elevación piernas tumbado', order: 5, rawInput: '0x15, 0x15, 0x15' },
      { exerciseId: 'day3-ex6', exerciseName: 'Plancha lateral', order: 6, rawInput: '0x45, 0x35, 0x35' },
    ],
  },
];

export const INITIAL_LOGS: WorkoutLog[] = [
  ...ROUTINE_3_LOGS.map(log => createSeedLog(log)),
  ...ROUTINE_2_HISTORY.map(item =>
    createLogFromDayInputs(item.id, 'routine2', item.dayId, item.date, [...item.sets], item.cardio || null)
  ),
];
