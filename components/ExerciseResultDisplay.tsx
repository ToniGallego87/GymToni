import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ParsedSet } from '../types';
import { parseSeriesString, formatParsedSet } from '@lib/parsers';
import { theme } from '@lib/theme';

interface ExerciseResultDisplayProps {
  exerciseName: string;
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
}

type ComparisonStatus = 'up' | 'same' | 'down' | 'missing';

function compareSetPerformance(
  current?: ParsedSet,
  previous?: ParsedSet
): ComparisonStatus {
  if (!current || !previous) return 'missing';

  if (current.weight > previous.weight) return 'up';
  if (current.weight < previous.weight) return 'down';

  if (current.reps > previous.reps) return 'up';
  if (current.reps < previous.reps) return 'down';

  return 'same';
}

function getStatusSymbol(status: ComparisonStatus): string {
  switch (status) {
    case 'up':
      return '↑';
    case 'down':
      return '↓';
    case 'same':
      return '=';
    default:
      return '—';
  }
}

export function ExerciseResultDisplay({
  exerciseName,
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
}: ExerciseResultDisplayProps) {

  const effectiveParsedSets =
    parsedSets && parsedSets.length > 0
      ? parsedSets
      : rawInput && rawInput !== '-' && rawInput.trim()
      ? parseSeriesString(rawInput)
      : [];

  const maxRows = Math.max(
    effectiveParsedSets.length,
    previousSets?.length ?? 0
  );

  const rows = Array.from({ length: maxRows }).map((_, i) => {
    const current = effectiveParsedSets[i];
    const previous = previousSets?.[i];

    const status = compareSetPerformance(current, previous);

    return {
      currentText: current ? formatParsedSet(current) : '—',
      previousText: previous ? formatParsedSet(previous) : '—',
      status,
    };
  });

  return (
    <View style={[styles.container, isDetail && styles.containerDetail]}>

      {/* Header */}
      <View style={[styles.header, isDetail && styles.headerDetail]}>
        <View style={styles.exerciseNameContainer}>
          <Text style={[styles.exerciseName, isDetail && styles.exerciseNameDetail]}>
            {exerciseName}
          </Text>

          {isDetail && (
            <Text style={styles.exerciseTarget}>
              {targetSets || '-'}x{targetReps || '-'}
            </Text>
          )}
        </View>

        {!!improvementText && (
          <Text
            style={[
              styles.improvementText,
              improvementColor ? { color: improvementColor } : (improvementPositive ? styles.improvementUp : styles.improvementDown),
            ]}
          >
            {improvementText}
          </Text>
        )}
      </View>

      {/* Comparison */}
      <View style={styles.resultsContainer}>

        <View style={styles.columnHeader}>
          <Text style={styles.columnLabel}>Actual</Text>
          <View style={{ width: 32 }} />
          <Text style={styles.columnLabel}>Anterior</Text>
        </View>

        {rows.map((row, index) => (
          <View key={index} style={styles.row}>

            <Text style={styles.currentValue}>
              {row.currentText}
            </Text>

            <View style={[
              styles.badge,
              row.status === 'up' && styles.badgeUp,
              row.status === 'down' && styles.badgeDown,
              row.status === 'same' && styles.badgeSame,
              row.status === 'missing' && styles.badgeMissing,
            ]}>
              <Text style={styles.badgeText}>
                {getStatusSymbol(row.status)}
              </Text>
            </View>

            <Text style={styles.previousValue}>
              {row.previousText}
            </Text>

          </View>
        ))}

      </View>

      {notes && (
        <View style={styles.notesContainer}>
          <Text style={styles.notes}>
            {notes}
          </Text>
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
    borderLeftColor: theme.colors.current,
  },

  header: {
    marginBottom: theme.spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  headerDetail: {
    alignItems: 'flex-start',
  },

  exerciseNameContainer: {
    flex: 1,
  },

  exerciseName: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
  },

  exerciseNameDetail: {
    fontSize: 16,
    marginBottom: 4,
  },

  exerciseTarget: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },

  improvementText: {
    fontSize: 14,
    fontWeight: '800',
  },

  improvementUp: {
    color: theme.colors.success,
  },

  improvementDown: {
    color: theme.colors.error,
  },

  resultsContainer: {
    marginTop: theme.spacing.sm,
  },

  columnHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingHorizontal: 4,
  },

  columnLabel: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    fontWeight: '600',
    letterSpacing: 0.5,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',

    paddingVertical: 6,
    paddingHorizontal: 4,

    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },

  currentValue: {
    flex: 1,
    fontFamily: 'monospace',
    color: theme.colors.current,
    fontSize: 15,
  },

  previousValue: {
    flex: 1,
    textAlign: 'right',
    fontFamily: 'monospace',
    color: theme.colors.previous,
    fontSize: 15,
  },

  badge: {
    width: 28,
    height: 20,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
  },

  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },

  badgeUp: {
    backgroundColor: 'rgb(80,200,120)',
  },

  badgeDown: {
    backgroundColor: 'rgb(255,90,90)',
  },

  badgeSame: {
    backgroundColor: 'rgb(180,180,180)',
  },

  badgeMissing: {
    backgroundColor: 'rgb(120,120,120)',
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
    fontStyle: 'italic',
  },

});