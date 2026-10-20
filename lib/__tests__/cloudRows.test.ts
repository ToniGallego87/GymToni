import {
  CLOUD_TEXT_LIMITS,
  clampText,
  cloudDayRow,
  cloudExerciseRow,
  cloudRoutineRow,
} from '../cloud/cloudRows';
import type { ExerciseRow, RoutineRow, WorkoutDayRow } from '../db/mappers';

const NOW = 1_700_000_000_000;
const USER = 'user-1';

const routineRow = (patch: Partial<RoutineRow> = {}): RoutineRow => ({
  id: 'r1',
  name: 'Torso pierna',
  description: null,
  timer_duration: null,
  created_at: 1,
  linked_owner_id: 'otro',
  source_routine_id: 'pub-1',
  source_author: 'Ana',
  source_owner_id: 'otro',
  ...patch,
});

describe('clampText', () => {
  it('deja igual lo que cabe y los nulos', () => {
    expect(clampText('hola', 10)).toBe('hola');
    expect(clampText(null, 10)).toBeNull();
    expect(clampText(undefined, 10)).toBeUndefined();
  });

  it('recorta lo que se pasa', () => {
    expect(clampText('abcdef', 3)).toBe('abc');
  });

  it('no parte un emoji por la mitad', () => {
    // Con `slice` quedaba medio emoji suelto, que Postgres rechaza.
    const cut = clampText('ab💪cd', 3);
    expect(cut).toBe('ab💪');
    expect(JSON.stringify(cut)).not.toMatch(/\\ud8/);
  });
});

describe('cloudRoutineRow', () => {
  it('quita las columnas que solo existen en el SQLite local', () => {
    // Con ellas la copia completa fallaba entera (columna desconocida).
    const row = cloudRoutineRow(routineRow(), USER, NOW);
    expect(row).not.toHaveProperty('linked_owner_id');
    expect(row).not.toHaveProperty('source_routine_id');
    expect(row).not.toHaveProperty('source_author');
    expect(row).not.toHaveProperty('source_owner_id');
  });

  it('estampa dueño, hora y vivo', () => {
    expect(cloudRoutineRow(routineRow(), USER, NOW)).toMatchObject({
      id: 'r1',
      user_id: USER,
      updated_at: NOW,
      deleted: false,
    });
  });

  it('recorta nombre y descripción a los topes de la nube', () => {
    const row = cloudRoutineRow(
      routineRow({ name: 'x'.repeat(500), description: 'y'.repeat(5000) }),
      USER,
      NOW
    );
    expect((row.name as string).length).toBe(CLOUD_TEXT_LIMITS.routineName);
    expect((row.description as string).length).toBe(
      CLOUD_TEXT_LIMITS.routineDescription
    );
  });
});

describe('cloudDayRow y cloudExerciseRow', () => {
  it('recortan los textos del día', () => {
    const day: WorkoutDayRow = {
      id: 'd1',
      routines_id: 'r1',
      day_number: 1,
      name: 'n'.repeat(300),
      emoji: 'e'.repeat(100),
      description: null,
    };
    const row = cloudDayRow(day, USER, NOW);
    expect((row.name as string).length).toBe(CLOUD_TEXT_LIMITS.dayName);
    expect((row.emoji as string).length).toBe(CLOUD_TEXT_LIMITS.dayEmoji);
    expect(row.description).toBeNull();
    expect(row.user_id).toBe(USER);
  });

  it('recortan los textos del ejercicio sin tocar lo demás', () => {
    const exercise: ExerciseRow = {
      id: 'e1',
      workout_days_id: 'd1',
      name: 'p'.repeat(400),
      exercise_order: 2,
      target_reps: '8'.repeat(60),
      target_sets: 4,
      catalog_id: '0025',
    };
    const row = cloudExerciseRow(exercise, USER, NOW);
    expect((row.name as string).length).toBe(CLOUD_TEXT_LIMITS.exerciseName);
    expect((row.target_reps as string).length).toBe(
      CLOUD_TEXT_LIMITS.targetReps
    );
    expect(row).toMatchObject({
      catalog_id: '0025',
      target_sets: 4,
      exercise_order: 2,
      deleted: false,
    });
  });
});
