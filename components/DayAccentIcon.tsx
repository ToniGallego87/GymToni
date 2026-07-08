import React from 'react';
import { theme } from '@lib/theme';
import { GymIcon, resolveDayIcon } from './GymIcon';

type DayAccentIconProps = {
  // `emoji` conserva su nombre por compatibilidad, pero ahora guarda el nombre
  // del icono (p. ej. 'pull'); los valores antiguos (emoji de color) se mapean.
  emoji?: string;
  name?: string;
  size?: number;
  color?: string;
};

export function DayAccentIcon({
  emoji,
  name,
  size = 18,
  color = theme.colors.white,
}: DayAccentIconProps) {
  return <GymIcon name={resolveDayIcon(emoji, name)} size={size} color={color} />;
}
