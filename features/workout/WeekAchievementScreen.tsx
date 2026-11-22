import { subscribeTheme } from '@lib/themeStore';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  AppState,
  findNodeHandle,
  Animated as RNAnimated,
  Easing,
  PixelRatio,
  useWindowDimensions,
  unstable_batchedUpdates,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import type Svg from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AchievementPoster,
  NAME_FONT,
  NAME_LETTER_SPACING,
  POSTER_WIDTH,
  POSTER_HEIGHT,
  posterUserName,
  QR_TITLE_FONT,
  QR_TITLE_LETTER_SPACING,
  QR_ROUTINE_FONT,
  posterQrTitle,
  posterRoutineName,
  posterHasQr,
  posterRings,
  DONUT_RADIUS,
  DONUT_STROKE,
} from '@components/AchievementPoster';
import {
  Button,
  FloatingBackButton,
  getFloatingBackButtonMetrics,
  GlassTopBar,
  GLASS_TOP_BAR_CONTENT_GAP,
  useGlassTopBarHeight,
  Toast,
  StretchScrollView,
} from '../../components';
import { WeekAchievements } from '@lib/achievements';
import { useMyProfile } from '@hooks/useMyProfile';
import { useSession } from '@lib/cloud/auth';
import { getPublicRoutineCard } from '@lib/cloud/social';
import { shareBase64Png } from '@lib/imageShare';
import { buildRoutineWebLink } from '@lib/routineShare';
import { communitySourceOf, isLinkedRoutine } from '@lib/routines';
import {
  canCaptureFramesNatively,
  captureVideoFrame,
  discardCapturedFrames,
  encodeCapturedToMp4,
  encodeKeyframesToMp4,
  isVideoEncoderAvailable,
  startCaptureSession,
} from '@lib/videoExport';
import { theme } from '@lib/theme';
import { t } from '@lib/i18n';
import type { WorkoutRoutine } from '../../types';

interface WeekAchievementScreenProps {
  achievements: WeekAchievements;
  // Rutina de esa semana: nombre en el póster y, si es pública, QR a ella.
  routine?: WorkoutRoutine;
  onBack: () => void;
}

// Resolución y cadencia del vídeo exportado (16:9 vertical, aptos para H.264).
const VIDEO_WIDTH = 720;
const VIDEO_HEIGHT = 1280;
const VIDEO_FPS = 30; // 30 fps para que la animación se vea fluida (sin trompicones).
// Fotogramas CLAVE que se capturan (la animación 0→1): capturar es lo lento.
// Entre cada dos, el codificador genera 3 intermedios → (31 - 1) × 4 + 1 = 121
// fotogramas = 4 s de animación a 30 fps, con un cuarto de las capturas. Los
// intermedios funden lo que aparece (opacidad) y barren por ángulo los
// anillos que crecen (posterRings), así que no queda rastro.
const VIDEO_KEYFRAMES = 31;
const VIDEO_STEPS_PER_KEYFRAME = 4;
// Póster (1080 de ancho) → fotograma del vídeo.
const VIDEO_SCALE = VIDEO_WIDTH / POSTER_WIDTH;
const VIDEO_END_HOLD = 120; // 120 / 30fps = 4 s con el resultado completo → ~8 s totales.
// Una captura que no responde (p. ej. con la app en segundo plano) se da por
// fallida a los 8 s; si fue por minimizar, se repite al volver.
const CAPTURE_TIMEOUT_MS = 8000;
// Reintentos de un mismo fotograma interrumpido por ir a segundo plano.
const MAX_FRAME_RETRIES = 3;

// Salir de la pantalla a mitad del vídeo: corta el bucle sin avisar de error.
class VideoCancelled extends Error {}

// Espera a que la app vuelva a primer plano (resuelve ya si lo está).
function waitUntilActive(): Promise<void> {
  return new Promise((resolve) => {
    if (AppState.currentState === 'active') return resolve();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        sub.remove();
        resolve();
      }
    });
  });
}

// Carga un asset bundleado como data URI PNG (necesario para que las imágenes se
// rastericen dentro del SVG al exportarlo con toDataURL, también en web).
async function loadImageDataUri(moduleRef: number): Promise<string> {
  const asset = Asset.fromModule(moduleRef);
  await asset.downloadAsync();
  const uri = asset.localUri || asset.uri;

  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    const blob = await response.blob();
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error(t('No se pudo leer la imagen')));
      reader.readAsDataURL(blob);
    });
  }

  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return `data:image/png;base64,${base64}`;
}

// Wordmark de la app (logo + "GymToni"). En nativo se pasa tal cual al póster.
const TITLE_ASSET = require('../../assets/title.png');

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function ShareButton({
  onPress,
  busy,
  label,
}: {
  onPress: () => void;
  busy: boolean;
  label: string;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      style={[styles.shareWrapper, animatedStyle]}
      onPress={onPress}
      disabled={busy}
      onPressIn={() => {
        scale.value = withSpring(0.97, { damping: 18, stiffness: 320 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 14, stiffness: 260 });
      }}
    >
      <LinearGradient
        colors={theme.gradients.primary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.shareGradient}
      >
        <LinearGradient
          colors={theme.gradients.sheen}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.shareSheen}
          pointerEvents="none"
        />
        <MaterialCommunityIcons
          name={busy ? 'progress-download' : 'share-variant'}
          size={22}
          color={theme.colors.onGold}
        />
        <Text style={styles.shareText}>{label}</Text>
      </LinearGradient>
    </AnimatedPressable>
  );
}

export function WeekAchievementScreen({
  achievements,
  routine,
  onBack,
}: WeekAchievementScreenProps) {
  const routineName = routine?.name;
  const { user } = useSession();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  // Quién completó la semana: el póster lleva su nombre y su foto.
  const { profile } = useMyProfile();
  // Ancho real del nombre en Anton, medido con un texto de la app (fuera de
  // pantalla): el SVG no sabe medirlo y el nivel quedaba lejos del nombre.
  const posterName = posterUserName(profile?.display_name ?? undefined);
  const [nameWidth, setNameWidth] = useState<number | undefined>(undefined);
  // Lo mismo con los dos textos del pie con QR, para centrar el conjunto.
  const [qrTitleWidth, setQrTitleWidth] = useState<number | undefined>(
    undefined
  );
  const [qrRoutineWidth, setQrRoutineWidth] = useState<number | undefined>(
    undefined
  );
  const posterRef = useRef<Svg>(null);
  // Vista que se captura para el vídeo (el póster sin el marco redondeado).
  const videoFrameRef = useRef<View>(null);
  const [busy, setBusy] = useState(false);
  // Fase del vídeo: capturar los fotogramas (con %) o montarlos en el MP4.
  const [videoPhase, setVideoPhase] = useState<'capture' | 'encode' | null>(
    null
  );
  const videoBusy = videoPhase !== null;
  const [videoProgress, setVideoProgress] = useState(0);
  // Salir de la pantalla con el vídeo a medias lo cancela (ver handleShareVideo).
  const mountedRef = useRef(true);
  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    []
  );
  // Cuántas veces ha ido la app a segundo plano: si cambia durante un
  // fotograma, ese fotograma se repite al volver en vez de abortar el vídeo.
  const backgroundCountRef = useRef(0);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') backgroundCountRef.current += 1;
    });
    return () => sub.remove();
  }, []);

  // Id PÚBLICO de la rutina, para que el QR la abra. Candidatas, por orden:
  // la propia (si la publicaste) y la pública de la que salió (enlazada o
  // copiada). Se confirma en la nube que siga pública: una retirada o
  // despublicada daría un enlace muerto. Sin confirmar (sin red, o ninguna
  // pública), el QR solo invita a descargar la app.
  const [publicRoutineId, setPublicRoutineId] = useState<string | undefined>(
    undefined
  );
  useEffect(() => {
    setPublicRoutineId(undefined);
    if (!routine) return;
    const sourceId = user
      ? communitySourceOf(routine, user.id)?.id
      : routine.sourceRoutineId ??
        (isLinkedRoutine(routine) ? routine.id : undefined);
    const ownId = user && !isLinkedRoutine(routine) ? routine.id : undefined;
    const candidates = [ownId, sourceId].filter(
      (id, index, all): id is string => !!id && all.indexOf(id) === index
    );
    let active = true;
    (async () => {
      for (const id of candidates) {
        try {
          if (await getPublicRoutineCard(id)) {
            if (active) setPublicRoutineId(id);
            return;
          }
        } catch {
          return; // Sin red: sin enlace a la rutina.
        }
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    routine?.id,
    routine?.sourceRoutineId,
    routine?.linkedOwnerId,
    routine?.sourceOwnerId,
    user?.id,
  ]);
  const qrValue = buildRoutineWebLink(publicRoutineId);
  // En nativo el wordmark se pasa como módulo de asset (require → número): así
  // react-native-svg lo rasteriza dentro de toDataURL en Android. En web hace
  // falta un data URI, que se carga de forma diferida más abajo.
  const [webTitleUri, setWebTitleUri] = useState<string | undefined>(undefined);
  const titleUri: string | number | undefined =
    Platform.OS === 'web' ? webTitleUri : TITLE_ASSET;
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  // Animación de aparición escalonada (solo en pantalla; el PNG es estático).
  const reveal = useRef(new RNAnimated.Value(0)).current;
  const animationRef = useRef<RNAnimated.CompositeAnimation | null>(null);
  const [revealValue, setRevealValue] = useState(0);

  useEffect(() => {
    const id = reveal.addListener(({ value }) => setRevealValue(value));
    animationRef.current = RNAnimated.timing(reveal, {
      toValue: 1,
      duration: 1800,
      delay: 250,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animationRef.current.start();
    return () => reveal.removeListener(id);
  }, [reveal]);

  useEffect(() => {
    if (Platform.OS !== 'web') return; // En nativo se usa el asset directo.
    let active = true;
    (async () => {
      try {
        const uri = await loadImageDataUri(TITLE_ASSET);
        if (active) setWebTitleUri(uri);
      } catch {
        // Sin imagen, el póster deja la cabecera vacía.
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const { topBarHeight, onTopBarLayout } = useGlassTopBarHeight(insets.top);
  const { bottom: floatingBackBottom, scrollBottomPadding } =
    getFloatingBackButtonMetrics(insets.bottom);

  const previewWidth = Math.min(windowWidth - theme.spacing.md * 2, 460);
  const previewHeight = (previewWidth * POSTER_HEIGHT) / POSTER_WIDTH;
  // El vídeo se captura de un póster aparte, fuera de pantalla, que mide
  // justo VIDEO_WIDTH × VIDEO_HEIGHT píxeles: react-native-svg pinta a los
  // píxeles de la vista, y estirar la vista previa (en móviles de densidad
  // baja, ~500 px de ancho) daba un vídeo borroso y un QR difícil de leer.
  const pixelRatio = PixelRatio.get();
  const captureWidth = VIDEO_WIDTH / pixelRatio;
  const captureHeight = VIDEO_HEIGHT / pixelRatio;

  const handleShare = () => {
    const node = posterRef.current;
    if (!node || busy || videoBusy) return;

    setBusy(true);

    // Forzar el estado final (todo visible y donuts rellenos) antes de exportar,
    // para que el PNG no capture un fotograma intermedio de la animación.
    animationRef.current?.stop();
    reveal.setValue(1);
    setRevealValue(1);

    // Esperar a que el póster se repinte completo antes de capturarlo.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        try {
          // toDataURL exporta a la resolución indicada (PNG nítido para redes).
          node.toDataURL(
            async (base64: string) => {
              try {
                await shareBase64Png(
                  `gymbro-semana-${achievements.weekNumber}.png`,
                  base64
                );
              } catch (error) {
                setToast({
                  message: t('No se pudo compartir la imagen.'),
                  type: 'error',
                });
              } finally {
                setBusy(false);
              }
            },
            { width: POSTER_WIDTH, height: POSTER_HEIGHT }
          );
        } catch (error) {
          setBusy(false);
          setToast({
            message: t('No se pudo generar la imagen.'),
            type: 'error',
          });
        }
      });
    });
  };

  // Repinta el póster en un valor de animación (y el % del botón en la misma
  // pasada: con la arquitectura antigua dos setState sueltos son dos repintados
  // del póster entero) y espera a que se confirme en pantalla.
  const renderAtReveal = (value: number, progress: number) =>
    new Promise<void>((resolve) => {
      unstable_batchedUpdates(() => {
        setRevealValue(value);
        setVideoProgress(progress);
      });
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });

  // Captura el póster del vídeo tal como está como fotograma clave `index`.
  // - Android: en nativo y a memoria (captureFrame): sin JPG, sin disco y con
  //   la conversión a YUV en otro hilo. Devuelve null.
  // - Si no (iOS o un binario sin recompilar): react-native-view-shot a JPG en
  //   un fichero temporal. Devuelve su ruta.
  // Si pasa el tiempo límite, lo que llegue tarde se suelta: en nativo lo
  // descarta la sesión ya cerrada (o lo sustituye la repetición del mismo
  // índice); el JPG tardío se borra aquí.
  const captureKeyframe = (session: string, index: number) =>
    new Promise<string | null>((resolve, reject) => {
      const node = videoFrameRef.current;
      const viewTag = node ? findNodeHandle(node) : null;
      if (!node || viewTag == null)
        return reject(new Error(t('Póster no disponible')));
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        reject(new Error('capture timeout'));
      }, CAPTURE_TIMEOUT_MS);
      const capture: Promise<string | null> = canCaptureFramesNatively
        ? captureVideoFrame(
            session,
            viewTag,
            index,
            VIDEO_WIDTH,
            VIDEO_HEIGHT
          ).then(() => null)
        : captureRef(videoFrameRef, {
            format: 'jpg',
            quality: 0.92,
            result: 'tmpfile',
            width: VIDEO_WIDTH,
            height: VIDEO_HEIGHT,
          });
      capture.then(
        (uri) => {
          clearTimeout(timer);
          if (timedOut) {
            if (uri)
              void FileSystem.deleteAsync(uri, { idempotent: true }).catch(
                () => undefined
              );
            return;
          }
          resolve(uri);
        },
        (error) => {
          clearTimeout(timer);
          reject(error);
        }
      );
    });

  // Captura los fotogramas CLAVE de la animación, los codifica a MP4 con el
  // módulo nativo (que genera los intermedios) y abre la hoja de compartir.
  //
  // Minimizar no lo tira: el bucle espera a que la app vuelva y repite el
  // fotograma que se cortó (los ya capturados valen). Salir de la pantalla lo
  // cancela sin aviso. Lo capturado se suelta siempre.
  const handleShareVideo = async () => {
    if (!videoFrameRef.current || busy || videoBusy) return;

    setVideoPhase('capture');
    setVideoProgress(0);
    animationRef.current?.stop();
    // Capturas de ESTE vídeo (otro que siga montándose no las toca).
    const session = startCaptureSession();

    // Solo en el camino de respaldo (view-shot): las rutas de los JPG.
    const keyPaths: string[] = [];
    const discardPath = (path: string) =>
      FileSystem.deleteAsync(path, { idempotent: true }).catch(() => undefined);
    try {
      // Pasada de calentamiento: el póster del vídeo no se ha pintado nunca
      // (está fuera de pantalla) y la primera vez carga sus imágenes. La
      // clave 0 de verdad la sustituye.
      await waitUntilActive();
      await renderAtReveal(0, 0);
      const warmUp = await captureKeyframe(session, 0).catch(() => null);
      if (warmUp) void discardPath(warmUp);

      let frame = 0;
      let retries = 0;
      while (frame < VIDEO_KEYFRAMES) {
        if (!mountedRef.current) throw new VideoCancelled();
        await waitUntilActive();
        if (!mountedRef.current) throw new VideoCancelled();
        const backgroundsBefore = backgroundCountRef.current;
        try {
          await renderAtReveal(
            frame / (VIDEO_KEYFRAMES - 1),
            frame / VIDEO_KEYFRAMES
          );
          const uri = await captureKeyframe(session, frame);
          // Si la app pasó por segundo plano mientras tanto, por si acaso se
          // repite el fotograma al volver (en nativo, la repetición sustituye
          // a esta captura por su índice).
          if (backgroundCountRef.current !== backgroundsBefore) {
            if (uri) void discardPath(uri);
            continue;
          }
          if (uri) keyPaths.push(uri);
          frame += 1;
          retries = 0;
        } catch (error) {
          if (!mountedRef.current) throw new VideoCancelled();
          const interrupted =
            backgroundCountRef.current !== backgroundsBefore ||
            AppState.currentState !== 'active';
          retries += 1;
          if (!interrupted || retries > MAX_FRAME_RETRIES) throw error;
        }
      }

      if (mountedRef.current) setVideoPhase('encode');
      const outputUri = `${FileSystem.cacheDirectory}gymbro-semana-${achievements.weekNumber}.mp4`;
      // Dónde está cada anillo y cuánto lleva relleno en cada clave (mismas
      // cuentas que el póster), para barrerlos en los intermedios.
      const withQr = posterHasQr(qrValue);
      const ringsAt = (frameIndex: number) =>
        posterRings(achievements, withQr, frameIndex / (VIDEO_KEYFRAMES - 1));
      const rings = {
        geometry: ringsAt(0).map((ring) => ({
          cx: ring.cx * VIDEO_SCALE,
          cy: ring.cy * VIDEO_SCALE,
          radius: DONUT_RADIUS * VIDEO_SCALE,
          halfStroke: (DONUT_STROKE / 2) * VIDEO_SCALE,
        })),
        fractions: Array.from({ length: VIDEO_KEYFRAMES }, (_, index) =>
          ringsAt(index).map((ring) => ring.fraction)
        ),
      };
      if (canCaptureFramesNatively) {
        await encodeCapturedToMp4(
          session,
          VIDEO_KEYFRAMES,
          outputUri,
          VIDEO_FPS,
          VIDEO_STEPS_PER_KEYFRAME,
          VIDEO_END_HOLD,
          rings
        );
      } else {
        await encodeKeyframesToMp4(
          keyPaths,
          outputUri,
          VIDEO_FPS,
          VIDEO_STEPS_PER_KEYFRAME,
          VIDEO_END_HOLD,
          rings
        );
      }
      if (!mountedRef.current) throw new VideoCancelled();

      // La hoja de compartir no se abre con la app en segundo plano.
      await waitUntilActive();
      if (!mountedRef.current) throw new VideoCancelled();
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(outputUri, {
          mimeType: 'video/mp4',
          dialogTitle: t('Compartir hitos de la semana'),
          UTI: 'public.mpeg-4',
        });
      }
    } catch (error) {
      if (!(error instanceof VideoCancelled) && mountedRef.current) {
        setToast({ message: t('No se pudo generar el vídeo.'), type: 'error' });
      }
    } finally {
      if (canCaptureFramesNatively) discardCapturedFrames(session);
      await Promise.all(keyPaths.map(discardPath));
      if (mountedRef.current) {
        setVideoPhase(null);
        setVideoProgress(0);
        reveal.setValue(1);
        setRevealValue(1);
      }
    }
  };

  // Botón principal: el vídeo si el codificador nativo está (toda APK Android
  // actual); si no (web o binario sin recompilar), la imagen. Con vídeo, la
  // imagen va en un botón secundario: sale al instante, sin esperar al vídeo.
  const handleShareMain = () => {
    if (isVideoEncoderAvailable) {
      void handleShareVideo();
    } else {
      handleShare();
    }
  };

  // Los dos pósters, memorizados: en cada clave del vídeo solo se repinta el
  // que se captura (la vista previa se queda completa), y en la animación de
  // la pantalla, solo la vista previa.
  const previewReveal = videoBusy ? 1 : revealValue;
  const captureReveal = videoBusy ? revealValue : 1;
  const userName = profile?.display_name ?? undefined;
  const avatarUri = profile?.avatar_url ?? undefined;
  const qrOpensRoutine = !!publicRoutineId;
  const posterDeps = [
    achievements,
    titleUri,
    userName,
    avatarUri,
    nameWidth,
    routineName,
    qrValue,
    qrOpensRoutine,
    qrTitleWidth,
    qrRoutineWidth,
  ];
  const renderPoster = (
    reveal: number,
    width: number,
    height: number,
    ref?: React.Ref<Svg>
  ) => (
    <AchievementPoster
      ref={ref}
      achievements={achievements}
      titleUri={titleUri}
      userName={userName}
      avatarUri={avatarUri}
      nameWidth={nameWidth}
      routineName={routineName}
      qrValue={qrValue}
      qrOpensRoutine={qrOpensRoutine}
      qrTitleWidth={qrTitleWidth}
      qrRoutineWidth={qrRoutineWidth}
      reveal={reveal}
      width={width}
      height={height}
    />
  );
  const previewPoster = useMemo(
    () => renderPoster(previewReveal, previewWidth, previewHeight, posterRef),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [...posterDeps, previewReveal, previewWidth, previewHeight]
  );
  const capturePoster = useMemo(
    () => renderPoster(captureReveal, captureWidth, captureHeight),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [...posterDeps, captureReveal, captureWidth, captureHeight]
  );

  const mainLabel =
    videoPhase === 'capture'
      ? t('Generando vídeo… {p}%', { p: Math.round(videoProgress * 100) })
      : videoPhase === 'encode'
      ? t('Montando vídeo…')
      : !isVideoEncoderAvailable && busy
      ? t('Generando…')
      : isVideoEncoderAvailable
      ? t('Compartir vídeo')
      : t('Compartir imagen');

  return (
    <View style={styles.container}>
      <StatusBar
        style={theme.statusBarStyle}
        translucent
        backgroundColor="transparent"
      />

      <StretchScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: topBarHeight + GLASS_TOP_BAR_CONTENT_GAP,
            paddingBottom: scrollBottomPadding,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.posterFrame,
            { width: previewWidth, height: previewHeight },
          ]}
        >
          {previewPoster}
        </View>

        <ShareButton
          onPress={handleShareMain}
          busy={busy || videoBusy}
          label={mainLabel}
        />
        {isVideoEncoderAvailable && (
          <Button
            title={busy ? t('Generando…') : t('Compartir imagen')}
            onPress={handleShare}
            variant="secondary"
            size="large"
            disabled={busy || videoBusy}
            style={styles.imageButton}
          />
        )}
      </StretchScrollView>

      <GlassTopBar
        title={t('Hitos de la semana')}
        icon="trophy-variant"
        subtitle={
          routineName
            ? `${t('Semana')} ${achievements.weekNumber} · ${routineName}`
            : `${t('Semana')} ${achievements.weekNumber}`
        }
        subtitleNumberOfLines={1}
        topInset={insets.top}
        onLayout={onTopBarLayout}
      />

      {/* Póster del vídeo, fuera de pantalla y a la resolución del vídeo.
        collapsable={false}: sin él Android puede aplanar esta vista y la
        captura no la encuentra. Sin opacidad 0: saldría así en la captura. */}
      {isVideoEncoderAvailable && (
        <View
          ref={videoFrameRef}
          collapsable={false}
          style={[
            styles.captureBox,
            { width: captureWidth, height: captureHeight },
          ]}
          pointerEvents="none"
        >
          {capturePoster}
        </View>
      )}

      {/* Medidor del nombre del póster (invisible y fuera de pantalla). */}
      {!!posterName && (
        <View style={styles.measureBox} pointerEvents="none">
          <Text
            style={styles.measureText}
            numberOfLines={1}
            allowFontScaling={false}
            onLayout={(e) => setNameWidth(e.nativeEvent.layout.width)}
          >
            {posterName}
          </Text>
        </View>
      )}
      {/* Medidores del pie con QR: la invitación (Anton) y la rutina. */}
      <View style={styles.measureBox} pointerEvents="none">
        <Text
          style={styles.measureQrTitle}
          numberOfLines={1}
          allowFontScaling={false}
          onLayout={(e) => setQrTitleWidth(e.nativeEvent.layout.width)}
        >
          {posterQrTitle(!!publicRoutineId)}
        </Text>
        {!!posterRoutineName(routineName) && (
          <Text
            style={styles.measureQrRoutine}
            numberOfLines={1}
            allowFontScaling={false}
            onLayout={(e) => setQrRoutineWidth(e.nativeEvent.layout.width)}
          >
            {posterRoutineName(routineName)}
          </Text>
        )}
      </View>

      <FloatingBackButton onPress={onBack} bottom={floatingBackBottom} />

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}
    </View>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    measureBox: {
      position: 'absolute',
      left: -5000,
      top: 0,
      width: 4000,
      opacity: 0,
      alignItems: 'flex-start',
    },
    captureBox: {
      position: 'absolute',
      left: -5000,
      top: 0,
    },
    measureText: {
      fontFamily: theme.fonts.display,
      fontSize: NAME_FONT,
      letterSpacing: NAME_LETTER_SPACING,
      includeFontPadding: false,
    },
    measureQrTitle: {
      fontFamily: theme.fonts.display,
      fontSize: QR_TITLE_FONT,
      letterSpacing: QR_TITLE_LETTER_SPACING,
      includeFontPadding: false,
    },
    measureQrRoutine: {
      fontSize: QR_ROUTINE_FONT,
      fontWeight: '700',
      includeFontPadding: false,
    },
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scroll: {
      flex: 1,
    },
    content: {
      paddingHorizontal: theme.spacing.md,
      alignItems: 'center',
      gap: 20,
    },
    posterFrame: {
      borderRadius: theme.borderRadius.lg,
      overflow: 'hidden',
      ...theme.shadow.card,
    },
    imageButton: {
      alignSelf: 'stretch',
      // El hueco de 20 del contenido ya separa del póster; pegado al
      // principal para que se lean como una pareja.
      marginTop: -8,
    },
    shareWrapper: {
      alignSelf: 'stretch',
      borderRadius: theme.borderRadius.lg,
      ...theme.shadow.card,
    },
    shareGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      borderRadius: theme.borderRadius.lg,
      paddingVertical: 18,
      paddingHorizontal: 24,
      overflow: 'hidden',
    },
    shareSheen: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: '55%',
    },
    shareText: {
      color: theme.colors.onGold,
      fontFamily: theme.fonts.display,
      fontSize: 22,
      letterSpacing: 0.5,
      lineHeight: 31,
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
