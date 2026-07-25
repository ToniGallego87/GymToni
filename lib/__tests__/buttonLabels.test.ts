import { setLanguage, t } from '../i18n';

/**
 * Guarda contra el bug de las notas: en la fila de 3 botones del modal
 * ("Cancelar / Borrar / Guardar") la etiqueta más larga no cabía en su tercio
 * de ancho y saltaba a dos líneas ("Cancela / r").
 *
 * No hay entorno de render en los tests (son de lógica pura, entorno node), así
 * que en vez de medir píxeles reales se estima el ancho del texto a partir de
 * las MISMAS constantes de layout que usan `AppModal` + `Button`, y se exige que
 * cada etiqueta quepa en una sola línea. Es una red de seguridad a nivel de
 * datos: si alguien mete una etiqueta larga o una traducción que se desborda,
 * este test lo caza antes de que llegue a pantalla. En tiempo de render el
 * `numberOfLines={1}` del Button es la garantía dura de que nunca se parte.
 */

// --- Constantes de layout (deben seguir a AppModal.tsx y Button.tsx) ---
const MODAL_CARD_MAX_WIDTH = 340; // AppModal styles.card.maxWidth
const MODAL_CARD_PADDING = 22; // theme.spacing.lg, a cada lado
const MODAL_ROW_GAP = 8; // WorkoutLogScreen styles.modalButtons.gap
const BUTTON_FONT_MEDIUM = 15; // Button, size 'medium'
const BUTTON_PADDING_H = 12; // Button getPadding() 'medium', a cada lado

const cardInnerWidth = MODAL_CARD_MAX_WIDTH - MODAL_CARD_PADDING * 2;

// Ancho de texto disponible en cada botón de una fila de `n` botones a partes
// iguales (flex: 1), descontando huecos y padding horizontal del propio botón.
function availableTextWidth(buttonCount: number): number {
  const perButton =
    (cardInnerWidth - (buttonCount - 1) * MODAL_ROW_GAP) / buttonCount;
  return perButton - BUTTON_PADDING_H * 2;
}

// Ancho por carácter relativo al tamaño de fuente, aproximando una sans-serif en
// negrita (los botones usan fontWeight 800). No pretende ser exacto: es
// conservador para no dar falsos positivos con etiquetas legítimas y aun así
// cazar las claramente largas.
function charFactor(ch: string): number {
  if (' .,:iIlj|!\'’'.includes(ch)) return 0.32;
  if ('mwMW'.includes(ch)) return 0.9;
  if (ch >= 'A' && ch <= 'Z') return 0.68;
  return 0.56;
}

function estimateTextWidth(text: string, fontSize: number): number {
  let units = 0;
  for (const ch of text) units += charFactor(ch);
  return units * fontSize;
}

// Etiquetas que conviven en una misma fila de botones dentro de un modal.
const MODAL_BUTTON_ROWS: { name: string; keys: string[] }[] = [
  // Modal "Notas del ejercicio": 3 botones (el caso que reventaba).
  { name: 'notas del ejercicio', keys: ['Cancelar', 'Borrar', 'Guardar'] },
  // Modal "Editar Temporizador": 2 botones.
  { name: 'editar temporizador', keys: ['Cancelar', 'Guardar'] },
];

describe('las etiquetas de botón caben en una sola línea', () => {
  afterEach(() => setLanguage('es'));

  for (const lang of ['es', 'en'] as const) {
    describe(`idioma ${lang}`, () => {
      for (const row of MODAL_BUTTON_ROWS) {
        it(`fila "${row.name}" no desborda`, () => {
          setLanguage(lang);
          const avail = availableTextWidth(row.keys.length);
          const overflowing = row.keys
            .map((key) => t(key))
            .filter(
              (label) => estimateTextWidth(label, BUTTON_FONT_MEDIUM) > avail
            );
          // Si falla, el array lista exactamente qué etiquetas se desbordan.
          expect(overflowing).toEqual([]);
        });
      }
    });
  }

  // El guard tiene dientes: una etiqueta claramente larga en la fila de 3 NO
  // cabría (si esto pasara a caber, el modelo se habría vuelto inútil).
  it('detecta una etiqueta demasiado larga para su fila', () => {
    const avail = availableTextWidth(3);
    const width = estimateTextWidth('Cancelar y salir', BUTTON_FONT_MEDIUM);
    expect(width).toBeGreaterThan(avail);
  });
});
