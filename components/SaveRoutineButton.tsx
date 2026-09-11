import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '@lib/theme';
import { subscribeTheme } from '@lib/themeStore';
import { t } from '@lib/i18n';

interface SaveRoutineButtonProps {
  /** Ya está en tus rutinas (enlazada o copiada de ella). */
  saved: boolean;
  /** Guardando ahora mismo (baja el plan de la nube). */
  busy?: boolean;
  onPress: () => void;
  style?: ViewStyle;
  /** Con rótulo junto al icono (para donde sobra ancho, p. ej. la consulta). */
  withLabel?: boolean;
}

/**
 * Guardar una rutina de la comunidad, con el mismo peso visual que el "me
 * gusta": una píldora con su icono, no un CTA a fila completa. Es una acción
 * que se pulsa una vez por rutina; ocupar un renglón entero de cada tarjeta la
 * hacía parecer lo principal del tablón cuando lo principal es la rutina.
 *
 * Guardado = marcador relleno en oro, igual que el corazón lleno del like.
 */
export function SaveRoutineButton({
  saved,
  busy = false,
  onPress,
  style,
  withLabel = false,
}: SaveRoutineButtonProps) {
  const label = saved
    ? t('En tus rutinas')
    : busy
    ? t('Añadiendo…')
    : t('Añadir a mis rutinas');

  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        saved && styles.buttonSaved,
        pressed && styles.pressed,
        style,
      ]}
      onPress={onPress}
      disabled={busy || saved}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityState={{ selected: saved, disabled: busy || saved }}
      accessibilityLabel={label}
    >
      <MaterialCommunityIcons
        name={saved ? 'bookmark' : 'bookmark-plus-outline'}
        size={20}
        color={saved ? theme.colors.primary : theme.colors.textSecondary}
      />
      {withLabel && (
        <Text style={[styles.label, saved && styles.labelSaved]}>{label}</Text>
      )}
    </Pressable>
  );
}

/**
 * Marca "de {autor}" para una rutina que no es tuya.
 *
 * Si se sabe quién es el autor (`ownerId`) la marca LLEVA a su perfil, igual
 * que el nombre del autor en el tablón y en la consulta pública: dar el crédito
 * sin dar el camino dejaba la firma en un callejón sin salida. Sin `ownerId`
 * (rutina vieja guardada antes de que se guardase el id) sigue siendo texto.
 */
export function RoutineOriginPill({
  author,
  copied = false,
  ownerId,
  onOpenProfile,
  style,
}: {
  author?: string;
  copied?: boolean;
  /** Autor de la rutina; sin él la marca no puede llevar a ningún sitio. */
  ownerId?: string;
  onOpenProfile?: (userId: string, name: string) => void;
  style?: ViewStyle;
}) {
  const name = author?.trim() || t('Anónimo');
  const label = copied
    ? t('Copiada de {name}', { name })
    : t('De {name}', { name });
  const canOpen = !!ownerId && !!onOpenProfile;

  const content = (
    <>
      <MaterialCommunityIcons
        name={copied ? 'content-copy' : 'account-arrow-right-outline'}
        size={13}
        color={theme.colors.textSecondary}
      />
      <Text style={styles.originText} numberOfLines={1}>
        {label}
      </Text>
      {canOpen && (
        <MaterialCommunityIcons
          name="chevron-right"
          size={15}
          color={theme.colors.textSecondary}
        />
      )}
    </>
  );

  if (!canOpen) {
    return <View style={[styles.originPill, style]}>{content}</View>;
  }

  return (
    <Pressable
      style={({ pressed }) => [
        styles.originPill,
        pressed && styles.pressed,
        style,
      ]}
      onPress={() => onOpenProfile?.(ownerId as string, name)}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={t('Ver perfil de {name}', { name })}
    >
      {content}
    </Pressable>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: theme.borderRadius.pill,
      backgroundColor: theme.colors.surfaceAlt,
    },
    buttonSaved: { backgroundColor: theme.colors.primaryMuted },
    label: {
      color: theme.colors.textSecondary,
      fontSize: 13,
      fontWeight: '800',
    },
    labelSaved: { color: theme.colors.primary },
    pressed: { opacity: 0.7 },
    originPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      alignSelf: 'flex-start',
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: theme.borderRadius.pill,
      backgroundColor: theme.colors.surfaceAlt,
    },
    originText: {
      color: theme.colors.textSecondary,
      fontSize: 12,
      fontWeight: '700',
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
