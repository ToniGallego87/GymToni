// Novedades por versión mostradas al usuario en el popup "Qué hay de nuevo"
// (components/WhatsNewModal.tsx). Se añade una entrada nueva al principio en
// cada cierre de versión (agente close-version), con el mismo contenido que
// el changelog de usuario final. Sin tecnicismos.
export interface ChangelogEntry {
  version: string;
  items: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '0.5.8',
    items: [
      'Ahora verás un aviso con las novedades cada vez que se actualice la app.',
      'Ajustes internos para mejorar la estabilidad y el rendimiento.',
    ],
  },
];
