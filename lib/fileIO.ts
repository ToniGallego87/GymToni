import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Alert, Platform } from 'react-native';
import { t } from './i18n';

export async function readJsonFromFile(): Promise<string> {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json,text/json';
      input.style.display = 'none';

      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) {
          reject(new Error(t('No se seleccionó ningún archivo')));
          return;
        }

        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () =>
          reject(new Error(t('No se pudo leer el archivo')));
        reader.readAsText(file);
      };

      document.body.appendChild(input);
      input.click();

      setTimeout(() => {
        if (document.body.contains(input)) {
          document.body.removeChild(input);
        }
      }, 0);
    });
  }

  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/json', '*/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled) {
    throw new Error(t('No se seleccionó ningún archivo'));
  }

  const asset = result.assets?.[0];
  if (!asset?.uri) {
    throw new Error(t('No se pudo acceder al archivo seleccionado'));
  }

  return FileSystem.readAsStringAsync(asset.uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });
}

export async function downloadJsonFile(
  fileName: string,
  json: string
): Promise<void> {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return;
  }

  const baseDirectory =
    FileSystem.cacheDirectory || FileSystem.documentDirectory;
  if (!baseDirectory) {
    throw new Error(t('No se encontró una carpeta disponible para exportar'));
  }

  const fileUri = `${baseDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(fileUri, json, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/json',
      dialogTitle: 'Exportar datos de GymBro',
      UTI: 'public.json',
    });
    return;
  }

  Alert.alert(
    t('Exportación completada'),
    `${t('Backup guardado en:')}\n${fileUri}`
  );
}

// --- Backup local silencioso (sin diálogo de compartir) ---
// A diferencia de `downloadJsonFile`, escribe el fichero en una carpeta
// PERSISTENTE del dispositivo (documentDirectory) sin abrir el selector de
// compartir: lo usa el backup automático. En web no hay documentDirectory, así
// que no hace nada (el backup automático se salta la plataforma web).

/** ¿Puede escribirse un backup silencioso en esta plataforma? */
export function canWriteLocalBackup(): boolean {
  return Platform.OS !== 'web' && !!FileSystem.documentDirectory;
}

function backupDir(subdir: string): string {
  return `${FileSystem.documentDirectory}${subdir}/`;
}

/** Escribe el JSON en `subdir/fileName` y devuelve su URI. */
export async function writeLocalBackup(
  subdir: string,
  fileName: string,
  json: string
): Promise<string> {
  if (!canWriteLocalBackup()) {
    throw new Error(t('No se encontró una carpeta disponible para exportar'));
  }
  const dir = backupDir(subdir);
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(
    () => {}
  );
  const fileUri = `${dir}${fileName}`;
  await FileSystem.writeAsStringAsync(fileUri, json, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  return fileUri;
}

/** Lista los ficheros de backup existentes (nombres, sin ruta), ordenados. */
export async function listLocalBackups(subdir: string): Promise<string[]> {
  if (!canWriteLocalBackup()) return [];
  const dir = backupDir(subdir);
  try {
    const names = await FileSystem.readDirectoryAsync(dir);
    return names.filter((name) => name.endsWith('.json')).sort();
  } catch {
    return [];
  }
}

/** Deja solo los `keep` backups más recientes (por nombre, que lleva fecha). */
export async function pruneLocalBackups(
  subdir: string,
  keep: number
): Promise<void> {
  const names = await listLocalBackups(subdir);
  if (names.length <= keep) return;
  const dir = backupDir(subdir);
  const toDelete = names.slice(0, names.length - keep);
  await Promise.all(
    toDelete.map((name) =>
      FileSystem.deleteAsync(`${dir}${name}`, { idempotent: true }).catch(
        () => {}
      )
    )
  );
}
