// Backup automático local: escritura silenciosa y periódica del JSON de la app
// en una carpeta persistente del dispositivo, sin cloud ni diálogo de compartir.
// Es la red de seguridad que NO depende de tener cuenta: la nube (opcional,
// desde 0.7.0) cubre la sincronización entre móviles, pero sin sesión esto es lo
// único que salva los datos de un móvil perdido sin exportar a mano.
//
// El payload es EL MISMO que el export manual (lo arma App.tsx): aquí solo se
// orquesta el "cada cuánto" y el "dónde", reutilizando lib/fileIO.ts.
import {
  canWriteLocalBackup,
  getLocalBackupSize,
  listLocalBackups,
  pruneLocalBackups,
  readLocalBackup,
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

export interface AutoBackupFile {
  fileName: string;
  /** Clave `YYYY-MM-DD` sacada del nombre (`gymbro-backup-AAAA-MM-DD.json`). */
  date: string | null;
  size: number;
}

const BACKUP_DATE = /(\d{4}-\d{2}-\d{2})\.json$/;

/** Backups automáticos del dispositivo, el más reciente primero. */
export async function listAutoBackups(): Promise<AutoBackupFile[]> {
  const names = await listLocalBackups(AUTO_BACKUP_DIR);
  const files = await Promise.all(
    names.map(async (fileName) => ({
      fileName,
      date: fileName.match(BACKUP_DATE)?.[1] ?? null,
      size: await getLocalBackupSize(AUTO_BACKUP_DIR, fileName),
    }))
  );
  return files.reverse();
}

export function readAutoBackup(fileName: string): Promise<string> {
  return readLocalBackup(AUTO_BACKUP_DIR, fileName);
}
