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
  /**
   * Aún no se sabe si tiene foto: círculo neutro en vez del marcador de
   * persona. Sin esto, mientras baja el perfil se enseña el marcador —que
   * significa "no tiene foto"— y la foto aparece después de golpe.
   */
  loading?: boolean;
}

/**
 * Foto de perfil de un usuario (o su marcador si no tiene).
 *
 * Fuente ÚNICA: antes cada pantalla social se pintaba el suyo y el mismo usuario
 * salía distinto según dónde lo miraras (gris en el tablón, con relleno dorado
 * en su perfil, de otro tamaño en las listas de seguir). Aquí solo cambia el
 * diámetro.
 */
export function Avatar({ uri, size = 40, loading }: AvatarProps) {
  const round = { width: size, height: size, borderRadius: size / 2 };
  // URL que no carga (la foto anterior se borra al cambiarla, y una caché
  // social o la copia del perfil en otro móvil pueden traer la vieja): marcador
  // en vez de un círculo vacío. Se recuerda por URL para que una nueva vuelva a
  // intentarse.
  const [failedUri, setFailedUri] = React.useState<string | null>(null);

  if (loading && !uri) {
    return <View style={[styles.loading, round]} />;
  }
  if (uri && uri !== failedUri) {
    return (
      <Image
        source={{ uri }}
        style={[styles.photo, round]}
        onError={() => setFailedUri(uri)}
      />
    );
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
    loading: { backgroundColor: theme.colors.border },
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
