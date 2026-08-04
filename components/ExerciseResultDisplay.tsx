import { subscribeTheme } from '@lib/themeStore';
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ParsedSet } from '../types';
import { parseSeriesString, formatParsedSet } from '@lib/parsers';
import { getSetPerformanceScore } from '@lib/progress';
import { theme } from '@lib/theme';
import { t } from '@lib/i18n';
import { GradientFill } from './GradientFill';
import { ExerciseGifButton } from './ExerciseGifButton';

interface ExerciseResultDisplayProps {
  exerciseName: string;
  // Id del catálogo del ejercicio (si viene de ahí), para la lupa de consulta.
  catalogId?: string;
  rawInput: string;
  parsedSets: ParsedSet[];
  notes?: string;
  previousSets?: ParsedSet[];
  improvementText?: string;
  improvementPositive?: boolean;
  improvementColor?: string;
  targetSets?: number;
  targetReps?: string | number;
  isDetail?: boolean;
  // Color de acento del día. Tiñe el degradado de fondo en detalle.
  accent?: string;
  // Fija un GIF al ejercicio de la rutina desde el buscador (botón Asignar).
  onAssignGif?: (catalogId: string) => void;
  // Abre la evolución de este ejercicio (gráfica de progreso) preseleccionado.
  onOpenProgress?: () => void;
}

type ComparisonStatus = 'up' | 'same' | 'down' | 'missing';

function compareSetPerformance(
  current?: ParsedSet,
  previous?: ParsedSet
): ComparisonStatus {
  if (!current || !previous) return 'missing';

  // Misma métrica que el porcentaje global del ejercicio: volumen de carga
  // (peso × reps). Así la flecha por serie no contradice el % de la cabecera
  // (p. ej. subir peso pero bajar reps puede ser menos volumen → flecha abajo).
  const currentScore = getSetPerformanceScore(current);
  const previousScore = getSetPerformanceScore(previous);

  if (currentScore > previousScore) return 'up';
  if (currentScore < previousScore) return 'down';

  return 'same';
}

const STATUS_GLYPH: Record<ComparisonStatus, string> = {
  up: '↑',
  down: '↓',
  same: '=',
  missing: '·',
};

export function ExerciseResultDisplay({
  exerciseName,
  catalogId,
  rawInput,
  parsedSets,
  notes,
  previousSets,
  improvementText,
  improvementPositive = true,
  improvementColor,
  targetSets,
  targetReps,
  isDetail = false,
  accent = theme.colors.current,
  onAssignGif,
  onOpenProgress,
}: ExerciseResultDisplayProps) {
  // En render para leer los colores del tema VIVO (cambio de tema en caliente).
  const STATUS_COLOR: Record<ComparisonStatus, string> = {
    up: theme.colors.success,
    down: theme.colors.error,
    same: theme.colors.textSecondary,
    missing: theme.colors.textMuted,
  };
  const effectiveParsedSets =
    parsedSets && parsedSets.length > 0
      ? parsedSets
      : rawInput && rawInput !== '-' && rawInput.trim()
      ? parseSeriesString(rawInput)
      : [];

  // Sin sesión anterior con la que comparar, la mitad de la tarjeta serían
  // placeholders ("—" y glifos "·"): se colapsa a una sola columna ("lo que
  // hiciste"). El % de mejora ya llega vacío en ese caso (lo decide Detail).
  const hasPrevious = !!(previousSets && previousSets.length > 0);

  const maxRows = hasPrevious
    ? Math.max(effectiveParsedSets.length, previousSets?.length ?? 0)
    : effectiveParsedSets.length;

  const rows = Array.from({ length: maxRows }).map((_, i) => {
    const current = effectiveParsedSets[i];
    const previous = previousSets?.[i];

    return {
      currentText: current ? formatParsedSet(current) : '—',
      previousText: previous ? formatParsedSet(previous) : '—',
      status: compareSetPerformance(current, previous),
    };
  });

  const hasTarget = !!targetSets || !!targetReps;

  return (
    <View style={styles.container}>
      {isDetail && <GradientFill accent={accent} />}

      {/* Cabecera: nombre del ejercicio + objetivo y mejora a la derecha. */}
      <View style={styles.header}>
        <Text style={styles.exerciseName} numberOfLines={2}>
          {exerciseName}
        </Text>
        <ExerciseGifButton
          name={exerciseName}
          catalogId={catalogId}
          size={18}
          onAssign={onAssignGif}
        />
        {!!onOpenProgress && (
          <Pressable
            style={({ pressed }) => [
              styles.progressButton,
              pressed && styles.progressButtonPressed,
            ]}
            onPress={onOpenProgress}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('Ver evolución')}
          >
            <MaterialCommunityIcons
              name="chart-line"
              size={18}
              color={theme.colors.textSecondary}
            />
          </Pressable>
        )}
        {!!improvementText && (
          <Text
            style={[
              styles.improvementText,
              {
                color:
                  improvementColor ??
                  (improvementPositive
                    ? theme.colors.success
                    : theme.colors.error),
              },
            ]}
          >
            {improvementText}
          </Text>
        )}
      </View>

      {/* Etiquetas de columna; el objetivo (4×10) ocupa el hueco central. Sin
          sesión anterior, el objetivo se alinea a la derecha y no hay columna
          "Anterior". */}
      <View style={styles.columnHeader}>
        <Text style={[styles.columnLabel, styles.columnLeft]}>
          {t('Actual')}
        </Text>
        {hasPrevious ? (
          <>
            <Text style={styles.targetLabel}>
              {hasTarget ? `${targetSets || '-'}×${targetReps || '-'}` : ''}
            </Text>
            <Text style={[styles.columnLabel, styles.columnRight]}>
              {t('Anterior')}
            </Text>
          </>
        ) : (
          hasTarget && (
            <Text style={[styles.columnLabel, styles.columnRight]}>
              {`${targetSets || '-'}×${targetReps || '-'}`}
            </Text>
          )
        )}
      </View>

      {rows.map((row, index) => (
        <View key={index} style={[styles.row, index > 0 && styles.rowDivider]}>
          <Text style={[styles.setValue, styles.currentValue]}>
            {row.currentText}
          </Text>
          {hasPrevious && (
            <>
              <Text
                style={[
                  styles.statusGlyph,
                  { color: STATUS_COLOR[row.status] },
                ]}
              >
                {STATUS_GLYPH[row.status]}
              </Text>
              <Text style={[styles.setValue, styles.previousValue]}>
                {row.previousText}
              </Text>
            </>
          )}
        </View>
      ))}

      {!!notes && <Text style={styles.notes}>{notes}</Text>}
    </View>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    container: {
      backgroundColor: 'transparent',
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginVertical: 5,
      overflow: 'hidden',
      ...theme.shadow.soft,
    },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 8,
    },

    // Misma fuente que el título de cada ejercicio en la vista de inserción
    // (ExerciseInputField): display (Anton).
    exerciseName: {
      flex: 1,
      fontSize: 19,
      fontFamily: theme.fonts.display,
      letterSpacing: 0.3,
      color: theme.colors.text,
      lineHeight: 27,
    },

    // Botón de evolución del ejercicio: mismo tamaño/forma que el de GIF pero
    // con acento neutro (es acción secundaria de consulta, no la primaria dorada).
    progressButton: {
      width: 34,
      height: 34,
      borderRadius: theme.borderRadius.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface,
    },
    progressButtonPressed: {
      opacity: 0.8,
    },

    improvementText: {
      fontSize: 14,
      fontWeight: '800',
      lineHeight: 18,
    },

    columnHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 2,
    },

    columnLabel: {
      flex: 1,
      fontSize: 12,
      color: theme.colors.textMuted,
      textTransform: 'uppercase',
      fontWeight: '700',
      letterSpacing: 0.8,
      lineHeight: 15,
    },

    columnLeft: {
      textAlign: 'left',
    },

    columnRight: {
      textAlign: 'right',
    },

    // Objetivo del ejercicio (series×reps), centrado entre las dos columnas.
    targetLabel: {
      minWidth: 44,
      textAlign: 'center',
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.textMuted,
      lineHeight: 15,
    },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 5,
    },

    rowDivider: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
    },

    setValue: {
      flex: 1,
      fontSize: 18,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
      lineHeight: 23,
    },

    currentValue: {
      color: theme.colors.text,
    },

    previousValue: {
      textAlign: 'right',
      color: theme.colors.textSecondary,
    },

    statusGlyph: {
      minWidth: 44,
      textAlign: 'center',
      fontSize: 18,
      fontWeight: '800',
      lineHeight: 23,
    },

    notes: {
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
      fontSize: 12,
      color: theme.colors.textSecondary,
      fontStyle: 'italic',
      lineHeight: 17,
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
