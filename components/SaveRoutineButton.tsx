import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '@lib/theme';
import { subscribeTheme } from '@lib/themeStore';
import { t } from '@lib/i18n';
import { AppModal } from './AppModal';
import { Button } from './Button';

interface SaveRoutineButtonProps {
  /** Ya está en tus rutinas (enlazada o copiada de ella). */
  saved: boolean;
  /** Guardando ahora mismo (baja el plan de la nube). */
  busy?: boolean;
  onPress: () => void;
  /**
   * Quitarla de tus rutinas cuando ya está guardada. Sin esto el botón guardado
   * es solo un estado (deshabilitado), como en el tablón.
   */
  onUnsave?: () => void;
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
  onUnsave,
  style,
  withLabel = false,
}: SaveRoutineButtonProps) {
  const canUnsave = saved && !!onUnsave;
  const label = canUnsave
    ? t('Quitar de mis rutinas')
    : saved
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
      onPress={canUnsave ? onUnsave : onPress}
      disabled={busy || (saved && !canUnsave)}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityState={{
        selected: saved,
        disabled: busy || (saved && !canUnsave),
      }}
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
 * "Me gusta" de una rutina de la comunidad: la píldora hermana del marcador
 * (mismo tamaño y mismo fondo), corazón lleno en rojo cuando es tuyo y el
 * recuento al lado. La usan la tarjeta del tablón y la ficha pública; antes
 * cada una montaba la suya con los mismos estilos.
 */
export function LikeButton({
  likes,
  liked,
  onPress,
  style,
}: {
  likes: number;
  liked: boolean;
  onPress: () => void;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.button, pressed && styles.pressed, style]}
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityState={{ selected: liked }}
      accessibilityLabel={t('Me gusta')}
    >
      <MaterialCommunityIcons
        name={liked ? 'heart' : 'heart-outline'}
        size={20}
        color={liked ? theme.colors.error : theme.colors.textSecondary}
      />
      <Text style={styles.likeCount}>{likes}</Text>
    </Pressable>
  );
}

/**
 * Dato de una rutina (series, comentarios, días) con la misma burbuja que el
 * "me gusta": mismo icono + número, mismo fondo, para que el pie de la tarjeta
 * se lea como una sola fila de píldoras y no como texto suelto junto a botones.
 *
 * Con `explanation` la burbuja se puede tocar y abre un `AppModal` corto que
 * dice qué mide ("Series planificadas en toda la semana"): un icono y una
 * cifra sin explicar son solo un número, igual que le pasaba a la píldora de
 * intensidad.
 *
 * Sin `explanation` (comentarios) es un DATO, y se pinta plano: sin la píldora
 * de fondo. En el pie de la tarjeta la regla queda a la vista — lo que tiene
 * fondo de píldora se pulsa (series, guardar, me gusta) y lo plano solo se lee.
 * Antes los dos se pintaban idénticos y uno de los dos no hacía nada al tocarlo.
 */
export function StatBubble({
  icon,
  value,
  label,
  explanation,
  style,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  value: number;
  /** Para el lector de pantalla: "42 series", "3 comentarios". */
  label: string;
  /** Qué significa el dato; con esto la burbuja se vuelve pulsable. */
  explanation?: { title: string; message: string };
  style?: ViewStyle;
}) {
  const [open, setOpen] = useState(false);
  const content = (
    <>
      <MaterialCommunityIcons
        name={icon}
        size={20}
        color={theme.colors.textSecondary}
      />
      <Text style={styles.likeCount}>{value}</Text>
    </>
  );

  if (!explanation) {
    return (
      <View
        style={[styles.button, styles.buttonFlat, style]}
        accessible
        accessibilityRole="text"
        accessibilityLabel={label}
      >
        {content}
      </View>
    );
  }

  return (
    <>
      <Pressable
        style={({ pressed }) => [
          styles.button,
          pressed && styles.pressed,
          style,
        ]}
        onPress={() => setOpen(true)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={explanation.title}
      >
        {content}
      </Pressable>
      <AppModal
        visible={open}
        onRequestClose={() => setOpen(false)}
        onOverlayPress={() => setOpen(false)}
        icon={icon}
        title={explanation.title}
        message={explanation.message}
        footer={
          <Button
            title={t('Entendido')}
            variant="secondary"
            onPress={() => setOpen(false)}
          />
        }
      />
    </>
  );
}

/**
 * Hueco de una burbuja cuyo dato todavía se está cargando: la misma píldora,
 * vacía y atenuada. Reserva el alto y el ancho para que la tarjeta no CREZCA
 * bajo el dedo cuando llegan las series y los comentarios (el tablón se pinta
 * en dos tiempos y la lista ya responde al toque en el primero).
 */
export function StatBubbleSkeleton({ style }: { style?: ViewStyle }) {
  return (
    <View
      style={[styles.button, styles.skeleton, style]}
      pointerEvents="none"
    />
  );
}

/** Explicación de la burbuja de series (tablón y ficha pública). */
export const seriesExplanation = () => ({
  title: t('Series de la rutina'),
  message: t(
    'Series planificadas en toda la semana, sumando todos los días y ejercicios. Es lo que decide la intensidad de la rutina.'
  ),
});

/** Explicación de la burbuja de días (ficha pública). */
export const daysExplanation = () => ({
  title: t('Días de la rutina'),
  message: t(
    'Días de entrenamiento que tiene la rutina cada semana. Cada uno lleva sus propios ejercicios.'
  ),
});

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
    // Dato, no control: sin fondo de píldora y sin el padding que la dibuja.
    buttonFlat: { backgroundColor: 'transparent', paddingHorizontal: 2 },
    // Mismo alto que una burbuja con contenido (icono 20 + 6 arriba y abajo).
    skeleton: { width: 52, height: 32, opacity: 0.45 },
    label: {
      color: theme.colors.textSecondary,
      fontSize: 13,
      fontWeight: '800',
    },
    labelSaved: { color: theme.colors.primary },
    likeCount: {
      color: theme.colors.textSecondary,
      fontSize: 14,
      fontWeight: '800',
    },
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
