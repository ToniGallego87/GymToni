import { subscribeTheme } from '@lib/themeStore';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '@lib/theme';

export interface BarChartPoint {
  key: string;
  value: number;
  /** Etiqueta bajo la barra ("S3", "jul"). */
  label: string;
  /** Texto sobre (o bajo) la barra: el valor ya formateado. */
  valueLabel: string;
  color: string;
  /** Tinta del valor. Por defecto, la de la barra. */
  valueColor?: string;
  /** Destaca la etiqueta del eje X (la semana/mes en curso). */
  highlighted?: boolean;
}

interface BarChartProps {
  points: BarChartPoint[];
  width: number;
  /** Rango del eje Y: cada gráfica tiene su criterio (ver los consumidores). */
  domain: { min: number; max: number };
  /** Formatea las tres marcas del eje Y. */
  formatYTick: (value: number) => string;
  /**
   * Valores con signo: dibuja el eje del cero y las barras negativas crecen
   * hacia abajo (progreso semanal). Sin él, las barras nacen del suelo del
   * dominio (métricas de cardio, siempre positivas).
   */
  signed?: boolean;
}

const HEIGHT = 170;
const PADDING = { top: 18, right: 12, bottom: 28, left: 42 };

/**
 * Gráfica de barras de la app (progreso semanal en Inicio y métricas mensuales
 * en Cardio). Antes cada pantalla tenía su propia copia, casi idéntica: mismo
 * alto, mismo cálculo de ranuras y anchos, mismas tres líneas de rejilla.
 *
 * Aquí solo vive el dibujo; el dominio y el color de cada barra los decide
 * quien la usa, que es lo único en lo que las dos gráficas difieren de verdad.
 */
export function BarChart({
  points,
  width,
  domain,
  formatYTick,
  signed = false,
}: BarChartProps) {
  const plotWidth = width - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;

  const slotWidth = points.length > 0 ? plotWidth / points.length : plotWidth;
  const barWidth = Math.max(18, Math.min(slotWidth * 0.55, 34));
  const getX = (index: number) =>
    PADDING.left + index * slotWidth + (slotWidth - barWidth) / 2;

  const getY = (value: number) => {
    if (domain.max === domain.min) return PADDING.top + plotHeight / 2;
    return (
      PADDING.top +
      ((domain.max - value) / (domain.max - domain.min)) * plotHeight
    );
  };

  // Con signo las barras salen del cero; si no, del suelo del dominio.
  const baselineValue = signed ? 0 : domain.min;
  const baselineY = getY(baselineValue);
  const yTicks = [domain.max, (domain.max + domain.min) / 2, domain.min];

  return (
    <View style={styles.wrapper}>
      <View style={[styles.chart, { width }]}>
        {yTicks.map((tick, index) => (
          <View
            key={`grid-${index}`}
            style={[
              styles.gridLine,
              { top: getY(tick), left: PADDING.left, width: plotWidth },
            ]}
          />
        ))}

        {signed && (
          <View
            style={[
              styles.axisLine,
              { top: baselineY, left: PADDING.left, width: plotWidth },
            ]}
          />
        )}

        {points.map((point, index) => {
          const x = getX(index);
          const y = getY(point.value);
          const isPositive = point.value >= baselineValue;
          const barTop = isPositive ? y : baselineY;
          const barHeight = Math.max(Math.abs(baselineY - y), 4);

          return (
            <React.Fragment key={point.key}>
              <View
                style={[
                  styles.bar,
                  {
                    left: x,
                    top: barTop,
                    height: barHeight,
                    width: barWidth,
                    backgroundColor: point.color,
                  },
                ]}
              />
              <Text
                style={[
                  styles.valueLabel,
                  {
                    color: point.valueColor ?? point.color,
                    left: x + barWidth / 2 - 22,
                    top: isPositive ? barTop - 16 : barTop + barHeight + 2,
                  },
                ]}
                numberOfLines={1}
              >
                {point.valueLabel}
              </Text>
              <Text
                style={[
                  styles.xLabel,
                  point.highlighted && styles.xLabelHighlighted,
                  { left: x + barWidth / 2 - 22, top: HEIGHT - 20 },
                ]}
                numberOfLines={1}
              >
                {point.label}
              </Text>
            </React.Fragment>
          );
        })}

        {yTicks.map((tick, index) => (
          <Text
            key={`y-${index}`}
            style={[styles.yLabel, { top: getY(tick) - 8 }]}
            numberOfLines={1}
          >
            {formatYTick(tick)}
          </Text>
        ))}
      </View>
    </View>
  );
}

const makeStyles = () => StyleSheet.create({
  wrapper: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    overflow: 'hidden',
  },
  chart: {
    height: HEIGHT,
    position: 'relative',
  },
  gridLine: {
    position: 'absolute',
    height: 1,
    backgroundColor: theme.colors.border,
    opacity: 0.8,
  },
  axisLine: {
    position: 'absolute',
    height: 1,
    backgroundColor: theme.colors.veryLightGray,
    opacity: 0.65,
  },
  bar: {
    position: 'absolute',
    borderRadius: 6,
  },
  valueLabel: {
    position: 'absolute',
    width: 44,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
  },
  xLabel: {
    position: 'absolute',
    width: 44,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    lineHeight: 16,
  },
  xLabelHighlighted: {
    color: theme.colors.primary,
    fontWeight: '800',
  },
  yLabel: {
    position: 'absolute',
    left: 0,
    width: 38,
    textAlign: 'right',
    fontSize: 11,
    color: theme.colors.textSecondary,
    paddingRight: 6,
    lineHeight: 16,
  },
});

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
