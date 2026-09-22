import { subscribeTheme } from '@lib/themeStore';
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '@lib/theme';
import { t } from '@lib/i18n';
import {
  Challenge,
  challengeProgressLabel,
  daysLeftInWeek,
} from '@lib/challenges';
import { AppModal } from './AppModal';
import { Button } from './Button';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

interface ChallengesModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  challenges: Challenge[];
}

/**
 * Popup con los retos de la semana (fila: icono, nombre + ventana, condición y
 * barra de progreso). Antes vivía fijo en la pantalla de Logros; ahora lo abre
 * la hero card de retos de cada vista (Inicio, Cardio) y solo con los retos de
 * su categoría, así que el contenido es el mismo componente en los dos sitios.
 */
export function ChallengesModal({
  visible,
  onClose,
  title,
  challenges,
}: ChallengesModalProps) {
  const daysLeft = daysLeftInWeek();

  // Ventana de cada reto, en una palabra: solo los de cardio la tienen (hoy o
  // lo que queda hasta el domingo). Los de fuerza van con la semana de la
  // rutina, sin fecha de cierre, así que no se dice nada.
  const periodLabel = (c: Challenge): string | null => {
    if (c.period === 'today') return t('Hoy');
    if (c.period === 'calendar-week') {
      return daysLeft === 1 ? t('Último día') : t('{n} días', { n: daysLeft });
    }
    return null;
  };

  return (
    <AppModal
      visible={visible}
      onRequestClose={onClose}
      onOverlayPress={onClose}
      title={title}
      icon="flag-checkered"
      footer={
        <Button title={t('Volver')} variant="secondary" onPress={onClose} />
      }
    >
      <View style={styles.list}>
        {challenges.map((c) => (
          <View
            key={c.id}
            style={[styles.challengeRow, c.done && styles.challengeRowDone]}
          >
            <View
              style={[styles.challengeIcon, c.done && styles.challengeIconDone]}
            >
              <MaterialCommunityIcons
                name={(c.done ? 'check-bold' : c.icon) as IconName}
                size={22}
                color={
                  c.done ? theme.colors.onGold : theme.colors.textSecondary
                }
              />
            </View>
            <View style={styles.challengeBody}>
              <View style={styles.challengeTitleRow}>
                <Text style={styles.challengeName} numberOfLines={1}>
                  {c.name}
                </Text>
                {!!periodLabel(c) && (
                  <Text style={styles.challengePeriod}>{periodLabel(c)}</Text>
                )}
              </View>
              <Text style={styles.challengeDescription} numberOfLines={2}>
                {c.description}
              </Text>
              <View style={styles.challengeProgressRow}>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      c.done && styles.progressFillDone,
                      {
                        width: `${Math.round(
                          (c.target > 0 ? c.current / c.target : 0) * 100
                        )}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.challengeProgress}>
                  {challengeProgressLabel(c)}
                </Text>
              </View>
            </View>
          </View>
        ))}
      </View>
    </AppModal>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    list: { gap: 10, alignSelf: 'stretch' },
    // `alignItems: center`: el icono va centrado con el bloque de texto (nombre
    // + condición + barra), no pegado arriba.
    challengeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 12,
      ...theme.shadow.soft,
    },
    challengeRowDone: {
      backgroundColor: theme.colors.primaryMuted,
      borderColor: theme.colors.primaryLine,
      shadowOpacity: 0,
      elevation: 0,
    },
    challengeIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surfaceAlt,
    },
    challengeIconDone: {
      backgroundColor: theme.colors.primaryFill,
    },
    challengeBody: { flex: 1, minWidth: 0, gap: 3 },
    challengeTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    challengeName: {
      flex: 1,
      fontSize: 15,
      fontWeight: '800',
      color: theme.colors.text,
      lineHeight: 20,
    },
    challengePeriod: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.colors.textSecondary,
    },
    challengeDescription: {
      fontSize: 13,
      lineHeight: 17,
      color: theme.colors.textSecondary,
    },
    challengeProgressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginTop: 4,
    },
    challengeProgress: {
      fontSize: 12,
      fontWeight: '800',
      color: theme.colors.text,
      fontVariant: ['tabular-nums'],
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
    progressFillDone: {
      backgroundColor: theme.colors.success,
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
