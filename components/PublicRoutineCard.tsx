import { subscribeTheme } from '@lib/themeStore';
import React from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
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
  daysExplanation,
} from './SaveRoutineButton';

/** Lo que la tarjeta necesita saber de una rutina pública. */
export interface PublicRoutineCardItem {
  id: string;
  name: string;
  description: string | null;
  /** Series planificadas en toda la rutina: de aquí sale la intensidad. */
  total_sets?: number;
  /** Días de entrenamiento de la rutina (llega en el mismo lote que las series). */
  total_days?: number;
  comments?: number;
  /** Personas que la han añadido a sus rutinas (ver `getSaveCounts`). */
  saves?: number;
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
   * Los metadatos (días, series, comentarios) llegan en una consulta posterior:
   * con esto puesto se reserva su hueco en vez de dejar que la tarjeta crezca
   * bajo el dedo cuando aparezcan.
   */
  loadingMeta?: boolean;
  /**
   * Firma del autor: su foto delante del nombre y "de {autor}" debajo, las dos
   * con camino a su perfil. El tablón la pone (allí mezclan rutinas de todo el
   * mundo); el perfil de su autor no, que ahí sobra: ya estás en él.
   */
  author?: { name: string; avatarUrl?: string | null; onPress?: () => void };
  style?: StyleProp<ViewStyle>;
}

/**
 * Tarjeta de una rutina pública. Fuente ÚNICA de cómo se ve una rutina ajena
 * (tablón de Comunidad y perfil de su autor), para que la misma rutina se vea
 * igual por las dos puertas.
 *
 * Lo que se mira para elegir va a la vista: quién la hizo, cuántos días tiene y
 * su intensidad. Las series no van aparte: la píldora de intensidad ya sale de
 * ellas (eran dos señales para el mismo dato); siguen, con su explicación, en
 * la ficha pública. En el pie, "Añadir" lleva rótulo y contorno de oro: es la
 * única acción que cambia tus rutinas y pesaba lo mismo que el "me gusta".
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
  const level =
    item.total_sets != null ? routineIntensity(item.total_sets) : null;
  const days = item.total_days;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        pressed && styles.cardPressed,
        style,
      ]}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={
        author
          ? `${item.name}. ${t('de {name}', { name: author.name })}`
          : item.name
      }
    >
      <GradientFill accent={theme.colors.primaryLine} />
      {/* Cabecera: la foto del autor, el nombre con su firma debajo y la
          intensidad a la derecha. */}
      <View style={styles.cardHead}>
        {!!author && (
          <Pressable
            style={({ pressed }) => [pressed && styles.pressed]}
            onPress={author.onPress}
            disabled={!author.onPress}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('Ver perfil de {name}', {
              name: author.name,
            })}
          >
            <Avatar uri={author.avatarUrl ?? null} size={34} />
          </Pressable>
        )}
        <View style={styles.titleWrap}>
          <Text style={styles.routineName} numberOfLines={2}>
            {item.name}
          </Text>
          {!!author && (
            <Pressable
              style={({ pressed }) => [
                styles.authorLine,
                pressed && styles.pressed,
              ]}
              onPress={author.onPress}
              disabled={!author.onPress}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={t('Ver perfil de {name}', {
                name: author.name,
              })}
            >
              <Text style={styles.authorText} numberOfLines={1}>
                {t('de {name}', { name: author.name })}
              </Text>
            </Pressable>
          )}
        </View>
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

      {/* Pie: a la izquierda los datos (días y comentarios), a la derecha las
          acciones, con "Añadir" al final, bajo el pulgar. */}
      <View style={styles.footerRow}>
        {days ? (
          <StatBubble
            icon="calendar-outline"
            value={days}
            label={days === 1 ? t('1 día') : t('{n} días', { n: days })}
            explanation={daysExplanation()}
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
        {item.likes !== undefined && !!onToggleLike && (
          <LikeButton
            likes={item.likes}
            liked={!!item.liked_by_me}
            onPress={onToggleLike}
          />
        )}
        <SaveRoutineButton
          saved={saved}
          busy={savingBusy}
          onPress={onSave}
          count={item.saves}
          compactLabel
        />
      </View>
    </Pressable>
  );
}

/**
 * Tarjeta fantasma con la forma de `PublicRoutineCard`, para la primera carga
 * del tablón: la lista no salta cuando llegan las rutinas y se ve qué va a
 * aparecer (antes, una rueda con "Cargando…" en medio).
 */
export function PublicRoutineCardSkeleton() {
  return (
    <View style={styles.card} pointerEvents="none">
      <View style={styles.cardHead}>
        <View style={[styles.ghost, styles.ghostAvatar]} />
        <View style={styles.titleWrap}>
          <View style={[styles.ghost, styles.ghostTitle]} />
          <View style={[styles.ghost, styles.ghostAuthor]} />
        </View>
        <RoutineIntensityPillSkeleton />
      </View>
      <View style={[styles.ghost, styles.ghostLine]} />
      <View style={styles.footerRow}>
        <StatBubbleSkeleton />
        <View style={styles.footerSpacer} />
        <StatBubbleSkeleton />
        <StatBubbleSkeleton style={styles.ghostSave} />
      </View>
    </View>
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
    titleWrap: { flex: 1, minWidth: 0, gap: 1 },
    footerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    footerSpacer: { flex: 1 },
    routineName: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: '800',
      lineHeight: 24,
    },
    authorLine: { alignSelf: 'flex-start' },
    authorText: {
      color: theme.colors.textSecondary,
      fontSize: 13,
      fontWeight: '600',
    },
    description: {
      color: theme.colors.textSecondary,
      fontSize: 14,
      lineHeight: 19,
    },
    // Fantasma: bloques del color de las píldoras, atenuados.
    ghost: {
      backgroundColor: theme.colors.surfaceAlt,
      borderRadius: theme.borderRadius.sm,
      opacity: 0.6,
    },
    ghostAvatar: { width: 34, height: 34, borderRadius: 17 },
    ghostTitle: { height: 16, width: '70%' },
    ghostAuthor: { height: 11, width: '35%', marginTop: 6 },
    ghostLine: { height: 12, width: '85%' },
    ghostSave: { width: 92 },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
