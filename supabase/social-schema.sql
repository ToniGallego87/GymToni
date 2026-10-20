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
-- los de quien TE SIGUE: en tu lista de Seguidores un perfil privado sale con
-- su foto y su nombre en vez de como "Perfil privado". Sus rutinas siguen
-- ocultas (RLS de routines).
--
-- Solo "te sigue", nunca "le sigues": seguir es unilateral (no hay solicitud
-- que aceptar) y los ids de cualquiera salen de likes, guardados y comentarios,
-- así que "le sigues" dejaba a cualquiera abrir un perfil privado con solo
-- seguirlo. Que él te siga sí es decisión suya.
drop policy if exists "read public profiles" on public.profiles;
create policy "read public profiles" on public.profiles
  for select using (
    is_public = true
    or id = auth.uid()
    or exists (
      select 1 from public.follows f
      where f.follower_id = profiles.id and f.following_id = auth.uid()
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
--
-- Solo las filas del DUEÑO de la rutina. "own days"/"own exercises"
-- (schema.sql) dejan a cualquiera insertar un día SUYO con el `routines_id` de
-- una rutina ajena (no hay FK: el sync sube en orden arbitrario), y sin esta
-- condición ese día salía dentro de la rutina pública de otro para todo el que
-- la abriera, y viajaba a las copias enlazadas en cada sync.
--
-- Y solo filas vivas: lo borrado de una rutina pública (un día que quitaste)
-- no es asunto de nadie más. Tú sigues viendo tus tombstones (el sync los
-- necesita para propagar los borrados entre tus móviles).
drop policy if exists "read public days" on public.workout_days;
create policy "read public days" on public.workout_days
  for select using (
    user_id = auth.uid() or (
      workout_days.deleted = false and exists (
        select 1 from public.routines r
        where r.id = workout_days.routines_id
          and r.user_id = workout_days.user_id
          and r.is_public = true and r.deleted = false
      )
    )
  );

drop policy if exists "read public exercises" on public.exercises;
create policy "read public exercises" on public.exercises
  for select using (
    user_id = auth.uid() or (
      exercises.deleted = false and exists (
        select 1 from public.workout_days d
        join public.routines r on r.id = d.routines_id
        where d.id = exercises.workout_days_id
          and d.user_id = exercises.user_id
          and d.deleted = false
          and r.user_id = d.user_id
          and r.is_public = true and r.deleted = false
      )
    )
  );

-- Las dos de arriba (y el tope de "Blindaje", al final) buscan días por
-- rutina y ejercicios por día.
create index if not exists idx_days_routine
  on public.workout_days(routines_id);
create index if not exists idx_exercises_day
  on public.exercises(workout_days_id);

-- Follows: cada quien gestiona SOLO sus propias aristas (follower_id = yo);
-- puede leer las que le implican (a quién sigo / quién me sigue).
drop policy if exists "manage own follows" on public.follows;
create policy "manage own follows" on public.follows
  for all using (follower_id = auth.uid()) with check (follower_id = auth.uid());

drop policy if exists "read involving follows" on public.follows;
create policy "read involving follows" on public.follows
  for select using (follower_id = auth.uid() or following_id = auth.uid());

-- Likes: cada quien gestiona SOLO los suyos, y solo se da like a una rutina
-- pública (antes valía cualquier id). Quitarlo sí vale siempre, aunque la
-- rutina se haya despublicado. La de UPDATE existe porque el cliente da like
-- con upsert: repetir uno ya dado pasa por ON CONFLICT DO UPDATE. Lectura de
-- los likes de rutinas públicas (para contar) o de los propios.
drop policy if exists "manage own likes" on public.routine_likes;
drop policy if exists "insert own likes" on public.routine_likes;
create policy "insert own likes" on public.routine_likes
  for insert with check (
    user_id = auth.uid() and routine_id in (
      select id from public.routines where is_public = true and deleted = false
    )
  );

-- El `with check` repite la condición de pública: sin ella, un PATCH movía un
-- like ya dado a cualquier rutina (privada o borrada).
drop policy if exists "update own likes" on public.routine_likes;
create policy "update own likes" on public.routine_likes
  for update using (user_id = auth.uid())
  with check (
    user_id = auth.uid() and routine_id in (
      select id from public.routines where is_public = true and deleted = false
    )
  );

drop policy if exists "delete own likes" on public.routine_likes;
create policy "delete own likes" on public.routine_likes
  for delete using (user_id = auth.uid());

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
-- `limit_count` se acota a 1–100: lo manda el cliente y sin tope cualquiera
-- podía pedir el tablón entero de una vez.
create or replace function public.popular_routines(limit_count integer default 50)
returns table (
  id           text,
  name         text,
  description  text,
  owner_id     uuid,
  author_name  text,
  likes        bigint,
  liked_by_me  boolean
) language sql stable security invoker set search_path = public as $$
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
  limit least(greatest(coalesce(limit_count, 50), 1), 100);
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
--     abre. Aquí solo viaja "entrené el día X de la rutina Y", sin series, y
--     los récords personales ("Press banca · 85 kg", kind 'record'): la marca
--     de un ejercicio, no la sesión.
--   · Visibilidad: la MISMA regla que el perfil (público, propio, o te sigue;
--     nunca "le sigues", ver "read public profiles"), y además
--     `profiles.share_activity`, que permite apagar solo la actividad sin volver
--     el perfil entero privado.
alter table public.profiles
  add column if not exists share_activity boolean not null default true;

create table if not exists public.activity (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  kind         text not null check (kind in ('badge', 'challenge', 'day', 'record')),
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

-- Récords personales como hito (kind 'record'). Las tablas creadas antes de
-- ellos tienen el CHECK sin 'record': se rehace (idempotente).
alter table public.activity drop constraint if exists activity_kind_check;
alter table public.activity add constraint activity_kind_check
  check (kind in ('badge', 'challenge', 'day', 'record'));

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
            where f.follower_id = p.id and f.following_id = auth.uid()
          )
        )
    )
  );

-- ─────────────────────────── routine_saves ───────────────────────────
-- Quién se ha llevado cada rutina pública a las suyas (enlazada o copiada): una
-- fila por (rutina, usuario). Alimenta el número junto al marcador de "añadir"
-- en el tablón, el perfil del autor y la ficha. Recuento ACUMULADO: quitarla
-- de tus rutinas no borra la fila (ver lib/cloud/social.ts, `getSaveCounts`).
create table if not exists public.routine_saves (
  routine_id text not null references public.routines(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at bigint not null default 0,
  primary key (routine_id, user_id)
);
create index if not exists idx_saves_routine on public.routine_saves(routine_id);

alter table public.routine_saves enable row level security;

-- Solo se apunta uno mismo, y solo en rutinas públicas de OTRA persona.
drop policy if exists "insert own saves" on public.routine_saves;
create policy "insert own saves" on public.routine_saves
  for insert with check (
    user_id = auth.uid() and routine_id in (
      select id from public.routines
      where is_public = true and deleted = false and user_id <> auth.uid()
    )
  );

-- Lectura de las de rutinas públicas (para contar) o de las propias.
drop policy if exists "read public saves" on public.routine_saves;
create policy "read public saves" on public.routine_saves
  for select using (
    user_id = auth.uid() or routine_id in (
      select id from public.routines where is_public = true and deleted = false
    )
  );

-- ─────────────────────────── Blindaje (2026-10-20) ───────────────────────────
-- Topes en el SERVIDOR para lo que ven los demás. La app ya limita lo que se
-- escribe, pero la API está abierta a cualquiera con la anon key y una cuenta:
-- sin esto, un nombre de 10 MB en una rutina subida al tablón lo descargaba
-- todo el que abriera Comunidad, y un avatar podía ser cualquier URL.
--
-- Todos los CHECK van NOT VALID: no revisan ni tocan las filas que ya hay, solo
-- las escrituras nuevas. OJO: una fila vieja que no cumpla ya no se podrá
-- actualizar hasta corregirla. Antes de ejecutar, comprobar que no hay ninguna
-- (debe dar todo 0):
--
--   select
--     (select count(*) from profiles where char_length(display_name) > 60
--        or char_length(bio) > 300
--        or (avatar_url is not null and avatar_url not like
--          'https://ccckuubzyixlbbjmrjak.supabase.co/storage/v1/object/public/avatars/'
--          || id::text || '/%')) as profiles,
--     (select count(*) from routines where char_length(name) > 120
--        or char_length(description) > 1000) as routines,
--     (select count(*) from workout_days where char_length(name) > 120
--        or char_length(emoji) > 64 or char_length(description) > 1000) as days,
--     (select count(*) from exercises where char_length(name) > 200
--        or char_length(target_reps) > 40 or char_length(catalog_id) > 40) as exercises;

-- 1. Longitudes. Muy por encima de los de la interfaz (nombre 40, bio 160,
--    rutina 40/80, día 30–40, ejercicio 80, reporte 300): solo frenan a quien
--    escribe directamente contra la API, nunca a la app.
alter table public.profiles drop constraint if exists profiles_text_len;
alter table public.profiles add constraint profiles_text_len check (
  char_length(display_name) <= 60 and char_length(bio) <= 300
) not valid;

alter table public.routines drop constraint if exists routines_text_len;
alter table public.routines add constraint routines_text_len check (
  char_length(id) <= 100 and char_length(name) <= 120
  and char_length(description) <= 1000
) not valid;

alter table public.workout_days drop constraint if exists workout_days_text_len;
alter table public.workout_days add constraint workout_days_text_len check (
  char_length(id) <= 100 and char_length(routines_id) <= 100
  and char_length(name) <= 120 and char_length(emoji) <= 64
  and char_length(description) <= 1000
) not valid;

alter table public.exercises drop constraint if exists exercises_text_len;
alter table public.exercises add constraint exercises_text_len check (
  char_length(id) <= 100 and char_length(workout_days_id) <= 100
  and char_length(name) <= 200 and char_length(target_reps) <= 40
  and char_length(catalog_id) <= 40
) not valid;

alter table public.activity drop constraint if exists activity_text_len;
alter table public.activity add constraint activity_text_len check (
  char_length(ref) <= 200 and char_length(title) <= 300
  and char_length(icon) <= 64 and char_length(routine_id) <= 100
  and char_length(routine_name) <= 200
) not valid;

alter table public.reports drop constraint if exists reports_text_len;
alter table public.reports add constraint reports_text_len check (
  char_length(target_id) <= 100 and char_length(reason) <= 500
) not valid;

-- 2. Avatar: solo la foto subida a TU carpeta del bucket `avatars`
--    (lib/cloud/social.ts → uploadAvatar). Antes valía cualquier URL (una de
--    rastreo veía la IP de quien miraba el perfil; una imagen enorme colgaba
--    su app) o un base64 entero dentro del perfil. Regex y no `like`: un
--    `like '.../{uid}/%'` aceptaba `{uid}/../{otro}/...` y el cliente HTTP
--    normaliza el `..`. Admite el nombre aleatorio de ahora y el
--    `avatar.jpg?v=…` de las versiones viejas. Si el proyecto cambia de URL,
--    cambiarla aquí también.
alter table public.profiles drop constraint if exists profiles_avatar_url_own;
alter table public.profiles add constraint profiles_avatar_url_own check (
  avatar_url is null or (
    char_length(avatar_url) <= 300
    and avatar_url ~ (
      '^https://ccckuubzyixlbbjmrjak\.supabase\.co/storage/v1/object/public/avatars/'
      || id::text || '/[A-Za-z0-9_-]+\.jpg(\?v=[0-9]+)?$'
    )
  )
) not valid;

-- 3. Volumen de una rutina pública: lo que el tablón y las copias enlazadas
--    descargan enteras. Topes holgados (una rutina tiene 1–7 días; editar
--    puede tener un momento los viejos y los nuevos a la vez antes de que
--    lleguen los borrados) para que el sync de nadie tropiece con ellos.
create or replace function public.limit_days_per_routine()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.deleted = false and new.routines_id is not null and (
    select count(*) from public.workout_days
    where routines_id = new.routines_id and user_id = new.user_id
      and deleted = false and id <> new.id
  ) >= 30 then
    raise exception 'Demasiados días en una rutina (máximo 30)'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
drop trigger if exists limit_days_per_routine on public.workout_days;
create trigger limit_days_per_routine
  before insert or update of routines_id, deleted on public.workout_days
  for each row execute function public.limit_days_per_routine();

create or replace function public.limit_exercises_per_day()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.deleted = false and new.workout_days_id is not null and (
    select count(*) from public.exercises
    where workout_days_id = new.workout_days_id and user_id = new.user_id
      and deleted = false and id <> new.id
  ) >= 100 then
    raise exception 'Demasiados ejercicios en un día (máximo 100)'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
drop trigger if exists limit_exercises_per_day on public.exercises;
create trigger limit_exercises_per_day
  before insert or update of workout_days_id, deleted on public.exercises
  for each row execute function public.limit_exercises_per_day();

-- Rutinas publicadas por persona: el tablón no es un vertedero.
create or replace function public.limit_public_routines()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.is_public = true and new.deleted = false and (
    select count(*) from public.routines
    where user_id = new.user_id and is_public = true and deleted = false
      and id <> new.id
  ) >= 50 then
    -- El `hint` es lo que reconoce la app (setRoutinePublic) para enseñar un
    -- aviso traducido en vez de este mensaje.
    raise exception 'Demasiadas rutinas públicas (máximo 50)'
      using errcode = 'check_violation', hint = 'public_routines_limit';
  end if;
  return new;
end;
$$;
drop trigger if exists limit_public_routines on public.routines;
create trigger limit_public_routines
  before insert or update of is_public, deleted on public.routines
  for each row execute function public.limit_public_routines();

-- 4. Reportes: como mucho 30 al día por persona. `created_at` lo pone el
--    cliente (no sirve para contar), así que se añade la hora del servidor.
alter table public.reports
  add column if not exists inserted_at timestamptz not null default now();
create index if not exists idx_reports_reporter
  on public.reports(reporter_id, inserted_at);

create or replace function public.limit_reports_per_day()
returns trigger language plpgsql set search_path = public as $$
begin
  -- La hora la pone SIEMPRE el servidor: si no, bastaba con mandarla antigua.
  new.inserted_at := now();
  if (
    select count(*) from public.reports
    where reporter_id = new.reporter_id
      and inserted_at > now() - interval '1 day'
  ) >= 30 then
    raise exception 'Demasiados reportes en un día (máximo 30)'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
drop trigger if exists limit_reports_per_day on public.reports;
create trigger limit_reports_per_day
  before insert on public.reports
  for each row execute function public.limit_reports_per_day();
