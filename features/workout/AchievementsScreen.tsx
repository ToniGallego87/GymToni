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
  GLASS_TOP_BAR_BASE_HEIGHT,
  GradientFill,
  MENU_TILE_GAP,
  MENU_TILE_INSET,
  MENU_TILE_PADDING,
  RestTimerRing,
  StretchScrollView,
} from '@components';
import { Badge, BADGE_CATEGORY_ORDER, badgeCategoryLabel } from '@lib/badges';
import { useAccountLevel } from '@hooks/useAccountLevel';
import { useChallengeWins, XP_PER_BADGE, XP_PER_CHALLENGE } from '@lib/level';
import { theme } from '@lib/theme';
import { dateLocale, t } from '@lib/i18n';

interface AchievementsScreenProps {
  onBack: () => void;
}

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

// Tres por fila, la misma retícula que el menú de Perfil y las casillas de
// ejercicio: con cuatro los nombres largos ('Corazón en marcha') se encogían
// hasta no leerse.
const TILES_PER_ROW = 3;
const TILE_ICON_SIZE = 33;
// Anillo de progreso alrededor del icono de una insignia aún sin conseguir.
const TILE_RING_SIZE = 44;
// Cuadrada y con las mismas medidas que el menú de Perfil (`menuTileTokens`):
// las dos cuadrículas se ven una detrás de otra y no pueden desencajar. Lo que
// se encoge para que quepa todo dentro del cuadrado es el contenido: anillo,
// icono y letra (antes la casilla era más ancha y más alta, `TILE_ASPECT` 0,88).

/**
 * Logros: catálogo fijo de insignias que se desbloquean con el histórico.
 *
 * El póster semanal (los 'hitos') celebra UNA semana; esto acumula: el que
 * lleva 60 entrenos lo ve aquí y sabe cuánto le falta para el siguiente. Todo
 * sale de los logs al abrir (lib/badges): nada que guardar ni sincronizar.
 *
 * Misma cuadrícula de casillas que el menú de Perfil: icono + nombre, en color
 * si está conseguido y, si no, en gris con el progreso a la vista (anillo
 * alrededor del icono y '37/50' bajo el nombre). El popup al tocar da la
 * condición completa y la fecha.
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
  // huecos invisibles para que las casillas no se estiren).
  const groups = useMemo(
    () =>
      BADGE_CATEGORY_ORDER.map((category) => {
        const items = badges.filter((b) => b.category === category);
        const rows: (Badge | null)[][] = [];
        for (let i = 0; i < items.length; i += TILES_PER_ROW) {
          const row: (Badge | null)[] = items.slice(i, i + TILES_PER_ROW);
          while (row.length < TILES_PER_ROW) row.push(null);
          rows.push(row);
        }
        return { category, rows };
      }).filter((g) => g.rows.length > 0),
    [badges]
  );

  const topBarHeight = GLASS_TOP_BAR_BASE_HEIGHT + insets.top;
  const { bottom: backBottom, scrollBottomPadding } =
    getFloatingBackButtonMetrics(insets.bottom);

  const longDate = (iso: string) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString(dateLocale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

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
          { paddingTop: topBarHeight + 28, paddingBottom: scrollBottomPadding },
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
          <Text style={styles.summaryLabel}>
            {t('{xp} / {next} puntos', {
              xp: level.xp,
              next: level.nextLevelAt,
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

        {groups.map(({ category, rows }) => (
          <View key={category} style={styles.group}>
            <Text style={styles.groupTitle}>
              {badgeCategoryLabel(category)}
            </Text>
            {rows.map((row, rowIndex) => (
              <View key={rowIndex} style={styles.gridRow}>
                {row.map((badge, i) =>
                  badge ? (
                    <Pressable
                      key={badge.id}
                      style={({ pressed }) => [
                        styles.tile,
                        badge.unlocked && styles.tileUnlocked,
                        pressed && styles.tilePressed,
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
                      {/* Sin conseguir: solo el icono va apagado (el nombre
                          se queda entero, que hay que poder leerlo) y, si es
                          de recuento, un anillo con lo que llevas. */}
                      {showsProgress(badge) ? (
                        <RestTimerRing
                          progress={badge.current / badge.target}
                          size={TILE_RING_SIZE}
                          strokeWidth={3}
                          color={theme.colors.primary}
                        >
                          <MaterialCommunityIcons
                            name={badge.icon as IconName}
                            size={TILE_ICON_SIZE - 4}
                            color={theme.colors.textSecondary}
                            style={styles.tileIconLocked}
                          />
                        </RestTimerRing>
                      ) : (
                        <View style={styles.tileIconBox}>
                          <MaterialCommunityIcons
                            name={badge.icon as IconName}
                            size={TILE_ICON_SIZE}
                            color={
                              badge.unlocked
                                ? theme.colors.primary
                                : theme.colors.textSecondary
                            }
                            style={!badge.unlocked && styles.tileIconLocked}
                          />
                        </View>
                      )}
                      <Text
                        style={[
                          styles.tileLabel,
                          !badge.unlocked && styles.tileLabelLocked,
                        ]}
                        numberOfLines={2}
                      >
                        {badge.name}
                      </Text>
                      {showsProgress(badge) && (
                        <Text style={styles.tileProgress}>
                          {badge.current}/{badge.target}
                        </Text>
                      )}
                    </Pressable>
                  ) : (
                    <View key={`gap-${i}`} style={styles.tileGap} />
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
        subtitle={t('Insignias y tu nivel')}
        topInset={insets.top}
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
            <View
              style={[
                styles.detailIconWrap,
                selected.unlocked && styles.detailIconWrapUnlocked,
              ]}
            >
              <MaterialCommunityIcons
                name={selected.icon as IconName}
                size={44}
                color={
                  selected.unlocked
                    ? theme.colors.primary
                    : theme.colors.textSecondary
                }
              />
            </View>
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

    group: { gap: 12 },
    groupTitle: {
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: theme.colors.textSecondary,
      paddingHorizontal: 2,
    },

    // Cuadrícula: las mismas casillas cuadradas del menú de Perfil, con sus
    // mismas medidas (separación, margen a los lados y aire interior).
    gridRow: {
      flexDirection: 'row',
      gap: MENU_TILE_GAP,
      marginHorizontal: MENU_TILE_INSET,
    },
    tile: {
      flex: 1,
      aspectRatio: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: MENU_TILE_PADDING,
    },
    // Sin sombra en ninguna casilla: la elevación de Android se pintaba como
    // un cuadrado más oscuro bajo el fondo translúcido del dorado, y si solo
    // la llevaban las bloqueadas parecían más grandes.
    tileUnlocked: {
      backgroundColor: theme.colors.primaryMuted,
      borderColor: theme.colors.primaryLine,
    },
    // Bloqueado: se apaga SOLO el icono; el nombre y la cifra van enteros
    // (en tema claro, gris al 60 % sobre surface rozaba el mínimo de contraste).
    tileIconLocked: { opacity: 0.55 },
    // Mismo alto que el anillo, para que icono y nombre caigan igual en todas
    // las casillas, lleven anillo o no.
    tileIconBox: {
      height: TILE_RING_SIZE,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tilePressed: { opacity: 0.8 },
    tileProgress: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.colors.textSecondary,
      fontVariant: ['tabular-nums'],
      lineHeight: 13,
    },
    // Hueco de relleno con la MISMA caja que una casilla (borde y padding,
    // invisibles): sin ellos Yoga repartía el ancho distinto y las casillas
    // de una fila incompleta (las de los últimos logros, casi siempre sin
    // conseguir) salían más anchas que las de una fila llena.
    tileGap: {
      flex: 1,
      aspectRatio: 1,
      borderWidth: 1,
      borderColor: 'transparent',
      padding: MENU_TILE_PADDING,
    },
    tileLabel: {
      fontSize: 12,
      fontWeight: '800',
      color: theme.colors.text,
      lineHeight: 15,
      textAlign: 'center',
    },
    tileLabelLocked: { color: theme.colors.textSecondary },

    detail: { alignItems: 'center', gap: 6 },
    detailIconWrap: {
      width: 76,
      height: 76,
      borderRadius: 38,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surfaceAlt,
      marginBottom: 6,
    },
    detailIconWrapUnlocked: {
      backgroundColor: theme.colors.primaryMuted,
      borderWidth: 1,
      borderColor: theme.colors.primaryLine,
    },
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
