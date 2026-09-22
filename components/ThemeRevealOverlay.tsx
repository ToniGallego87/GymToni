import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { captureRef } from 'react-native-view-shot';
import { getModeBackgroundColor, setThemeMode, theme } from '@lib/theme';
import { subscribeThemeReveal, ThemeRevealRequest } from '@lib/themeTransition';

// Overlay del cambio de tema. Un círculo (View con transform: scale, acelerado
// por GPU → 60fps) que enseña la pantalla en la OTRA piel al pasar:
//
//  - noche → día (destino claro): se captura la vista actual y se deja tapando
//    la pantalla (idéntica, nadie lo nota); debajo se aplica el tema y se
//    captura la vista ya en claro; ese segundo pantallazo CRECE en un círculo
//    desde el punto pulsado sobre el primero. Al llenar la pantalla se quita
//    todo: debajo está la UI real, igual que la captura.
//  - día → noche (destino oscuro): se captura la vista actual, se aplica el
//    tema (la noche queda debajo, viva) y la captura saliente, recortada en
//    círculo, se ENCOGE hasta el punto pulsado revelando la noche desde los
//    bordes.
//
// El truco para que el pantallazo no se escale con el círculo: el disco escala
// `s` sobre su centro (el punto pulsado) y un hijo del mismo tamaño y centro
// escala `1/s`; la imagen dentro queda clavada a la pantalla y solo se mueve
// el recorte. Si la captura falla (sin permiso, vista sin medir…), se cae al
// disco de color sólido de siempre.
//
// Se monta en la raíz (app/App.tsx) sobre `captureTarget`, la vista con toda
// la app menos este overlay, y bloquea los toques mientras dura.
const DURATION = 620;
const FADE_DURATION = 200;
// Escala mínima del disco: la inversa (1/s) del hijo no puede irse a infinito.
const MIN_SCALE = 0.004;

interface RevealState extends ThemeRevealRequest {
  // true = noche→día (crece); false = día→noche (encoge).
  expanding: boolean;
  // Color sólido del círculo (respaldo): el de destino al crecer, el saliente
  // al encoger.
  discColor: string;
  // Pantallazo que tapa toda la pantalla mientras se prepara el revelado (la
  // piel saliente). Solo al crecer; al encoger la piel nueva vive debajo.
  coverUri: string | null;
  // Pantallazo dentro del disco: la piel de destino al crecer, la saliente al
  // encoger. `null` → disco de color.
  discUri: string | null;
  // Listo para animar (las imágenes ya están decodificadas).
  ready: boolean;
}

interface ThemeRevealOverlayProps {
  /** La vista a capturar: toda la app menos este overlay. */
  captureTarget: React.RefObject<View>;
}

async function snapshot(target: React.RefObject<View>): Promise<string | null> {
  if (!target.current) return null;
  try {
    return await captureRef(target, {
      format: 'jpg',
      quality: 0.9,
      result: 'tmpfile',
    });
  } catch {
    return null;
  }
}

// Espera a que React y la vista nativa hayan pintado el tema nuevo antes de
// capturarlo: dos frames y un respiro para el árbol entero (cinco pestañas).
function afterPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setTimeout(resolve, 40));
    });
  });
}

export function ThemeRevealOverlay({ captureTarget }: ThemeRevealOverlayProps) {
  const { width, height } = useWindowDimensions();
  const [request, setRequest] = useState<RevealState | null>(null);
  const scale = useSharedValue(0);
  const opacity = useSharedValue(1);
  // Evita solapar dos revelados si se pulsa muy rápido.
  const animating = useRef(false);
  // Cuántas imágenes faltan por decodificar antes de arrancar.
  const pendingLoads = useRef(0);

  useEffect(
    () =>
      subscribeThemeReveal((next) => {
        if (animating.current) return;
        animating.current = true;
        const expanding = next.mode === 'light';
        const outgoingBg = theme.colors.background;
        const discColor = expanding
          ? getModeBackgroundColor(next.mode)
          : outgoingBg;
        // Postura inicial del disco ANTES de pintar nada: invisible al crecer
        // y cubriendo la pantalla al encoger (si no, al encoger se vería la
        // noche un par de frames antes de que el disco la tapara).
        scale.value = expanding ? MIN_SCALE : 1;
        opacity.value = 1;

        void (async () => {
          const outgoing = await snapshot(captureTarget);
          if (!outgoing) {
            // Respaldo: disco de color, como antes.
            if (!expanding) setThemeMode(next.mode);
            setRequest({
              ...next,
              expanding,
              discColor,
              coverUri: null,
              discUri: null,
              ready: true,
            });
            return;
          }
          if (expanding) {
            // Tapar con la piel saliente; cuando esté pintada, cambiar el tema
            // debajo y capturar la piel nueva (segundo paso, en `onLoad`).
            pendingLoads.current = 1;
            setRequest({
              ...next,
              expanding,
              discColor,
              coverUri: outgoing,
              discUri: null,
              ready: false,
            });
          } else {
            // La noche se aplica ya (queda viva debajo) y el disco lleva el
            // pantallazo saliente.
            setThemeMode(next.mode);
            pendingLoads.current = 1;
            setRequest({
              ...next,
              expanding,
              discColor,
              coverUri: null,
              discUri: outgoing,
              ready: false,
            });
          }
        })();
      }),
    [captureTarget]
  );

  // Segundo paso del crecimiento: con la tapa ya pintada, aplicar el tema
  // debajo y capturar la piel nueva para meterla en el disco.
  const handleCoverLoaded = () => {
    if (!request || !request.expanding || request.discUri) return;
    void (async () => {
      setThemeMode(request.mode);
      await afterPaint();
      const incoming = await snapshot(captureTarget);
      pendingLoads.current = incoming ? 1 : 0;
      setRequest((r) =>
        r
          ? {
              ...r,
              discUri: incoming,
              // Sin captura nueva, el disco de color de destino crece sobre
              // la tapa: el respaldo de siempre.
              ready: !incoming,
            }
          : r
      );
    })();
  };

  const handleDiscLoaded = () => {
    pendingLoads.current -= 1;
    if (pendingLoads.current <= 0) {
      setRequest((r) => (r && !r.ready ? { ...r, ready: true } : r));
    }
  };

  // Círculo centrado en (x, y) con radio suficiente para alcanzar la esquina más
  // lejana (con margen para absorber pequeñas diferencias de medida).
  const geometry = useMemo(() => {
    if (!request) return null;
    const { x, y } = request;
    const corners = [
      [0, 0],
      [width, 0],
      [0, height],
      [width, height],
    ];
    const reach = Math.max(
      ...corners.map(([cx, cy]) => Math.hypot(cx - x, cy - y))
    );
    const radius = reach * 1.15 + 8;
    return { radius, left: x - radius, top: y - radius, size: radius * 2 };
  }, [request, width, height]);

  const endReveal = () => {
    animating.current = false;
    setRequest(null);
  };

  // Al terminar de crecer: aplicar el tema si aún no está (respaldo sin
  // capturas) y desvanecer el círculo para dejar ver la UI real.
  const applyThenFade = () => {
    if (request) setThemeMode(request.mode);
    opacity.value = withTiming(
      0,
      { duration: FADE_DURATION, easing: Easing.out(Easing.quad) },
      (finished) => {
        if (finished) runOnJS(endReveal)();
      }
    );
  };

  const ready = !!request?.ready;
  const expanding = !!request?.expanding;
  useEffect(() => {
    if (!request || !ready) return;
    opacity.value = 1;
    if (expanding) {
      scale.value = MIN_SCALE;
      scale.value = withTiming(
        1,
        { duration: DURATION, easing: Easing.inOut(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(applyThenFade)();
        }
      );
    } else {
      scale.value = 1;
      scale.value = withTiming(
        MIN_SCALE,
        { duration: DURATION, easing: Easing.inOut(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(endReveal)();
        }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, expanding]);

  const discStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: Math.max(scale.value, MIN_SCALE) }],
  }));
  // El hijo deshace la escala del disco: la imagen queda fija en pantalla.
  const innerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 / Math.max(scale.value, MIN_SCALE) }],
  }));

  if (!request || !geometry) return null;

  const screenImage = (uri: string, onLoad?: () => void) => (
    <Image
      source={{ uri }}
      style={{
        position: 'absolute',
        // Alineada con la pantalla: el disco empieza en (left, top).
        left: -geometry.left,
        top: -geometry.top,
        width,
        height,
      }}
      onLoad={onLoad}
      onError={onLoad}
      fadeDuration={0}
    />
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="auto">
      {/* Tapa con la piel saliente (solo al crecer), bajo el disco. */}
      {!!request.coverUri && (
        <Image
          source={{ uri: request.coverUri }}
          style={StyleSheet.absoluteFill}
          onLoad={handleCoverLoaded}
          onError={handleCoverLoaded}
          fadeDuration={0}
        />
      )}
      {/* El disco: mientras no esté listo, al crecer no se ve (escala mínima)
          y al encoger cubre la pantalla entera (escala 1), que es justo lo que
          hace falta en cada caso. */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: geometry.left,
            top: geometry.top,
            width: geometry.size,
            height: geometry.size,
            borderRadius: geometry.radius,
            overflow: 'hidden',
            backgroundColor: request.discUri
              ? 'transparent'
              : request.discColor,
          },
          discStyle,
        ]}
      >
        {!!request.discUri && (
          <Animated.View
            style={[
              { width: geometry.size, height: geometry.size },
              innerStyle,
            ]}
          >
            {screenImage(request.discUri, handleDiscLoaded)}
          </Animated.View>
        )}
      </Animated.View>
    </View>
  );
}
