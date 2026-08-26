-- GymBro — Schema de la nube (Supabase / Postgres). Fase 2 (backup + cuentas).
--
-- Espejo de las tablas de dominio de la app (lib/db/schema.ts), más:
--   · user_id  → propietario (RLS: cada quien solo ve/escribe lo suyo).
--   · updated_at (epoch ms, bigint) → mismo formato que el local; el sync (Fase 3)
--     lo usa para el pull incremental y el last-write-wins.
--   · deleted (bool) → tombstone (borrado propagable).
--
-- Notas de diseño:
--   · Los id son TEXT (uuid v4 generados en el cliente), igual que en local.
--   · NO se ponen FKs entre tablas espejo: durante el sync las filas llegan en
--     orden arbitrario y una FK estricta rompería el upsert. La integridad la
--     mantiene la app. La única FK real es user_id → auth.users.
--   · Ejecutar este archivo entero en el SQL Editor de Supabase.

-- ─────────────────────────── profiles ───────────────────────────
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url   text,
  bio          text,
  is_public    boolean not null default false,
  updated_at   bigint  not null default 0
);

-- Ajustes por usuario (rutina activa / seleccionada). Una fila por usuario.
create table if not exists public.user_settings (
  user_id             uuid primary key references auth.users(id) on delete cascade,
  active_routine_id   text,
  selected_routine_id text,
  updated_at          bigint not null default 0
);

-- ─────────────────────── tablas de dominio (espejo) ───────────────────────
create table if not exists public.routines (
  id             text primary key,
  user_id        uuid not null references auth.users(id) on delete cascade,
  name           text not null,
  description    text,
  timer_duration integer,
  created_at     bigint not null,
  updated_at     bigint not null default 0,
  deleted        boolean not null default false
);

create table if not exists public.workout_days (
  id          text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  routines_id text,
  day_number  integer not null,
  name        text not null,
  emoji       text not null default '',
  description text,
  updated_at  bigint not null default 0,
  deleted     boolean not null default false
);

create table if not exists public.exercises (
  id              text primary key,
  user_id         uuid not null references auth.users(id) on delete cascade,
  workout_days_id text,
  name            text not null,
  exercise_order  integer not null,
  target_reps     text,
  target_sets     integer,
  catalog_id      text,
  updated_at      bigint not null default 0,
  deleted         boolean not null default false
);

create table if not exists public.workout_logs (
  id              text primary key,
  user_id         uuid not null references auth.users(id) on delete cascade,
  routines_id     text,
  workout_days_id text,
  date            text not null,
  created_at      bigint not null,
  updated_at      bigint not null default 0,
  starts_new_week integer not null default 0,
  cardio_only     integer not null default 0,
  is_deload       integer not null default 0,
  deleted         boolean not null default false
);

create table if not exists public.exercise_logs (
  id              text primary key,
  user_id         uuid not null references auth.users(id) on delete cascade,
  workout_logs_id text,
  exercises_id    text,
  exercise_name   text not null,
  exercise_order  integer not null,
  raw_input       text not null default '',
  notes           text,
  created_at      bigint not null,
  updated_at      bigint not null default 0,
  deleted         boolean not null default false
);

create table if not exists public.log_sets (
  id               text primary key,
  user_id          uuid not null references auth.users(id) on delete cascade,
  exercise_logs_id text,
  set_order        integer not null,
  weight           real not null,
  reps             integer not null,
  updated_at       bigint not null default 0,
  deleted          boolean not null default false
);

create table if not exists public.cardio_logs (
  id              text primary key,
  user_id         uuid not null references auth.users(id) on delete cascade,
  workout_logs_id text,
  type            text not null,
  raw_input       text not null default '',
  duration        real,
  distance        real,
  pace            text,
  notes           text,
  updated_at      bigint not null default 0,
  deleted         boolean not null default false
);

-- Índices para el pull incremental (Fase 3): por usuario y updated_at.
create index if not exists idx_routines_user      on public.routines(user_id, updated_at);
create index if not exists idx_days_user          on public.workout_days(user_id, updated_at);
create index if not exists idx_exercises_user     on public.exercises(user_id, updated_at);
create index if not exists idx_logs_user          on public.workout_logs(user_id, updated_at);
create index if not exists idx_exlogs_user        on public.exercise_logs(user_id, updated_at);
create index if not exists idx_sets_user          on public.log_sets(user_id, updated_at);
create index if not exists idx_cardio_user        on public.cardio_logs(user_id, updated_at);

-- ─────────────────────────── RLS ───────────────────────────
-- Cada usuario solo accede a sus filas. En las tablas de dominio la clave es
-- user_id; en profiles/user_settings es la propia PK.
alter table public.profiles      enable row level security;
alter table public.user_settings enable row level security;
alter table public.routines      enable row level security;
alter table public.workout_days  enable row level security;
alter table public.exercises     enable row level security;
alter table public.workout_logs  enable row level security;
alter table public.exercise_logs enable row level security;
alter table public.log_sets      enable row level security;
alter table public.cardio_logs   enable row level security;

create policy "own profile" on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

create policy "own settings" on public.user_settings
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own routines" on public.routines
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own days" on public.workout_days
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own exercises" on public.exercises
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own logs" on public.workout_logs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own exlogs" on public.exercise_logs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own sets" on public.log_sets
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own cardio" on public.cardio_logs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Crear la fila de profile automáticamente al registrarse un usuario.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────── app_releases (aviso de actualización) ───────────────────
-- Una fila por plataforma con la última versión publicada en la tienda. La app
-- la consulta al arrancar (lib/cloud/release.ts) y, si es mayor que la
-- instalada (app.json → expo.version), avisa con un popup y un enlace a Google
-- Play. Hace falta porque la app se distribuye por Play con expo-updates
-- deshabilitado: el dispositivo no tiene otra forma de saber que hay versión
-- nueva.
--
-- Se publica a mano al cerrar cada versión (SQL Editor de Supabase):
--   insert into public.app_releases (platform, version, updated_at)
--   values ('android', '0.7.3', extract(epoch from now()) * 1000)
--   on conflict (platform) do update
--     set version = excluded.version, updated_at = excluded.updated_at;
create table if not exists public.app_releases (
  platform   text primary key,
  version    text not null,
  store_url  text,
  updated_at bigint not null default 0
);

-- Lectura para todo el mundo, también sin sesión: el aviso tiene que funcionar
-- sin haber iniciado sesión. No hay policy de escritura a propósito, así que
-- desde el cliente nadie puede publicar una versión (solo el service_role).
alter table public.app_releases enable row level security;

create policy "read releases" on public.app_releases
  for select using (true);
