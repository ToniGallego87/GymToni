import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getTrainingAccent } from '@lib/theme';

type DayAccentIconProps = {
  emoji?: string;
  name?: string;
  size?: number;
};

export function DayAccentIcon({ emoji, name, size = 18 }: DayAccentIconProps) {
  return (
    <MaterialCommunityIcons
      name="circle"
      size={size}
      color={getTrainingAccent({ emoji, name })}
    />
  );
}
