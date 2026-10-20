import { supabase } from '../supabase';
import {
  ActivityCounts,
  ActivityItem,
  activityKey,
  sortActivity,
} from '../activity';
import {
  getStoredPublishedActivity,
  setStoredPublishedActivity,
} from '../appSettings';

// Actividad en la nube: los hitos que el perfil de una persona enseña
// (insignias, retos, días entrenados y récords). Requiere haber ejecutado la sección
// `activity` de supabase/social-schema.sql.
//
// Quién ve qué lo decide la RLS, no esta capa: la misma regla que el perfil
// (público, propio o con relación de seguimiento) más `profiles.share_activity`.
// El historial de entrenos sigue privado; aquí solo viaja "entrené el día X de
// la rutina Y", sin series ni pesos.

/** Cuántos hitos se traen de una vez (la lista pagina con "Cargar más"). */
export const ACTIVITY_PAGE = 20;

interface ActivityRow {
  kind: string;
  ref: string;
  title: string;
  icon: string | null;
  routine_id: string | null;
  routine_name: string | null;
  happened_on: string;
}

const rowToItem = (row: ActivityRow): ActivityItem => ({
  kind: row.kind as ActivityItem['kind'],
  ref: row.ref,
  title: row.title,
  icon: row.icon ?? undefined,
  routineId: row.routine_id ?? undefined,
  routineName: row.routine_name ?? undefined,
  happenedOn: row.happened_on,
});

/**
 * Los hitos de alguien, de más reciente a más antiguo. Pide uno más de los que
 * caben para saber si hay más sin una segunda consulta (`hasMore`).
 */
export async function getActivity(
  userId: string,
  { limit = ACTIVITY_PAGE, offset = 0 } = {}
): Promise<{ items: ActivityItem[]; hasMore: boolean }> {
  const { data, error } = await supabase
    .from('activity')
    .select('kind, ref, title, icon, routine_id, routine_name, happened_on')
    .eq('user_id', userId)
    .order('happened_on', { ascending: false })
    .range(offset, offset + limit);
  if (error) throw new Error(`activity: ${error.message}`);
  const rows = (data ?? []) as ActivityRow[];
  return {
    items: sortActivity(rows.slice(0, limit).map(rowToItem)),
    hasMore: rows.length > limit,
  };
}

/**
 * Cuántos hitos de cada tipo tiene alguien EN TOTAL, que es lo que rotula la
 * cabecera de la Actividad. Se cuenta en el servidor (`head: true`: no baja ni
 * una fila) porque contar lo que hay cargado daría el tamaño de la página —20—
 * y cambiaría a cada "Cargar más".
 */
export async function getActivityCounts(
  userId: string
): Promise<ActivityCounts> {
  const countOf = async (kind: ActivityItem['kind']): Promise<number> => {
    const { count, error } = await supabase
      .from('activity')
      .select('ref', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('kind', kind);
    if (error) throw new Error(`activity: ${error.message}`);
    return count ?? 0;
  };
  const [badges, challenges, days, records] = await Promise.all([
    countOf('badge'),
    countOf('challenge'),
    countOf('day'),
    countOf('record'),
  ]);
  return {
    badges,
    challenges,
    days,
    records,
    total: badges + challenges + days + records,
  };
}

// Fila de la tabla para un hito. La marca del récord va dentro del título: la
// tabla no tiene columna para ella.
const itemToRow = (userId: string, item: ActivityItem, now: number) => ({
  user_id: userId,
  kind: item.kind,
  ref: item.ref,
  title: item.detail ? `${item.title} · ${item.detail}` : item.title,
  icon: item.icon ?? null,
  routine_id: item.routineId ?? null,
  routine_name: item.routineName ?? null,
  happened_on: item.happenedOn,
  created_at: now,
});

/**
 * Sube los hitos que aún no estén publicados. Idempotente por partida doble: el
 * `unique (user_id, kind, ref)` de la tabla descarta los repetidos y, para no
 * gastar red en cada arranque, se recuerda en local lo ya enviado.
 *
 * `limit` acota la PRIMERA publicación: quien llega con años de historial no
 * sube cientos de filas de golpe, sino los hitos más recientes (los que la
 * lista enseña), y el resto se queda sin publicar a propósito.
 */
export async function publishActivity(
  userId: string,
  items: ActivityItem[],
  { limit = 120 }: { limit?: number } = {}
): Promise<number> {
  const published = new Set(getStoredPublishedActivity());
  const unpublished = items.filter(
    (item) => !published.has(activityKey(item))
  );
  // El tope va por separado para récords y resto: unos récords que la base
  // rechaza no pueden ocupar el cupo y dejar sin subir los demás hitos.
  const base = unpublished
    .filter((item) => item.kind !== 'record')
    .slice(0, limit);
  const records = unpublished
    .filter((item) => item.kind === 'record')
    .slice(0, limit);
  if (base.length === 0 && records.length === 0) return 0;

  const now = Date.now();
  const upsert = (batch: ActivityItem[]) =>
    supabase
      .from('activity')
      .upsert(
        batch.map((item) => itemToRow(userId, item, now)),
        { onConflict: 'user_id,kind,ref', ignoreDuplicates: true }
      );
  const markPublished = (batch: ActivityItem[]) => {
    batch.forEach((item) => published.add(activityKey(item)));
    setStoredPublishedActivity([...published]);
  };

  if (base.length > 0) {
    const { error } = await upsert(base);
    if (error) throw new Error(`activity: ${error.message}`);
    markPublished(base);
  }

  // Los récords van aparte: el CHECK de `kind` de la tabla no los admitía
  // hasta la migración de supabase/social-schema.sql. Si la base aún no la
  // tiene, se rechazan solos sin arrastrar al resto y se reintentan después.
  if (records.length > 0) {
    const { error } = await upsert(records);
    if (!error) markPublished(records);
  }

  return base.length + records.length;
}

/**
 * Retira toda la actividad publicada. Es lo que hace apagar el interruptor:
 * dejar de compartir borra lo subido, no lo esconde (y se olvida el marcador
 * local, para que al volver a encenderlo se publique de nuevo).
 */
export async function deleteActivity(userId: string): Promise<void> {
  const { error } = await supabase
    .from('activity')
    .delete()
    .eq('user_id', userId);
  if (error) throw new Error(`activity: ${error.message}`);
  setStoredPublishedActivity([]);
}
