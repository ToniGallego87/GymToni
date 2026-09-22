import { subscribeTheme } from '@lib/themeStore';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { theme } from '@lib/theme';
import { dateLocale, fmtNum } from '@lib/i18n';

export interface WeightTrendPoint {
  /** Momento en que se anotó (ms). */
  at: number;
  /** Peso en kg. */
  weight: number;
}

interface WeightTrendChartProps {
  /** Del más antiguo al más reciente. */
  points: WeightTrendPoint[];
}

const HEIGHT = 170;
const PADDING = { top: 14, right: 14, bottom: 26, left: 44 };
const Y_TICKS = 3;

/**
 * Gráfica de línea del peso EN EL TIEMPO: el eje X es la fecha real, no el
 * índice del registro, así que dos pesadas separadas por tres meses se ven
 * separadas (la sparkline de la hero las pintaba equidistantes). Eje Y en kg
 * ajustado al rango real con margen: los pesos varían poco y partir de cero
 * aplanaría la línea.
 */
export function WeightTrendChart({ points }: WeightTrendChartProps) {
  const [width, setWidth] = useState(0);
  if (points.length < 2) return null;

  const plotWidth = width - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;

  const weights = points.map((p) => p.weight);
  const maxVal = Math.max(...weights);
  const minVal = Math.min(...weights);
  const span = maxVal - minVal;
  const margin = span > 0 ? span * 0.25 : 1;
  const domainMin = minVal - margin;
  const domainMax = maxVal + margin;

  const firstAt = points[0].at;
  const lastAt = points[points.length - 1].at;
  const timeSpan = Math.max(lastAt - firstAt, 1);

  const getX = (at: number) =>
    PADDING.left + ((at - firstAt) / timeSpan) * plotWidth;
  const getY = (value: number) =>
    PADDING.top + ((domainMax - value) / (domainMax - domainMin)) * plotHeight;

  const yTicks = Array.from(
    { length: Y_TICKS },
    (_, i) => domainMin + ((domainMax - domainMin) * i) / (Y_TICKS - 1)
  );

  const shortDate = (at: number) =>
    new Date(at).toLocaleDateString(dateLocale, {
      day: 'numeric',
      month: 'short',
    });
  // Fechas en el eje X: primera, última y, si hay sitio, la del medio.
  const xLabels = [
    { at: firstAt, align: 'left' as const },
    ...(plotWidth > 220
      ? [{ at: firstAt + timeSpan / 2, align: 'center' as const }]
      : []),
    { at: lastAt, align: 'right' as const },
  ];

  return (
    <View
      style={styles.wrapper}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {width > 0 && (
        <View style={[styles.chart, { width }]}>
          <Svg width={width} height={HEIGHT}>
            {yTicks.map((tick) => (
              <Line
                key={tick}
                x1={PADDING.left}
                x2={PADDING.left + plotWidth}
                y1={getY(tick)}
                y2={getY(tick)}
                stroke={theme.colors.border}
                strokeWidth={1}
                opacity={0.8}
              />
            ))}
            <Polyline
              points={points
                .map((p) => `${getX(p.at)},${getY(p.weight)}`)
                .join(' ')}
              fill="none"
              stroke={theme.colors.primary}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {points.map((p, i) => {
              const isLast = i === points.length - 1;
              return (
                <Circle
                  key={p.at}
                  cx={getX(p.at)}
                  cy={getY(p.weight)}
                  r={isLast ? 5 : 3}
                  fill={isLast ? theme.colors.primary : theme.colors.surface}
                  stroke={theme.colors.primary}
                  strokeWidth={2}
                />
              );
            })}
          </Svg>
          {yTicks.map((tick) => (
            <Text
              key={`y-${tick}`}
              style={[styles.yLabel, { top: getY(tick) - 8 }]}
            >
              {fmtNum(tick)}
            </Text>
          ))}
          {xLabels.map(({ at, align }) => {
            const x = getX(at);
            const left =
              align === 'left' ? x : align === 'center' ? x - 30 : x - 60;
            return (
              <Text
                key={`x-${align}`}
                style={[
                  styles.xLabel,
                  { left, textAlign: align, top: HEIGHT - PADDING.bottom + 6 },
                ]}
              >
                {shortDate(at)}
              </Text>
            );
          })}
        </View>
      )}
    </View>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    wrapper: {
      width: '100%',
      overflow: 'hidden',
    },
    chart: {
      height: HEIGHT,
      position: 'relative',
    },
    yLabel: {
      position: 'absolute',
      left: 0,
      width: 38,
      textAlign: 'right',
      fontSize: 11,
      color: theme.colors.textSecondary,
      lineHeight: 16,
      fontVariant: ['tabular-nums'],
    },
    xLabel: {
      position: 'absolute',
      width: 60,
      fontSize: 11,
      fontWeight: '700',
      color: theme.colors.textSecondary,
      lineHeight: 16,
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
