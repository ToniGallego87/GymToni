// `sync.ts` arrastra react-native, AsyncStorage, expo-sqlite y Supabase al
// importarse, y jest aquí solo transforma `.ts` (ver jest.config.js). Como lo
// que se prueba es una función PURA, se sustituyen esos módulos por cáscaras:
// así el fichero se puede cargar sin montar media app.
jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn() },
}));
jest.mock('../supabase', () => ({ supabase: {} }));
jest.mock('../db', () => ({}));
jest.mock('../db/mappers', () => ({}));

import { dropPendingLocal } from '../cloud/sync';
import type { PendingLocalIds, RemoteChanges } from '../db';

// Regresión de la pérdida de cardio de 0.8.1.
//
// `dropPendingLocal` descarta de lo que baja el pull lo que este dispositivo
// tiene pendiente de subir. Hasta 0.8.1 filtraba solo los UPSERTS y dejaba pasar
// los tombstones, y ese es el lado que no perdona: un upsert mal aplicado lo
// corrige el push siguiente, pero el borrado es un DELETE real contra el SQLite
// local y no hay de dónde recuperarlo. Al separar cardio y fuerza, el log de
// fuerza subía sin cardio y marcaba borrada su fila; si el log de solo cardio
// que la revivía no llegaba a subir, el pull traía la lápida y el cardio
// desaparecía del dispositivo.

const vacio = (): RemoteChanges => ({
  routines: { upserts: [], deletes: [] },
  workoutDays: { upserts: [], deletes: [] },
  exercises: { upserts: [], deletes: [] },
  workoutLogs: { upserts: [], deletes: [] },
  exerciseLogs: { upserts: [], deletes: [] },
  logSets: { upserts: [], deletes: [] },
  cardioLogs: { upserts: [], deletes: [] },
  settings: null,
});

const pendiente = (logs: string[] = []): PendingLocalIds => ({
  routines: [],
  days: [],
  logs,
  exercises: [],
});

describe('dropPendingLocal: borrados de hijos', () => {
  it('descarta el borrado de un cardio cuyo log tiene cambios sin subir', () => {
    const changes = vacio();
    changes.cardioLogs.deletes = [
      { id: 'c1', workout_logs_id: 'log1' }, // log pendiente → no se aplica
      { id: 'c2', workout_logs_id: 'log2' }, // ajeno → sí se aplica
    ];

    const out = dropPendingLocal(changes, pendiente(['log1']));

    expect(out.cardioLogs.deletes.map((r) => r.id)).toEqual(['c2']);
  });

  it('hace lo mismo con los ejercicios y las series del log pendiente', () => {
    const changes = vacio();
    changes.exerciseLogs.deletes = [
      { id: 'e1', workout_logs_id: 'log1' },
      { id: 'e2', workout_logs_id: 'otro' },
    ];
    changes.exerciseLogs.upserts = [{ id: 'e3', workout_logs_id: 'log1' }];
    changes.logSets.deletes = [{ id: 's1', exercise_logs_id: 'e3' }];

    const out = dropPendingLocal(changes, pendiente(['log1']));

    expect(out.exerciseLogs.deletes.map((r) => r.id)).toEqual(['e2']);
    // La serie cuelga de un ejercicio saltado: se salta también.
    expect(out.logSets.deletes).toHaveLength(0);
  });

  it('no toca nada si no hay cambios locales pendientes', () => {
    const changes = vacio();
    changes.cardioLogs.deletes = [{ id: 'c1', workout_logs_id: 'log1' }];

    const out = dropPendingLocal(changes, pendiente());

    expect(out.cardioLogs.deletes).toHaveLength(1);
  });

  it('filtra el borrado del propio log pendiente', () => {
    const changes = vacio();
    changes.workoutLogs.deletes = [{ id: 'log1' }, { id: 'log2' }];

    const out = dropPendingLocal(changes, pendiente(['log1']));

    expect(out.workoutLogs.deletes.map((r) => r.id)).toEqual(['log2']);
  });
});
