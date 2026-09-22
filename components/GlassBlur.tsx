import React from 'react';
import {
  Platform,
  processColor,
  StyleProp,
  View,
  ViewStyle,
} from 'react-native';

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
 * ~35 fps. Solo Android; en otro sitio (o en un binario antiguo sin el módulo)
 * cae a un fondo translúcido con el mismo tinte.
 */
let Native: React.ComponentType<NativeProps> | null = null;
try {
  if (Platform.OS === 'android') {
    // Carga perezosa: requireNativeViewManager lanza si el binario no lo trae.
    const core = require('expo-modules-core');
    Native = core.requireNativeViewManager('GlassBlur');
  }
} catch {
  Native = null;
}

export function GlassBlur({ tint, style }: GlassBlurProps) {
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
