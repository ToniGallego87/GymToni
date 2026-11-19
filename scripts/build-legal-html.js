/**
 * Genera las páginas web de la Política de privacidad y los Términos de uso
 * (las que se enlazan desde Google Play y la App Store) a partir de
 * `data/legal.json`, la misma fuente que lee la app. Cada página lleva el texto
 * en español y, debajo, en inglés.
 *
 *   node scripts/build-legal-html.js
 *
 * Escribe `privacy-policy.html` y `terms.html` en la raíz del repo. No editar
 * esos archivos a mano: se pisan al volver a generarlos.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const legal = JSON.parse(
  fs.readFileSync(path.join(root, 'data', 'legal.json'), 'utf8')
);

const escape = (text) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// Texto escapado con el contacto convertido en enlace.
const render = (text) =>
  escape(text)
    .split('{contact}')
    .join(`<a href="mailto:${legal.contact}">${legal.contact}</a>`);

const STYLE = `
      :root {
        color-scheme: light dark;
        --bg: #ffffff;
        --text: #1a1d24;
        --text-muted: #5a6070;
        --border: #e2e5eb;
        --accent: #b8860b;
      }
      @media (prefers-color-scheme: dark) {
        :root {
          --bg: #0f1115;
          --text: #f5f7fa;
          --text-muted: #98a0ae;
          --border: #232734;
          --accent: #f7cc3d;
        }
      }
      body {
        background: var(--bg);
        color: var(--text);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
          sans-serif;
        line-height: 1.6;
        max-width: 720px;
        margin: 0 auto;
        padding: 2.5rem 1.5rem 4rem;
      }
      h1 { font-size: 1.6rem; margin-bottom: 0.25rem; }
      .updated { color: var(--text-muted); font-size: 0.9rem; margin-bottom: 2rem; }
      h2 {
        font-size: 1.15rem;
        margin-top: 2rem;
        border-bottom: 1px solid var(--border);
        padding-bottom: 0.4rem;
      }
      ul { padding-left: 1.3rem; }
      a { color: var(--accent); }
      .summary {
        background: var(--border);
        border-radius: 10px;
        padding: 1rem 1.2rem;
        margin: 1.5rem 0;
        font-weight: 600;
      }
      .lang { font-size: 0.9rem; }
      hr { border: 0; border-top: 1px solid var(--border); margin: 3rem 0; }
      footer { margin-top: 3rem; color: var(--text-muted); font-size: 0.85rem; }`;

function renderDoc(doc, lang) {
  const sections = doc.sections
    .map((section) => {
      const paragraphs = (section.p ?? [])
        .map((p) => `      <p>${render(p)}</p>`)
        .join('\n');
      const items = section.li
        ? `      <ul>\n${section.li
            .map((li) => `        <li>${render(li)}</li>`)
            .join('\n')}\n      </ul>`
        : '';
      return [`      <h2>${escape(section.h)}</h2>`, paragraphs, items]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n\n');
  return `    <section lang="${lang}" id="${lang}">
      <h1>${escape(doc.title)} — GymBro</h1>
      <p class="updated">${escape(doc.updated)}</p>
      <div class="summary">${render(doc.summary)}</div>

${sections}
    </section>`;
}

function page(id, file) {
  const { es, en } = legal.docs[id];
  const html = `<!DOCTYPE html>
<!-- Generado por scripts/build-legal-html.js desde data/legal.json. No editar a mano. -->
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escape(es.title)} — GymBro</title>
    <style>${STYLE}
    </style>
  </head>
  <body>
    <p class="lang"><a href="#en">English version below</a></p>
${renderDoc(es, 'es')}

    <hr />

${renderDoc(en, 'en')}

    <footer>GymBro — ${escape(es.title.toLowerCase())} · ${
      legal.version
    }</footer>
  </body>
</html>
`;
  fs.writeFileSync(path.join(root, file), html);
  console.log(`${file} (${legal.version})`);
}

page('privacy', 'privacy-policy.html');
page('terms', 'terms.html');
