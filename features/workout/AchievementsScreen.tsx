import { subscribeTheme } from '@lib/themeStore';
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  AppModal,
  Button,
  ChallengesModal,
  FloatingBackButton,
  getFloatingBackButtonMetrics,
  GlassTopBar,
  GLASS_TOP_BAR_CONTENT_GAP,
  useGlassTopBarHeight,
  BadgeMedal,
  GradientFill,
  StretchScrollView,
} from '@components';
import { Badge, BADGE_CATEGORY_ORDER, badgeCategoryLabel } from '@lib/badges';
import { useAccountLevel } from '@hooks/useAccountLevel';
import { useChallengeWins, XP_PER_BADGE, XP_PER_CHALLENGE } from '@lib/level';
import { theme } from '@lib/theme';
import { t } from '@lib/i18n';
import { longDate, shortDayMonth } from '@lib/utils';

interface AchievementsScreenProps {
  onBack: () => void;
}

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

// Tres medallas por fila dentro de la tarjeta de cada tipo de logro.
const MEDALS_PER_ROW = 3;
// Medalla: el círculo y su icono. Las que van por recuento llevan alrededor
// el anillo de progreso (MEDAL_RING), y todas reservan ese hueco para que los
// nombres caigan a la misma altura.
const MEDAL_SIZE = 60;
// En el popup de detalle, la misma medalla más grande.
const DETAIL_MEDAL_SIZE = 84;

/**
 * Logros: catálogo fijo de insignias que se desbloquean con el histórico.
 *
 * El póster semanal (los 'hitos') celebra UNA semana; esto acumula: el que
 * lleva 60 entrenos lo ve aquí y sabe cuánto le falta para el siguiente. Todo
 * sale de los logs al abrir (lib/badges): nada que guardar ni sincronizar.
 *
 * Muro de medallas, una tarjeta por tipo de logro con lo conseguido y su barra.
 * Conseguida: medalla de oro (el degradado de la marca, con tinta oscura) y la
 * fecha. Por recuento y sin conseguir: medalla apagada con el anillo de lo que
 * llevas y '186/200'. De sí/no sin conseguir: apagada con un candado. Antes
 * eran casillas cuadradas y las conseguidas iban rellenas de oro con borde de
 * oro: con casi todo conseguido la pantalla era un bloque amarillo y lo que
 * faltaba (lo interesante) se perdía. El popup al tocar da la condición
 * completa y la fecha.
 *
 * La cabecera enseña las DOS mitades del nivel (retos superados y logros) y
 * la regla de puntos, y desde aquí se abren todos los retos de la semana
 * juntos (fuerza + cardio), que en las hero cards van por separado.
 */
export function AchievementsScreen({ onBack }: AchievementsScreenProps) {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<Badge | null>(null);
  const [showChallenges, setShowChallenges] = useState(false);

  // Las insignias salen del mismo cálculo compartido que el nivel: antes esta
  // pantalla volvía a recorrer el historial por su cuenta.
  const { badges, level, challenges } = useAccountLevel();
  const unlockedCount = badges.filter((b) => b.unlocked).length;
  // Retos superados en total (claves permanentes): la otra mitad del nivel.
  const challengeWins = useChallengeWins().length;
  // Los mismos retos que enseñan las hero cards, aquí todos juntos.
  const weekChallenges = challenges;
  const weekChallengesDone = weekChallenges.filter((c) => c.done).length;

  // Grupos por tipo, cada uno en filas de tres (la última se rellena con
  // huecos para que las medallas que hay queden en su columna).
  const groups = useMemo(
    () =>
      BADGE_CATEGORY_ORDER.map((category) => {
        const items = badges.filter((b) => b.category === category);
        const rows: (Badge | null)[][] = [];
        for (let i = 0; i < items.length; i += MEDALS_PER_ROW) {
          const row: (Badge | null)[] = items.slice(i, i + MEDALS_PER_ROW);
          while (row.length < MEDALS_PER_ROW) row.push(null);
          rows.push(row);
        }
        const done = items.filter((b) => b.unlocked).length;
        return { category, rows, done, total: items.length };
      }).filter((g) => g.rows.length > 0),
    [badges]
  );

  const { topBarHeight, onTopBarLayout } = useGlassTopBarHeight(insets.top);
  const { bottom: backBottom, scrollBottomPadding } =
    getFloatingBackButtonMetrics(insets.bottom);
  // Los de sí/no (objetivo 1) no llevan progreso: o están o no están.
  const showsProgress = (b: Badge) => !b.unlocked && b.target > 1;

  const selectedRatio =
    selected && selected.target > 0 ? selected.current / selected.target : 0;
  const selectedShowsProgress = !!selected && selected.target > 1;

  return (
    <View style={styles.container}>
      <StatusBar
        style={theme.statusBarStyle}
        translucent
        backgroundColor="transparent"
      />

      <StretchScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: topBarHeight + GLASS_TOP_BAR_CONTENT_GAP,
            paddingBottom: scrollBottomPadding,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Cabecera: el nivel de la cuenta (lo permanente) con su barra hasta
            el siguiente, las dos cifras que lo forman y la regla de puntos. */}
        <View style={styles.summaryCard}>
          <GradientFill accent={theme.colors.primaryLine} />
          <Text style={styles.summaryValue}>
            {t('Nivel {n}', { n: level.level })}
          </Text>
          <View style={styles.levelTrack}>
            <View
              style={[
                styles.levelFill,
                { width: `${Math.round(level.progress * 100)}%` },
              ]}
            />
          </View>
          {/* Puntos DENTRO del nivel actual (no el acumulado total): lo que
              llena la barra y lo que cuesta el salto al siguiente. */}
          <Text style={styles.summaryLabel}>
            {t('{xp} / {next} puntos', {
              xp: level.xp - level.levelStart,
              next: level.nextLevelAt - level.levelStart,
            })}
          </Text>
          <View style={styles.summaryStatsRow}>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryStatValue}>{challengeWins}</Text>
              <Text style={styles.summaryStatLabel}>
                {challengeWins === 1
                  ? t('reto superado')
                  : t('retos superados')}
              </Text>
            </View>
            <View style={styles.summaryStatDivider} />
            <View style={styles.summaryStat}>
              <Text style={styles.summaryStatValue}>
                {unlockedCount} / {badges.length}
              </Text>
              <Text style={styles.summaryStatLabel}>{t('logros')}</Text>
            </View>
          </View>
          <Text style={styles.summaryRule}>
            {t('Reto +{c} · Logro +{b}', {
              c: XP_PER_CHALLENGE,
              b: XP_PER_BADGE,
            })}
          </Text>
        </View>

        {/* Los retos de la semana, todos juntos (fuerza + cardio): la parte
            del nivel que se renueva cada semana. */}
        <Pressable
          style={({ pressed }) => [
            styles.challengesRow,
            pressed && styles.challengesRowPressed,
          ]}
          onPress={() => setShowChallenges(true)}
          accessibilityRole="button"
          accessibilityLabel={t('Retos de la semana')}
        >
          <MaterialCommunityIcons
            name="flag-checkered"
            size={20}
            color={theme.colors.primary}
          />
          <Text style={styles.challengesRowText}>
            {t('Retos de la semana')}
          </Text>
          <Text style={styles.challengesRowCount}>
            {weekChallengesDone}/{weekChallenges.length}
          </Text>
          <MaterialCommunityIcons
            name="chevron-right"
            size={20}
            color={theme.colors.textSecondary}
          />
        </Pressable>

        {groups.map(({ category, rows, done, total }) => (
          <View key={category} style={styles.group}>
            <View style={styles.groupHeader}>
              <Text style={styles.groupTitle}>
                {badgeCategoryLabel(category)}
              </Text>
              <Text
                style={[
                  styles.groupCount,
                  done === total && styles.groupCountDone,
                ]}
              >
                {done}
                <Text style={styles.groupCountTotal}>/{total}</Text>
              </Text>
            </View>
            <View style={styles.groupTrack}>
              <View
                style={[
                  styles.groupFill,
                  done === total && styles.groupFillDone,
                  { width: `${Math.round((done / total) * 100)}%` },
                ]}
              />
            </View>
            {rows.map((row, rowIndex) => (
              <View key={rowIndex} style={styles.medalRow}>
                {row.map((badge, i) =>
                  badge ? (
                    <Pressable
                      key={badge.id}
                      style={({ pressed }) => [
                        styles.medalCell,
                        pressed && styles.medalPressed,
                      ]}
                      onPress={() => setSelected(badge)}
                      accessibilityRole="button"
                      accessibilityLabel={`${badge.name}. ${
                        badge.unlocked
                          ? t('Conseguido')
                          : showsProgress(badge)
                          ? `${badge.current} / ${badge.target}`
                          : t('Aún sin conseguir')
                      }`}
                    >
                      <BadgeMedal
                        icon={badge.icon}
                        unlocked={badge.unlocked}
                        progress={
                          showsProgress(badge)
                            ? badge.current / badge.target
                            : undefined
                        }
                        size={MEDAL_SIZE}
                      />
                      <Text
                        style={[
                          styles.medalName,
                          !badge.unlocked && styles.medalNameLocked,
                        ]}
                        numberOfLines={2}
                      >
                        {badge.name}
                      </Text>
                      <Text
                        style={[
                          styles.medalMeta,
                          showsProgress(badge) && styles.medalMetaProgress,
                        ]}
                        numberOfLines={1}
                      >
                        {badge.unlocked
                          ? badge.unlockedAt
                            ? shortDayMonth(badge.unlockedAt)
                            : ' '
                          : showsProgress(badge)
                          ? `${badge.current}/${badge.target}`
                          : ' '}
                      </Text>
                    </Pressable>
                  ) : (
                    <View key={`gap-${i}`} style={styles.medalCell} />
                  )
                )}
              </View>
            ))}
          </View>
        ))}
      </StretchScrollView>

      {/* Sin la píldora de nivel: llevaría a esta misma pantalla. */}
      <GlassTopBar
        title={t('Logros')}
        icon="trophy-outline"
        subtitle={t('{a} de {b} logros', {
          a: unlockedCount,
          b: badges.length,
        })}
        topInset={insets.top}
        onLayout={onTopBarLayout}
        showLevelPill={false}
      />

      <FloatingBackButton onPress={onBack} bottom={backBottom} />

      <ChallengesModal
        visible={showChallenges}
        onClose={() => setShowChallenges(false)}
        title={t('Retos de la semana')}
        challenges={weekChallenges}
      />

      {/* Detalle del logro: cómo se consigue, cuánto llevas y cuándo cayó. */}
      <AppModal
        visible={!!selected}
        onRequestClose={() => setSelected(null)}
        onOverlayPress={() => setSelected(null)}
        title={selected?.name ?? ''}
        icon={selected?.icon as IconName}
        footer={
          <Button
            title={t('Volver')}
            variant="secondary"
            onPress={() => setSelected(null)}
          />
        }
      >
        {!!selected && (
          <View style={styles.detail}>
            {/* La misma medalla que en la lista, más grande. */}
            <BadgeMedal
              icon={selected.icon}
              unlocked={selected.unlocked}
              progress={
                showsProgress(selected)
                  ? selected.current / selected.target
                  : undefined
              }
              size={DETAIL_MEDAL_SIZE}
            />
            <Text style={styles.detailDescription}>{selected.description}</Text>

            {selectedShowsProgress && (
              <View style={styles.progressBlock}>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${Math.round(selectedRatio * 100)}%` },
                    ]}
                  />
                </View>
                <Text style={styles.progressText}>
                  {selected.current} / {selected.target}
                </Text>
              </View>
            )}

            <View style={styles.detailStatusRow}>
              <MaterialCommunityIcons
                name={selected.unlocked ? 'check-circle' : 'lock-outline'}
                size={16}
                color={
                  selected.unlocked
                    ? theme.colors.success
                    : theme.colors.textSecondary
                }
              />
              <Text
                style={[
                  styles.detailStatus,
                  selected.unlocked && styles.detailStatusUnlocked,
                ]}
              >
                {selected.unlocked && selected.unlockedAt
                  ? t('Completado el {date}', {
                      date: longDate(selected.unlockedAt),
                    })
                  : t('Aún sin conseguir')}
              </Text>
            </View>
          </View>
        )}
      </AppModal>
    </View>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    scroll: { flex: 1 },
    content: { paddingHorizontal: theme.spacing.md, gap: 16 },

    summaryCard: {
      backgroundColor: 'transparent',
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 14,
      alignItems: 'center',
      overflow: 'hidden',
      ...theme.shadow.soft,
    },
    summaryValue: {
      fontSize: 28,
      fontFamily: theme.fonts.display,
      letterSpacing: 0.5,
      color: theme.colors.primary,
      lineHeight: 38,
    },
    summaryLabel: {
      marginTop: 2,
      fontSize: 12,
      color: theme.colors.textSecondary,
      lineHeight: 16,
    },
    // Las dos mitades del nivel, una a cada lado de un separador.
    summaryStatsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'stretch',
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    summaryStat: { flex: 1, alignItems: 'center' },
    summaryStatValue: {
      fontSize: 18,
      fontWeight: '800',
      color: theme.colors.text,
      fontVariant: ['tabular-nums'],
    },
    summaryStatLabel: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 1,
    },
    summaryStatDivider: {
      width: 1,
      height: 28,
      backgroundColor: theme.colors.border,
    },
    summaryRule: {
      marginTop: 8,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.4,
      color: theme.colors.textSecondary,
    },

    // Fila-enlace a los retos de la semana: misma tarjeta que las casillas.
    challengesRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingVertical: 12,
      paddingHorizontal: 14,
      ...theme.shadow.soft,
    },
    challengesRowPressed: { opacity: 0.8 },
    challengesRowText: {
      flex: 1,
      fontSize: 15,
      fontWeight: '800',
      color: theme.colors.text,
    },
    challengesRowCount: {
      fontSize: 14,
      fontWeight: '800',
      color: theme.colors.primary,
      fontVariant: ['tabular-nums'],
    },

    levelTrack: {
      alignSelf: 'stretch',
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.colors.surfaceAlt,
      overflow: 'hidden',
      marginTop: 8,
      marginBottom: 4,
    },
    levelFill: {
      height: '100%',
      borderRadius: 3,
      backgroundColor: theme.colors.primary,
    },

    // Tarjeta de un tipo de logro: neutra; el oro lo ponen las medallas
    // conseguidas, no el marco.
    group: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 12,
      paddingTop: 14,
      paddingBottom: 6,
      ...theme.shadow.soft,
    },
    groupHeader: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      paddingHorizontal: 4,
    },
    groupTitle: {
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: theme.colors.textSecondary,
    },
    // Mismo dibujo que el recuento de retos de Inicio: lo hecho grande en
    // color y "/total" pequeño en blanco.
    groupCount: {
      fontSize: 16,
      fontWeight: '800',
      color: theme.colors.primary,
      fontVariant: ['tabular-nums'],
    },
    groupCountDone: { color: theme.colors.success },
    groupCountTotal: {
      fontSize: 12,
      color: theme.colors.text,
    },
    groupTrack: {
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.colors.surfaceAlt,
      overflow: 'hidden',
      marginTop: 8,
      marginBottom: 6,
      marginHorizontal: 4,
    },
    groupFill: {
      height: '100%',
      borderRadius: 2,
      backgroundColor: theme.colors.primary,
    },
    groupFillDone: { backgroundColor: theme.colors.success },

    medalRow: {
      flexDirection: 'row',
    },
    medalCell: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 4,
      gap: 6,
    },
    medalPressed: { opacity: 0.7 },
    medalName: {
      fontSize: 12,
      fontWeight: '800',
      color: theme.colors.text,
      lineHeight: 15,
      textAlign: 'center',
      minHeight: 30,
    },
    medalNameLocked: { color: theme.colors.textSecondary },
    // Bajo el nombre: la fecha si está conseguido, lo que llevas si va por
    // recuento.
    medalMeta: {
      marginTop: -4,
      fontSize: 11,
      fontWeight: '600',
      color: theme.colors.textMuted,
      fontVariant: ['tabular-nums'],
      lineHeight: 13,
    },
    medalMetaProgress: {
      fontWeight: '800',
      color: theme.colors.primary,
    },

    detail: { alignItems: 'center', gap: 6 },
    detailDescription: {
      fontSize: 15,
      color: theme.colors.text,
      lineHeight: 21,
      textAlign: 'center',
    },
    progressBlock: {
      alignSelf: 'stretch',
      marginTop: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    progressTrack: {
      flex: 1,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.colors.surfaceAlt,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: 4,
      backgroundColor: theme.colors.primary,
    },
    progressText: {
      fontSize: 13,
      fontWeight: '800',
      color: theme.colors.text,
      fontVariant: ['tabular-nums'],
    },
    detailStatusRow: {
      marginTop: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    detailStatus: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      fontWeight: '600',
    },
    detailStatusUnlocked: { color: theme.colors.success },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
