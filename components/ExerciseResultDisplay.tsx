import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ParsedSet } from '@types/index';
import { formatSets, parseSeriesString, formatParsedSet } from '@lib/parsers';
import { theme } from '@lib/theme';

interface ExerciseResultDisplayProps {
  exerciseName: string;
  rawInput: string;
  parsedSets: ParsedSet[];
  notes?: string;
  previousSets?: ParsedSet[];
  improvementText?: string;
  improvementPositive?: boolean;
  targetSets?: number;
  targetReps?: string | number;
  isDetail?: boolean;
}

// Formatea sets con saltos de carro para vista detalle
function formatSetsWithLineBreaks(sets: ParsedSet[]): string {
  return sets.map(s => formatParsedSet(s)).join('\n');
}

export function ExerciseResultDisplay({
  exerciseName,
  rawInput,
  parsedSets,
  notes,
  previousSets,
  improvementText,
  improvementPositive = true,
  targetSets,
  targetReps,
  isDetail = false,
}: ExerciseResultDisplayProps) {
  // Si parsedSets está vacío pero tenemos rawInput, intentar parsear
  const effectiveParsedSets = (parsedSets && parsedSets.length > 0) 
    ? parsedSets 
    : (rawInput && rawInput !== '-' && rawInput.trim() ? parseSeriesString(rawInput) : []);

  // Mostrar parsedSets si existen, sino usar rawInput, sino mostrar guión
  const currentValue = (effectiveParsedSets && effectiveParsedSets.length > 0) 
    ? (isDetail ? formatSetsWithLineBreaks(effectiveParsedSets) : formatSets(effectiveParsedSets))
    : (rawInput && rawInput !== '-' && rawInput.trim() ? rawInput : 'No realizado');
  const previousValue = (previousSets && previousSets.length > 0)
    ? (isDetail ? formatSetsWithLineBreaks(previousSets) : formatSets(previousSets))
    : '-';

  return (
    <View style={[styles.container, isDetail && styles.containerDetail]}>
      <View style={[styles.header, isDetail && styles.headerDetail]}>
        {isDetail && (targetSets !== undefined && targetReps !== undefined) ? (
          <View style={styles.exerciseNameContainer}>
            <Text style={[styles.exerciseName, styles.exerciseNameDetail]}>
              {exerciseName}
            </Text>
            <Text style={[styles.exerciseTarget, isDetail && styles.exerciseTargetDetail]}>
              {targetSets || '-'}x{targetReps || '-'}
            </Text>
          </View>
        ) : (
          <Text style={[styles.exerciseName, isDetail && styles.exerciseNameDetail]}>
            {exerciseName}
          </Text>
        )}
        {!!improvementText && (
          <Text
            style={[
              styles.improvementText,
              isDetail && styles.improvementTextDetail,
              improvementPositive ? styles.improvementUp : styles.improvementDown,
            ]}
          >
            {improvementText}
          </Text>
        )}
      </View>

      <View style={styles.resultsContainer}>
        <View style={styles.resultRow}>
          <View style={styles.resultItem}>
            <Text style={styles.resultLabel}>Realizado</Text>
            <Text style={[styles.resultValue, isDetail && styles.resultValueDetail, styles.currentResult]}>
              {currentValue}
            </Text>
          </View>
          <View style={styles.resultItem}>
            <Text style={styles.resultLabel}>Anterior</Text>
            <Text style={[styles.resultValue, isDetail && styles.resultValueDetail, styles.previousResult]}>
              {previousValue}
            </Text>
          </View>
        </View>

        {!rawInput.trim() && (
          <View style={styles.emptySet}>
            <Text style={styles.emptySetText}>-</Text>
          </View>
        )}
      </View>

      {notes && (
        <View style={styles.notesContainer}>
          <Text style={[styles.notes, isDetail && styles.notesDetail]}>{notes}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginVertical: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.soft,
  },
  containerDetail: {
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.push,
  },
  header: {
    marginBottom: theme.spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  headerDetail: {
    alignItems: 'flex-start',
  },
  exerciseNameContainer: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.text,
    flex: 1,
  },
  exerciseNameDetail: {
    fontSize: 16,
    marginBottom: 4,
  },
  exerciseTarget: {
    fontSize: 14,
    fontWeight: '400',
    color: theme.colors.textSecondary,
  },
  exerciseTargetDetail: {
    fontSize: 14,
  },
  improvementText: {
    fontSize: 13,
    fontWeight: '800',
  },
  improvementTextDetail: {
    fontSize: 16,
  },
  improvementUp: {
    color: theme.colors.success,
  },
  improvementDown: {
    color: theme.colors.error,
  },
  resultsContainer: {
    marginVertical: theme.spacing.sm,
  },
  resultRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  resultItem: {
    flex: 1,
    backgroundColor: theme.colors.darkGray,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  resultLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
    lineHeight: 16,
  },
  resultValue: {
    fontSize: 17,
    fontWeight: '700',
    fontFamily: 'monospace',
    lineHeight: 24,
  },
  resultValueDetail: {
    fontWeight: '400',
    lineHeight: 20,
  },
  currentResult: {
    color: theme.colors.push,
  },
  previousResult: {
    color: theme.colors.previous,
  },
  emptySet: {
    backgroundColor: theme.colors.darkGray,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  emptySetText: {
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
  notesContainer: {
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  notes: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  notesDetail: {
    fontSize: 15,
  },
});
