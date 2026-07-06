import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '@lib/theme';
import { FloatingGlassBar } from './FloatingGlassBar';

type FloatingPrimaryNavKey =
  | 'home'
  | 'cardio'
  | 'routines'
  | 'calendar'
  | 'data';

interface FloatingPrimaryNavProps {
  bottom: number;
  activeTab: FloatingPrimaryNavKey;
  /** Oculta el botón de Cardio cuando no hay ningún registro de cardio. */
  showCardio?: boolean;
  onPressHome?: () => void;
  onPressCardio?: () => void;
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
  showCardio = true,
  onPressHome,
  onPressCardio,
  onPressRoutines,
  onPressCalendar,
  onPressData,
}: FloatingPrimaryNavProps) {
  const items: NavItem[] = [
    {
      key: 'home',
      label: 'Fuerza',
      icon: 'dumbbell',
      onPress: onPressHome,
    },
    {
      key: 'cardio',
      label: 'Cardio',
      icon: 'run-fast',
      onPress: onPressCardio,
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

  const visibleItems = showCardio
    ? items
    : items.filter((item) => item.key !== 'cardio');

  return (
    <FloatingGlassBar bottom={bottom}>
      {visibleItems.map((item) => {
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
              size={22}
              style={[styles.icon, isActive && styles.iconActive]}
            />
            <Text
              style={[styles.label, isActive && styles.labelActive]}
              numberOfLines={1}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </FloatingGlassBar>
  );
}

const styles = StyleSheet.create({
  item: {
    flex: 1,
    borderRadius: 14,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 6,
    backgroundColor: 'transparent',
  },
  itemActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  icon: {
    color: theme.colors.textSecondary,
    marginBottom: 3,
  },
  iconActive: {
    color: theme.colors.white,
  },
  label: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  labelActive: {
    color: theme.colors.white,
  },
});
