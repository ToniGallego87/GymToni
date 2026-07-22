import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { getModeBackgroundColor, setThemeMode, theme } from '@lib/theme';
import {
  subscribeThemeReveal,
  ThemeRevealRequest,
} from '@lib/themeTransition';

// Overlay del cambio de tema. Un círculo de color sólido (View con transform:
// scale, acelerado por GPU → 60fps) recolorea la pantalla al pasar:
//
//  - noche → día (destino claro): el círculo del color de destino CRECE desde el
//    punto pulsado sobre la vista actual y, al llenarla, se aplica el tema y el
//    círculo se desvanece dejando ver la UI nueva.
//  - día → noche (destino oscuro): se aplica el tema ya (la noche queda debajo) y
//    el círculo del color SALIENTE, que cubre toda la pantalla, se ENCOGE de fuera
//    adentro hasta el punto pulsado, revelando la noche desde los bordes.
//
// Se monta en la raíz (app/App.tsx) para cubrir también las barras flotantes y
// bloquea los toques mientras dura.
const DURATION = 620;
const FADE_DURATION = 200;

interface RevealState extends ThemeRevealRequest {
  // true = noche→día (crece); false = día→noche (encoge).
  expanding: boolean;
  // Color sólido del círculo: el de destino al crecer, el saliente al encoger.
  discColor: string;
}

export function ThemeRevealOverlay() {
  const { width, height } = useWindowDimensions();
  const [request, setRequest] = useState<RevealState | null>(null);
  const scale = useSharedValue(0);
  const opacity = useSharedValue(1);
  // Evita solapar dos revelados si se pulsa muy rápido.
  const animating = useRef(false);

  useEffect(
    () =>
      subscribeThemeReveal((next) => {
        if (animating.current) return;
        animating.current = true;
        const expanding = next.mode === 'light';
        const outgoingBg = theme.colors.background;
        // Al encoger, el tema se aplica YA (la noche queda debajo) y el círculo
        // saliente se retira revelándola. Al crecer, el tema se aplica al final.
        if (!expanding) setThemeMode(next.mode);
        setRequest({
          ...next,
          expanding,
          discColor: expanding ? getModeBackgroundColor(next.mode) : outgoingBg,
        });
      }),
    []
  );

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

  // Al terminar de crecer: aplicar el tema (la UI nueva ya está debajo) y
  // desvanecer el círculo para revelarla suavemente.
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

  useEffect(() => {
    if (!request) return;
    opacity.value = 1;
    if (request.expanding) {
      scale.value = 0;
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
        0,
        { duration: DURATION, easing: Easing.inOut(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(endReveal)();
        }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  const circleStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  if (!request || !geometry) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="auto">
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: geometry.left,
            top: geometry.top,
            width: geometry.size,
            height: geometry.size,
            borderRadius: geometry.radius,
            backgroundColor: request.discColor,
          },
          circleStyle,
        ]}
      />
    </View>
  );
}
