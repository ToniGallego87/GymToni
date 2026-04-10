import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  GestureResponderEvent,
} from 'react-native';
import { DayAccentIcon } from './DayAccentIcon';
import { getDisplayDayName, getTrainingAccent, theme } from '@lib/theme';

interface DayCardProps {
  emoji: string;
  name: string;
  description: string;
  onPress: (event: GestureResponderEvent) => void;
}

export function DayCard({ emoji, name, description, onPress }: DayCardProps) {
  const accentColor = getTrainingAccent({ emoji, name });

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={onPress}
    >
      <View style={styles.content}>
        <View style={styles.leading}>
          <View style={[styles.dot, { backgroundColor: accentColor }]} />
          <DayAccentIcon emoji={emoji} name={name} size={22} />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.name}>{getDisplayDayName(name)}</Text>
          <Text style={styles.description}>{description}</Text>
        </View>
        <View style={styles.badgeWrap}>
          <Text style={styles.badgeText}>{name.match(/^Día\s+\d+/i)?.[0] || ''}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginVertical: theme.spacing.xs,
    marginHorizontal: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.soft,
  },
  pressed: {
    opacity: 0.92,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  leading: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 14,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  name: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 4,
  },
  description: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
  badgeWrap: {
    marginLeft: 12,
  },
  badgeText: {
    color: theme.colors.primaryLight,
    backgroundColor: theme.colors.primaryMuted,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.pill,
    fontSize: 12,
    fontWeight: '700',
    overflow: 'hidden',
  },
});
