import { subscribeTheme } from '@lib/themeStore';
import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { theme } from '@lib/theme';
import { t } from '@lib/i18n';
import { routineIntensity } from '@lib/routines';
import { Avatar } from './Avatar';
import { GradientFill } from './GradientFill';
import {
  RoutineIntensityPill,
  RoutineIntensityPillSkeleton,
} from './RoutineIntensityPill';
// Las acciones sociales y las burbujas de dato viven todas en este módulo.
import {
  LikeButton,
  SaveRoutineButton,
  StatBubble,
  StatBubbleSkeleton,
  seriesExplanation,
} from './SaveRoutineButton';

/** Lo que la tarjeta necesita saber de una rutina pública. */
export interface PublicRoutineCardItem {
  id: string;
  name: string;
  description: string | null;
  /** Series planificadas en toda la rutina: de aquí sale la intensidad. */
  total_sets?: number;
  comments?: number;
  likes?: number;
  liked_by_me?: boolean;
}

interface PublicRoutineCardProps {
  item: PublicRoutineCardItem;
  /** Ya está en "mis rutinas" (enlazada o copiada). */
  saved: boolean;
  /** Se está añadiendo ahora mismo. */
  savingBusy?: boolean;
  onPress?: () => void;
  onSave: () => void;
  onToggleLike?: () => void;
  /**
   * Los metadatos (series, comentarios) llegan en una consulta posterior: con
   * esto puesto se reserva su hueco en vez de dejar que la tarjeta crezca bajo
   * el dedo cuando aparezcan.
   */
  loadingMeta?: boolean;
  /**
   * Firma del autor a la izquierda del nombre, que lleva a su perfil. El tablón
   * la pone (allí mezclan rutinas de todo el mundo); el perfil de su autor no,
   * que ahí sobra: ya estás en él.
   */
  author?: { name: string; avatarUrl?: string | null; onPress?: () => void };
  style?: StyleProp<ViewStyle>;
}

/**
 * Tarjeta de una rutina pública. Fuente ÚNICA de cómo se ve una rutina ajena:
 * la montaban por separado el tablón de Comunidad (con intensidad, series,
 * comentarios y "me gusta") y el perfil de su autor (solo nombre, descripción y
 * "añadir"), así que la misma rutina se veía distinta y solo se podía dar like
 * desde una de las dos puertas.
 */
export function PublicRoutineCard({
  item,
  saved,
  savingBusy,
  onPress,
  onSave,
  onToggleLike,
  loadingMeta,
  author,
  style,
}: PublicRoutineCardProps) {
  const level = item.total_sets != null ? routineIntensity(item.total_sets) : null;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed, style]}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={t('Ver rutina')}
    >
      <GradientFill accent={theme.colors.primaryLine} />
      {/* Una sola fila de cabecera: la foto del autor (su firma, y la diana que
          lleva a su perfil) delante del nombre, y la intensidad a la derecha. */}
      <View style={styles.cardHead}>
        {!!author && (
          <Pressable
            style={({ pressed }) => [pressed && styles.pressed]}
            onPress={author.onPress}
            disabled={!author.onPress}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('Ver perfil de {name}', { name: author.name })}
          >
            <Avatar uri={author.avatarUrl ?? null} size={28} />
          </Pressable>
        )}
        <Text style={styles.routineName} numberOfLines={2}>
          {item.name}
        </Text>
        {level ? (
          <RoutineIntensityPill level={level} />
        ) : loadingMeta ? (
          <RoutineIntensityPillSkeleton />
        ) : null}
      </View>

      {!!item.description && (
        <Text style={styles.description} numberOfLines={2}>
          {item.description}
        </Text>
      )}

      {/* Pie: a la izquierda los datos (series y comentarios) como burbujas, y a
          la derecha las acciones, todas del mismo tamaño. */}
      <View style={styles.footerRow}>
        {level ? (
          <StatBubble
            icon="repeat"
            value={item.total_sets ?? 0}
            label={
              item.total_sets === 1
                ? t('1 serie')
                : t('{n} series', { n: item.total_sets ?? 0 })
            }
            explanation={seriesExplanation()}
          />
        ) : loadingMeta ? (
          <StatBubbleSkeleton />
        ) : null}
        {!!item.comments && (
          <StatBubble
            icon="comment-outline"
            value={item.comments}
            label={
              item.comments === 1
                ? t('1 comentario')
                : t('{n} comentarios', { n: item.comments })
            }
          />
        )}
        <View style={styles.footerSpacer} />
        <SaveRoutineButton saved={saved} busy={savingBusy} onPress={onSave} />
        {item.likes !== undefined && !!onToggleLike && (
          <LikeButton
            likes={item.likes}
            liked={!!item.liked_by_me}
            onPress={onToggleLike}
          />
        )}
      </View>
    </Pressable>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    card: {
      borderRadius: theme.borderRadius.lg,
      overflow: 'hidden',
      // El mismo padding que `routineCard` en Rutinas: son la misma cosa en
      // dos pestañas vecinas y con 20 la Comunidad parecía otra app.
      padding: 14,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: 10,
    },
    cardPressed: { opacity: 0.85 },
    pressed: { opacity: 0.6 },
    cardHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    footerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    footerSpacer: { flex: 1 },
    routineName: {
      flex: 1,
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: '800',
      lineHeight: 24,
    },
    description: {
      color: theme.colors.textSecondary,
      fontSize: 14,
      lineHeight: 19,
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
