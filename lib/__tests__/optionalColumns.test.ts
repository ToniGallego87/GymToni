import { upsertTolerant } from '../cloud/optionalColumns';

type Row = Record<string, unknown>;

// Nube falsa: rechaza con PGRST204 cualquier fila que traiga una columna que
// "no existe" en la tabla. Apunta lo que recibe cada intento.
function fakeCloud(missing: string[]) {
  const calls: Row[][] = [];
  const upsert = async (rows: Row[]) => {
    calls.push(rows);
    const bad = missing.find((column) => rows.some((row) => column in row));
    return {
      error: bad
        ? {
            code: 'PGRST204',
            message: `Could not find the '${bad}' column of 'exercise_logs' in the schema cache`,
          }
        : null,
    };
  };
  return { calls, upsert };
}

describe('upsertTolerant', () => {
  it('si la nube no tiene la columna nueva, reintenta sin ella', async () => {
    const cloud = fakeCloud(['catalog_id']);
    const error = await upsertTolerant(
      'exercise_logs',
      [{ id: 'a', exercise_name: 'Banca', catalog_id: '0025' }],
      cloud.upsert
    );
    expect(error).toBeNull();
    expect(cloud.calls).toHaveLength(2);
    expect(cloud.calls[1]).toEqual([{ id: 'a', exercise_name: 'Banca' }]);
  });

  it('una vez sabido que falta, ya no la manda en los siguientes lotes', async () => {
    const cloud = fakeCloud(['catalog_id']);
    await upsertTolerant(
      'exercise_logs',
      [{ id: 'b', catalog_id: '0025' }],
      cloud.upsert
    );
    expect(cloud.calls).toEqual([[{ id: 'b' }]]);
  });

  it('con la columna en la nube la sube tal cual', async () => {
    const cloud = fakeCloud([]);
    const rows = [{ id: 'c', catalog_id: '0025' }];
    // Otra tabla: el aprendizaje de la prueba anterior es de exercise_logs.
    expect(await upsertTolerant('exercises', rows, cloud.upsert)).toBeNull();
    expect(cloud.calls).toEqual([rows]);
  });

  it('no esconde otros errores ni columnas que no son opcionales', async () => {
    const cloud = fakeCloud(['exercise_name']);
    const error = await upsertTolerant(
      'exercise_logs',
      [{ id: 'd', exercise_name: 'Banca' }],
      cloud.upsert
    );
    expect(error?.code).toBe('PGRST204');
    expect(cloud.calls).toHaveLength(1);
  });
});
