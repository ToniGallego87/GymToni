// Backup automático local: escritura silenciosa y periódica del JSON de la app
// en una carpeta persistente del dispositivo, sin cloud ni diálogo de compartir.
// La app es local-only, así que esto es la única red de seguridad frente a un
// móvil perdido sin depender de que el usuario exporte a mano.
//
// El payload es EL MISMO que el export manual (lo arma App.tsx): aquí solo se
// orquesta el "cada cuánto" y el "dónde", reutilizando lib/fileIO.ts.
import {
  canWriteLocalBackup,
  listLocalBackups,
  pruneLocalBackups,
  writeLocalBackup,
} from './fileIO';
import {
  getAutoBackupEnabled,
  getLastAutoBackupAt,
  setLastAutoBackupAt,
} from './appSettings';

/** Subcarpeta (bajo documentDirectory) donde viven los backups automáticos. */
export const AUTO_BACKUP_DIR = 'backups';
/** Backups que se conservan; los más antiguos se van borrando (rotación). */
export const MAX_AUTO_BACKUPS = 7;
/** Intervalo mínimo entre backups automáticos: uno al día. */
export const AUTO_BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** ¿Toca hacer un backup automático ahora (activado y pasado el intervalo)? */
export function isAutoBackupDue(now: number = Date.now()): boolean {
  if (!canWriteLocalBackup() || !getAutoBackupEnabled()) return false;
  return now - getLastAutoBackupAt() >= AUTO_BACKUP_INTERVAL_MS;
}

/**
 * Escribe un backup, rota los antiguos y guarda la marca de tiempo. Devuelve la
 * URI del fichero escrito. No comprueba el intervalo: eso lo decide el llamante
 * con `isAutoBackupDue` (así el botón "backup ahora" puede forzarlo).
 */
export async function runAutoBackup(
  json: string,
  now: number = Date.now()
): Promise<string> {
  const stamp = new Date(now).toISOString().slice(0, 10);
  const fileName = `gymbro-backup-${stamp}.json`;
  const uri = await writeLocalBackup(AUTO_BACKUP_DIR, fileName, json);
  await pruneLocalBackups(AUTO_BACKUP_DIR, MAX_AUTO_BACKUPS);
  setLastAutoBackupAt(now);
  return uri;
}

/** Número de backups automáticos guardados en el dispositivo. */
export async function countLocalBackups(): Promise<number> {
  return (await listLocalBackups(AUTO_BACKUP_DIR)).length;
}
