import React, { forwardRef } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, {
  ClipPath,
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
import { darkColors, posterColors } from '@lib/theme';
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
const PANEL_BORDER = posterColors.panelBorder;
const TRACK = posterColors.track;
const TEXT = darkColors.text;
const MUTED = darkColors.textSecondary;
const ON_GOLD = darkColors.onGold;
// Fondo del panel "Esta semana": el tono alto del degradado del póster, un
// punto más claro que el lienzo de abajo.
const PANEL_FILL = posterColors.bgTop;

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
      ? 44
      : Math.max(
          34,
          Math.min(
            44,
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
  subLabelFont = 44,
  opacity = 1,
}: DonutProps) {
  const strokeWidth = 26;
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
          y={cy + 62}
          fill={MUTED}
          fontSize={38}
          fontWeight="700"
          textAnchor="middle"
        >
          {centerSub}
        </SvgText>
      )}
      <SvgText
        x={cx}
        y={cy + radius + 78}
        fill={GOLD}
        fontSize={44}
        fontFamily={DISPLAY_FONT}
        letterSpacing={1}
        textAnchor="middle"
      >
        {label}
      </SvgText>
      {!!subLabel && (
        <SvgText
          x={cx}
          y={cy + radius + 130}
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
  // Wordmark de la app (title.png, ya incluye el logo). En nativo es el módulo del
  // asset (require → número); en web, un data URI. El número rasteriza bien en
  // toDataURL en Android; el data URI no.
  titleUri?: string | number;
  /** Quién completó la semana: nombre y foto del perfil (si hay cuenta). */
  userName?: string;
  avatarUri?: string;
  /**
   * Ancho real del nombre a NAME_FONT en Anton (lo mide la pantalla con un
   * texto de la app: el SVG no sabe medir). Sin él, se estima.
   */
  nameWidth?: number;
  // Progreso de la animación de aparición (0 = nada, 1 = todo visible/relleno).
  reveal?: number;
  width?: number;
  height?: number;
}

// Glifo de un icono de MaterialCommunityIcons, para pintarlo como texto con su
// fuente (la misma que usa la app; ya está cargada).
const ICON_FONT = 'material-community';
const ICON_GLYPHS = MaterialCommunityIcons.getRawGlyphMap() as Record<
  string,
  number
>;
const glyph = (name: string): string =>
  String.fromCodePoint(ICON_GLYPHS[name] ?? ICON_GLYPHS['check-circle']);

/** El nombre tal como lo pinta el póster (recortado): lo que hay que medir. */
export const posterUserName = (userName?: string): string =>
  userName?.trim() ? clip(userName.trim(), 22) : '';

// Fila de cabecera (foto, nombre y nivel): medidas en unidades del póster.
export const NAME_FONT = 56;
export const NAME_LETTER_SPACING = 1;
const ANTON_CHAR_RATIO = 0.42; // Ancho medio de un carácter de Anton (estimación).
const DIGIT_RATIO = 0.46;
const STAR_SIZE = 42;
const STAR_GAP = 4;
const AVATAR_GAP = 28;
const LEVEL_GAP = 18;

// Recorta un texto a `max` caracteres con puntos suspensivos.
const clip = (text: string, max: number): string =>
  text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;

/**
 * Una columna del panel "Esta semana": rótulo, cuántos y hasta dos nombres con
 * su icono (el último con "+N" si hay más). `wide`: es la única columna y los
 * nombres pueden ser más largos.
 */
function ExtrasColumn({
  x,
  title,
  items,
  wide = false,
}: {
  x: number;
  title: string;
  items: { key: string; name: string; icon: string }[];
  wide?: boolean;
}) {
  const shown = items.slice(0, 2);
  const more = items.length - shown.length;
  return (
    <G>
      <SvgText
        x={x}
        y={1620}
        fill={GOLD}
        fontSize={36}
        fontFamily={DISPLAY_FONT}
        letterSpacing={1}
      >
        {title}
      </SvgText>
      <SvgText
        x={x}
        y={1716}
        fill={TEXT}
        fontSize={86}
        fontFamily={DISPLAY_FONT}
      >
        {String(items.length)}
      </SvgText>
      {shown.map((item, i) => (
        <G key={item.key}>
          <SvgText
            x={x + 84}
            y={1670 + i * 44}
            fill={GOLD}
            fontSize={30}
            fontFamily={ICON_FONT}
          >
            {glyph(item.icon)}
          </SvgText>
          <SvgText
            x={x + 124}
            y={1670 + i * 44}
            fill={TEXT}
            fontSize={30}
            fontWeight="700"
          >
            {clip(
              i === shown.length - 1 && more > 0
                ? `${item.name} +${more}`
                : item.name,
              wide ? 40 : 16
            )}
          </SvgText>
        </G>
      ))}
    </G>
  );
}

/**
 * Imagen de logros semanales (SVG). Se expone ref al <Svg> para exportarla a PNG
 * con toDataURL. `reveal` (0→1) controla la aparición escalonada.
 *
 * De arriba abajo: QUIÉN (foto centrada y, debajo, el nombre con el nivel que
 * tenía al cerrar la semana: estrella + número), el titular con el número de
 * semana, los cuatro mejores datos de la semana en anillos, lo que se ganó en
 * ella (retos superados y logros nuevos, lib/weekExtras; solo si hubo) y la
 * marca.
 */
export const AchievementPoster = forwardRef<Svg, AchievementPosterProps>(
  (
    {
      achievements,
      titleUri,
      userName,
      avatarUri,
      nameWidth,
      reveal = 1,
      width = POSTER_WIDTH,
      height = POSTER_HEIGHT,
    },
    ref
  ) => {
    const { daysTrained, slots, weekNumber, extras } = achievements;

    // Aparición escalonada: cada elemento tiene su ventana dentro de [0, 1].
    const seg = (start: number, end: number) =>
      reveal >= end
        ? 1
        : reveal <= start
        ? 0
        : (reveal - start) / (end - start);
    const easeOut = (t: number) => 1 - (1 - t) * (1 - t);
    const fade = (start: number, end: number) => easeOut(seg(start, end));

    const profileOp = fade(0, 0.1);
    const semanaOp = fade(0.08, 0.2);
    const completadaOp = fade(0.16, 0.28);
    const subtitleOp = fade(0.26, 0.36);
    const extrasOp = fade(0.8, 0.92);
    const footerOp = fade(0.9, 1); // Al final: da tiempo a cargar el wordmark.

    // Donut: opacidad (aparece rápido) + relleno del anillo (toda su ventana).
    const donutAnim = (start: number, end: number) => {
      const p = seg(start, end);
      return { opacity: easeOut(Math.min(1, p / 0.4)), fill: easeOut(p) };
    };
    const d1 = donutAnim(0.32, 0.54);
    const d2 = donutAnim(0.42, 0.64);
    const d3 = donutAnim(0.52, 0.74);
    const d4 = donutAnim(0.62, 0.84);

    // --- Cabecera: quién, en una fila centrada: foto, nombre y nivel ---
    // Cada pieza va en su x calculada: encadenadas en un solo texto, el SVG
    // medía mal el nombre en Anton y el nivel quedaba muy separado. El ancho
    // del nombre lo mide la pantalla con un texto de la app (`nameWidth`).
    const name = posterUserName(userName);
    const level = extras?.level;
    const levelText = level ? String(level) : '';
    const headerCy = 112;
    const avatarR = 58;
    const measuredName = name
      ? nameWidth ?? name.length * NAME_FONT * ANTON_CHAR_RATIO
      : 0;
    const levelNumberW = levelText.length * NAME_FONT * DIGIT_RATIO;
    const levelW = level ? STAR_SIZE + STAR_GAP + levelNumberW : 0;
    const rowW =
      (name ? avatarR * 2 + AVATAR_GAP + measuredName : 0) +
      (name && level ? LEVEL_GAP : 0) +
      levelW;
    const rowX = (POSTER_WIDTH - rowW) / 2;
    const avatarCx = rowX + avatarR;
    const nameX = rowX + avatarR * 2 + AVATAR_GAP;
    const starX = name ? nameX + measuredName + LEVEL_GAP : rowX;
    // Línea base que centra la letra (Anton, mayúsculas ~0,72 em) en la foto.
    const nameBaseline = headerCy + NAME_FONT * 0.36;

    // --- Lo ganado en la semana: solo lo que haya ---
    const challengeItems = (extras?.challenges ?? []).map((c, i) => ({
      key: `${c.id}-${i}`,
      name: c.name,
      icon: c.icon,
    }));
    const badgeItems = (extras?.badges ?? []).map((b) => ({
      key: b.id,
      name: b.name,
      icon: b.icon,
    }));
    const extraColumns = [
      { key: 'challenges', title: t('RETOS SUPERADOS'), items: challengeItems },
      { key: 'badges', title: t('LOGROS NUEVOS'), items: badgeItems },
    ].filter((column) => column.items.length > 0);
    const hasPanel = extraColumns.length > 0;

    // --- Donuts (rejilla 2×2): los 4 mejores datos de la semana ---
    // Sin panel de lo ganado, la rejilla se reparte el sitio que deja.
    const donutRadius = 110;
    const colLeftX = 288;
    const colRightX = POSTER_WIDTH - 288;
    const rowTopY = hasPanel ? 735 : 770;
    const rowBottomY = hasPanel ? 1210 : 1275;
    const slotLayout = [
      { cx: colLeftX, cy: rowTopY, anim: d1 },
      { cx: colRightX, cy: rowTopY, anim: d2 },
      { cx: colLeftX, cy: rowBottomY, anim: d3 },
      { cx: colRightX, cy: rowBottomY, anim: d4 },
    ];

    // --- Pie: el wordmark ---
    const titleH = 64;
    const titleW = Math.round(682 * (titleH / 122));

    return (
      <Svg
        ref={ref}
        width={width}
        height={height}
        viewBox={`0 0 ${POSTER_WIDTH} ${POSTER_HEIGHT}`}
      >
        <Defs>
          <LinearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={posterColors.bgTop} />
            <Stop offset="1" stopColor={posterColors.bgBottom} />
          </LinearGradient>
          <LinearGradient id="goldText" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={GOLD_SOFT} />
            <Stop offset="1" stopColor={GOLD} />
          </LinearGradient>
          <ClipPath id="avatarClip">
            <Circle cx={avatarCx} cy={headerCy} r={avatarR} />
          </ClipPath>
        </Defs>

        <Rect
          x="0"
          y="0"
          width={POSTER_WIDTH}
          height={POSTER_HEIGHT}
          fill="url(#bg)"
        />
        <Rect x="0" y="0" width={POSTER_WIDTH} height="12" fill={GOLD} />

        {/* Quién: foto (o inicial), nombre y el nivel que tenía al cerrar la
          semana (estrella + número, pegado al nombre). */}
        <G opacity={profileOp}>
          {!!name && (
            <>
              <Circle cx={avatarCx} cy={headerCy} r={avatarR} fill={GOLD} />
              <SvgText
                x={avatarCx}
                y={headerCy + 22}
                fill={ON_GOLD}
                fontSize={64}
                fontFamily={DISPLAY_FONT}
                textAnchor="middle"
              >
                {name.charAt(0).toUpperCase()}
              </SvgText>
              {!!avatarUri && (
                <SvgImage
                  x={avatarCx - avatarR}
                  y={headerCy - avatarR}
                  width={avatarR * 2}
                  height={avatarR * 2}
                  href={{ uri: avatarUri }}
                  preserveAspectRatio="xMidYMid slice"
                  clipPath="url(#avatarClip)"
                />
              )}
              <Circle
                cx={avatarCx}
                cy={headerCy}
                r={avatarR}
                stroke={GOLD}
                strokeWidth={5}
                fill="none"
              />
              <SvgText
                x={nameX}
                y={nameBaseline}
                fill={TEXT}
                fontSize={NAME_FONT}
                fontFamily={DISPLAY_FONT}
                letterSpacing={NAME_LETTER_SPACING}
              >
                {name}
              </SvgText>
            </>
          )}
          {!!level && (
            <>
              <SvgText
                x={starX}
                y={headerCy + STAR_SIZE * 0.42}
                fill={GOLD}
                fontSize={STAR_SIZE}
                fontFamily={ICON_FONT}
              >
                {glyph('star-four-points')}
              </SvgText>
              <SvgText
                x={starX + STAR_SIZE + STAR_GAP}
                y={nameBaseline}
                fill={GOLD}
                fontSize={NAME_FONT}
                fontFamily={DISPLAY_FONT}
              >
                {levelText}
              </SvgText>
            </>
          )}
        </G>

        {/* Titular, con el número de semana */}
        <SvgText
          x={POSTER_WIDTH / 2}
          y={372}
          fill="url(#goldText)"
          fontSize={172}
          fontFamily={DISPLAY_FONT}
          letterSpacing={4}
          textAnchor="middle"
          opacity={semanaOp}
        >
          {t('SEMANA {n}', { n: weekNumber })}
        </SvgText>
        <SvgText
          x={POSTER_WIDTH / 2}
          y={498}
          fill={TEXT}
          fontSize={112}
          fontFamily={DISPLAY_FONT}
          letterSpacing={3}
          textAnchor="middle"
          opacity={completadaOp}
        >
          {t('¡COMPLETADA!')}
        </SvgText>
        <SvgText
          x={POSTER_WIDTH / 2}
          y={562}
          fill={MUTED}
          fontSize={44}
          fontWeight="700"
          textAnchor="middle"
          opacity={subtitleOp}
        >
          {t(daysTrained === 1 ? '{n} día entrenado' : '{n} días entrenados', {
            n: daysTrained,
          })}
        </SvgText>

        {/* Donuts (2×2): los mejores datos de la semana, mejores primero */}
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
              centerMainFont={Math.round(slot.centerMainFont * 0.82)}
              centerSub={slot.centerSub}
              label={slot.label}
              subLabel={sub?.text}
              subLabelFont={sub?.font}
              opacity={position.anim.opacity}
            />
          );
        })}

        {/* Lo ganado en la semana: solo lo que haya (una o dos columnas) */}
        {/* Mismo hueco (58) con lo de arriba —el texto de los anillos acaba
          en ~1500 con subtítulo a dos líneas— y con la marca (1810). Dentro,
          36 arriba y abajo: del alto del rótulo a la base de la cifra. */}
        {hasPanel && (
          <G opacity={extrasOp}>
            <Rect
              x={60}
              y={1558}
              width={POSTER_WIDTH - 120}
              height={194}
              rx={36}
              fill={PANEL_FILL}
              stroke={PANEL_BORDER}
              strokeWidth={2}
            />
            {extraColumns.length === 2 && (
              <Line
                x1={POSTER_WIDTH / 2}
                y1={1590}
                x2={POSTER_WIDTH / 2}
                y2={1720}
                stroke={PANEL_BORDER}
                strokeWidth={2}
              />
            )}
            {extraColumns.map((column, index) => (
              <ExtrasColumn
                key={column.key}
                x={index === 0 ? 100 : POSTER_WIDTH / 2 + 40}
                title={column.title}
                items={column.items}
                wide={extraColumns.length === 1}
              />
            ))}
          </G>
        )}

        {/* Pie: la marca */}
        <G opacity={footerOp}>
          {titleUri ? (
            <SvgImage
              x={(POSTER_WIDTH - titleW) / 2}
              y={1810}
              width={titleW}
              height={titleH}
              href={titleUri}
              preserveAspectRatio="xMidYMid meet"
            />
          ) : null}
        </G>
      </Svg>
    );
  }
);

AchievementPoster.displayName = 'AchievementPoster';
