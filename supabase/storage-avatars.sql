-- GymBro — Storage de avatares (Supabase). Fase 4 (foto de perfil).
--
-- Crea el bucket público `avatars` y las políticas para que cada usuario suba y
-- actualice SU carpeta (`{userId}/avatar.jpg`). La app sube la foto ya reducida
-- (256px jpeg) y guarda la URL pública en `profiles.avatar_url`.
--
-- Sin ejecutar esto, la app sigue funcionando: cae a guardar la foto como base64
-- en el propio perfil (más pesado). Ejecutar entero en el SQL Editor de Supabase.

-- Bucket público (lectura anónima por URL; escritura restringida por políticas).
insert into storage.buckets (id, name, public)
  values ('avatars', 'avatars', true)
  on conflict (id) do update set public = true;

-- Lectura pública de los objetos del bucket (además, al ser público, la URL ya
-- es accesible; la política deja explícito el acceso de lectura).
drop policy if exists "avatars public read" on storage.objects;
create policy "avatars public read" on storage.objects
  for select using (bucket_id = 'avatars');

-- Cada usuario gestiona SOLO su carpeta (primer segmento del nombre = su uid).
drop policy if exists "avatars insert own" on storage.objects;
create policy "avatars insert own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars update own" on storage.objects;
create policy "avatars update own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars delete own" on storage.objects;
create policy "avatars delete own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
