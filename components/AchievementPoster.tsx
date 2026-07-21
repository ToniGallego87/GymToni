import React, { forwardRef } from 'react';
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Rect,
  Circle,
  Line,
  G,
  Text as SvgText,
  TSpan,
  Image as SvgImage,
} from 'react-native-svg';
import { WeekAchievements, SlotColor } from '@lib/achievements';
import { darkColors } from '@lib/theme';
import { t } from '@lib/i18n';

// Lienzo vertical 9:16, ideal para historias/stories de redes.
export const POSTER_WIDTH = 1080;
export const POSTER_HEIGHT = 1920;

// Alias locales de la paleta del tema (el póster se renderiza en SVG con los
// mismos colores de la app). PANEL_BORDER/TRACK son tonos propios del póster.
// El póster se pinta siempre sobre lienzo oscuro (PANEL_BORDER/TRACK), así que
// el oro es el de superficie: el bronce oscuro de la tinta de día se apagaba.
const GOLD = darkColors.primaryFill;
const GOLD_SOFT = darkColors.primaryFillLight;
const GREEN = darkColors.success;
const PANEL_BORDER = '#2A2F3A';
const TRACK = '#262B36';
const TEXT = darkColors.text;
const MUTED = darkColors.textSecondary;

// Fuente display de la app (Anton, cargada en App.tsx). Se usa en los titulares,
// números y etiquetas para que el póster sea coherente con el resto de la app.
const DISPLAY_FONT = 'Anton';

// Reparte un texto en como mucho 2 líneas (por palabras) para que quepa con un
// tamaño de fuente fijo. Así todas las frases blancas se ven igual de grandes.
function wrapText(text: string, maxChars = 15): string {
  const clean = text.trim();
  if (clean.length <= maxChars) return clean;

  const words = clean.split(/\s+/);
  if (words.length === 1) return clean;

  let first = '';
  let rest = '';
  for (const word of words) {
    if (!rest && (first ? `${first} ${word}` : word).length <= maxChars) {
      first = first ? `${first} ${word}` : word;
    } else {
      rest = rest ? `${rest} ${word}` : word;
    }
  }
  return rest ? `${first}\n${rest}` : first;
}

// Ancho útil bajo cada donut (media columna del póster menos margen). Los
// sublabels largos reducen fuente en vez de invadir la otra columna.
const SUB_LABEL_MAX_WIDTH = 460;
const SUB_LABEL_CHAR_RATIO = 0.55; // Ancho medio de carácter ≈ 0.55 × fontSize (bold).

// Envuelve en 2 líneas, trunca lo imposible y encoge la fuente para que ninguna
// línea desborde su columna (nombres de ejercicio largos incluidos).
function fitSubLabel(text: string): { text: string; font: number } {
  const lines = wrapText(text, 17)
    .split('\n')
    .map((line) =>
      line.length > 24 ? `${line.slice(0, 23).trimEnd()}…` : line
    );
  const longest = Math.max(...lines.map((line) => line.length));
  const font =
    longest <= 13
      ? 50
      : Math.max(
          38,
          Math.min(
            50,
            Math.floor(SUB_LABEL_MAX_WIDTH / (SUB_LABEL_CHAR_RATIO * longest))
          )
        );
  return { text: lines.join('\n'), font };
}

// Primera letra en mayúscula (ignora signos iniciales como «¡»), para que todas
// las frases blancas sigan el mismo formato que los nombres de ejercicio.
function capitalizeFirst(text: string): string {
  for (let i = 0; i < text.length; i++) {
    if (/[a-zA-ZÀ-ÿ]/.test(text[i])) {
      return text.slice(0, i) + text[i].toUpperCase() + text.slice(i + 1);
    }
  }
  return text;
}

// Colores semánticos de los slots → paleta del tema.
const SLOT_COLORS: Record<SlotColor, string> = {
  success: GREEN,
  gold: GOLD,
  goldSoft: GOLD_SOFT,
};

interface DonutProps {
  cx: number;
  cy: number;
  radius: number;
  // Fracción rellena del anillo (0-1) y su color.
  fraction: number;
  color: string;
  // Texto del centro: valor grande + unidad pequeña opcional.
  centerMain: string;
  centerMainFont?: number;
  centerSub?: string;
  // Etiqueta dorada bajo el anillo + sublínea opcional (p. ej. nombre de ejercicio).
  label: string;
  subLabel?: string;
  subLabelFont?: number;
  // Opacidad del conjunto (para la animación de aparición).
  opacity?: number;
}

function Donut({
  cx,
  cy,
  radius,
  fraction,
  color,
  centerMain,
  centerMainFont = 86,
  centerSub,
  label,
  subLabel,
  subLabelFont = 50,
  opacity = 1,
}: DonutProps) {
  const strokeWidth = 30;
  const circumference = 2 * Math.PI * radius;
  const filled = Math.max(0, Math.min(1, fraction));

  return (
    <G opacity={opacity}>
      <Circle
        cx={cx}
        cy={cy}
        r={radius}
        stroke={TRACK}
        strokeWidth={strokeWidth}
        fill="none"
      />
      {filled > 0 && (
        <Circle
          cx={cx}
          cy={cy}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${filled * circumference} ${circumference}`}
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      )}
      <SvgText
        x={cx}
        y={centerSub ? cy + 14 : cy + 30}
        fill={TEXT}
        fontSize={centerMainFont}
        fontFamily={DISPLAY_FONT}
        textAnchor="middle"
      >
        {centerMain}
      </SvgText>
      {!!centerSub && (
        <SvgText
          x={cx}
          y={cy + 70}
          fill={MUTED}
          fontSize={42}
          fontWeight="700"
          textAnchor="middle"
        >
          {centerSub}
        </SvgText>
      )}
      <SvgText
        x={cx}
        y={cy + radius + 90}
        fill={GOLD}
        fontSize={50}
        fontFamily={DISPLAY_FONT}
        letterSpacing={1}
        textAnchor="middle"
      >
        {label}
      </SvgText>
      {!!subLabel && (
        <SvgText
          x={cx}
          y={cy + radius + 152}
          fill={TEXT}
          fontSize={subLabelFont}
          fontWeight="700"
          textAnchor="middle"
        >
          {subLabel.split('\n').map((line, i) => (
            <TSpan key={i} x={cx} dy={i === 0 ? 0 : subLabelFont * 1.04}>
              {line}
            </TSpan>
          ))}
        </SvgText>
      )}
    </G>
  );
}

interface AchievementPosterProps {
  achievements: WeekAchievements;
  routineName?: string;
  // Wordmark de la app (title.png, ya incluye el logo). En nativo es el módulo del
  // asset (require → número); en web, un data URI. El número rasteriza bien en
  // toDataURL en Android; el data URI no.
  titleUri?: string | number;
  // Progreso de la animación de aparición (0 = nada, 1 = todo visible/relleno).
  reveal?: number;
  width?: number;
  height?: number;
}

/**
 * Imagen de logros semanales (SVG). Se expone ref al <Svg> para exportarla a PNG
 * con toDataURL. titleUri es un data URI precargado (ver pantalla). `reveal`
 * (0→1) controla la aparición escalonada de cada elemento.
 */
export const AchievementPoster = forwardRef<Svg, AchievementPosterProps>(
  (
    {
      achievements,
      routineName,
      titleUri,
      reveal = 1,
      width = POSTER_WIDTH,
      height = POSTER_HEIGHT,
    },
    ref
  ) => {
    const { daysTrained, slots } = achievements;

    // Aparición escalonada: cada elemento tiene su ventana dentro de [0, 1].
    const seg = (start: number, end: number) =>
      reveal >= end
        ? 1
        : reveal <= start
        ? 0
        : (reveal - start) / (end - start);
    const easeOut = (t: number) => 1 - (1 - t) * (1 - t);
    const fade = (start: number, end: number) => easeOut(seg(start, end));

    const headerOp = fade(0.9, 1); // Cabecera la última: da tiempo a cargar la imagen del título.
    const semanaOp = fade(0.08, 0.2);
    const completadaOp = fade(0.16, 0.28);
    const subtitleOp = fade(0.26, 0.36);
    const footerOp = fade(0.9, 1);

    // Donut: opacidad (aparece rápido) + relleno del anillo (toda su ventana).
    const donutAnim = (start: number, end: number) => {
      const p = seg(start, end);
      return { opacity: easeOut(Math.min(1, p / 0.4)), fill: easeOut(p) };
    };
    const d1 = donutAnim(0.34, 0.56);
    const d2 = donutAnim(0.47, 0.69);
    const d3 = donutAnim(0.6, 0.82);
    const d4 = donutAnim(0.72, 0.94);

    // --- Cabecera: wordmark de la app centrado (ya incluye el logo) ---
    const titleH = 108;
    const titleW = Math.round(682 * (titleH / 122));
    const headerCenterY = 150;
    const titleX = (POSTER_WIDTH - titleW) / 2;
    const titleY = headerCenterY - titleH / 2;

    // --- Donuts (rejilla 2×2): los 4 mejores logros de la semana ---
    const donutRadius = 148;
    const colLeftX = 288;
    const colRightX = POSTER_WIDTH - 288;
    const rowTopY = 858;
    const rowBottomY = 1430;

    // Posición y animación de cada hueco de la rejilla, en orden de lectura.
    const slotLayout = [
      { cx: colLeftX, cy: rowTopY, anim: d1 },
      { cx: colRightX, cy: rowTopY, anim: d2 },
      { cx: colLeftX, cy: rowBottomY, anim: d3 },
      { cx: colRightX, cy: rowBottomY, anim: d4 },
    ];

    return (
      <Svg
        ref={ref}
        width={width}
        height={height}
        viewBox={`0 0 ${POSTER_WIDTH} ${POSTER_HEIGHT}`}
      >
        <Defs>
          <LinearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#13161C" />
            <Stop offset="1" stopColor="#0B0D11" />
          </LinearGradient>
          <LinearGradient id="goldText" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={GOLD_SOFT} />
            <Stop offset="1" stopColor={GOLD} />
          </LinearGradient>
        </Defs>

        <Rect
          x="0"
          y="0"
          width={POSTER_WIDTH}
          height={POSTER_HEIGHT}
          fill="url(#bg)"
        />
        <Rect x="0" y="0" width={POSTER_WIDTH} height="12" fill={GOLD} />

        {/* Cabecera: wordmark de la app (barra de título) */}
        <G opacity={headerOp}>
          {titleUri ? (
            <SvgImage
              x={titleX}
              y={titleY}
              width={titleW}
              height={titleH}
              href={titleUri}
              preserveAspectRatio="xMidYMid meet"
            />
          ) : null}
        </G>

        {/* Titular */}
        <SvgText
          x={POSTER_WIDTH / 2}
          y={406}
          fill="url(#goldText)"
          fontSize={196}
          fontFamily={DISPLAY_FONT}
          letterSpacing={4}
          textAnchor="middle"
          opacity={semanaOp}
        >
          {t('SEMANA')}
        </SvgText>
        <SvgText
          x={POSTER_WIDTH / 2}
          y={556}
          fill={TEXT}
          fontSize={130}
          fontFamily={DISPLAY_FONT}
          letterSpacing={3}
          textAnchor="middle"
          opacity={completadaOp}
        >
          {t('¡COMPLETADA!')}
        </SvgText>

        {/* Subtítulo */}
        <SvgText
          x={POSTER_WIDTH / 2}
          y={618}
          fill={MUTED}
          fontSize={48}
          fontWeight="700"
          textAnchor="middle"
          opacity={subtitleOp}
        >
          {`${routineName ? `${routineName} · ` : ''}${t(
            daysTrained === 1 ? '{n} día entrenado' : '{n} días entrenados',
            { n: daysTrained }
          )}`}
        </SvgText>

        {/* Donuts (2×2): logros elegidos por el selector, mejores primero */}
        {slotLayout.map((position, index) => {
          const slot = slots[index];
          if (!slot) return null;
          const sub = slot.subLabel
            ? fitSubLabel(capitalizeFirst(slot.subLabel))
            : undefined;
          return (
            <Donut
              key={slot.id}
              cx={position.cx}
              cy={position.cy}
              radius={donutRadius}
              fraction={slot.fraction * position.anim.fill}
              color={SLOT_COLORS[slot.color]}
              centerMain={slot.centerMain}
              centerMainFont={slot.centerMainFont}
              centerSub={slot.centerSub}
              label={slot.label}
              subLabel={sub?.text}
              subLabelFont={sub?.font}
              opacity={position.anim.opacity}
            />
          );
        })}

        {/* Pie */}
        <G opacity={footerOp}>
          <Line
            x1={70}
            y1={1846}
            x2={POSTER_WIDTH - 70}
            y2={1846}
            stroke={PANEL_BORDER}
            strokeWidth={2}
          />
          <SvgText
            x={POSTER_WIDTH / 2}
            y={1892}
            fill={MUTED}
            fontSize={38}
            fontWeight="600"
            textAnchor="middle"
          >
            Tu progreso, semana a semana
          </SvgText>
        </G>
      </Svg>
    );
  }
);

AchievementPoster.displayName = 'AchievementPoster';
