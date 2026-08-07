import fs from 'fs';
import path from 'path';

/**
 * Guarda contra el bug de los titulares "comidos por arriba": la fuente display
 * (Anton) es condensada y de trazo alto; sus mayúsculas y tildes rozan el borde
 * superior de la caja de línea. Si el `lineHeight` de un estilo con Anton es
 * demasiado ajustado respecto al `fontSize`, Android recorta la parte de arriba
 * de los glifos (se vio en la fila de resumen "6 / 3,5% / 28 / 245" y en la
 * tarjeta de día "Pierna B").
 *
 * No hay entorno de render en los tests (entorno node), así que en vez de medir
 * píxeles se hace análisis estático del código: se busca cada bloque de estilo
 * que use `theme.fonts.display` y se exige que `lineHeight / fontSize` llegue a
 * un mínimo seguro. Empíricamente los titulares que se ven bien están a ratio
 * >= 1.36 (HeroCard 1.38, subtítulo 1.41, GradientCtaButton 1.36) y los que se
 * recortaban estaban a <= 1.25. El umbral se pone justo por debajo del grupo
 * bueno.
 *
 * OJO con `translateY`: NO exime. El transform solo reposiciona el texto ya
 * pintado; no agranda la caja de línea, así que un lineHeight corto sigue
 * recortando el ascendente por dentro aunque haya translateY (fue el bug de la
 * tarjeta "Pierna B" del historial, que tenía translateY:3 y aun así cortaba).
 *
 * Excepciones (allowlist explícita abajo): solo displays de dígitos ya
 * verificados a ojo, donde no hay mayúsculas ni tildes que asomen tanto.
 */

const MIN_RATIO = 1.35;

// `${archivoRelativo}::${nombreEstilo}` de estilos Anton deliberadamente exentos
// del ratio, con su motivo.
const ALLOWLIST: Record<string, string> = {
  // Badge de un solo dígito (el número de orden del ejercicio): sin lineHeight,
  // centrado en su círculo con includeFontPadding:false. No es un titular.
  'components/ExerciseInputField.tsx::orderBadgeText':
    'badge de un dígito, sin lineHeight',
  // Displays hero de solo dígitos (kcal/volumen/peso semanal): lineHeight 44
  // para fontSize 34 (ratio 1.29) ajustado a mano con translateY, verificado sin
  // recorte porque los dígitos no suben tanto como mayúsculas y tildes.
  'components/HeroStatsCard.tsx::heroMainValue':
    'display de dígitos, verificado',
  'components/HeroWeightCard.tsx::mainValue': 'display de dígitos, verificado',
};

const ROOT = path.resolve(__dirname, '../../');
const SCAN_DIRS = ['components', 'features'];
// Archivos sueltos (fuera de SCAN_DIRS) con estilos de texto display definidos
// como FÁBRICA (`export const x = () => ({...})`), que también deben cumplir el
// ratio: lib/textStyles.ts centraliza el nombre de día y el título de semana.
const EXTRA_FILES = ['lib/textStyles.ts'];

interface AntonStyle {
  file: string;
  style: string;
  fontSize: number | null;
  lineHeight: number | null;
}

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, acc);
    else if (entry.name.endsWith('.tsx')) acc.push(p);
  }
  return acc;
}

// Extrae cada bloque `nombre: { ... }` (con llaves balanceadas) que use la fuente
// display, junto a su fontSize / lineHeight / si compensa con translateY.
function extractAntonStyles(src: string, relFile: string): AntonStyle[] {
  const out: AntonStyle[] = [];
  const re = /(\w+)\s*:\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const start = re.lastIndex - 1;
    let depth = 0;
    let end = -1;
    for (let i = start; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end === -1) continue;
    const body = src.slice(start + 1, end);
    const usesDisplay =
      /fontFamily\s*:\s*theme\.fonts\.display/.test(body) ||
      /fontFamily\s*:\s*['"]Anton/.test(body);
    if (!usesDisplay) continue;
    const fsM = body.match(/fontSize\s*:\s*(\d+)/);
    const lhM = body.match(/lineHeight\s*:\s*(\d+)/);
    out.push({
      file: relFile,
      style: m[1],
      fontSize: fsM ? Number(fsM[1]) : null,
      lineHeight: lhM ? Number(lhM[1]) : null,
    });
  }
  return out;
}

// Igual que extractAntonStyles pero para estilos en forma de fábrica
// (`export const nombre = (...) => ({ ... })`), como los de lib/textStyles.ts.
function extractFactoryAntonStyles(src: string, relFile: string): AntonStyle[] {
  const out: AntonStyle[] = [];
  const re = /export const (\w+)\s*=\s*\([^)]*\)[^=]*=>\s*\(\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const braceStart = src.indexOf('{', re.lastIndex - 1);
    if (braceStart === -1) continue;
    let depth = 0;
    let end = -1;
    for (let i = braceStart; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end === -1) continue;
    const body = src.slice(braceStart + 1, end);
    const usesDisplay =
      /fontFamily\s*:\s*theme\.fonts\.display/.test(body) ||
      /fontFamily\s*:\s*['"]Anton/.test(body);
    if (!usesDisplay) continue;
    const fsM = body.match(/fontSize\s*:\s*(\d+)/);
    const lhM = body.match(/lineHeight\s*:\s*(\d+)/);
    out.push({
      file: relFile,
      style: m[1],
      fontSize: fsM ? Number(fsM[1]) : null,
      lineHeight: lhM ? Number(lhM[1]) : null,
    });
  }
  return out;
}

function collectAllAntonStyles(): AntonStyle[] {
  const files = SCAN_DIRS.flatMap((d) => walk(path.join(ROOT, d)));
  const scanned = files.flatMap((f) =>
    extractAntonStyles(
      fs.readFileSync(f, 'utf8'),
      path.relative(ROOT, f).replace(/\\/g, '/')
    )
  );
  const extra = EXTRA_FILES.flatMap((rel) =>
    extractFactoryAntonStyles(
      fs.readFileSync(path.join(ROOT, rel), 'utf8'),
      rel
    )
  );
  return [...scanned, ...extra];
}

describe('titulares con fuente Anton no se recortan por arriba', () => {
  const styles = collectAllAntonStyles();

  it('encuentra estilos con la fuente display (el escáner funciona)', () => {
    expect(styles.length).toBeGreaterThan(10);
  });

  it('todo estilo Anton con tamaño declara un lineHeight suficiente', () => {
    const offenders: string[] = [];
    for (const s of styles) {
      const key = `${s.file}::${s.style}`;
      if (ALLOWLIST[key]) continue;
      if (s.fontSize == null) continue; // hereda tamaño de otro estilo
      if (s.lineHeight == null) {
        offenders.push(`${key} (fontSize ${s.fontSize} sin lineHeight)`);
        continue;
      }
      const ratio = s.lineHeight / s.fontSize;
      if (ratio < MIN_RATIO) {
        offenders.push(
          `${key} (fontSize ${s.fontSize} / lineHeight ${
            s.lineHeight
          } = ${ratio.toFixed(
            2
          )}, mínimo ${MIN_RATIO}; sube lineHeight a >= ${Math.ceil(
            s.fontSize * MIN_RATIO
          )})`
        );
      }
    }
    // Si falla, la lista dice exactamente qué estilos recortan y a cuánto subir.
    expect(offenders).toEqual([]);
  });
});
