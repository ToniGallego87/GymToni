import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  GestureResponderEvent,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '@lib/theme';

interface CardioInputFieldProps {
  value: string;
  onChangeText: (text: string) => void;
  expanded?: boolean;
  onToggle?: (event: GestureResponderEvent) => void;
  placeholder?: string;
}

export function CardioInputField({
  value,
  onChangeText,
  expanded = true,
  onToggle,
  placeholder = 'Ej: Cinta: 22.5mins, 11.5kmh',
}: CardioInputFieldProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MaterialCommunityIcons name="run" size={20} color={theme.colors.text} style={styles.icon} />
          <Text style={styles.title}>Cardio (opcional)</Text>
        </View>
        {onToggle && (
          <Pressable
            style={({ pressed }) => [
              styles.toggleButton,
              pressed && styles.toggleButtonPressed,
            ]}
            onPress={onToggle}
          >
            <Text style={styles.toggleText}>{expanded ? '▼' : '▶'}</Text>
          </Pressable>
        )}
      </View>

      {expanded && (
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textSecondary}
          value={value}
          onChangeText={onChangeText}
          multiline={true}
          maxLength={200}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    marginVertical: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.primary,
    ...theme.shadow.soft,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.text,
    lineHeight: 22,
  },
  toggleButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  toggleButtonPressed: {
    opacity: 0.6,
  },
  toggleText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
  icon: {
    marginRight: 8,
  },
  input: {
    backgroundColor: theme.colors.darkGray,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    padding: 16,
    fontSize: 15,
    fontFamily: 'monospace',
    minHeight: 56,
    color: theme.colors.text,
    marginTop: 10,
    textAlignVertical: 'top',
    lineHeight: 22,
  },
});
