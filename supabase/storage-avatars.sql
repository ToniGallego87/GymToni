-- GymBro — Storage de avatares (Supabase). Fase 4 (foto de perfil).
--
-- Crea el bucket público `avatars` y las políticas para que cada usuario suba y
-- gestione SU carpeta (`{userId}/{nombre aleatorio}.jpg`; las versiones viejas
-- de la app suben `{userId}/avatar.jpg`). La app sube la foto ya reducida
-- (256px jpeg) y guarda la URL pública en `profiles.avatar_url`.
--
-- Es obligatorio: sin el bucket no hay foto de perfil (la caída a base64 en el
-- propio perfil se quitó: `profiles_avatar_url_own`, en social-schema.sql, solo
-- admite URLs de este bucket). Ejecutar entero en el SQL Editor de Supabase.

-- Bucket público (lectura anónima por URL; escritura restringida por políticas).
-- Solo JPEG y hasta 512 KB: la app sube 256 px a calidad 0.6 (unas decenas de
-- KB). Sin tope, cualquiera con cuenta podía subir archivos de cualquier tipo
-- y tamaño a un bucket que se sirve en público.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('avatars', 'avatars', true, 524288, array['image/jpeg'])
  on conflict (id) do update set
    public = true,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Lectura: SOLO de tu carpeta. Un bucket público sirve sus archivos por
-- `/object/public/...` sin pasar por estas políticas, así que las fotos se
-- siguen viendo en los perfiles; lo que esta política controla es LISTAR y
-- leer por la API. Antes era `bucket_id = 'avatars'` para todo el mundo, y
-- cualquiera sin sesión listaba las carpetas (una por cuenta, con su id) y
-- bajaba la foto de un perfil privado. Hace falta la propia: la app lista su
-- carpeta para borrar la foto anterior (pruneAvatars) y el upsert de las
-- versiones viejas la necesita.
drop policy if exists "avatars public read" on storage.objects;
drop policy if exists "avatars read own" on storage.objects;
create policy "avatars read own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Subir: solo a tu carpeta, solo `{nombre}.jpg` (sin subcarpetas ni `..`) y
-- como mucho 3 fotos a la vez (la app deja 1: borra la anterior tras subir).
drop policy if exists "avatars insert own" on storage.objects;
create policy "avatars insert own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and name ~ ('^' || auth.uid()::text || '/[A-Za-z0-9_-]+\.jpg$')
    and (
      select count(*) from storage.objects o
      where o.bucket_id = 'avatars'
        and (storage.foldername(o.name))[1] = auth.uid()::text
    ) < 3
  );

drop policy if exists "avatars update own" on storage.objects;
create policy "avatars update own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and name ~ ('^' || auth.uid()::text || '/[A-Za-z0-9_-]+\.jpg$')
  );

drop policy if exists "avatars delete own" on storage.objects;
create policy "avatars delete own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
