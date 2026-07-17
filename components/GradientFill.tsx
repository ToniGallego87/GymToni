import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '@lib/theme';

interface GradientFillProps {
  // Color de acento (estado de mejora). Se aplica como tinte muy sutil.
  accent?: string;
}

// Capa de fondo absoluta para tarjetas secundarias: gradiente oscuro diagonal
// + tinte de acento + brillo superior (sheen). Coherente con HeroCard pero
// discreta. El contenedor padre debe tener `overflow: 'hidden'` y su borderRadius.
export function GradientFill({ accent }: GradientFillProps) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={[
          theme.colors.surfaceAlt,
          theme.colors.surface,
          theme.colors.backgroundElevated,
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {!!accent && (
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: accent, opacity: 0.07 },
          ]}
        />
      )}
      <LinearGradient
        colors={theme.gradients.cardSheen}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.sheen}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '55%',
  },
});
