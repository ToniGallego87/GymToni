import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ParsedSet } from '@types/index';
import { formatSets, parseSeriesString } from '@lib/parsers';
import { theme } from '@lib/theme';

interface ExerciseResultDisplayProps {
  exerciseName: string;
  rawInput: string;
  parsedSets: ParsedSet[];
  notes?: string;
  previousSets?: ParsedSet[];
  improvementText?: string;
  improvementPositive?: boolean;
}

export function ExerciseResultDisplay({
  exerciseName,
  rawInput,
  parsedSets,
  notes,
  previousSets,
  improvementText,
  improvementPositive = true,
}: ExerciseResultDisplayProps) {
  // Si parsedSets está vacío pero tenemos rawInput, intentar parsear
  const effectiveParsedSets = (parsedSets && parsedSets.length > 0) 
    ? parsedSets 
    : (rawInput && rawInput !== '-' && rawInput.trim() ? parseSeriesString(rawInput) : []);

  // Mostrar parsedSets si existen, sino usar rawInput, sino mostrar guión
  const currentValue = (effectiveParsedSets && effectiveParsedSets.length > 0) 
    ? formatSets(effectiveParsedSets) 
    : (rawInput && rawInput !== '-' && rawInput.trim() ? rawInput : 'No realizado');
  const previousValue = (previousSets && previousSets.length > 0)
    ? formatSets(previousSets)
    : '-';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.exerciseName}>{exerciseName}</Text>
        {!!improvementText && (
          <Text
            style={[
              styles.improvementText,
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
            <Text style={[styles.resultValue, styles.currentResult]}>
              {currentValue}
            </Text>
          </View>
          <View style={styles.resultItem}>
            <Text style={styles.resultLabel}>Anterior</Text>
            <Text style={[styles.resultValue, styles.previousResult]}>
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
          <Text style={styles.notes}>{notes}</Text>
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
  header: {
    marginBottom: theme.spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  exerciseName: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.text,
    flex: 1,
  },
  improvementText: {
    fontSize: 13,
    fontWeight: '800',
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
});
