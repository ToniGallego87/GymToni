import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Alert, Platform } from 'react-native';

/**
 * Guarda un PNG (base64 sin prefijo data:) en caché y abre la hoja de compartir
 * del sistema. En web fuerza una descarga.
 */
export async function shareBase64Png(
  fileName: string,
  base64: string
): Promise<void> {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${base64}`;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return;
  }

  const baseDirectory =
    FileSystem.cacheDirectory || FileSystem.documentDirectory;
  if (!baseDirectory) {
    throw new Error('No se encontró una carpeta disponible para la imagen');
  }

  const fileUri = `${baseDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(fileUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'image/png',
      dialogTitle: 'Compartir logros de la semana',
      UTI: 'public.png',
    });
    return;
  }

  Alert.alert('Imagen guardada', `Disponible en:\n${fileUri}`);
}
