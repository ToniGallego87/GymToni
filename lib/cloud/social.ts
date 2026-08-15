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

// Ids que sigue el usuario (para pintar el estado "siguiendo" en las listas).
export async function getFollowingIds(followerId: string): Promise<string[]> {
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
