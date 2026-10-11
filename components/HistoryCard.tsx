import { subscribeTheme } from '@lib/themeStore';
import React, { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '@lib/theme';
import { dayNameText } from '@lib/textStyles';
import { GradientFill } from './GradientFill';

interface HistoryCardProps {
  /** Aro dorado + degradado del día de hoy (mismo tratamiento en Inicio y Cardio). */
  isToday?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  children: ReactNode;
}

/**
 * Marco de una tarjeta de historial (una sesión de un día): fondo, borde,
 * sombra y el resalte de "hoy". Compartido por la tarjeta de día de Inicio
 * (fuerza, un `HistoryCardRow`) y la de Cardio (fecha + kcal arriba, un
 * `HistoryCardRow` por disciplina debajo si hay más de una) para que dejen
 * de divergir en tamaño y trato visual.
 */
export function HistoryCard({
  isToday,
  onPress,
  accessibilityLabel,
  children,
}: HistoryCardProps) {
  return (
    <Pressable
      style={({ pressed }: { pressed: boolean }) => [
        styles.card,
        isToday && styles.cardToday,
        pressed && styles.cardPressed,
      ]}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
    >
      {isToday && <GradientFill accent={theme.colors.primaryLine} />}
      {children}
    </Pressable>
  );
}

interface HistoryCardRowProps {
  icon: ReactNode;
  title: string;
  /** Mismo formato en Inicio y Cardio: `weekdayDayMonth` ("Dom 4 oct"). Se
   * omite en las filas de disciplina de un día de Cardio con varias, donde
   * la fecha ya la lleva la cabecera del día. */
  date?: string;
  right?: ReactNode;
  /** Separación con la fila anterior: solo la llevan las filas de
   * disciplina que se apilan bajo la cabecera de un día de Cardio. */
  spaced?: boolean;
}

/** Icono grande a la izquierda, título y fecha debajo a su derecha, y
 * contenido libre pegado al borde derecho (porcentaje/opciones en Inicio,
 * kcal y minutos/km-h en Cardio). */
export function HistoryCardRow({
  icon,
  title,
  date,
  right,
  spaced,
}: HistoryCardRowProps) {
  return (
    <View style={[styles.row, spaced && styles.rowSpaced]}>
      <View style={styles.left}>
        <View style={styles.accent}>{icon}</View>
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {title}
          </Text>
          {!!date && (
            <Text style={styles.date} numberOfLines={1}>
              {date}
            </Text>
          )}
        </View>
      </View>
      {!!right && <View style={styles.right}>{right}</View>}
    </View>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    // Padding vertical menor que el horizontal y sin `minHeight`: el alto lo
    // da el contenido (icono de 36 + una o dos filas), no un mínimo que
    // sobraba aire en la lista que más se recorre.
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      paddingVertical: 10,
      paddingHorizontal: theme.spacing.md,
      marginTop: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
      justifyContent: 'center',
      overflow: 'hidden',
      ...theme.shadow.soft,
    },
    cardToday: {
      borderColor: theme.colors.primaryLine,
      borderWidth: 2.5,
    },
    cardPressed: {
      opacity: 0.8,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 10,
    },
    rowSpaced: {
      marginTop: 10,
    },
    left: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      minWidth: 0,
    },
    accent: {
      marginLeft: -4,
      marginRight: 12,
    },
    info: {
      flex: 1,
      minWidth: 0,
    },
    // Nombre: estilo display compartido con Inicio, Cardio y el selector de día.
    name: dayNameText(),
    date: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginTop: 2,
      lineHeight: 16,
      fontWeight: '500',
    },
    right: {
      alignItems: 'flex-end',
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
