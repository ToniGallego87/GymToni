import { subscribeTheme } from '@lib/themeStore';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '@lib/theme';
import { t } from '@lib/i18n';
import { shortDayMonth, weekdayDayMonth } from '@lib/utils';
import {
  ActivityItem,
  activityKey,
  genericChallengeTitle,
  groupActivityByMonth,
  monthLabel,
} from '@lib/activity';
import { DayAccentIcon } from './DayAccentIcon';
import { SectionLegend } from './SectionLegend';
import { TrendDelta } from './TrendDelta';

interface ActivityListProps {
  items: ActivityItem[];
  /**
   * Abre la rutina de un día. Solo se ofrece en los hitos cuya rutina sigue
   * siendo pública: `publicRoutineIds` dice cuáles, porque una rutina puede
   * haberse retirado del tablón después de que el día se publicara. Es lo que
   * hace el día en el perfil de OTRA persona; en el propio manda `onOpenDay`.
   */
  publicRoutineIds?: Set<string>;
  onOpenRoutine?: (routineId: string, routineName: string) => void;
  /**
   * Actividad propia: el día abre esa sesión (su Detalle). Devuelve false si
   * no se puede (el día ya no existe en ninguna rutina) y la fila no enlaza.
   */
  canOpenDay?: (item: ActivityItem) => boolean;
  onOpenDay?: (item: ActivityItem) => void;
  /** Actividad propia: mejora de ese entreno frente al anterior del día. */
  dayTrend?: (item: ActivityItem) => { percent: number; isImproved: boolean } | null;
  /** Actividad propia: el récord abre el Progreso de su ejercicio. */
  onOpenRecord?: (item: ActivityItem) => void;
}

// Color e icono de cada tipo de hito. Los días no llevan icono fijo: usan el de
// su propio día de rutina (`DayAccentIcon`), como en el historial de Inicio.
const KIND_COLOR: Record<ActivityItem['kind'], () => string> = {
  badge: () => theme.colors.primary,
  challenge: () => theme.colors.success,
  day: () => theme.colors.textSecondary,
  record: () => theme.colors.emoji_orange,
};
const KIND_TINT: Record<ActivityItem['kind'], () => string> = {
  badge: () => theme.colors.primaryMuted,
  challenge: () => theme.colors.successMuted,
  day: () => theme.colors.surfaceAlt,
  record: () => theme.colors.emoji_orangeMuted,
};

// Con más de estos, entrenos y récords de un mes se pliegan en una fila: si no,
// 17 entrenos al mes tapaban los uno o dos logros que se vienen a mirar.
const FOLD_AFTER = 2;

const plural = (n: number, one: string, many: string) =>
  n === 1 ? t(one) : t(many, { n });

/** "12 entrenos · 3 récords · 1 logro · 2 retos" de un mes. */
function monthSummary(items: ActivityItem[]): string {
  const count = (kind: ActivityItem['kind']) =>
    items.filter((item) => item.kind === kind).length;
  const days = count('day');
  const records = count('record');
  const challenges = count('challenge');
  const badges = count('badge');
  return [
    days > 0 && plural(days, '1 entreno', '{n} entrenos'),
    records > 0 && plural(records, '1 récord', '{n} récords'),
    badges > 0 && plural(badges, '1 logro', '{n} logros'),
    challenges > 0 && plural(challenges, '1 reto', '{n} retos'),
  ]
    .filter(Boolean)
    .join(' · ');
}

/** Nombres distintos de una lista, en orden y sin repetir. */
function distinctTitles(items: ActivityItem[]): string {
  return [...new Set(items.map((item) => item.title))].join(', ');
}

/**
 * La Actividad de una persona como un diario por meses: cada mes con su
 * cabecera y su resumen, y dentro entrenos, récords, logros y retos, por ese
 * orden; entrenos y récords plegados en una fila que se despliega (si hay
 * muchos). La comparten el
 * perfil propio y el de otra persona, que sacan los hitos de sitios distintos
 * —datos locales o la nube— pero los pintan igual.
 */
export function ActivityList({
  items,
  publicRoutineIds,
  onOpenRoutine,
  canOpenDay,
  onOpenDay,
  dayTrend,
  onOpenRecord,
}: ActivityListProps) {
  // Grupos desplegados: `mes:tipo`.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const toggle = (key: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const renderRow = (item: ActivityItem, nested = false) => {
    const color = KIND_COLOR[item.kind]();
    const year = Number(item.happenedOn.slice(0, 4));

    // A dónde lleva la fila: el día propio a su sesión; el ajeno a su rutina
    // si sigue pública (si no, el nombre se queda como texto: el hito pasó,
    // aunque la rutina ya no se pueda ver); el récord propio a su Progreso.
    const opensDay =
      item.kind === 'day' && !!onOpenDay && (canOpenDay?.(item) ?? true);
    const opensRoutine =
      !onOpenDay &&
      item.kind === 'day' &&
      !!item.routineId &&
      !!onOpenRoutine &&
      (!publicRoutineIds || publicRoutineIds.has(item.routineId));
    const opensRecord =
      item.kind === 'record' && !!onOpenRecord && !!item.exerciseKey;
    const onPress = opensDay
      ? () => onOpenDay?.(item)
      : opensRoutine
      ? () => onOpenRoutine?.(item.routineId!, item.routineName!)
      : opensRecord
      ? () => onOpenRecord?.(item)
      : undefined;

    // La línea de debajo: cuándo y, si el título no lo dice ya, qué es. El
    // reto se fecha por su semana (se supera en algún momento de esos siete
    // días); el día lleva su día de la semana, que es lo que se recuerda.
    const date = shortDayMonth(item.happenedOn);
    const meta =
      item.kind === 'challenge'
        ? item.title === genericChallengeTitle() ||
          item.title === t('Reto superado')
          ? t('Semana del {d}', { d: date })
          : `${t('Semana del {d}', { d: date })} · ${t('reto superado')}`
        : item.kind === 'badge'
        ? `${date} · ${t('logro')}`
        : item.kind === 'record'
        ? `${date} · ${t('récord personal')}`
        : `${weekdayDayMonth(item.happenedOn, year)}${
            item.routineName ? ` · ${item.routineName}` : ''
          }`;
    const trend = item.kind === 'day' ? dayTrend?.(item) : null;

    const body = (
      <>
        <View
          style={[
            styles.iconWrap,
            nested && styles.iconWrapNested,
            { backgroundColor: KIND_TINT[item.kind]() },
          ]}
        >
          {item.kind === 'day' ? (
            <DayAccentIcon
              emoji={item.icon}
              name={item.title}
              size={nested ? 16 : 18}
              color={color}
            />
          ) : (
            <MaterialCommunityIcons
              name={(item.icon ?? 'star-outline') as any}
              size={nested ? 16 : 18}
              color={color}
            />
          )}
        </View>
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {meta}
          </Text>
        </View>
        {!!item.detail && <Text style={styles.detail}>{item.detail}</Text>}
        {!!trend && (
          <TrendDelta
            value={trend.percent}
            improved={trend.isImproved}
            iconSize={12}
            textStyle={styles.trend}
          />
        )}
        {!!onPress && (
          <MaterialCommunityIcons
            name="chevron-right"
            size={20}
            color={theme.colors.textMuted}
          />
        )}
      </>
    );

    const rowStyle = [styles.row, nested && styles.rowNested];
    return onPress ? (
      <Pressable
        key={activityKey(item)}
        style={({ pressed }) => [rowStyle, pressed && styles.rowPressed]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={
          opensRoutine
            ? t('Ver la rutina {name}', { name: item.routineName ?? '' })
            : `${item.title}. ${meta}`
        }
      >
        {body}
      </Pressable>
    ) : (
      <View key={activityKey(item)} style={rowStyle}>
        {body}
      </View>
    );
  };

  // Entrenos o récords de un mes: hasta FOLD_AFTER van como filas; con más,
  // una fila "12 entrenos" con los nombres y un chevron que la despliega.
  const renderGroup = (
    month: string,
    kind: 'day' | 'record',
    group: ActivityItem[]
  ) => {
    if (group.length === 0) return null;
    if (group.length <= FOLD_AFTER) return group.map((item) => renderRow(item));
    const key = `${month}:${kind}`;
    const open = expanded.has(key);
    const label =
      kind === 'day'
        ? plural(group.length, '1 entreno', '{n} entrenos')
        : plural(group.length, '1 récord', '{n} récords');
    // Los iconos de los días distintos que se entrenaron (hasta 4).
    const dayIcons =
      kind === 'day'
        ? [...new Map(group.map((item) => [item.title, item])).values()].slice(
            0,
            4
          )
        : [];
    return (
      <React.Fragment key={key}>
        <Pressable
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          onPress={() => toggle(key)}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={label}
        >
          <View
            style={[
              styles.iconWrap,
              { backgroundColor: KIND_TINT[kind]() },
            ]}
          >
            <MaterialCommunityIcons
              name={kind === 'day' ? 'calendar-check' : 'trophy'}
              size={18}
              color={KIND_COLOR[kind]()}
            />
          </View>
          <View style={styles.info}>
            <Text style={styles.title} numberOfLines={1}>
              {label}
            </Text>
            {kind === 'day' ? (
              <View style={styles.dayIcons}>
                {dayIcons.map((item) => (
                  <DayAccentIcon
                    key={item.title}
                    emoji={item.icon}
                    name={item.title}
                    size={13}
                    color={theme.colors.textSecondary}
                  />
                ))}
                <Text style={[styles.meta, styles.dayNames]} numberOfLines={1}>
                  {distinctTitles(group)}
                </Text>
              </View>
            ) : (
              <Text style={styles.meta} numberOfLines={1}>
                {distinctTitles(group)}
              </Text>
            )}
          </View>
          <MaterialCommunityIcons
            name={open ? 'chevron-up' : 'chevron-down'}
            size={22}
            color={theme.colors.textSecondary}
          />
        </Pressable>
        {open && group.map((item) => renderRow(item, true))}
      </React.Fragment>
    );
  };

  return (
    <View style={styles.months}>
      {groupActivityByMonth(items).map(({ month, items: monthItems }) => {
        // Orden del mes: entrenos, récords, logros y retos (el del resumen).
        const ofKind = (kind: ActivityItem['kind']) =>
          monthItems.filter((item) => item.kind === kind);
        const days = ofKind('day');
        const records = ofKind('record');
        const badges = ofKind('badge');
        const challenges = ofKind('challenge');
        return (
          <View key={month}>
            <SectionLegend
              title={monthLabel(month)}
              hint={monthSummary(monthItems)}
            />
            <View style={styles.card}>
              {renderGroup(month, 'day', days)}
              {renderGroup(month, 'record', records)}
              {badges.map((item) => renderRow(item))}
              {challenges.map((item) => renderRow(item))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    months: {
      gap: 16,
    },
    // Cada mes, una tarjeta (superficie y borde, como el resto de listas).
    // El borde de abajo de la última fila se lo come el `overflow`.
    card: {
      paddingHorizontal: 12,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
      marginBottom: -StyleSheet.hairlineWidth,
    },
    // Las filas de un grupo desplegado van sangradas bajo su cabecera.
    rowNested: {
      paddingLeft: 22,
      paddingVertical: 8,
    },
    rowPressed: { opacity: 0.6 },
    iconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconWrapNested: {
      width: 30,
      height: 30,
      borderRadius: 15,
    },
    info: { flex: 1, minWidth: 0 },
    title: {
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: '700',
      lineHeight: 20,
    },
    meta: {
      color: theme.colors.textSecondary,
      fontSize: 13,
      fontWeight: '600',
      marginTop: 1,
    },
    dayIcons: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 2,
    },
    dayNames: {
      flex: 1,
      marginTop: 0,
      marginLeft: 2,
    },
    // La marca del récord, a la derecha y en su naranja: es el dato de la fila.
    detail: {
      color: theme.colors.emoji_orange,
      fontSize: 16,
      fontWeight: '800',
      fontVariant: ['tabular-nums'],
    },
    trend: {
      fontSize: 13,
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
