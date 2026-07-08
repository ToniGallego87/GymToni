import React, { useEffect, useRef, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  Animated as RNAnimated,
  Easing,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import type Svg from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AchievementPoster,
  POSTER_WIDTH,
  POSTER_HEIGHT,
} from '@components/AchievementPoster';
import {
  FloatingBackButton,
  FLOATING_BACK_BUTTON_HEIGHT,
  FLOATING_BACK_BUTTON_MARGIN,
  GlassTopBar,
  GLASS_TOP_BAR_BASE_HEIGHT,
  Toast,
  StretchScrollView,
} from '../../components';
import { WeekAchievements } from '@lib/achievements';
import { shareBase64Png } from '@lib/imageShare';
import { encodeFramesToMp4, isVideoEncoderAvailable } from '@lib/videoExport';
import { theme } from '@lib/theme';

interface WeekAchievementScreenProps {
  achievements: WeekAchievements;
  routineName?: string;
  onBack: () => void;
}

// Resolución y cadencia del vídeo exportado (16:9 vertical, aptos para H.264).
const VIDEO_WIDTH = 720;
const VIDEO_HEIGHT = 1280;
const VIDEO_FPS = 30; // 30 fps para que la animación se vea fluida (sin trompicones).
// Fotogramas ÚNICOS que se capturan (la animación 0→1). A 30 fps y sin repetir,
// cada uno es un fotograma real → movimiento suave.
const VIDEO_CAPTURE_FRAMES = 120; // 120 / 30fps = 4 s de animación.
const VIDEO_FRAME_REPEAT = 1;
const VIDEO_END_HOLD = 120; // 120 / 30fps = 4 s con el resultado completo → ~8 s totales.

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
      reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
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
        colors={['#F9D85A', '#F7CC3D', '#E0B226']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.shareGradient}
      >
        <LinearGradient
          colors={['rgba(255,255,255,0.32)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.shareSheen}
          pointerEvents="none"
        />
        <MaterialCommunityIcons
          name={busy ? 'progress-download' : 'share-variant'}
          size={22}
          color={theme.colors.darkGray}
        />
        <Text style={styles.shareText}>{label}</Text>
      </LinearGradient>
    </AnimatedPressable>
  );
}

export function WeekAchievementScreen({
  achievements,
  routineName,
  onBack,
}: WeekAchievementScreenProps) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const posterRef = useRef<Svg>(null);
  const [busy, setBusy] = useState(false);
  const [videoBusy, setVideoBusy] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
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

  const topBarHeight = GLASS_TOP_BAR_BASE_HEIGHT + insets.top;
  const floatingBackBottom =
    Math.max(insets.bottom, 10) + FLOATING_BACK_BUTTON_MARGIN;
  const scrollBottomPadding =
    floatingBackBottom + FLOATING_BACK_BUTTON_HEIGHT + 28;

  const previewWidth = Math.min(windowWidth - theme.spacing.md * 2, 460);
  const previewHeight = (previewWidth * POSTER_HEIGHT) / POSTER_WIDTH;

  const handleShare = () => {
    const node = posterRef.current;
    if (!node || busy) return;

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
                  message: 'No se pudo compartir la imagen.',
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
          setToast({ message: 'No se pudo generar la imagen.', type: 'error' });
        }
      });
    });
  };

  // Repinta el póster en un valor de animación y espera a que se confirme en pantalla.
  const renderAtReveal = (value: number) =>
    new Promise<void>((resolve) => {
      setRevealValue(value);
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });

  const capturePng = (w: number, h: number) =>
    new Promise<string>((resolve, reject) => {
      const node = posterRef.current;
      if (!node) return reject(new Error('Póster no disponible'));
      node.toDataURL((data: string) => resolve(data), { width: w, height: h });
    });

  // Captura la secuencia de la animación fotograma a fotograma, la codifica a MP4
  // con el módulo nativo y abre la hoja de compartir.
  const handleShareVideo = async () => {
    if (!posterRef.current || busy || videoBusy) return;

    setVideoBusy(true);
    setVideoProgress(0);
    animationRef.current?.stop();

    const framesDir = `${FileSystem.cacheDirectory}gymbro-frames/`;
    try {
      await FileSystem.makeDirectoryAsync(framesDir, {
        intermediates: true,
      }).catch(() => undefined);

      // Capturar los fotogramas únicos de la animación (reveal 0→1).
      const uniquePaths: string[] = [];
      for (let f = 0; f < VIDEO_CAPTURE_FRAMES; f++) {
        const value = f / (VIDEO_CAPTURE_FRAMES - 1);
        await renderAtReveal(value);
        const base64 = await capturePng(VIDEO_WIDTH, VIDEO_HEIGHT);
        const framePath = `${framesDir}f${String(f).padStart(3, '0')}.png`;
        await FileSystem.writeAsStringAsync(framePath, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        uniquePaths.push(framePath);
        setVideoProgress((f + 1) / VIDEO_CAPTURE_FRAMES);
      }

      // Expandir: repetir cada fotograma (ralentiza) + mantener el final estático.
      const framePaths: string[] = [];
      uniquePaths.forEach((path) => {
        for (let r = 0; r < VIDEO_FRAME_REPEAT; r++) framePaths.push(path);
      });
      const lastPath = uniquePaths[uniquePaths.length - 1];
      for (let h = 0; h < VIDEO_END_HOLD; h++) framePaths.push(lastPath);

      const outputUri = `${FileSystem.cacheDirectory}gymbro-semana-${achievements.weekNumber}.mp4`;
      await encodeFramesToMp4(framePaths, outputUri, VIDEO_FPS);

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(outputUri, {
          mimeType: 'video/mp4',
          dialogTitle: 'Compartir logros de la semana',
          UTI: 'public.mpeg-4',
        });
      }

      await FileSystem.deleteAsync(framesDir, { idempotent: true }).catch(
        () => undefined
      );
    } catch (error) {
      setToast({ message: 'No se pudo generar el vídeo.', type: 'error' });
    } finally {
      setVideoBusy(false);
      setVideoProgress(0);
      reveal.setValue(1);
      setRevealValue(1);
    }
  };

  // Botón principal: comparte el vídeo si el codificador nativo está disponible;
  // si no (web o binario sin recompilar), comparte la imagen PNG estática.
  const handleShareResults = () => {
    if (isVideoEncoderAvailable) {
      void handleShareVideo();
    } else {
      handleShare();
    }
  };

  const shareLabel = videoBusy
    ? `Generando vídeo… ${Math.round(videoProgress * 100)}%`
    : busy
    ? 'Generando…'
    : 'Compartir resultados';

  return (
    <View style={styles.container}>
      <StatusBar style="light" translucent backgroundColor="transparent" />

      <StretchScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: topBarHeight + 28,
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
          <AchievementPoster
            ref={posterRef}
            achievements={achievements}
            routineName={routineName}
            titleUri={titleUri}
            reveal={revealValue}
            width={previewWidth}
            height={previewHeight}
          />
        </View>

        <ShareButton
          onPress={handleShareResults}
          busy={busy || videoBusy}
          label={shareLabel}
        />
      </StretchScrollView>

      <GlassTopBar
        title="Logros"
        titleElement={
          <View style={styles.topBarTitleRow}>
            <MaterialCommunityIcons
              name="trophy-variant"
              size={18}
              color={theme.colors.text}
            />
            <Text style={styles.topBarTitleText}>Logros de la semana</Text>
          </View>
        }
        subtitle="Comparte tus resultados en redes"
        topInset={insets.top}
      />

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

const styles = StyleSheet.create({
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
    color: theme.colors.darkGray,
    fontFamily: theme.fonts.display,
    fontSize: 22,
    letterSpacing: 0.5,
    lineHeight: 26,
  },
  topBarTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  topBarTitleText: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.text,
    lineHeight: 24,
  },
});
