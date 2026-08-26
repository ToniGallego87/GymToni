import { subscribeTheme } from '@lib/themeStore';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { theme } from '@lib/theme';
import { t } from '@lib/i18n';
import {
  GLASS_BACK_BUTTON_BG,
  GLASS_BACK_BUTTON_BORDER,
  GLASS_BACK_BUTTON_OVERLAY,
  GLASS_BACK_BUTTON_TEXT,
  GLASS_BLUR_INTENSITY,
} from './glassTokens';

const FrostedBlur = BlurView as unknown as React.ComponentType<any>;

export const FLOATING_BACK_BUTTON_HEIGHT = 58;
export const FLOATING_BACK_BUTTON_MARGIN = 16;
// Suelo del inset inferior: en móviles sin barra de gestos `insets.bottom` es 0
// y el botón quedaría pegado al canto.
export const FLOATING_BACK_BUTTON_MIN_INSET = 10;
// Aire entre el final del scroll y el botón, para que el último elemento de la
// lista no quede debajo del cristal.
export const FLOATING_BACK_BUTTON_SCROLL_EXTRA_PADDING = 28;

/**
 * Posición del botón "Volver" y padding inferior que necesita el scroll de la
 * pantalla que lo lleva. Espejo de `getFloatingPrimaryNavMetrics` (barra de
 * pestañas) para las pantallas que NO son pestaña: antes cada una repetía la
 * misma fórmula a mano.
 */
export function getFloatingBackButtonMetrics(bottomInset: number) {
  const bottom =
    Math.max(bottomInset, FLOATING_BACK_BUTTON_MIN_INSET) +
    FLOATING_BACK_BUTTON_MARGIN;
  const scrollBottomPadding =
    bottom +
    FLOATING_BACK_BUTTON_HEIGHT +
    FLOATING_BACK_BUTTON_SCROLL_EXTRA_PADDING;

  return { bottom, scrollBottomPadding };
}

interface FloatingBackButtonProps {
  onPress: () => void;
  bottom: number;
  label?: string;
}

export function FloatingBackButton({
  onPress,
  bottom,
  label = `← ${t('Volver')}`,
}: FloatingBackButtonProps) {
  // En ambos temas el botón es cristal oscuro TRANSLÚCIDO con texto claro: el
  // blur de tinte oscuro sobre el fondo claro deja un ahumado que se lee sin
  // opacar el contenido de detrás (antes en día era una píldora oscura sólida).
  // La variante de cada tema vive en los tokens `GLASS_BACK_BUTTON_*`.
  return (
    <Pressable
      style={[
        styles.floatingBackButton,
        {
          left: FLOATING_BACK_BUTTON_MARGIN,
          right: FLOATING_BACK_BUTTON_MARGIN,
          bottom,
          height: FLOATING_BACK_BUTTON_HEIGHT,
        },
      ]}
      onPress={onPress}
    >
      <FrostedBlur
        tint="dark"
        intensity={GLASS_BLUR_INTENSITY}
        experimentalBlurMethod="dimezisBlurView"
        style={styles.floatingBackBlur}
      />
      <View style={styles.floatingBackGlassOverlay} />
      <Text style={styles.backButtonText}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    floatingBackButton: {
      position: 'absolute',
      zIndex: 30,
      borderRadius: 22,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: GLASS_BACK_BUTTON_BG,
      borderWidth: 1,
      borderColor: GLASS_BACK_BUTTON_BORDER,
      overflow: 'hidden',
      ...theme.shadow.card,
    },
    floatingBackBlur: {
      ...StyleSheet.absoluteFillObject,
    },
    floatingBackGlassOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: GLASS_BACK_BUTTON_OVERLAY,
      pointerEvents: 'none',
    },
    backButtonText: {
      color: GLASS_BACK_BUTTON_TEXT,
      fontWeight: '800',
      fontSize: 16,
      lineHeight: 20,
      letterSpacing: 0.2,
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
