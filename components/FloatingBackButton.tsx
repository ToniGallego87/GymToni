import { subscribeTheme } from '@lib/themeStore';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '@lib/theme';
import { t } from '@lib/i18n';
import {
  GLASS_BACK_BUTTON_BG,
  GLASS_BACK_BUTTON_BORDER,
  GLASS_BACK_BUTTON_OVERLAY,
  GLASS_BACK_BUTTON_TEXT,
} from './glassTokens';
import { GlassBlur } from './GlassBlur';
import {
  FLOATING_GLASS_BAR_HEIGHT,
  FLOATING_GLASS_BAR_MARGIN,
  getFloatingPrimaryNavMetrics,
} from './FloatingGlassBar';

// Mismo hueco exacto que la barra de pestañas (alto, márgenes y distancia al
// canto): al ir de una pestaña a una subpantalla, "Volver" ocupa el sitio de
// la barra sin saltar. Antes era más bajo (58), con otro margen y otro suelo
// de inset, y quedaba a distinta altura.
export const FLOATING_BACK_BUTTON_HEIGHT = FLOATING_GLASS_BAR_HEIGHT;
export const FLOATING_BACK_BUTTON_MARGIN = FLOATING_GLASS_BAR_MARGIN;

/**
 * Posición del botón "Volver" y padding inferior que necesita el scroll de la
 * pantalla que lo lleva. Son las de la barra de pestañas
 * (`getFloatingPrimaryNavMetrics`) para las pantallas que NO son pestaña.
 */
export function getFloatingBackButtonMetrics(bottomInset: number) {
  return getFloatingPrimaryNavMetrics(bottomInset);
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
      <GlassBlur tint={GLASS_BACK_BUTTON_BG} style={styles.floatingBackBlur} />
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
      borderRadius: 24,
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
