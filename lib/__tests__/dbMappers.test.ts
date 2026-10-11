import {
  SETTING_ACTIVE_ROUTINE_ID,
  SETTING_INITIALIZED,
  appDataToRows,
  rowsToAppData,
} from '../db/mappers';
import { WorkoutAppData } from '../../types';

let idCounter = 0;
const stubId = () => `stub-${++idCounter}`;

function buildAppData(): WorkoutAppData {
  return {
    activeRoutineId: 'r1',
    routines: [
      {
        id: 'r1',
        name: 'Rutina 1',
        description: 'desc',
        isActive: true,
        createdAt: 100,
        days: [
          {
            id: 'd1',
            dayNumber: 1,
            name: 'Día 1 - Pecho',
            emoji: '💪',
            exercises: [
              { id: 'e2', name: 'Aperturas', order: 2 },
              {
                id: 'e1',
                name: 'Press banca',
                order: 1,
                targetSets: 4,
                targetReps: '8-12',
              },
            ],
          },
          {
            id: 'd2',
            dayNumber: 2,
            name: 'Día 2 - Espalda',
            emoji: '🏋️',
            description: 'opcional',
            exercises: [],
          },
        ],
      },
    ],
    logs: [
      {
        id: 'l1',
        routineId: 'r1',
        dayId: 'd1',
        date: '2026-06-10',
        createdAt: 200,
        updatedAt: 300,
        exercises: [
          {
            id: 'el1',
            exerciseId: 'e1',
            exerciseName: 'Press banca',
            order: 1,
            rawInput: '60x8 60x8',
            parsedSets: [
              { weight: 60, reps: 8 },
              { weight: 60, reps: 8 },
            ],
            notes: 'subir peso',
            timestamp: 250,
          },
        ],
        cardio: {
          id: 'c1',
          type: 'cinta',
          rawInput: '20min',
          duration: 20,
        },
      },
    ],
  };
}

beforeEach(() => {
  idCounter = 0;
});

describe('appDataToRows', () => {
  it('marca la BD como inicializada y guarda la rutina activa en settings', () => {
    const rows = appDataToRows(buildAppData(), stubId);

    expect(rows.settings).toContainEqual({
      key: SETTING_INITIALIZED,
      value: '1',
    });
    expect(rows.settings).toContainEqual({
      key: SETTING_ACTIVE_ROUTINE_ID,
      value: 'r1',
    });
  });

  it('marca inicializada incluso sin datos (vaciar no resucita seeds)', () => {
    const rows = appDataToRows({ routines: [], logs: [] }, stubId);

    expect(rows.settings).toEqual([{ key: SETTING_INITIALIZED, value: '1' }]);
    expect(rows.routines).toEqual([]);
  });

  it('aplana plan e historial en filas con FKs correctas', () => {
    const rows = appDataToRows(buildAppData(), stubId);

    expect(rows.routines).toHaveLength(1);
    expect(rows.workoutDays.map((d) => d.routines_id)).toEqual(['r1', 'r1']);
    expect(rows.exercises.map((e) => e.workout_days_id)).toEqual(['d1', 'd1']);
    expect(rows.workoutLogs[0]).toMatchObject({
      routines_id: 'r1',
      workout_days_id: 'd1',
    });
    expect(rows.exerciseLogs[0]).toMatchObject({
      workout_logs_id: 'l1',
      exercises_id: 'e1',
      created_at: 250,
    });
    expect(rows.logSets.map((s) => [s.set_order, s.weight, s.reps])).toEqual([
      [1, 60, 8],
      [2, 60, 8],
    ]);
    expect(rows.cardioLogs[0]).toMatchObject({
      id: 'c1',
      workout_logs_id: 'l1',
      duration: 20,
    });
  });

  it('anula referencias colgando a rutinas/días/ejercicios borrados', () => {
    const data = buildAppData();
    data.logs[0].routineId = 'borrada';
    data.logs[0].dayId = 'borrado';
    data.logs[0].exercises[0].exerciseId = 'borrado';

    const rows = appDataToRows(data, stubId);

    expect(rows.workoutLogs[0].routines_id).toBeNull();
    expect(rows.workoutLogs[0].workout_days_id).toBeNull();
    expect(rows.exerciseLogs[0].exercises_id).toBeNull();
    expect(rows.exerciseLogs[0].exercise_name).toBe('Press banca');
  });

  it('convierte opcionales ausentes en NULL', () => {
    const data = buildAppData();
    delete data.logs[0].exercises[0].notes;
    delete data.logs[0].cardio;

    const rows = appDataToRows(data, stubId);

    // Columna heredada (v7): siempre null, el descanso ya no es de la rutina.
    expect(rows.routines[0].timer_duration).toBeNull();
    expect(rows.exerciseLogs[0].notes).toBeNull();
    expect(rows.cardioLogs).toEqual([]);
  });
});

describe('rowsToAppData', () => {
  it('reconstruye el AppData completo (ida y vuelta)', () => {
    const original = buildAppData();
    const restored = rowsToAppData(appDataToRows(original, stubId));

    expect(restored.activeRoutineId).toBe('r1');
    expect(restored.routines).toHaveLength(1);
    expect(restored.routines[0]).toMatchObject({
      id: 'r1',
      name: 'Rutina 1',
      isActive: true,
    });
    expect(restored.routines[0].days.map((d) => d.id)).toEqual(['d1', 'd2']);
    expect(restored.logs[0]).toMatchObject({
      id: 'l1',
      routineId: 'r1',
      dayId: 'd1',
      date: '2026-06-10',
      createdAt: 200,
      updatedAt: 300,
    });
    expect(restored.logs[0].exercises[0]).toMatchObject({
      exerciseId: 'e1',
      exerciseName: 'Press banca',
      rawInput: '60x8 60x8',
      notes: 'subir peso',
      timestamp: 250,
    });
    expect(restored.logs[0].exercises[0].parsedSets).toEqual([
      { weight: 60, reps: 8 },
      { weight: 60, reps: 8 },
    ]);
    expect(restored.logs[0].cardio).toMatchObject({
      id: 'c1',
      type: 'cinta',
      duration: 20,
    });
  });

  it('ordena días, ejercicios y series por sus campos de orden', () => {
    const restored = rowsToAppData(appDataToRows(buildAppData(), stubId));

    // En el plan, e2 venía antes que e1 pero con order 2 y 1.
    expect(restored.routines[0].days[0].exercises.map((e) => e.id)).toEqual([
      'e1',
      'e2',
    ]);
  });

  it('mapea FKs NULL del historial a string vacío', () => {
    const data = buildAppData();
    data.logs[0].routineId = 'borrada';
    data.logs[0].dayId = 'borrado';

    const restored = rowsToAppData(appDataToRows(data, stubId));

    expect(restored.logs[0].routineId).toBe('');
    expect(restored.logs[0].dayId).toBe('');
  });

  it('marca isActive solo en la rutina activa de settings', () => {
    const data = buildAppData();
    data.routines.push({
      id: 'r2',
      name: 'Rutina 2',
      isActive: false,
      createdAt: 150,
      days: [],
    });

    const restored = rowsToAppData(appDataToRows(data, stubId));

    expect(restored.routines.map((r) => [r.id, r.isActive])).toEqual([
      ['r1', true],
      ['r2', false],
    ]);
  });
});

describe('entradas de cardio (cardio_entries)', () => {
  const withCardio = (rawInput: string): WorkoutAppData => {
    const data = buildAppData();
    data.logs[0].cardio = { id: 'c1', type: 'Cardio', rawInput };
    return data;
  };

  it('una fila por entrada, con id determinista y la disciplina como id fijo', () => {
    const rows = appDataToRows(
      withCardio('Andar en cinta: 20min, 5kmh, 8% | Remo: 10min'),
      stubId
    );
    expect(rows.cardioEntries).toEqual([
      {
        id: 'c1:1',
        cardio_logs_id: 'c1',
        workout_logs_id: rows.workoutLogs[0].id,
        entry_order: 1,
        discipline: 'treadmill-walk',
        label: 'Andar en cinta',
        minutes: 20,
        speed: 5,
        incline: 8,
      },
      {
        id: 'c1:2',
        cardio_logs_id: 'c1',
        workout_logs_id: rows.workoutLogs[0].id,
        entry_order: 2,
        discipline: null,
        label: 'Remo',
        minutes: 10,
        speed: null,
        incline: null,
      },
    ]);
  });

  it('reconoce el rótulo en inglés y lo guarda con el mismo id', () => {
    const rows = appDataToRows(withCardio('Treadmill walk: 30min, 6kmh'), stubId);
    expect(rows.cardioEntries?.[0]).toMatchObject({
      discipline: 'treadmill-walk',
      label: 'Andar en cinta',
    });
  });

  it('ida y vuelta: el log recupera sus entradas', () => {
    const restored = rowsToAppData(
      appDataToRows(withCardio('Bici estática: 25min, 20kmh'), stubId)
    );
    expect(restored.logs[0].cardio?.entries).toEqual([
      {
        discipline: 'stationary-bike',
        label: 'Bici estática',
        minutes: 25,
        speed: 20,
        incline: null,
      },
    ]);
  });

  it('si un móvil viejo cambió solo el texto, manda el texto', () => {
    const rows = appDataToRows(withCardio('Elíptica: 15min'), stubId);
    rows.cardioLogs[0].raw_input = 'Elíptica: 40min';
    const restored = rowsToAppData(rows);
    expect(restored.logs[0].cardio?.entries?.[0].minutes).toBe(40);
  });
});
