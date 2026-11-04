// GymBro — Edge Function `purge-deleted-accounts`: borra de verdad las cuentas
// cuyo plazo de gracia ha terminado. La lanza una tarea diaria (SETUP.md →
// "Panel de Supabase"), nunca la app.
//
// Es la única pieza con `service_role`, porque borrar un usuario de Auth y sus
// archivos lo exige. Solo la puede llamar quien tenga `PURGE_SECRET` (secreto de
// la función): no hay usuario que la llame, así que "Verify JWT" va desactivado.
//
// Pedir el borrado lo hace la app con `request_account_deletion`
// (supabase/social-schema.sql, sección "Borrado de cuenta", donde está el porqué
// del diseño). Aquí, por cada cuenta vencida:
//   1. `anonymize_account`: lo público pasa a la cuenta "Cuenta eliminada".
//   2. Sus fotos de `avatars`: Storage guarda al dueño de cada archivo y, con
//      archivos suyos, Auth se niega a borrar el usuario.
//   3. El usuario de Auth: lo privado cae en cascada.
// Cada paso se puede repetir: si una cuenta falla, sigue marcada y mañana se
// reintenta. Un fallo en una no para a las demás. Desde el corte de los 30 días
// la cuenta ya no se puede recuperar (`cancel_account_deletion`), así que nadie
// recupera una cuenta a medio purgar.

// Versión EXACTA, la misma que la app: es la única pieza con `service_role` y no
// debe cambiar de librería sola en cada despliegue.
import { createClient } from 'jsr:@supabase/supabase-js@2.112.3';

// Mismo valor que los días de lib/utils.ts → ACCOUNT_DELETION_GRACE_DAYS.
const GRACE_DAYS = 30;
// Mismo id que supabase/social-schema.sql y lib/cloud/social.ts.
const DELETED_ACCOUNT_ID = 'd31e7ed0-0000-4000-8000-000000000000';
// Tope por ejecución: lo que quede se purga al día siguiente.
const BATCH = 100;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

type Admin = ReturnType<typeof createClient>;

// La cuenta reservada: la primera purga la crea. Nadie puede entrar en ella
// (contraseña aleatoria que no se guarda y baneada).
async function ensureDeletedAccount(admin: Admin): Promise<void> {
  const { data } = await admin.auth.admin.getUserById(DELETED_ACCOUNT_ID);
  if (!data?.user) {
    const { error } = await admin.auth.admin.createUser({
      id: DELETED_ACCOUNT_ID,
      email: 'cuenta-eliminada@gymbro.invalid',
      email_confirm: true,
      password: `${crypto.randomUUID()}${crypto.randomUUID()}`,
      ban_duration: '876000h',
    });
    if (error) throw new Error(`cuenta reservada: ${error.message}`);
  }
  const { error } = await admin.from('profiles').upsert({
    id: DELETED_ACCOUNT_ID,
    display_name: 'Cuenta eliminada',
    is_public: true,
    share_activity: false,
  });
  if (error) throw new Error(`perfil reservado: ${error.message}`);
}

async function purgeAccount(admin: Admin, userId: string): Promise<void> {
  const { error: anonymizeError } = await admin.rpc('anonymize_account', {
    target: userId,
  });
  if (anonymizeError) throw new Error(`anonymize: ${anonymizeError.message}`);

  const bucket = admin.storage.from('avatars');
  const { data: files, error: listError } = await bucket.list(userId, {
    limit: 100,
  });
  if (listError) throw new Error(`avatars: ${listError.message}`);
  if (files && files.length) {
    const { error: removeError } = await bucket.remove(
      files.map((file) => `${userId}/${file.name}`)
    );
    if (removeError) throw new Error(`avatars: ${removeError.message}`);
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) throw new Error(`auth: ${deleteError.message}`);
}

// Compara los hashes, no los textos: el tiempo de `!==` depende de cuántos
// caracteres coincidan.
async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(text)
  );
  return Array.from(new Uint8Array(digest)).join(',');
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const secret = Deno.env.get('PURGE_SECRET');
  const given = req.headers.get('x-purge-secret') ?? '';
  if (!secret || (await sha256(given)) !== (await sha256(secret))) {
    return json({ error: 'unauthorized' }, 401);
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  );

  const cutoff = new Date(
    Date.now() - GRACE_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
  const { data: due, error } = await admin
    .from('profiles')
    .select('id')
    .lt('deletion_requested_at', cutoff)
    .neq('id', DELETED_ACCOUNT_ID)
    .limit(BATCH);
  if (error) return json({ error: `profiles: ${error.message}` }, 500);
  if (!due?.length) return json({ purged: 0, failed: 0 });

  try {
    await ensureDeletedAccount(admin);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }

  let purged = 0;
  const failed: { id: string; error: string }[] = [];
  for (const { id } of due as { id: string }[]) {
    try {
      await purgeAccount(admin, id);
      purged += 1;
    } catch (e) {
      failed.push({ id, error: (e as Error).message });
    }
  }
  return json({ purged, failed: failed.length, errors: failed });
});
