// GymBro — Edge Function `delete-account`: borra la cuenta de quien la llama.
//
// Es la única pieza con `service_role` (borrar un usuario de Auth lo exige) y
// por eso vive en el servidor, nunca en la app. Solo borra a QUIEN LLAMA: el
// usuario sale del JWT de la petición (lo verifica Supabase antes de entrar
// aquí y otra vez `getUser`), nunca de un parámetro.
//
// Qué se borra:
//   · Sus fotos del bucket `avatars`, PRIMERO: Storage guarda al dueño de cada
//     archivo y, con archivos suyos, Auth se niega a borrar el usuario.
//   · El usuario de Auth. Todas las tablas cuelgan de `auth.users` con
//     `on delete cascade` (supabase/schema.sql y social-schema.sql): perfil,
//     ajustes, rutinas, entrenos, actividad, seguimientos, likes, guardados,
//     comentarios y reportes caen con él, y los comentarios y likes que otros
//     dejaron en sus rutinas caen con las rutinas.
//
// Despliegue (Supabase → Edge Functions → Deploy a new function → editor):
// nombre `delete-account`, pegar este archivo y dejar "Verify JWT" activado.
// `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` ya están
// definidas en el entorno de toda Edge Function.
// Versión EXACTA, la misma que la app: es la única pieza con `service_role` y no
// debe cambiar de librería sola en cada despliegue.
import { createClient } from 'jsr:@supabase/supabase-js@2.112.3';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const authorization = req.headers.get('Authorization');
  if (!authorization) return json({ error: 'unauthorized' }, 401);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Quién llama, con SU token (no con la service_role).
  const asCaller = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const {
    data: { user },
    error: userError,
  } = await asCaller.auth.getUser();
  // Usuario ya borrado: un reintento tras perder la respuesta del borrado
  // bueno (sin cobertura). La firma del JWT ya la validó la pasarela ("Verify
  // JWT"), así que es de una cuenta que existió y ya no existe: el borrado está
  // hecho. Responder ok deja al móvil terminar su limpieza en vez de atascarlo.
  if (userError?.code === 'user_not_found') return json({ ok: true });
  if (userError || !user) return json({ error: 'unauthorized' }, 401);

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  // 0. Sin foto en el perfil ANTES de borrar los archivos: si luego fallara
  //    el borrado del usuario, nadie vería una foto rota hasta el reintento.
  const { error: profileError } = await admin
    .from('profiles')
    .update({ avatar_url: null })
    .eq('id', user.id);
  if (profileError)
    return json({ error: `profiles: ${profileError.message}` }, 500);

  // 1. Fotos de su carpeta (la app deja como mucho unas pocas).
  const bucket = admin.storage.from('avatars');
  const { data: files, error: listError } = await bucket.list(user.id, {
    limit: 100,
  });
  if (listError) return json({ error: `avatars: ${listError.message}` }, 500);
  if (files && files.length) {
    const { error: removeError } = await bucket.remove(
      files.map((file) => `${user.id}/${file.name}`)
    );
    if (removeError) {
      return json({ error: `avatars: ${removeError.message}` }, 500);
    }
  }

  // 2. El usuario; las tablas caen en cascada.
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) return json({ error: deleteError.message }, 500);

  return json({ ok: true });
});
