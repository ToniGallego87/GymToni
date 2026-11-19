import React, { useRef, useState } from 'react';
import {
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  TextLayoutEventData,
  TextProps,
} from 'react-native';
import { breaksWord, startTextFit, stepTextFit } from '@lib/textFit';

// Interlineado al encoger dentro de una caja de alto fijo (`maxHeight`): con
// menos letra cabe una línea más en la misma caja.
const SHRUNK_LINE_HEIGHT_RATIO = 1.2;
// Redondeo a píxeles del alto que devuelve la medida.
const HEIGHT_TOLERANCE = 1;
const DEFAULT_FONT_SIZE = 14;

interface FitTextProps
  extends Omit<TextProps, 'children' | 'numberOfLines' | 'onTextLayout'> {
  /** Si el texto puede cambiar, ponle `key={texto}`: la medida es de ese texto. */
  children: string;
  /** Alto de la caja: el texto ocupa eso como mucho, en las líneas que hagan falta. */
  maxHeight?: number;
  /** Líneas como mucho (sustituye a `numberOfLines`, que cortaría con "…"). */
  maxLines?: number;
  /** Tamaño y alto de línea de partida (por defecto, los del `style`): si cabe así, no se toca. */
  fontSize?: number;
  lineHeight?: number;
  minFontSize?: number;
  /**
   * Cambia cuando cambia el ancho disponible (p. ej. al aparecer o quitarse algo
   * al lado): vuelve a medir desde el tamaño de partida. Sin él, solo se re-mide
   * hacia abajo si deja de caber.
   */
  layoutKey?: unknown;
}

/**
 * Texto que no se trunca ni parte palabras: baja la letra lo justo para caber
 * entero en su caja (`maxHeight` / `maxLines`) sin cortar ninguna palabra a
 * media línea ("Complementario" / "s"), pasando a más líneas si con ellas queda
 * mayor (ver lib/textFit.ts). La primera vez no se pinta hasta tener el
 * tamaño, que es cosa de un par de fotogramas.
 */
export function FitText({
  children,
  style,
  maxHeight,
  maxLines,
  fontSize,
  lineHeight,
  minFontSize = 7,
  layoutKey,
  ...rest
}: FitTextProps) {
  const flat = StyleSheet.flatten(style) ?? {};
  const baseSize = fontSize ?? flat.fontSize ?? DEFAULT_FONT_SIZE;
  const baseLineHeight = lineHeight ?? flat.lineHeight;
  const minSize = Math.min(minFontSize, baseSize);

  const [fit, setFit] = useState(() => startTextFit(baseSize, minSize));
  const [measuredKey, setMeasuredKey] = useState(layoutKey);
  if (measuredKey !== layoutKey) {
    setMeasuredKey(layoutKey);
    setFit(startTextFit(baseSize, minSize));
  }
  // Una vez pintado, las re-medidas no lo vuelven a ocultar (no parpadea).
  const shown = useRef(false);
  if (fit.done) shown.current = true;

  const handleTextLayout = (e: NativeSyntheticEvent<TextLayoutEventData>) => {
    const { lines } = e.nativeEvent;
    const height = lines.reduce((sum, l) => sum + l.height, 0);
    const fits =
      (maxHeight == null || height <= maxHeight + HEIGHT_TOLERANCE) &&
      (maxLines == null || lines.length <= maxLines) &&
      !breaksWord(lines.map((l) => l.text));
    setFit((current) => stepTextFit(current, fits));
  };

  const shrunkLineHeight =
    baseLineHeight == null
      ? undefined
      : fit.size === baseSize
      ? baseLineHeight
      : maxHeight != null
      ? fit.size * SHRUNK_LINE_HEIGHT_RATIO
      : (baseLineHeight * fit.size) / baseSize;

  return (
    <Text
      {...rest}
      style={[
        style,
        {
          fontSize: fit.size,
          lineHeight: shrunkLineHeight,
          opacity: shown.current ? flat.opacity ?? 1 : 0,
        },
      ]}
      // Ni al mínimo cabe: entonces sí se corta, para no romper la tarjeta.
      numberOfLines={fit.done && fit.size <= fit.min ? maxLines : undefined}
      onTextLayout={handleTextLayout}
    >
      {children}
    </Text>
  );
}
