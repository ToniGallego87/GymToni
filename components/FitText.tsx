import React, { useState } from 'react';
import {
  NativeSyntheticEvent,
  StyleProp,
  Text,
  TextLayoutEventData,
  TextStyle,
} from 'react-native';
import { startTextFit, stepTextFit } from '@lib/textFit';

// Interlineado al encoger: con menos letra cabe una línea más en la misma caja.
const SHRUNK_LINE_HEIGHT_RATIO = 1.2;
// Redondeo a píxeles del alto que devuelve la medida.
const HEIGHT_TOLERANCE = 1;

interface FitTextProps {
  /** Si el texto puede cambiar, ponle `key={texto}`: la medida es de ese texto. */
  children: string;
  style?: StyleProp<TextStyle>;
  /** Alto de la caja: el texto ocupa eso como mucho, en las líneas que hagan falta. */
  maxHeight: number;
  /** Tamaño y alto de línea de partida: si cabe así, no se toca. */
  fontSize: number;
  lineHeight: number;
  minFontSize?: number;
}

/**
 * Texto que no se trunca: baja la letra lo justo para caber entero en su caja,
 * pasando a más líneas si con ellas queda mayor (ver lib/textFit.ts). No se pinta
 * hasta tener el tamaño, que es cosa de un par de fotogramas.
 */
export function FitText({
  children,
  style,
  maxHeight,
  fontSize,
  lineHeight,
  minFontSize = 7,
}: FitTextProps) {
  const [fit, setFit] = useState(() => startTextFit(fontSize, minFontSize));

  const handleTextLayout = (e: NativeSyntheticEvent<TextLayoutEventData>) => {
    const height = e.nativeEvent.lines.reduce((sum, l) => sum + l.height, 0);
    const fits = height <= maxHeight + HEIGHT_TOLERANCE;
    setFit((current) => stepTextFit(current, fits));
  };

  return (
    <Text
      style={[
        style,
        {
          fontSize: fit.size,
          lineHeight:
            fit.size === fontSize
              ? lineHeight
              : fit.size * SHRUNK_LINE_HEIGHT_RATIO,
          opacity: fit.done ? 1 : 0,
        },
      ]}
      onTextLayout={handleTextLayout}
    >
      {children}
    </Text>
  );
}
