// Columnas nuevas que la app ya sube pero que la nube puede no tener todavía:
// la migración de Supabase se ejecuta a mano y una versión nueva de la app
// puede llegar antes. Sin esto, subir una columna que la tabla no tiene hace
// fallar el upsert entero y se para la sincronización de todo el que tenga
// cuenta. Con esto, se reintenta sin esa columna: el dato se queda en local
// (la bajada no lo pisa, ver `keepLocal` en lib/db/index.ts) y sube en cuanto la
// columna exista y el registro se vuelva a guardar o se haga una copia.
const OPTIONAL_COLUMNS: Record<string, string[]> = {
  exercise_logs: ['catalog_id'],
  log_sets: ['is_extra'],
};

// Columnas que ya sabemos que faltan en esta sesión: no se vuelve a probar con
// ellas en cada lote.
const knownMissing = new Set<string>();

type Row = Record<string, unknown>;
type UpsertError = { code?: string; message: string } | null;

function withoutColumns(rows: Row[], columns: string[]): Row[] {
  if (!columns.length) return rows;
  return rows.map((row) => {
    const copy = { ...row };
    for (const column of columns) delete copy[column];
    return copy;
  });
}

/**
 * Upsert de un lote que tolera las columnas opcionales que falten en la nube
 * (PostgREST responde PGRST204 "Could not find the 'x' column"). Cualquier otro
 * error se devuelve tal cual.
 */
export async function upsertTolerant(
  table: string,
  rows: Row[],
  upsert: (rows: Row[]) => PromiseLike<{ error: UpsertError }>
): Promise<UpsertError> {
  const optional = OPTIONAL_COLUMNS[table] ?? [];
  const skip = () => optional.filter((c) => knownMissing.has(`${table}.${c}`));

  let { error } = await upsert(withoutColumns(rows, skip()));
  // Una pasada por columna opcional como mucho: cada fallo descubre una.
  for (let i = 0; error && i < optional.length; i++) {
    if (error.code !== 'PGRST204') break;
    const missing = optional.find(
      (c) =>
        !knownMissing.has(`${table}.${c}`) && error!.message.includes(`'${c}'`)
    );
    if (!missing) break;
    knownMissing.add(`${table}.${missing}`);
    ({ error } = await upsert(withoutColumns(rows, skip())));
  }
  return error;
}
