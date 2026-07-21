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
    version: '0.6.3',
    items: [
      'Nuevo buscador de ejercicios con vídeo de referencia: al montar o editar los ejercicios de un día, toca la lupa y elige entre más de 1.300 ejercicios (buscables en español o inglés, con filtro por zona del cuerpo y una miniatura de cada uno). Al elegir uno se rellena el nombre solo.',
      'Ahora puedes ver cómo se hace cada ejercicio: un botón de play abre su vídeo de referencia, tanto mientras entrenas como al mirar un día que ya hiciste. Los vídeos se descargan solo cuando los abres, así que no ocupan sitio en el móvil.',
      'Tocar la tarjeta de hoy en Inicio continúa tu entrenamiento directamente, sin pasar antes por un menú. Para borrarlo, usa el botón de los tres puntos de la tarjeta.',
      'Ya puedes restaurar una copia de seguridad desde el primer momento, con la app recién instalada y sin ninguna rutina creada. Ideal si cambias de móvil o reinstalas.',
      'Un día dejado a medias ya no cuenta como semana entrenada ni suma en la gráfica ni en la racha. En cuanto lo terminas, vuelve a contar como siempre.',
      'Al elegir una sesión que ya tenías empezada hoy, la app la abre para seguir metiendo series, en vez de volver a Inicio sin avisar.',
      'El botón físico de atrás del móvil ahora te lleva justo a donde esperas, igual que el botón "Volver" de cada pantalla.',
      'Si escribes un valor imposible en una serie (un símbolo raro, un número negativo o un peso o repeticiones disparatados), la app te avisa de qué ha pasado en cada caso y no deja que estropee tus gráficas.',
      'Mejorar en un ejercicio de peso corporal ya no te penaliza: añadir algo de lastre siempre sube la nota, nunca la baja.',
      'Cambiar entre modo oscuro y claro es ahora instantáneo: la app ya no se reinicia al hacerlo (cambiar de idioma sí la sigue reiniciando).',
      'El modo claro se ve más pulido y legible: dorado un poco más luminoso, cristal más transparente y el botón "Volver", las gráficas de cardio y el calendario mejor colocados.',
      'Ajustes internos para mejorar la estabilidad y el rendimiento.',
    ],
  },
  {
    version: '0.6.2',
    items: [
      'Nuevo Progreso por ejercicio (en Perfil): elige un ejercicio y ve cómo ha ido sesión a sesión, con tus récords de peso, repeticiones y mejor sesión, cada uno con su fecha. Aunque cambies de rutina, el histórico del ejercicio sigue entero.',
      'Ya no hay que mantener pulsado para nada: todo lo que se puede hacer tiene ahora su botón a la vista (ver los logros de una semana, editar o borrar un entrenamiento, borrar una rutina y editar los ejercicios de un día).',
      'Ahora puedes duplicar una rutina: se copia entera, sin historial, para que la ajustes y la estrenes sin tocar la que estás entrenando.',
      'La pantalla ya no se apaga mientras registras un entrenamiento, así no tienes que desbloquear el móvil entre serie y serie.',
      'Al borrar un día de entrenamiento puedes quedarte con el cardio de ese día: te lo pregunta y, por defecto, lo conserva.',
      'Un día tiene un solo cardio, lo metas por donde lo metas: se acabaron los días partidos en dos sesiones que se veían distintas en cada pantalla. Los días que ya estaban partidos se arreglan solos al abrir la app.',
      'Los filtros de las gráficas ahora se ven todos de golpe: antes había que ir pulsando a ciegas para pasar de uno a otro. El filtro por día muestra el dibujo de cada grupo muscular.',
      'El modo claro estrena un dorado vivo y luminoso, en vez del bronce apagado de antes, y los acentos ya no se ven marrones.',
      'Cardio se organiza por días: una tarjeta por día con sus calorías totales y, dentro, cada disciplina. El dato grande ahora es tu cardio de HOY, comparado con el mismo día de la semana pasada, tu media diaria y tu mejor día.',
      'Andar en cuesta ya cuenta como algo distinto de andar en llano, y el calendario pinta la disciplina en la que más quemaste ese día.',
      'Los decimales se escriben y se ven con coma, como en español ("12,6 km/h").',
      'Guardar un entrenamiento ya no te hace esperar: vuelve al instante.',
      'La tarjeta de progreso de Inicio ya dice el nombre de tu rutina, en vez de "Rutina 2".',
      'Corregido: al reordenar o añadir ejercicios en un día, el historial se mezclaba entre ejercicios y las comparaciones mostraban datos de otro. Ya no.',
      'Al volver del registro de cardio aterrizas en Cardio, no en Inicio.',
      'Los números grandes de las tarjetas vuelven a estar bien alineados y sin recortes.',
      'Ajustes internos para mejorar la estabilidad y el rendimiento.',
    ],
  },
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
