import { subscribeTheme } from '@lib/themeStore';
import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '@lib/theme';

interface AvatarProps {
  /** Foto del perfil; si falta se pinta el marcador. */
  uri?: string | null;
  /** Diámetro en px. 40 en listas, 52-60 en cabeceras de perfil. */
  size?: number;
}

/**
 * Foto de perfil de un usuario (o su marcador si no tiene).
 *
 * Fuente ÚNICA: antes cada pantalla social se pintaba el suyo y el mismo usuario
 * salía distinto según dónde lo miraras (gris en el tablón, con relleno dorado
 * en su perfil, de otro tamaño en las listas de seguir). Aquí solo cambia el
 * diámetro.
 */
export function Avatar({ uri, size = 40 }: AvatarProps) {
  const round = { width: size, height: size, borderRadius: size / 2 };

  if (uri) {
    return <Image source={{ uri }} style={[styles.photo, round]} />;
  }
  return (
    <View style={[styles.placeholder, round]}>
      <MaterialCommunityIcons
        name="account"
        size={Math.round(size * 0.6)}
        color={theme.colors.textMuted}
      />
    </View>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    photo: { backgroundColor: theme.colors.surfaceAlt },
    placeholder: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surfaceAlt,
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
