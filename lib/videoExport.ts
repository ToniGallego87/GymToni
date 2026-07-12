import { Platform } from 'react-native';
import { t } from './i18n';

// Módulo nativo local (modules/video-encoder). Solo existe en nativo; en web no
// se carga para no romper el bundle.
type VideoEncoderNative = {
  encode: (
    framePaths: string[],
    outputPath: string,
    fps: number
  ) => Promise<string>;
};

let nativeModule: VideoEncoderNative | null = null;
try {
  if (Platform.OS !== 'web') {
    // Carga perezosa: requireNativeModule lanza si el binario no incluye el módulo.
    nativeModule =
      require('expo-modules-core').requireNativeModule('VideoEncoder');
  }
} catch {
  nativeModule = null;
}

export const isVideoEncoderAvailable = nativeModule !== null;

/**
 * Codifica una lista de fotogramas PNG (rutas de fichero) en un MP4 H.264.
 * Lanza si el módulo nativo no está disponible (p. ej. en web o sin recompilar).
 */
export async function encodeFramesToMp4(
  framePaths: string[],
  outputPath: string,
  fps: number
): Promise<string> {
  if (!nativeModule) {
    throw new Error(
      t('El codificador de vídeo no está disponible en esta versión.')
    );
  }
  return nativeModule.encode(framePaths, outputPath, fps);
}
