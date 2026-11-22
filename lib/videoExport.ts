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
  // Solo Android por ahora (el módulo de iOS no lo tiene: ver abajo).
  encodeKeyframes?: (
    keyPaths: string[],
    outputPath: string,
    fps: number,
    steps: number,
    holdFrames: number,
    ringGeometry: number[],
    ringFractions: number[]
  ) => Promise<string>;
  // Captura nativa de una vista a memoria (solo Android): sin JPG ni disco.
  // `session` separa lo capturado por cada vídeo (ver startCaptureSession).
  captureFrame?: (
    session: string,
    viewTag: number,
    index: number,
    width: number,
    height: number
  ) => Promise<number>;
  encodeCaptured?: (
    session: string,
    keyCount: number,
    outputPath: string,
    fps: number,
    steps: number,
    holdFrames: number,
    ringGeometry: number[],
    ringFractions: number[]
  ) => Promise<string>;
  discardCaptured?: (session: string) => void;
};

/**
 * Anillos que crecen en la animación, para que el codificador barra los
 * fotogramas intermedios por ángulo en vez de fundirlos. En píxeles del
 * fotograma capturado.
 */
export interface VideoRings {
  // Por anillo: centro, radio y medio grosor del trazo.
  geometry: { cx: number; cy: number; radius: number; halfStroke: number }[];
  // Por fotograma clave, la fracción rellena (0-1) de cada anillo, en orden.
  fractions: number[][];
}

// Los anillos, aplanados como los espera el módulo nativo: 4 números por anillo
// (cx, cy, radio, medio grosor) y las fracciones clave a clave.
function flattenRings(rings?: VideoRings): {
  geometry: number[];
  fractions: number[];
} {
  return {
    geometry: (rings?.geometry ?? []).flatMap((r) => [
      r.cx,
      r.cy,
      r.radius,
      r.halfStroke,
    ]),
    fractions: (rings?.fractions ?? []).flat(),
  };
}

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
 * Codifica un MP4 H.264 a partir de fotogramas CLAVE (rutas de fichero PNG/JPG):
 * entre cada dos claves salen `steps - 1` fotogramas intermedios fundiendo una
 * en otra, y la última se mantiene `holdFrames` fotogramas más. Capturar solo
 * las claves es lo que hace rápido el vídeo de la semana. Con `rings`, la zona
 * de cada anillo que crece se barre por ángulo en vez de fundirse (sin el
 * rastro del arco anterior).
 *
 * Si el binario no trae `encodeKeyframes` (iOS, o un nativo sin recompilar),
 * repite cada clave en vez de fundirla: mismo vídeo, movimiento a saltos.
 * Lanza si el módulo nativo no está disponible (p. ej. en web).
 */
export async function encodeKeyframesToMp4(
  keyPaths: string[],
  outputPath: string,
  fps: number,
  steps: number,
  holdFrames: number,
  rings?: VideoRings
): Promise<string> {
  if (!nativeModule) {
    throw new Error(
      t('El codificador de vídeo no está disponible en esta versión.')
    );
  }
  if (nativeModule.encodeKeyframes) {
    const flat = flattenRings(rings);
    return nativeModule.encodeKeyframes(
      keyPaths,
      outputPath,
      fps,
      steps,
      holdFrames,
      flat.geometry,
      flat.fractions
    );
  }
  const frames: string[] = [];
  keyPaths.forEach((path, index) => {
    const last = index === keyPaths.length - 1;
    const copies = last ? 1 + holdFrames : steps;
    for (let c = 0; c < copies; c++) frames.push(path);
  });
  return nativeModule.encode(frames, outputPath, fps);
}

/**
 * El binario sabe capturar la vista en nativo, a memoria (Android). Es lo
 * más rápido: ni JPG, ni disco, ni volver a leer; y la conversión a YUV corre
 * en otro hilo mientras se pinta el siguiente fotograma.
 */
export const canCaptureFramesNatively = !!(
  nativeModule?.captureFrame &&
  nativeModule.encodeCaptured &&
  nativeModule.discardCaptured
);

let sessionCounter = 0;

/**
 * Id de las capturas de UN vídeo. Cada vídeo usa el suyo: así lo que suelta o
 * codifica uno (p. ej. el que sigue montándose tras salir de la pantalla) no
 * toca los fotogramas de otro que ya ha empezado. Lleva la hora para no
 * repetirse tras recargar el JS.
 */
export function startCaptureSession(): string {
  sessionCounter += 1;
  return `${Date.now()}-${sessionCounter}`;
}

/**
 * Captura la vista `viewTag` a width×height como fotograma clave `index` de
 * `session` (repetir un índice lo sustituye; si la sesión ya se soltó, la
 * captura se descarta). Requiere `canCaptureFramesNatively`.
 */
export async function captureVideoFrame(
  session: string,
  viewTag: number,
  index: number,
  width: number,
  height: number
): Promise<void> {
  if (!nativeModule?.captureFrame) {
    throw new Error('captureFrame no disponible');
  }
  await nativeModule.captureFrame(session, viewTag, index, width, height);
}

/**
 * Codifica las `keyCount` claves capturadas de `session`, como
 * encodeKeyframesToMp4, y las suelta.
 */
export async function encodeCapturedToMp4(
  session: string,
  keyCount: number,
  outputPath: string,
  fps: number,
  steps: number,
  holdFrames: number,
  rings?: VideoRings
): Promise<string> {
  if (!nativeModule?.encodeCaptured) {
    throw new Error('encodeCaptured no disponible');
  }
  const flat = flattenRings(rings);
  return nativeModule.encodeCaptured(
    session,
    keyCount,
    outputPath,
    fps,
    steps,
    holdFrames,
    flat.geometry,
    flat.fractions
  );
}

/**
 * Suelta de memoria lo capturado de `session` sin codificar (cancelado o
 * fallido). Una captura de esa sesión que llegue después se descarta.
 */
export function discardCapturedFrames(session: string): void {
  try {
    nativeModule?.discardCaptured?.(session);
  } catch {
    // Nada que soltar.
  }
}
