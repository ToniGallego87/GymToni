import { subscribeTheme } from '@lib/themeStore';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '@lib/theme';
import { t } from '@lib/i18n';
import { shortDayMonth } from '@lib/utils';
import { ActivityItem, activityKey } from '@lib/activity';
import { DayAccentIcon } from './DayAccentIcon';

interface ActivityListProps {
  items: ActivityItem[];
  /**
   * Abre la rutina de un día. Solo se ofrece en los hitos cuya rutina sigue
   * siendo pública: `publicRoutineIds` dice cuáles, porque una rutina puede
   * haberse retirado del tablón después de que el día se publicara.
   */
  publicRoutineIds?: Set<string>;
  onOpenRoutine?: (routineId: string, routineName: string) => void;
}

// Color e icono de cada tipo de hito. Los días no llevan icono fijo: usan el de
// su propio día de rutina (`DayAccentIcon`), como en el historial de Inicio.
const KIND_COLOR: Record<ActivityItem['kind'], () => string> = {
  badge: () => theme.colors.primary,
  challenge: () => theme.colors.success,
  day: () => theme.colors.textSecondary,
};

/**
 * La Actividad de una persona: sus hitos en una línea de tiempo (insignia
 * desbloqueada, reto superado, día entrenado). La comparten el perfil propio y
 * el de otra persona, que la sacan de sitios distintos —datos locales o la
 * nube— pero la pintan igual.
 */
export function ActivityList({
  items,
  publicRoutineIds,
  onOpenRoutine,
}: ActivityListProps) {
  return (
    <View>
      {items.map((item) => {
        const color = KIND_COLOR[item.kind]();
        // El día enlaza a su rutina solo si sigue pública: si no, el nombre se
        // queda como texto (el hito pasó, aunque la rutina ya no se pueda ver).
        const linkable =
          item.kind === 'day' &&
          !!item.routineId &&
          !!onOpenRoutine &&
          (!publicRoutineIds || publicRoutineIds.has(item.routineId));

        const body = (
          <>
            <View style={[styles.iconWrap, { borderColor: color + '66' }]}>
              {item.kind === 'day' ? (
                <DayAccentIcon
                  emoji={item.icon}
                  name={item.title}
                  size={18}
                  color={color}
                />
              ) : (
                <MaterialCommunityIcons
                  name={(item.icon ?? 'star-outline') as any}
                  size={18}
                  color={color}
                />
              )}
            </View>
            <View style={styles.info}>
              <Text style={styles.title} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                {shortDayMonth(item.happenedOn)}
                {item.kind === 'badge' && ` · ${t('insignia')}`}
                {item.kind === 'challenge' && ` · ${t('reto superado')}`}
                {item.kind === 'day' && !!item.routineName && (
                  <Text style={linkable ? styles.routineLink : undefined}>
                    {' · '}
                    {item.routineName}
                  </Text>
                )}
              </Text>
            </View>
            {linkable && (
              <MaterialCommunityIcons
                name="chevron-right"
                size={20}
                color={theme.colors.textMuted}
              />
            )}
          </>
        );

        return linkable ? (
          <Pressable
            key={activityKey(item)}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => onOpenRoutine?.(item.routineId!, item.routineName!)}
            accessibilityRole="button"
            accessibilityLabel={t('Ver la rutina {name}', {
              name: item.routineName ?? '',
            })}
          >
            {body}
          </Pressable>
        ) : (
          <View key={activityKey(item)} style={styles.row}>
            {body}
          </View>
        );
      })}
    </View>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    rowPressed: { opacity: 0.6 },
    iconWrap: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      backgroundColor: theme.colors.surfaceAlt,
    },
    info: { flex: 1, minWidth: 0 },
    title: {
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: '700',
      lineHeight: 20,
    },
    meta: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: '600',
      marginTop: 1,
    },
    // El nombre de la rutina se pinta como enlace solo cuando de verdad lleva a
    // ella (el chevron del final lo confirma).
    routineLink: {
      color: theme.colors.primary,
      fontWeight: '700',
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
