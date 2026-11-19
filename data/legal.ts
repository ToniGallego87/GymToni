import legal from './legal.json';

/**
 * Política de privacidad y Términos de uso. El texto vive en `legal.json`, que
 * es la fuente única: lo lee la app (pantalla Legal, desde Configuración y desde
 * el alta de la cuenta) y de él salen los `.html` publicados para las tiendas
 * (`node scripts/build-legal-html.js`). Cambiar el texto = cambiar `version`
 * (la fecha) y volver a generar los `.html`.
 */

export type LegalDocId = 'privacy' | 'terms';

export interface LegalSection {
  /** Encabezado numerado. */
  h: string;
  /** Párrafos. */
  p?: string[];
  /** Lista de puntos, después de los párrafos. */
  li?: string[];
}

export interface LegalDoc {
  title: string;
  updated: string;
  summary: string;
  sections: LegalSection[];
}

/** Versión vigente de los textos: se guarda en la cuenta al aceptarlos. */
export const LEGAL_VERSION: string = legal.version;

/** Email de contacto de los textos legales. */
export const LEGAL_CONTACT: string = legal.contact;

function fill(text: string): string {
  return text.split('{contact}').join(LEGAL_CONTACT);
}

/** El documento en el idioma pedido, con el contacto ya puesto. */
export function getLegalDoc(id: LegalDocId, lang: 'es' | 'en'): LegalDoc {
  const doc: LegalDoc = legal.docs[id][lang];
  return {
    title: doc.title,
    updated: doc.updated,
    summary: fill(doc.summary),
    sections: doc.sections.map((section) => ({
      h: section.h,
      p: section.p?.map(fill),
      li: section.li?.map(fill),
    })),
  };
}
