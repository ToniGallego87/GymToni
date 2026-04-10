import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '@lib/theme';
import { FloatingGlassBar } from './FloatingGlassBar';

type FloatingPrimaryNavKey = 'home' | 'routines' | 'calendar' | 'data';

interface FloatingPrimaryNavProps {
  bottom: number;
  activeTab: FloatingPrimaryNavKey;
  onPressHome?: () => void;
  onPressRoutines?: () => void;
  onPressCalendar?: () => void;
  onPressData?: () => void;
}

type NavItem = {
  key: FloatingPrimaryNavKey;
  label: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  onPress?: () => void;
};

export function FloatingPrimaryNav({
  bottom,
  activeTab,
  onPressHome,
  onPressRoutines,
  onPressCalendar,
  onPressData,
}: FloatingPrimaryNavProps) {
  const items: NavItem[] = [
    {
      key: 'home',
      label: 'Entrenar',
      icon: 'dumbbell',
      onPress: onPressHome,
    },
    {
      key: 'routines',
      label: 'Rutinas',
      icon: 'book-open-variant',
      onPress: onPressRoutines,
    },
    {
      key: 'calendar',
      label: 'Calendario',
      icon: 'calendar-month-outline',
      onPress: onPressCalendar,
    },
    {
      key: 'data',
      label: 'Datos',
      icon: 'folder-cog-outline',
      onPress: onPressData,
    },
  ];

  return (
    <FloatingGlassBar bottom={bottom}>
      {items.map(item => {
        const isActive = item.key === activeTab;

        return (
          <TouchableOpacity
            key={item.key}
            style={[styles.item, isActive && styles.itemActive]}
            onPress={item.onPress}
            disabled={!item.onPress || isActive}
            activeOpacity={0.88}
          >
            <MaterialCommunityIcons
              name={item.icon}
              size={25}
              style={[styles.icon, isActive && styles.iconActive]}
            />
          </TouchableOpacity>
        );
      })}
    </FloatingGlassBar>
  );
}

const styles = StyleSheet.create({
  item: {
    flex: 1,
    borderRadius: 16,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 12,
    backgroundColor: 'transparent',
  },
  itemActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  icon: {
    color: theme.colors.textSecondary,
    marginBottom: 5,
  },
  iconActive: {
    color: theme.colors.primary,
  },
  label: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
    textAlign: 'center',
  },
  labelActive: {
    color: theme.colors.white,
  },
});