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
    version: '0.6.1',
    items: [
      'Ahora puedes registrar solo tu cardio, sin tener que abrir un día de entrenamiento de fuerza.',
      'Al crear una rutina nueva ya no cambias de golpe la que estás entrenando: la nueva queda "Preparada" y empieza a contar cuando registras en ella tu primer día.',
      'La pantalla de Inicio estrena tarjetas que puedes deslizar con las flechas: tu situación de hoy, un acceso a tus rutinas y las estadísticas de la semana (kilos levantados).',
      'En Cardio también puedes deslizar entre tus estadísticas de la semana, tu peso y un botón directo para añadir cardio.',
      'Tu peso tiene ahora su propia tarjeta en Cardio: lo ves en grande, lo cambias tocándola y, en cuanto tengas tres pesos apuntados, te dibuja cómo ha ido evolucionando.',
      'El porcentaje de cambio de las estadísticas de fuerza ya no te compara la semana a medias contra la semana pasada entera: ahora compara solo los días que llevas hechos, así que el dato sirve desde el primer día de la semana.',
      'Al elegir la sesión del día puedes decidir empezar una semana nueva con ese día.',
      'La app abre directa en tu rutina, sin parpadeos.',
      'El aviso de novedades ahora se puede desplazar cuando hay muchas cosas que contar.',
      'Ajustes internos para mejorar la estabilidad y el rendimiento.',
    ],
  },
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
