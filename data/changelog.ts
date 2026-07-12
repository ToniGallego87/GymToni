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
    version: '0.6.0',
    items: [
      'Nueva pestaña Perfil: ahora la app tiene 4 secciones (Fuerza, Cardio, Calendario, Perfil) y desde Perfil accedes a tus rutinas, tus datos y los ajustes.',
      'Nuevos ajustes: elige entre modo claro y modo oscuro, y entre español e inglés.',
      'Modo claro renovado: más legible, con mejor contraste en botones y títulos.',
      'App disponible en inglés.',
      'Ahora puedes ponerle nombre y descripción a tus rutinas, tanto al crearlas como después.',
      'La cabecera de cada rutina se ve más cuidada.',
      'El resumen de tus datos (rutinas, entrenamientos, sesiones de cardio) ahora está en Perfil.',
      'Cardio estrena un resumen semanal más claro: calorías, sesiones, minutos y kilómetros de la semana, comparados con la anterior y con tu mejor semana.',
      'El póster de logros semanales ahora elige tus mejores logros de la semana en lugar de mostrar siempre los mismos datos, y ya no se corta con nombres de ejercicio largos.',
      'La racha de asistencia perfecta ahora se celebra como tal, en vez de solo contar días.',
      'La tarjeta de "hoy" ya no dice que has terminado el entrenamiento si te falta alguna serie por hacer.',
      'La app abre siempre mostrando tu rutina activa, sin parpadeos raros.',
      'Ajustes internos para mejorar la estabilidad y el rendimiento.',
    ],
  },
  {
    version: '0.5.9',
    items: [
      'La copia de seguridad ahora guarda también tu peso corporal: al restaurarla, las calorías del cardio salen bien.',
      'El detalle de un entrenamiento muestra cada actividad de cardio del día por separado, con sus minutos, velocidad y pendiente.',
      'Las tarjetas de ejercicios del detalle se ven más claras: el objetivo de series y repeticiones siempre visible y flechas de color para comparar con la vez anterior.',
      'El icono de la app se ve mejor centrado y con el tamaño adecuado.',
      'La pantalla de elegir sesión es más fácil de leer, con etiquetas más grandes.',
      'El calendario se ve igual de ordenado en Fuerza y en Cardio.',
      'Mejor contraste en el botón de importar rutina al escanear un QR.',
      'Ajustes internos para mejorar la estabilidad y el rendimiento.',
    ],
  },
  {
    version: '0.5.8',
    items: [
      'Ahora verás un aviso con las novedades cada vez que se actualice la app.',
      'Ajustes internos para mejorar la estabilidad y el rendimiento.',
    ],
  },
];
