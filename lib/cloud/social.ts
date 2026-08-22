import type { WorkoutRoutine } from '../../types';
import { supabase } from '../supabase';
import { duplicateRoutine } from '../routines';
import {
  rowsToAppData,
  DbRows,
  RoutineRow,
  WorkoutDayRow,
  ExerciseRow,
} from '../db/mappers';

// Capa de acceso a la parte SOCIAL de la nube (Fase 4): perfiles públicos,
// seguir usuarios, rutinas públicas + tablón de populares, likes y clonado.
// Requiere haber ejecutado supabase/social-schema.sql. Todo respeta la RLS: cada
// quien escribe lo suyo y lee lo suyo + lo marcado público.

// ─────────────────────────── Perfil ───────────────────────────

export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_public: boolean;
}

// Versión ligera del perfil para listas (búsqueda, seguidos, autor del tablón).
export interface ProfileLite {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
}

// Busca perfiles públicos por nombre (para "Buscar usuarios").
export async function searchProfiles(
  query: string,
  limit = 20
): Promise<ProfileLite[]> {
  const q = query.trim();
  if (!q) return [];
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url')
    .eq('is_public', true)
    .ilike('display_name', `%${q}%`)
    .limit(limit);
  if (error) throw new Error(`profiles: ${error.message}`);
  return (data ?? []) as ProfileLite[];
}

// Perfiles (nombre + avatar) de un conjunto de ids: enriquece las listas de
// rutinas con la foto del autor sin repetir la foto por cada rutina.
export async function getProfilesByIds(
  userIds: string[]
): Promise<Map<string, ProfileLite>> {
  const ids = Array.from(new Set(userIds)).filter(Boolean);
  const map = new Map<string, ProfileLite>();
  if (!ids.length) return map;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url')
    .in('id', ids);
  if (error) throw new Error(`profiles: ${error.message}`);
  for (const r of data ?? []) {
    const p = r as ProfileLite;
    map.set(p.id, p);
  }
  return map;
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url, bio, is_public')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new Error(`profiles: ${error.message}`);
  return (data as Profile | null) ?? null;
}

export async function updateProfile(
  userId: string,
  patch: Partial<Omit<Profile, 'id'>>
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: userId, ...patch, updated_at: Date.now() });
  if (error) throw new Error(`profiles: ${error.message}`);
}

// Decodifica base64 → bytes (Hermes no trae `atob`). Algoritmo estándar de
// base64-arraybuffer; escrituras que sobrepasan el buffer (relleno `=`) son no-op.
function base64ToBytes(base64: string): Uint8Array {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;
  const len = base64.length;
  let bufferLength = len * 0.75;
  if (base64[len - 1] === '=') {
    bufferLength--;
    if (base64[len - 2] === '=') bufferLength--;
  }
  const bytes = new Uint8Array(bufferLength);
  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const e1 = lookup[base64.charCodeAt(i)];
    const e2 = lookup[base64.charCodeAt(i + 1)];
    const e3 = lookup[base64.charCodeAt(i + 2)];
    const e4 = lookup[base64.charCodeAt(i + 3)];
    bytes[p++] = (e1 << 2) | (e2 >> 4);
    bytes[p++] = ((e2 & 15) << 4) | (e3 >> 2);
    bytes[p++] = ((e3 & 3) << 6) | (e4 & 63);
  }
  return bytes;
}

// Sube la foto (jpeg base64) al bucket `avatars` de Storage y devuelve su URL
// pública (con cache-bust). Requiere el bucket creado (supabase/storage-avatars.sql).
// Si falla (bucket sin configurar), el llamante cae a guardar el base64 en el perfil.
export async function uploadAvatar(
  userId: string,
  base64Jpeg: string
): Promise<string> {
  const path = `${userId}/avatar.jpg`;
  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, base64ToBytes(base64Jpeg), {
      contentType: 'image/jpeg',
      upsert: true,
    });
  if (error) throw new Error(`avatars: ${error.message}`);
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}

// ─────────────────────────── Seguir ───────────────────────────

export async function followUser(
  followerId: string,
  targetId: string
): Promise<void> {
  const { error } = await supabase.from('follows').upsert({
    follower_id: followerId,
    following_id: targetId,
    created_at: Date.now(),
  });
  if (error) throw new Error(`follows: ${error.message}`);
}

export async function unfollowUser(
  followerId: string,
  targetId: string
): Promise<void> {
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('following_id', targetId);
  if (error) throw new Error(`follows: ${error.message}`);
}

// Ids que sigue el usuario. Uso interno (perfiles seguidos y feed lo consumen).
async function getFollowingIds(followerId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', followerId);
  if (error) throw new Error(`follows: ${error.message}`);
  return (data ?? []).map((r) => (r as { following_id: string }).following_id);
}

// Perfiles a los que sigue el usuario (para la lista "A quién sigo").
export async function getFollowingProfiles(
  followerId: string
): Promise<ProfileLite[]> {
  const ids = await getFollowingIds(followerId);
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url')
    .in('id', ids);
  if (error) throw new Error(`profiles: ${error.message}`);
  return (data ?? []) as ProfileLite[];
}

// ¿followerId sigue a targetId? (para el botón Seguir/Siguiendo de un perfil).
export async function isFollowing(
  followerId: string,
  targetId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', followerId)
    .eq('following_id', targetId)
    .maybeSingle();
  if (error) throw new Error(`follows: ${error.message}`);
  return !!data;
}

// Cuántos seguidores tiene un usuario (para su perfil público).
export async function getFollowerCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('follows')
    .select('*', { count: 'exact', head: true })
    .eq('following_id', userId);
  if (error) throw new Error(`follows: ${error.message}`);
  return count ?? 0;
}

// A cuántos sigue el usuario (contador de "Siguiendo" en su propio perfil).
export async function getFollowingCount(followerId: string): Promise<number> {
  const { count, error } = await supabase
    .from('follows')
    .select('*', { count: 'exact', head: true })
    .eq('follower_id', followerId);
  if (error) throw new Error(`follows: ${error.message}`);
  return count ?? 0;
}

// Perfiles que TE siguen (lista "Seguidores"). Solo devuelve los de perfil
// público (la RLS oculta los privados), así que puede ser menor que el contador.
export async function getFollowerProfiles(
  userId: string
): Promise<ProfileLite[]> {
  const { data, error } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('following_id', userId);
  if (error) throw new Error(`follows: ${error.message}`);
  const ids = (data ?? []).map(
    (r) => (r as { follower_id: string }).follower_id
  );
  if (!ids.length) return [];
  const { data: profs, error: e2 } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url')
    .in('id', ids);
  if (e2) throw new Error(`profiles: ${e2.message}`);
  return (profs ?? []) as ProfileLite[];
}

// ─────────────────────── Rutinas públicas ───────────────────────

// Marca/desmarca una rutina como pública. is_public es un atributo SOLO de la
// nube (no vive en el SQLite local); el sync no lo pisa (upsert parcial).
export async function setRoutinePublic(
  routineId: string,
  isPublic: boolean
): Promise<void> {
  const { error } = await supabase
    .from('routines')
    .update({ is_public: isPublic, updated_at: Date.now() })
    .eq('id', routineId);
  if (error) throw new Error(`routines: ${error.message}`);
}

export interface PublicRoutineSummary {
  id: string;
  name: string;
  description: string | null;
}

// Rutinas públicas de un usuario (para su perfil). RLS deja leerlas a cualquiera.
export async function getUserPublicRoutines(
  userId: string
): Promise<PublicRoutineSummary[]> {
  const { data, error } = await supabase
    .from('routines')
    .select('id, name, description')
    .eq('user_id', userId)
    .eq('is_public', true)
    .eq('deleted', false)
    .order('updated_at', { ascending: false });
  if (error) throw new Error(`routines: ${error.message}`);
  return (data ?? []) as PublicRoutineSummary[];
}

// Qué rutinas propias están publicadas (para el estado del interruptor en la UI).
export async function getPublicRoutineIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('routines')
    .select('id')
    .eq('user_id', userId)
    .eq('is_public', true)
    .eq('deleted', false);
  if (error) throw new Error(`routines: ${error.message}`);
  return (data ?? []).map((r) => (r as { id: string }).id);
}

// ─────────────────────── Tablón de populares ───────────────────────

export interface PopularRoutine {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  author_name: string | null;
  likes: number;
  liked_by_me: boolean;
}

export async function getPopularRoutines(
  limit = 50
): Promise<PopularRoutine[]> {
  const { data, error } = await supabase.rpc('popular_routines', {
    limit_count: limit,
  });
  if (error) throw new Error(`popular_routines: ${error.message}`);
  // likes llega como bigint → string; se normaliza a número.
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    name: r.name as string,
    description: (r.description as string | null) ?? null,
    owner_id: r.owner_id as string,
    author_name: (r.author_name as string | null) ?? null,
    likes: Number(r.likes ?? 0),
    liked_by_me: !!r.liked_by_me,
  }));
}

// Feed de "Siguiendo": rutinas públicas de la gente que sigues, recientes antes.
export interface FeedRoutine {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
}

export async function getFollowingFeed(
  followerId: string,
  limit = 50
): Promise<FeedRoutine[]> {
  const ids = await getFollowingIds(followerId);
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from('routines')
    .select('id, name, description, user_id')
    .in('user_id', ids)
    .eq('is_public', true)
    .eq('deleted', false)
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`routines: ${error.message}`);
  return (data ?? []).map((r) => {
    const row = r as {
      id: string;
      name: string;
      description: string | null;
      user_id: string;
    };
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? null,
      owner_id: row.user_id,
    };
  });
}

// Likes de un conjunto de rutinas (nº y si el usuario les ha dado): enriquece el
// feed "Siguiendo", que no trae likes de serie. RLS deja leer los likes de
// rutinas públicas (que son las del feed).
export async function getLikeInfo(
  routineIds: string[],
  userId: string | null
): Promise<Map<string, { likes: number; liked: boolean }>> {
  const map = new Map<string, { likes: number; liked: boolean }>();
  for (const id of routineIds) map.set(id, { likes: 0, liked: false });
  if (!routineIds.length) return map;
  const { data, error } = await supabase
    .from('routine_likes')
    .select('routine_id, user_id')
    .in('routine_id', routineIds);
  if (error) throw new Error(`routine_likes: ${error.message}`);
  for (const r of data ?? []) {
    const row = r as { routine_id: string; user_id: string };
    const entry = map.get(row.routine_id);
    if (!entry) continue;
    entry.likes += 1;
    if (userId && row.user_id === userId) entry.liked = true;
  }
  return map;
}

export async function likeRoutine(
  routineId: string,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from('routine_likes')
    .upsert({ routine_id: routineId, user_id: userId, created_at: Date.now() });
  if (error) throw new Error(`routine_likes: ${error.message}`);
}

export async function unlikeRoutine(
  routineId: string,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from('routine_likes')
    .delete()
    .eq('routine_id', routineId)
    .eq('user_id', userId);
  if (error) throw new Error(`routine_likes: ${error.message}`);
}

// ─────────────────────── Clonar una rutina pública ───────────────────────

// Baja una rutina pública (cabecera + días + ejercicios) y la reconstruye como
// WorkoutRoutine del dominio, con sus ids ORIGINALES. El llamante la pasa por
// `duplicateRoutine` (lib/routines.ts) para asignar ids nuevos antes de
// añadirla al espacio del usuario (ADD_ROUTINE), como al duplicar una propia.
// La consume la vista de consulta (PublicRoutineScreen), que muestra el plan
// SIN clonarlo, y cloneablePublicRoutine, que lo duplica antes de adoptarlo.
export async function fetchPublicRoutine(
  routineId: string
): Promise<WorkoutRoutine | null> {
  const coerce = (r: Record<string, unknown>): Record<string, unknown> => ({
    ...r,
    ...(r.created_at != null ? { created_at: Number(r.created_at) } : {}),
  });

  const { data: routineRow, error: rErr } = await supabase
    .from('routines')
    .select('*')
    .eq('id', routineId)
    .eq('is_public', true)
    .eq('deleted', false)
    .maybeSingle();
  if (rErr) throw new Error(`routines: ${rErr.message}`);
  if (!routineRow) return null;

  const { data: days, error: dErr } = await supabase
    .from('workout_days')
    .select('*')
    .eq('routines_id', routineId)
    .eq('deleted', false);
  if (dErr) throw new Error(`workout_days: ${dErr.message}`);

  const dayIds = (days ?? []).map((d) => (d as { id: string }).id);
  let exercises: Record<string, unknown>[] = [];
  if (dayIds.length) {
    const { data: ex, error: eErr } = await supabase
      .from('exercises')
      .select('*')
      .in('workout_days_id', dayIds)
      .eq('deleted', false);
    if (eErr) throw new Error(`exercises: ${eErr.message}`);
    exercises = ex ?? [];
  }

  const rows: DbRows = {
    settings: [],
    routines: [coerce(routineRow) as unknown as RoutineRow],
    workoutDays: (days ?? []) as unknown as WorkoutDayRow[],
    exercises: exercises as unknown as ExerciseRow[],
    workoutLogs: [],
    exerciseLogs: [],
    logSets: [],
    cardioLogs: [],
  };
  return rowsToAppData(rows).routines[0] ?? null;
}

// Baja una rutina pública y la devuelve YA duplicada (ids nuevos), lista para
// añadir al espacio del usuario con ADD_ROUTINE. Helper común del tablón y del
// perfil (evita repetir fetch + duplicate en cada pantalla).
export async function cloneablePublicRoutine(
  routineId: string,
  existingNames: string[]
): Promise<WorkoutRoutine | null> {
  const routine = await fetchPublicRoutine(routineId);
  return routine ? duplicateRoutine(routine, existingNames) : null;
}

// ─────────────────── Volumen de una rutina pública (intensidad) ───────────────────

// Series planificadas de cada rutina pública, en DOS consultas por lote (nunca
// una por rutina): días de esas rutinas y, con sus ids, la suma de `target_sets`
// de sus ejercicios. La RLS de social-schema.sql ya deja leer días y ejercicios
// de una rutina pública, así que no hace falta tocar el backend.
//
// El resultado alimenta el distintivo Suave/Medio/Intenso del tablón
// (`routineIntensity` en lib/routines.ts). Se pide en segundo plano, después de
// pintar la lista: es un adorno, no debe retrasar el tablón.
export async function getRoutineSetTotals(
  routineIds: string[]
): Promise<Map<string, number>> {
  const totals = new Map<string, number>();
  const ids = Array.from(new Set(routineIds)).filter(Boolean);
  if (!ids.length) return totals;

  const { data: days, error: dErr } = await supabase
    .from('workout_days')
    .select('id, routines_id')
    .in('routines_id', ids)
    .eq('deleted', false);
  if (dErr) throw new Error(`workout_days: ${dErr.message}`);

  // día → rutina, para repartir las series de cada ejercicio en su rutina.
  const dayToRoutine = new Map<string, string>();
  for (const row of days ?? []) {
    const d = row as { id: string; routines_id: string };
    dayToRoutine.set(d.id, d.routines_id);
  }
  if (!dayToRoutine.size) return totals;

  const { data: exercises, error: eErr } = await supabase
    .from('exercises')
    .select('workout_days_id, target_sets')
    .in('workout_days_id', Array.from(dayToRoutine.keys()))
    .eq('deleted', false);
  if (eErr) throw new Error(`exercises: ${eErr.message}`);

  for (const row of exercises ?? []) {
    const ex = row as { workout_days_id: string; target_sets: number | null };
    const routineId = dayToRoutine.get(ex.workout_days_id);
    if (!routineId) continue;
    totals.set(routineId, (totals.get(routineId) ?? 0) + (ex.target_sets ?? 0));
  }
  return totals;
}
