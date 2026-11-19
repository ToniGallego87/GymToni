import React from 'react';
import {
  Platform,
  processColor,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { theme } from '@lib/theme';

interface GlassBlurProps {
  /** Tinte sobre el desenfoque (rgba); también es el fondo de respaldo. */
  tint: string;
  style?: StyleProp<ViewStyle>;
}

type NativeProps = {
  tintColor: number | null | undefined;
  reduction: number;
  blurRadius: number;
  style?: StyleProp<ViewStyle>;
};

// Factor de reducción de la captura y radio (en píxeles reducidos) del
// desenfoque. 12 deja un bitmap de ~100×220 en un 1080×2400: barato de dibujar
// y de desenfocar; el radio 2 en dos pasadas equivale a ~30 px reales.
const REDUCTION = 12;
const RADIUS = 2;

/**
 * Cristal esmerilado de las barras (superior, inferior, Volver, descanso).
 *
 * Módulo nativo propio (modules/glass-blur): UNA captura reducida de la
 * pantalla por frame, compartida por todas las instancias. El `BlurView` de
 * expo-blur redibujaba la jerarquía entera por instancia y por frame (~7 ms
 * cada barra en garnet, medido 2026-09-22): con cuatro barras la app iba a
 * ~35 fps. Ese módulo es solo Android.
 *
 * En iOS, el `BlurView` de expo-blur: allí es el desenfoque nativo del sistema
 * (`UIVisualEffectView`), que compone la GPU sin redibujar nada, así que es
 * barato; el tinte va encima, como en Android. En Android expo-blur no entra
 * en el binario (`expo.autolinking.android.exclude` en package.json).
 *
 * Sin ninguno de los dos (o en un binario antiguo sin el módulo) cae a un fondo
 * translúcido con el mismo tinte.
 */
let Native: React.ComponentType<NativeProps> | null = null;
type BlurViewType = typeof import('expo-blur').BlurView;
let IOSBlur: BlurViewType | null = null;
try {
  if (Platform.OS === 'android') {
    // Carga perezosa: requireNativeViewManager lanza si el binario no lo trae.
    const core = require('expo-modules-core');
    Native = core.requireNativeViewManager('GlassBlur');
  } else if (Platform.OS === 'ios') {
    IOSBlur = (require('expo-blur') as typeof import('expo-blur')).BlurView;
  }
} catch {
  Native = null;
  IOSBlur = null;
}

// Fuerza del desenfoque de iOS (0-100). El tinte de encima pone el color.
const IOS_BLUR_INTENSITY = 60;

export function GlassBlur({ tint, style }: GlassBlurProps) {
  if (IOSBlur) {
    return (
      <IOSBlur
        style={style}
        intensity={IOS_BLUR_INTENSITY}
        tint={theme.mode === 'light' ? 'light' : 'dark'}
        pointerEvents="none"
      >
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: tint }]}
          pointerEvents="none"
        />
      </IOSBlur>
    );
  }
  if (!Native) {
    return (
      <View style={[style, { backgroundColor: tint }]} pointerEvents="none" />
    );
  }
  return (
    <Native
      style={style}
      tintColor={processColor(tint) as number}
      reduction={REDUCTION}
      blurRadius={RADIUS}
      // @ts-expect-error: prop de View que el wrapper nativo acepta.
      pointerEvents="none"
    />
  );
}
