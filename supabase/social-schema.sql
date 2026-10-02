-- GymBro — Schema social de la nube (Supabase / Postgres). Fase 4.
--
-- Additivo e idempotente sobre el schema de la Fase 2 (supabase/schema.sql):
-- se puede ejecutar entero en el SQL Editor de Supabase sin romper lo existente.
--
-- Novedades:
--   · routines.is_public → una rutina puede publicarse al tablón (por defecto NO).
--   · follows            → grafo de seguimiento (follower → following).
--   · routine_likes      → likes/guardados; alimentan el ranking del tablón.
--   · Políticas RLS de LECTURA PÚBLICA para perfiles y rutinas marcados públicos
--     (y su plan: días y ejercicios), sin abrir el historial de entrenos.
--
-- Nota de diseño: el sync (Fase 3) sube las rutinas con upsert PARCIAL (no incluye
-- is_public en el payload), así que marcar/desmarcar pública NO se pisa con el sync.

-- ─────────────────────── rutinas: visibilidad pública ───────────────────────
alter table public.routines
  add column if not exists is_public boolean not null default false;

create index if not exists idx_routines_public
  on public.routines(is_public) where is_public;

-- ─────────────────────────── follows ───────────────────────────
-- Una fila por arista follower→following. Sin duplicados (PK compuesta).
create table if not exists public.follows (
  follower_id  uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at   bigint not null default 0,
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);
create index if not exists idx_follows_following on public.follows(following_id);

-- ─────────────────────────── routine_likes ───────────────────────────
-- Un like por (rutina, usuario). El recuento alimenta el ranking del tablón.
create table if not exists public.routine_likes (
  routine_id text not null references public.routines(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at bigint not null default 0,
  primary key (routine_id, user_id)
);
create index if not exists idx_likes_routine on public.routine_likes(routine_id);

-- ─────────────────────────── RLS ───────────────────────────
alter table public.follows       enable row level security;
alter table public.routine_likes enable row level security;

-- Perfiles: además de "el propio" (schema.sql), permitir LEER los públicos y
-- los de quien tiene relación contigo (te sigue o le sigues): en las listas de
-- Seguidores / A quién sigo un perfil privado sale con su foto y su nombre en
-- vez de como "Perfil privado". Sus rutinas siguen ocultas (RLS de routines).
drop policy if exists "read public profiles" on public.profiles;
create policy "read public profiles" on public.profiles
  for select using (
    is_public = true
    or id = auth.uid()
    or exists (
      select 1 from public.follows f
      where (f.follower_id = profiles.id and f.following_id = auth.uid())
         or (f.following_id = profiles.id and f.follower_id = auth.uid())
    )
  );

-- Rutinas: además de las propias, LEER las públicas no borradas.
drop policy if exists "read public routines" on public.routines;
create policy "read public routines" on public.routines
  for select using (
    (is_public = true and deleted = false) or user_id = auth.uid()
  );

-- Plan de una rutina pública (días y ejercicios): lectura pública si su rutina
-- es pública. Así el tablón puede mostrar y clonar el plan, nunca el historial.
drop policy if exists "read public days" on public.workout_days;
create policy "read public days" on public.workout_days
  for select using (
    user_id = auth.uid() or routines_id in (
      select id from public.routines where is_public = true and deleted = false
    )
  );

drop policy if exists "read public exercises" on public.exercises;
create policy "read public exercises" on public.exercises
  for select using (
    user_id = auth.uid() or workout_days_id in (
      select d.id from public.workout_days d
      join public.routines r on r.id = d.routines_id
      where r.is_public = true and r.deleted = false
    )
  );

-- Follows: cada quien gestiona SOLO sus propias aristas (follower_id = yo);
-- puede leer las que le implican (a quién sigo / quién me sigue).
drop policy if exists "manage own follows" on public.follows;
create policy "manage own follows" on public.follows
  for all using (follower_id = auth.uid()) with check (follower_id = auth.uid());

drop policy if exists "read involving follows" on public.follows;
create policy "read involving follows" on public.follows
  for select using (follower_id = auth.uid() or following_id = auth.uid());

-- Likes: cada quien gestiona SOLO los suyos; lectura de los likes de rutinas
-- públicas (para contar) o de los propios.
drop policy if exists "manage own likes" on public.routine_likes;
create policy "manage own likes" on public.routine_likes
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "read public likes" on public.routine_likes;
create policy "read public likes" on public.routine_likes
  for select using (
    user_id = auth.uid() or routine_id in (
      select id from public.routines where is_public = true and deleted = false
    )
  );

-- ─────────────── Tablón de rutinas populares (RPC) ───────────────
-- Devuelve las rutinas públicas con su nº de likes y el nombre del autor,
-- ordenadas por popularidad. SECURITY INVOKER: respeta la RLS de arriba.
create or replace function public.popular_routines(limit_count integer default 50)
returns table (
  id           text,
  name         text,
  description  text,
  owner_id     uuid,
  author_name  text,
  likes        bigint,
  liked_by_me  boolean
) language sql stable security invoker as $$
  select r.id, r.name, r.description, r.user_id as owner_id,
         p.display_name as author_name,
         count(l.user_id) as likes,
         bool_or(l.user_id = auth.uid()) as liked_by_me
  from public.routines r
  left join public.profiles p on p.id = r.user_id
  left join public.routine_likes l on l.routine_id = r.id
  where r.is_public = true and r.deleted = false
  group by r.id, r.name, r.description, r.user_id, p.display_name
  order by likes desc, r.updated_at desc
  limit limit_count;
$$;

-- ─────────────────────────── routine_comments ───────────────────────────
-- Hilo de comentarios de una rutina pública. Es texto libre escrito por
-- terceros, así que la RLS es la que manda:
--   · LEER   → si la rutina es pública (o el comentario es tuyo).
--   · ESCRIBIR → solo con sesión, solo en tu nombre y solo en rutinas públicas.
--   · BORRAR → el autor del comentario o el DUEÑO de la rutina (moderación
--     mínima del propio hilo, mientras no exista la tabla `reports`).
create table if not exists public.routine_comments (
  id         uuid primary key default gen_random_uuid(),
  routine_id text not null references public.routines(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  body       text not null check (char_length(btrim(body)) between 1 and 500),
  created_at bigint not null default 0
);
create index if not exists idx_comments_routine
  on public.routine_comments(routine_id, created_at);

alter table public.routine_comments enable row level security;

drop policy if exists "read public comments" on public.routine_comments;
create policy "read public comments" on public.routine_comments
  for select using (
    user_id = auth.uid() or routine_id in (
      select id from public.routines where is_public = true and deleted = false
    )
  );

drop policy if exists "insert own comments" on public.routine_comments;
create policy "insert own comments" on public.routine_comments
  for insert with check (
    user_id = auth.uid() and routine_id in (
      select id from public.routines where is_public = true and deleted = false
    )
  );

drop policy if exists "delete own or owned comments" on public.routine_comments;
create policy "delete own or owned comments" on public.routine_comments
  for delete using (
    user_id = auth.uid() or routine_id in (
      select id from public.routines where user_id = auth.uid()
    )
  );

-- ─────────────────────────── reports ───────────────────────────
-- Moderación mínima: cualquiera con sesión puede reportar una rutina pública,
-- un perfil o un comentario. Los partes se revisan desde el panel de Supabase
-- (la service key salta la RLS); la app solo escribe y ve los suyos.
--
-- Además, quien reporta deja de ver ese contenido EN SU DISPOSITIVO
-- (lib/moderation.ts): no hace falta esperar a que alguien revise el parte para
-- quitarse de delante lo que te ha molestado.
create table if not exists public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('routine', 'profile', 'comment')),
  target_id   text not null,
  reason      text,
  created_at  bigint not null default 0
);
create index if not exists idx_reports_target
  on public.reports(target_type, target_id);

alter table public.reports enable row level security;

drop policy if exists "insert own reports" on public.reports;
create policy "insert own reports" on public.reports
  for insert with check (reporter_id = auth.uid());

drop policy if exists "read own reports" on public.reports;
create policy "read own reports" on public.reports
  for select using (reporter_id = auth.uid());

-- ─────────────────────────── activity (Actividad) ───────────────────────────
-- Trayectoria pública de una persona: los hitos que su perfil enseña (insignias
-- desbloqueadas, retos superados y días entrenados, cada día con la rutina de la
-- que salió, para poder enlazarla si es pública).
--
-- Decisiones:
--   · La escribe el PROPIO cliente cuando detecta un hito nuevo, igual que ya
--     sube `level`/`xp` al perfil (hooks/useAccountLevel.ts). No hay trigger:
--     el cálculo de insignias y retos vive en el dispositivo (lib/badges.ts,
--     lib/challenges.ts) y no se va a duplicar en SQL.
--   · `unique (user_id, kind, ref)` hace la publicación IDEMPOTENTE: subir dos
--     veces el mismo hito no duplica nada (upsert con ignoreDuplicates).
--   · El historial de entrenos (`workout_logs`) sigue siendo privado: esto NO lo
--     abre. Aquí solo viaja "entrené el día X de la rutina Y", sin series, pesos
--     ni nada medible.
--   · Visibilidad: la MISMA regla que el perfil (público, propio, o hay relación
--     de seguimiento), y además `profiles.share_activity`, que permite apagar
--     solo la actividad sin volver el perfil entero privado.
alter table public.profiles
  add column if not exists share_activity boolean not null default true;

create table if not exists public.activity (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  kind         text not null check (kind in ('badge', 'challenge', 'day')),
  -- Identidad del hito dentro de su tipo: id de insignia, `reto@periodo`
  -- (lib/level.ts) o id del log del día. Con `kind` forma la clave única.
  ref          text not null,
  -- Cómo se enseña, ya resuelto por el cliente (que es quien tiene el catálogo
  -- traducido): nombre del hito y su icono de MaterialCommunityIcons.
  title        text not null,
  icon         text,
  -- Solo en los días: de qué rutina salió, para enlazarla si es pública. El
  -- nombre se guarda porque la rutina puede dejar de ser pública o borrarse.
  routine_id   text,
  routine_name text,
  -- Fecha del hito (`YYYY-MM-DD`), que es por la que se ordena: no la de subida.
  happened_on  date not null,
  created_at   bigint not null default 0,
  unique (user_id, kind, ref)
);
create index if not exists idx_activity_user
  on public.activity(user_id, happened_on desc);

alter table public.activity enable row level security;

drop policy if exists "insert own activity" on public.activity;
create policy "insert own activity" on public.activity
  for insert with check (user_id = auth.uid());

-- Apagar el interruptor BORRA lo publicado (no basta con ocultarlo).
drop policy if exists "delete own activity" on public.activity;
create policy "delete own activity" on public.activity
  for delete using (user_id = auth.uid());

drop policy if exists "read visible activity" on public.activity;
create policy "read visible activity" on public.activity
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = activity.user_id
        and p.share_activity = true
        and (
          p.is_public = true
          or exists (
            select 1 from public.follows f
            where (f.follower_id = p.id and f.following_id = auth.uid())
               or (f.following_id = p.id and f.follower_id = auth.uid())
          )
        )
    )
  );
