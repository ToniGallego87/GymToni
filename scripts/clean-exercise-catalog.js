#!/usr/bin/env node
// Limpia data/exerciseCatalog.json EN SU SITIO y regenera
// data/exerciseVariants.ts. Idempotente: ejecutarlo dos veces deja lo mismo.
//
//   node scripts/clean-exercise-catalog.js
//
// Qué hace, en orden:
//   1. Inglés: arregla la codificación rota ("45в°") y las erratas del dataset
//      ("revers", "sitted") ANTES de agrupar, para que las copias se reconozcan.
//   2. Variantes. El dataset trae el mismo ejercicio varias veces: con otra
//      cámara ("(back pov)"), con otro modelo ("(female)"), numerado ("v. 2"),
//      repetido tal cual o con otro nombre ("Chin-up" / "Reverse grip
//      pull-up"). Cada grupo se cuelga de un ejercicio principal (`variantOf`):
//      para el historial son EL MISMO ejercicio. Las de cámara y modelo se
//      ocultan del buscador (no aportan nada); las demás siguen visibles como
//      "(variante N)", porque su GIF puede encajar mejor con la máquina de cada
//      gimnasio.
//   3. Español: quita frases duplicadas por la traducción automática ("con
//      barra Z con barra"), lleva al final el equipo cuando detrás solo quedaba
//      un adjetivo ("Curl con banda alterno" → "Curl alterno con banda"),
//      arregla la concordancia ("Dominada asistido") y aplica los nombres
//      corregidos a mano (HAND). Una variante visible se llama como su
//      principal + "(variante N)".
//   4. Sinónimos de gimnasio (ALIASES) para el buscador y las sugerencias.
//   5. Comprueba que ningún nombre visible se repite (ES ni EN). Si se repite,
//      lo lista y sale con error: hay que darle nombre propio en HAND.
//
// El test lib/__tests__/exerciseCatalog.test.ts vigila las mismas invariantes.

const fs = require('fs');
const prettier = require('prettier');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CATALOG = path.join(ROOT, 'data', 'exerciseCatalog.json');
const VARIANTS = path.join(ROOT, 'data', 'exerciseVariants.ts');

// ─── Nombres corregidos a mano (id → español) ────────────────────────────────
// Traducciones que perdían parte del ejercicio y chocaban con otro nombre, o
// que la regla deja mal. Mandan sobre las reglas. En una variante no hace falta:
// toma el nombre de su principal.
const HAND = {
  // Perdían la mitad del ejercicio.
  '0028': 'Cargada y press con barra',
  '0022': 'Pullover y press con barra',
  '0040': 'Elevación frontal y pullover con barra',
  2407: 'Curl de bíceps con barra (arm blaster)',
  '0049': 'Remo en banco inclinado con barra',
  '0053': 'Sentadilla con salto con barra',
  '0102': 'Sentadilla de rodillas con barra',
  '0111': 'Elevación de gemelos de pie con balanceo con barra',
  1490: 'Elevación de gemelos de pie en escalón',
  3161: 'Remo de pie a una mano con toalla',
  3165: 'Remo de pie con toalla',
  '0167': 'Remo alto de rodillas en polea',
  '0170': 'Apertura inclinada en polea en fitball',
  '0197': 'Jalón en polea con barra pro',
  '0202': 'Remo de deltoides posterior en polea con estribos',
  '0203': 'Remo de deltoides posterior en polea con cuerda',
  1320: 'Remo sentado cruzado en polea con cuerda',
  '0874': 'Crunch de pie en polea con cuerda',
  '0234': 'Remo de pie en polea con barra en V',
  '0236': 'Remo de pie con giro en polea con barra en V',
  '0862': 'Giro en polea de arriba abajo',
  1430: 'Fondo de pecho en jaula',
  2398: 'Flexión agarre cerrado de rodillas',
  '0267': 'Crunch con manos sobre la cabeza',
  '0271': 'Crunch en fitball',
  2297: 'Crunch en fitball con recorrido completo',
  '0272': 'Crunch en fitball con brazos rectos',
  2403: 'Curl de bíceps alterno con mancuernas (arm blaster)',
  '0327': 'Remo en banco inclinado con mancuernas',
  2401: 'Curl de bíceps con mancuernas (arm blaster)',
  1658: 'Zancada con curl de bíceps con mancuernas',
  '0307': 'Apertura declinada con giro con mancuernas',
  3234: 'Apertura alta con mancuernas',
  1623: 'Press de banca inclinado agarre neutro con mancuernas',
  '0422': 'Curl de pie a una mano apoyado en banco inclinado con mancuernas',
  '0379': 'Elevación lateral posterior con apoyo de cabeza con mancuernas',
  '0390': 'Curl de bíceps sentado en fitball con mancuernas',
  '0404': 'Press de hombro sentado agarre neutro con mancuernas',
  3241: 'Elevación de gemelos en pared en fitball con pelota entre tobillos',
  3240: 'Elevación de gemelos en pared en fitball con pelota entre rodillas',
  3785: 'Flexión inclinada en cajón',
  '0496': 'Curl femoral inverso con apoyo en banco',
  2400: 'Curl femoral inverso en máquina de poleas',
  '0595': 'Crunch sentado en máquina con apoyo de pecho',
  '0600': 'Crunch con elevación de piernas sentado en máquina',
  '0601': 'Apertura inversa sentado agarre neutro en máquina',
  1401: 'Muscle-up en barra vertical',
  '0651': 'Dominada agarre neutro',
  '0653': 'Flexión en bosu',
  '0655': 'Flexión en fitball',
  '0659': 'Flexión en pared',
  '0812': 'Fondo de tríceps con pies en banco',
  '0813': 'Fondo de tríceps entre bancos',
  3312: 'Muscle-up con lastre en barra',
  '0845': 'Giro ruso con lastre y piernas elevadas',
  '0974': 'Jalón agarre cerrado con banda',
  3117: 'Jalón agarre cerrado con banda anclada atrás',
  1013: 'Jalón agarre supino con banda',
  3116: 'Jalón agarre supino con banda anclada atrás',
  // Jalones de tríceps en polea ("Extensión en polea en polea").
  '0201': 'Extensión de tríceps en polea',
  '0200': 'Extensión de tríceps en polea con cuerda',
  '0172': 'Extensión de tríceps en polea con el torso inclinado',
  '0173': 'Extensión de tríceps sobre la cabeza en banco inclinado en polea',
  1723: 'Extensión de tríceps a una mano en polea',
  '0207': 'Extensión de tríceps agarre inverso en polea',
  2406: 'Extensión de tríceps agarre inverso con barra Z en polea (arm blaster)',
  '0241': 'Extensión de tríceps con barra en V en polea',
  2405: 'Extensión de tríceps con barra en V en polea (arm blaster)',
  '0514': 'Sentadilla con salto',
  '0464': 'Plancha frontal con giro',
  3582: 'Zancada con salto',
  1688: 'Zancada con giro',
  '0664': 'Flexión a plancha lateral',
  // Otros mal construidos.
  1739: 'Patada de tríceps de pie alterna con mancuernas',
  3313: 'Fondos en barra recta con lastre',
  1434: 'Sentadilla con barra baja en multipower',
  '0494': 'Flexión inclinada con agarre inverso',
  3327: 'Flexión en plancha completa (planche)',
  '0018': 'Extensión de tríceps de pie asistida (con toalla)',
};

// ─── Variantes que el nombre inglés no delata (id → principal) ───────────────
// El mismo ejercicio con otro nombre en el dataset.
const MANUAL_VARIANT_OF = {
  '0199': '0238', // Cable pushdown (straight arm) v. 2 → straight arm pulldown
  '0161': '0162', // Cable forward raise → Cable front raise
  2189: '2188', // Dumbbells seated triceps extension
  1351: '1349', // Lever t-bar reverse grip row → Lever reverse t-bar row
  '0674': '1326', // Reverse grip pull-up → Chin-up
  1307: '0653', // Push up on bosu ball → Push-up (bosu ball)
  '0316': '0319', // Dumbbell incline breeding (sic) → Dumbbell incline fly
};

// ─── Sinónimos (id → términos extra para buscar) ─────────────────────────────
// Cómo se llaman de verdad en el gimnasio. Solo alimentan la búsqueda y las
// sugerencias: NUNCA vinculan un ejercicio solos (ver lib/exerciseIdentity.ts).
const ALIASES = {
  '0025': ['press banca', 'banca plana', 'press plano', 'bench press'],
  '0047': ['banca inclinada', 'press inclinado'],
  '0033': ['banca declinada', 'press declinado'],
  '0030': ['press banca cerrado', 'banca agarre cerrado'],
  '0289': ['press banca mancuernas', 'banca con mancuernas'],
  '0314': ['press inclinado mancuernas', 'inclinado con mancuernas'],
  '0043': ['sentadilla', 'sentadilla trasera', 'back squat', 'squat'],
  '0042': ['front squat'],
  '0046': ['hack squat', 'sentadilla hack'],
  '0743': ['hack squat maquina', 'sentadilla hack en maquina'],
  '0032': ['peso muerto', 'deadlift'],
  '0085': ['peso muerto rumano', 'rumano', 'rdl'],
  1459: ['rumano con mancuernas', 'rdl mancuernas'],
  '0117': ['peso muerto sumo', 'sumo'],
  '0044': ['buenos dias', 'good morning'],
  '0652': ['dominadas', 'pull up', 'pull-up'],
  1326: ['dominadas supinas', 'chin up', 'chin-up'],
  '0150': ['jalon al pecho', 'polea al pecho', 'lat pulldown', 'jalon'],
  '0861': ['remo en polea baja', 'remo gironda', 'polea baja'],
  '0027': ['remo con barra', 'barbell row', 'remo pendlay'],
  '0292': ['remo con mancuerna', 'remo unilateral', 'remo serrucho'],
  '0606': ['remo en t', 'remo t', 't bar row'],
  '0091': ['press militar', 'press militar sentado'],
  1457: ['press militar de pie', 'overhead press', 'ohp'],
  '0405': ['press de hombro con mancuernas', 'press hombro mancuernas'],
  2137: ['press arnold', 'arnold'],
  '0334': ['elevaciones laterales', 'laterales', 'pajaros laterales'],
  '0310': ['elevaciones frontales', 'frontales'],
  '0203': ['face pull', 'facepull', 'jalon a la cara'],
  '0031': ['curl con barra', 'curl biceps barra'],
  '0294': ['curl biceps mancuernas'],
  '0285': ['curl alterno'],
  '0313': ['curl martillo', 'hammer curl'],
  '0070': ['curl predicador', 'curl scott', 'banco scott'],
  '0201': ['jalon de triceps', 'pushdown', 'triceps en polea'],
  '0200': ['triceps con cuerda', 'jalon triceps cuerda', 'pushdown cuerda'],
  '0060': ['press frances', 'skull crusher', 'rompecraneos'],
  '0251': ['fondos', 'fondos en paralelas', 'dips'],
  '0814': ['fondos de triceps', 'fondos en banco'],
  '0739': ['prensa', 'prensa de piernas', 'leg press', 'prensa 45'],
  '0585': ['extension de cuadriceps', 'cuadriceps maquina', 'leg extension'],
  '0586': ['curl femoral', 'femoral tumbado', 'leg curl'],
  '0599': ['curl femoral sentado', 'femoral sentado'],
  1409: ['hip thrust', 'empuje de cadera', 'puente de gluteo'],
  '0336': ['zancadas', 'lunges', 'estocadas'],
  '0054': ['zancadas con barra'],
  '0410': ['sentadilla bulgara', 'bulgara', 'split squat'],
  '0605': ['gemelos', 'gemelo de pie', 'calf raise'],
  '0594': ['gemelos sentado'],
  '0188': ['aperturas en polea', 'cruce de poleas', 'crossover'],
  '0596': ['contractora', 'peck deck', 'pec deck', 'aperturas en maquina'],
  '0308': ['aperturas', 'aperturas mancuernas', 'flyes'],
  '0603': ['press hombro maquina'],
  '0576': ['press pecho maquina', 'press banca maquina'],
  '0274': ['abdominales', 'crunch'],
  '0472': ['elevacion de piernas colgado', 'leg raise'],
  '0857': ['rueda abdominal', 'ab wheel'],
  '0687': ['giros rusos', 'russian twist'],
  '0489': ['hiperextensiones', 'lumbares'],
  '0095': ['encogimientos', 'trapecio', 'shrugs'],
  '0406': ['encogimientos con mancuernas'],
  '0120': ['remo al menton'],
  '0238': ['pullover polea', 'pullover en polea'],
  '0549': ['swing', 'kettlebell swing'],
  2133: ['paseo del granjero', 'farmer walk'],
};

// ─── Utilidades ──────────────────────────────────────────────────────────────
const norm = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const clean = (s) => s.replace(/\s+/g, ' ').trim();
const byId = (a, b) => a.id.localeCompare(b.id);

// Marcas del dataset que distinguen copias del mismo ejercicio. "(variant N)"
// es la que pone este script a las copias sin número: se reconoce igual para
// que una segunda pasada agrupe lo mismo.
const POV = /\s*\((back|side) pov\)/i;
const GENDER = /\s*\((male|female)\)/i;
const NUMBERED = /\s*(?:v\.\s*(\d+)|\(variant (\d+)\))/i;
const numberOf = (en) => {
  const m = NUMBERED.exec(en);
  return m ? Number(m[1] || m[2]) : null;
};
const baseEn = (en) =>
  norm(en.replace(POV, ' ').replace(GENDER, ' ').replace(NUMBERED, ' '));

// ─── 1. Inglés ───────────────────────────────────────────────────────────────
function fixEnglishTypos(e) {
  e.en = clean(
    e.en
      .replace(/в°/g, '°')
      .replace(/\brevers\b/gi, 'reverse')
      .replace(/\bsitted\b/gi, 'seated')
  );
}

// ─── 2. Variantes ────────────────────────────────────────────────────────────
function assignVariants(catalog) {
  // Se recalcula desde cero en cada ejecución: así es idempotente.
  for (const e of catalog) {
    delete e.variantOf;
    delete e.hidden;
    delete e.variant;
  }
  const byIdMap = new Map(catalog.map((e) => [e.id, e]));

  const groups = new Map();
  for (const e of catalog) {
    if (MANUAL_VARIANT_OF[e.id]) continue; // va con su principal, abajo
    const key = baseEn(e.en);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }
  for (const [id, primaryId] of Object.entries(MANUAL_VARIANT_OF)) {
    const group = [...groups.values()].find((g) =>
      g.some((e) => e.id === primaryId)
    );
    group.push(byIdMap.get(id));
  }

  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const isMarked = (e) =>
      POV.test(e.en) ||
      GENDER.test(e.en) ||
      NUMBERED.test(e.en) ||
      !!MANUAL_VARIANT_OF[e.id];
    const unmarked = group.filter((e) => !isMarked(e)).sort(byId);
    const primary = unmarked[0] ?? [...group].sort(byId)[0];

    // Números ya usados por las "v. N"; el resto toma los libres.
    const used = new Set([1]);
    for (const e of group) {
      const n = numberOf(e.en);
      if (n && e !== primary) used.add(n);
    }
    let next = 2;
    const nextFree = () => {
      while (used.has(next)) next++;
      used.add(next);
      return next;
    };

    for (const e of [...group].sort(byId)) {
      if (e === primary) continue;
      e.variantOf = primary.id;
      if (POV.test(e.en) || GENDER.test(e.en)) {
        e.hidden = true;
        continue;
      }
      e.variant = numberOf(e.en) ?? nextFree();
    }
  }
}

function finishEnglish(e) {
  // El modelo solo se dice cuando distingue dos copias (y esas van ocultas).
  if (!e.variantOf) e.en = clean(e.en.replace(GENDER, ''));
  // Copia visible sin número propio: se numera para distinguirla.
  if (e.variant && !NUMBERED.test(e.en))
    e.en = `${e.en} (variant ${e.variant})`;
}

// ─── 3. Español ──────────────────────────────────────────────────────────────
const EQUIPMENT =
  '(?:con (?:barra (?:Z|olímpica|hexagonal|curva)|barra|bandas? elástica|banda|mancuernas?|kettlebell|cuerda|balón medicinal|lastre|rodillo)|en (?:polea|máquina|multipower|trineo|fitball|bosu))';
const TRAILING_ADJ = new RegExp(
  `\\s(${EQUIPMENT})\\s(alterno|alterna|asistido|asistida|unilateral)$`,
  'i'
);
const FEMININE_HEAD =
  /^(dominadas?|sentadillas?|flexi[oó]n|extensi[oó]n|elevaci[oó]n|patadas?|prensas?|zancadas?|aperturas?|planchas?)\b/i;
// El banco inclinado/declinado solo concuerda con la cabeza en estas.
const INCLINE_HEAD = /^(aperturas?|flexi[oó]n)\b/i;
const MASC_TO_FEM = {
  alterno: 'alterna',
  asistido: 'asistida',
  inverso: 'inversa',
  completo: 'completa',
  cruzado: 'cruzada',
  invertido: 'invertida',
  inclinado: 'inclinada',
  declinado: 'declinada',
};
const VARIANT_SUFFIX = /\s\(variante \d+\)$/;

function ruleSpanish(raw) {
  let es = raw.replace(VARIANT_SUFFIX, '');
  // Frases duplicadas por la traducción automática.
  es = es
    .replace(/con barra Z con barra/gi, 'con barra Z')
    .replace(/en multipower en máquina/gi, 'en multipower')
    .replace(/\b(de \S+) \1\b/gi, '$1');
  // "Curl con banda alterno" → "Curl alterno con banda".
  es = es.replace(TRAILING_ADJ, ' $2 $1');
  // Concordancia: "Dominada asistido" → "Dominada asistida". "agarre inverso"
  // se queda: concuerda con agarre.
  if (FEMININE_HEAD.test(es)) {
    const adjectives = INCLINE_HEAD.test(es)
      ? 'alterno|asistido|inverso|completo|cruzado|invertido|inclinado|declinado'
      : 'alterno|asistido|inverso|completo|cruzado|invertido';
    es = es.replace(
      new RegExp(`(\\S+)\\s(${adjectives})\\b`, 'gi'),
      (match, prev, adj) =>
        /^agarre$/i.test(prev)
          ? match
          : `${prev} ${MASC_TO_FEM[adj.toLowerCase()]}`
    );
  }
  return clean(es);
}

function fixSpanish(catalog) {
  const byIdMap = new Map(catalog.map((e) => [e.id, e]));
  // Primero los principales: las variantes toman su nombre.
  for (const e of catalog) {
    if (e.variant) continue;
    e.es = HAND[e.id] ?? ruleSpanish(e.es);
  }
  for (const e of catalog) {
    if (!e.variant) continue;
    const base = HAND[e.id] ?? byIdMap.get(e.variantOf).es;
    e.es = `${base} (variante ${e.variant})`;
  }
}

// ─── 4. Sinónimos ────────────────────────────────────────────────────────────
function applyAliases(e) {
  const aliases = ALIASES[e.id];
  if (aliases && aliases.length) e.aliases = aliases;
  else delete e.aliases;
}

// ─── 5. Invariantes ──────────────────────────────────────────────────────────
function findDuplicates(catalog, field) {
  const seen = new Map();
  for (const e of catalog) {
    if (e.hidden) continue;
    const key = norm(e[field]);
    if (!seen.has(key)) seen.set(key, []);
    seen.get(key).push(e);
  }
  return [...seen.values()].filter((group) => group.length > 1);
}

// Se escribe ya formateado como el resto del repo: así `npm run format` no
// genera un diff enorme sin cambios reales.
async function writeFormatted(file, text) {
  const options = (await prettier.resolveConfig(file)) ?? {};
  fs.writeFileSync(
    file,
    await prettier.format(text, { ...options, filepath: file })
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const catalog = JSON.parse(fs.readFileSync(CATALOG, 'utf8'));
  const ids = new Set(catalog.map((e) => e.id));
  for (const id of [
    ...Object.keys(HAND),
    ...Object.keys(ALIASES),
    ...Object.keys(MANUAL_VARIANT_OF),
    ...Object.values(MANUAL_VARIANT_OF),
  ]) {
    if (!ids.has(id)) throw new Error(`No existe el id ${id} en el catálogo`);
  }

  catalog.forEach(fixEnglishTypos);
  assignVariants(catalog);
  catalog.forEach(finishEnglish);
  fixSpanish(catalog);
  catalog.forEach(applyAliases);
  for (const id of Object.keys(ALIASES)) {
    const e = catalog.find((x) => x.id === id);
    if (e.variantOf) {
      throw new Error(
        `ALIASES: ${id} es variante de ${e.variantOf}; ponlos en el principal`
      );
    }
  }

  let failed = false;
  for (const field of ['es', 'en']) {
    for (const group of findDuplicates(catalog, field)) {
      failed = true;
      console.error(
        `Nombre ${field.toUpperCase()} repetido: ` +
          group.map((e) => `${e.id} "${e[field]}" <${e.en}>`).join(' | ')
      );
    }
  }

  // Orden y forma estables (el diff de una re-ejecución sale vacío).
  const out = catalog.map((e) => {
    const row = {
      id: e.id,
      mediaId: e.mediaId,
      en: e.en,
      es: e.es,
      target: e.target,
      equipment: e.equipment,
      category: e.category,
    };
    if (e.variantOf) row.variantOf = e.variantOf;
    if (e.hidden) row.hidden = true;
    if (e.aliases) row.aliases = e.aliases;
    return row;
  });
  await writeFormatted(CATALOG, JSON.stringify(out, null, 2) + '\n');

  const variants = out.filter((e) => e.variantOf).sort(byId);
  const ts =
    '// GENERADO por scripts/clean-exercise-catalog.js — no editar a mano.\n' +
    '//\n' +
    '// Copias del mismo ejercicio en el catálogo (otra cámara, otro modelo, "v. 2")\n' +
    '// → su ejercicio principal. Para el historial son EL MISMO ejercicio. Vive\n' +
    '// aparte del JSON para que agrupar el historial no cargue el catálogo entero.\n' +
    'export const EXERCISE_VARIANT_OF: Readonly<Record<string, string>> = {\n' +
    variants.map((e) => `  '${e.id}': '${e.variantOf}',`).join('\n') +
    '\n};\n';
  await writeFormatted(VARIANTS, ts);

  console.log(
    `${out.length} ejercicios · ${variants.length} variantes ` +
      `(${out.filter((e) => e.hidden).length} ocultas) · ` +
      `${out.filter((e) => e.aliases).length} con sinónimos`
  );
  if (failed) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
