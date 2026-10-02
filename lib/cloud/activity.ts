import { supabase } from '../supabase';
import { ActivityItem, activityKey, sortActivity } from '../activity';
import {
  getStoredPublishedActivity,
  setStoredPublishedActivity,
} from '../appSettings';

// Actividad en la nube: los hitos que el perfil de una persona enseña
// (insignias, retos y días entrenados). Requiere haber ejecutado la sección
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

/** Cuántos hitos tiene alguien en total (la cabecera de la sección). */
export async function getActivityCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('activity')
    .select('ref', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (error) throw new Error(`activity: ${error.message}`);
  return count ?? 0;
}

/**
 * Cuántos hitos de cada tipo tiene alguien EN TOTAL, que es lo que rotula la
 * cabecera de la Actividad. Se cuenta en el servidor (`head: true`: no baja ni
 * una fila) porque contar lo que hay cargado daría el tamaño de la página —20—
 * y cambiaría a cada "Cargar más".
 */
export async function getActivityCounts(userId: string): Promise<{
  badges: number;
  challenges: number;
  days: number;
  total: number;
}> {
  const countOf = async (kind: ActivityItem['kind']): Promise<number> => {
    const { count, error } = await supabase
      .from('activity')
      .select('ref', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('kind', kind);
    if (error) throw new Error(`activity: ${error.message}`);
    return count ?? 0;
  };
  const [badges, challenges, days] = await Promise.all([
    countOf('badge'),
    countOf('challenge'),
    countOf('day'),
  ]);
  return { badges, challenges, days, total: badges + challenges + days };
}

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
  const pending = items
    .filter((item) => !published.has(activityKey(item)))
    .slice(0, limit);
  if (pending.length === 0) return 0;

  const now = Date.now();
  const { error } = await supabase.from('activity').upsert(
    pending.map((item) => ({
      user_id: userId,
      kind: item.kind,
      ref: item.ref,
      title: item.title,
      icon: item.icon ?? null,
      routine_id: item.routineId ?? null,
      routine_name: item.routineName ?? null,
      happened_on: item.happenedOn,
      created_at: now,
    })),
    { onConflict: 'user_id,kind,ref', ignoreDuplicates: true }
  );
  if (error) throw new Error(`activity: ${error.message}`);

  setStoredPublishedActivity([
    ...published,
    ...pending.map((item) => activityKey(item)),
  ]);
  return pending.length;
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
