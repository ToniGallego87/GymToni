// i18n minimalista: la CLAVE es el texto en español (idioma fuente de la app)
// y solo existe diccionario para inglés. Si falta una traducción se muestra el
// español (nunca rompe).
//
// El idioma se aplica EN CALIENTE (igual que el tema, ver themeStore): el valor
// inicial se lee de forma síncrona al evaluar el módulo, pero `setLanguage`
// reasigna los bindings vivos (`language`/`dateLocale`/`decimalSeparator`) y
// avisa a los suscriptores para re-renderizar el árbol, sin reiniciar el bundle.
// Por eso NO deben capturarse estos valores en constantes de módulo: hay que
// leerlos en cada render/llamada (t(), toLocaleDateString(dateLocale), etc.).
//
// Placeholders: t('Importados {n} días', { n: 3 }).
import { getStoredLanguage, Language, setStoredLanguage } from './appSettings';
import { useSyncExternalStore } from 'react';

export let language: Language = getStoredLanguage();

// Locale para toLocaleDateString y similares.
export let dateLocale = language === 'en' ? 'en-GB' : 'es-ES';

// Separador decimal del idioma: coma en español, punto en inglés.
//
// IMPORTANTE: los datos se GUARDAN y se PARSEAN siempre con punto (`rawInput`
// separa las series por comas: "60x8, 60x8" — una coma decimal ahí partiría la
// serie en dos, y los regex de parsers.ts/cardio.ts esperan punto). Así que la
// coma vive solo en los extremos: al pintar (localizeDecimals) y al teclear
// (canonicalDecimals / parseTypedNumber).
export let decimalSeparator = language === 'en' ? '.' : ',';

// --- Store de idioma (versión + suscriptores), espejo de themeStore ---
type LangListener = () => void;
const langListeners = new Set<LangListener>();
let langVersion = 0;

function subscribeLanguage(listener: LangListener): () => void {
  langListeners.add(listener);
  return () => {
    langListeners.delete(listener);
  };
}

function getLanguageVersion(): number {
  return langVersion;
}

// Cambia el idioma en caliente: reasigna los bindings vivos, persiste y avisa a
// los suscriptores (la raíz se re-renderiza y todo el árbol relee los t()).
export function setLanguage(next: Language): void {
  if (next === language) return;
  language = next;
  dateLocale = next === 'en' ? 'en-GB' : 'es-ES';
  decimalSeparator = next === 'en' ? '.' : ',';
  setStoredLanguage(next);
  langVersion += 1;
  for (const listener of Array.from(langListeners)) listener();
}

// Suscribe la RAÍZ del árbol a los cambios de idioma (re-render en cada cambio,
// como useThemeVersion). Ningún componente está memoizado, así que la cascada
// llega a todos y los t() inline se recalculan.
export function useLanguageVersion(): number {
  return useSyncExternalStore(
    subscribeLanguage,
    getLanguageVersion,
    getLanguageVersion
  );
}

/** Pinta los decimales de un texto ("12.6 km/h" → "12,6 km/h") en el idioma. */
export function localizeDecimals(text: string): string {
  if (decimalSeparator === '.') return text;
  return text.replace(/(\d)\.(\d)/g, `$1${decimalSeparator}$2`);
}

/** Pasa a punto lo tecleado por el usuario, que puede venir con coma. */
export function canonicalDecimals(text: string): string {
  return text.replace(',', '.');
}

/** Lee un número tecleado por el usuario (admite coma o punto). */
export function parseTypedNumber(text: string): number {
  return parseFloat(canonicalDecimals(text));
}

const EN: Record<string, string> = {};

export function t(
  text: string,
  params?: Record<string, string | number>
): string {
  let out = language === 'en' ? EN[text] ?? text : text;
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      out = out.split(`{${key}}`).join(String(value));
    }
  }
  return out;
}

// Registra las traducciones al inglés. Se declara aparte (abajo) para que el
// diccionario grande no tape la lógica del módulo.
function register(entries: Record<string, string>) {
  Object.assign(EN, entries);
}

register({
  // Navegación y pantallas
  Fuerza: 'Strength',
  Cardio: 'Cardio',
  Calendario: 'Calendar',
  Perfil: 'Profile',
  Inicio: 'Home',
  Rutinas: 'Routines',
  Rutina: 'Routine',
  Datos: 'Data',
  Configuración: 'Settings',
  Versión: 'Version',

  // Perfil
  'Mis rutinas': 'My routines',
  'Consulta, comparte o cambia de rutina': 'View, share or switch routines',
  'Progreso por ejercicio': 'Progress by exercise',
  'Tu evolución y tus récords, ejercicio a ejercicio':
    'Your progress and records, exercise by exercise',
  'Importa, exporta o limpia la información':
    'Import, export or wipe your data',
  'Tema, idioma y novedades': "Theme, language and what's new",
  'Tu rutina, tus datos y la configuración': 'Your routine, data and settings',
  Entrenamientos: 'Workouts',
  'Sesiones cardio': 'Cardio sessions',

  // Configuración
  Tema: 'Theme',
  Oscuro: 'Dark',
  Claro: 'Light',
  Idioma: 'Language',
  Novedades: "What's new",
  'Qué ha cambiado en la versión {v}': 'What changed in version {v}',
  'Novedades de la versión': "What's new in version",
  'Ajusta la app a tu gusto': 'Make the app yours',
  Entendido: 'Got it',

  // Inicio / hero
  'Añade una rutina': 'Add a routine',
  'Rutina cerrada': 'Closed routine',
  'Pulsa para cambiar la rutina': 'Tap to change the routine',
  Preparada: 'Prepared',
  'Solo cardio': 'Cardio only',
  'Registra solo tu cardio': 'Log just your cardio',
  'Añade tu cardio antes de guardar': 'Add your cardio before saving',
  'Empezar una nueva semana con este día': 'Start a new week with this day',
  'Empezar sesión': 'Start session',
  '¡Semana completada!': 'Week completed!',
  'Pulsa para compartir resultados': 'Tap to share your results',
  'Continúa tu entrenamiento': 'Continue your workout',
  'Entrenamiento completado': 'Workout completed',
  'Empezar entrenamiento': 'Start workout',
  '{n} semanas seguidas': '{n} weeks in a row',
  Semana: 'Week',
  Descarga: 'Deload',
  'Marcar semana de descarga': 'Mark as deload week',
  'Quitar semana de descarga': 'Unmark deload week',
  'Marcar como semana de descarga': 'Mark as deload week',
  '¿Marcar semana de descarga?': 'Mark as deload week?',
  'Se borrarán los datos ya insertados de esta sesión para prepararla como descarga (menos series y peso más ligero). ¿Continuar?':
    'The data already entered in this session will be cleared to set it up as a deload (fewer sets and lighter weight). Continue?',
  'Peso sugerido más ligero': 'Lighter suggested weight',
  'Semana completa': 'Full week',
  '1 día': '1 day',
  '{n} días': '{n} days',
  '{n} de {total} días': '{n} of {total} days',
  '¿Mover el día?': 'Move the day?',
  Mover: 'Move',
  'Este movimiento vacía una semana y recalcula racha, progreso y logros. ¿Continuar?':
    'This move empties a week and recalculates streak, progress and achievements. Continue?',
  'Este movimiento reorganiza una semana ya completada y recalcula racha, progreso y logros. ¿Continuar?':
    'This move reorganizes an already completed week and recalculates streak, progress and achievements. Continue?',
  'Ver logros de la semana': "See the week's achievements",
  'Más opciones': 'More options',
  '¿Qué deseas hacer?': 'What do you want to do?',
  'Puedes editar o eliminar el registro': 'You can edit or delete the entry',
  'Puedes continuar o eliminar el registro':
    'You can continue or delete the entry',
  Editar: 'Edit',
  Eliminar: 'Delete',
  Volver: 'Back',
  Activa: 'Active',
  '+ Nueva rutina': '+ New routine',
  'Consultar detalles de esta rutina': 'View this routine in detail',
  '{n} días de entrenamiento': '{n} training days',
  'Consulta la que desees o crea una nueva':
    'Check any routine or create a new one',
  Duplicar: 'Duplicate',
  '(copia)': '(copy)',
  '(copia {n})': '(copy {n})',
  'Copiada como "{name}"': 'Copied as "{name}"',
  '¿Eliminar rutina?': 'Delete routine?',
  '¿Eliminar entrenamiento?': 'Delete workout?',
  'Esta acción no se puede deshacer. ¿Estás seguro?':
    'This cannot be undone. Are you sure?',

  // Selector de día
  'Elige la sesión': 'Pick a session',
  'Borrar también el cardio': 'Delete the cardio too',
  Día: 'Day',
  'Selecciona el día que vas a registrar': "Select the day you'll log",
  '{n} ejercicios': '{n} exercises',

  // Registro de entrenamiento
  Guardar: 'Save',
  Hecho: 'Done',
  'Buscar GIF': 'Search GIF',
  'Cronómetro del ejercicio': 'Exercise stopwatch',
  Cancelar: 'Cancel',
  Borrar: 'Clear',
  'Entrenamiento guardado': 'Workout saved',
  'Error al guardar.': 'Could not save.',
  'Rellena primero los datos': 'Fill in the data first',
  'El peso y las repeticiones no pueden ser negativos':
    'Weight and reps cannot be negative',
  'Valor demasiado alto (máx. {max}kg / {reps} reps)':
    'Value too high (max. {max}kg / {reps} reps)',
  'Valor no válido: usa solo números': 'Invalid value: numbers only',
  'Rellena los ejercicios': 'Fill in the exercises',
  'Notas del ejercicio': 'Exercise notes',
  'Añade una nota (ej: muy cansado, fallo en última serie)':
    'Add a note (e.g. very tired, failed last set)',
  'Descanso finalizado': 'Rest over',
  'Es hora de tu siguiente serie': 'Time for your next set',
  Objetivo: 'Target',
  Anterior: 'Previous',
  Actual: 'Current',
  'Peso · kg': 'Weight · kg',
  Repeticiones: 'Reps',
  Segundos: 'Seconds',
  'Añadir serie': 'Add set',
  'Saltar resto': 'Skip remaining',
  Nota: 'Note',
  'Completado · {a}/{b} series': 'Completed · {a}/{b} sets',
  Iniciar: 'Start',
  Parar: 'Stop',
  'Tiempo hasta la siguiente serie': 'Time until your next set',
  Saltar: 'Skip',
  'Saltar descanso': 'Skip rest',
  'Añadir 30 segundos': 'Add 30 seconds',
  'Usar {n}s': 'Use {n}s',
  '¡Ánimo con tu nueva rutina!': 'Good luck with your new routine!',

  // Cardio
  'Añadir cardio': 'Add cardio',
  Añadir: 'Add',
  'Selecciona el tipo de cardio': 'Choose the cardio type',
  'Correr en cinta': 'Treadmill run',
  'Andar en cinta': 'Treadmill walk',
  'Correr en exterior': 'Outdoor run',
  'Bici estática': 'Stationary bike',
  Elíptica: 'Elliptical',
  Otro: 'Other',
  'Especifica el tipo de ejercicio': 'Specify the exercise type',
  'Ej: Escalador, Remo, etc.': 'E.g.: Stair climber, Rowing, etc.',
  Continuar: 'Continue',
  Atrás: 'Back',
  'Disciplinas ejecutadas:': 'Disciplines done:',
  'Detalles del cardio': 'Cardio details',
  'Se guarda solo: pulsa ✓ en el teclado o toca fuera.':
    'Saves itself: tap ✓ on the keyboard or tap outside.',
  Minutos: 'Minutes',
  'Pendiente %': 'Incline %',
  'Ej: Cinta: 22.5mins, 11.5kmh': 'E.g.: Treadmill: 22.5mins, 11.5kmh',
  'Consulta tus resultados': 'Check your results',
  'Aún no hay cardio. Añádelo dentro de un día de fuerza.':
    'No cardio yet. Add it inside a strength day.',
  'Esta semana': 'This week',
  'semana pasada': 'last week',
  'media semanal': 'weekly average',
  'mejor semana': 'best week',
  Hoy: 'Today',
  'Aún sin cardio hoy': 'No cardio yet today',
  disciplina: 'discipline',
  disciplinas: 'disciplines',
  'hace 7 días': '7 days ago',
  'media diaria': 'daily average',
  'mejor día': 'best day',
  'vs mismos días': 'vs same days',
  ejercicios: 'exercises',
  'Pulsa para indicar tu peso': 'Tap to set your weight',
  'Pulsa para actualizarlo': 'Tap to update it',
  '{d} kg desde el anterior': '{d} kg since the previous one',
  'Últimos {n} registros': 'Last {n} entries',
  'Tu peso': 'Your weight',
  'Se usa para estimar las kcalorías del cardio. Se aplica a los próximos; los cardios ya registrados mantienen el peso que tenías entonces.':
    'Used to estimate cardio kcal. It applies from now on; cardio already logged keeps the weight you had back then.',
  mes: 'month',
  Distancia: 'Distance',
  Velocidad: 'Speed',
  'Cargar más': 'Load more',
  sesión: 'session',
  sesiones: 'sessions',

  // Calendario
  'Tu historial mensual': 'Your monthly history',
  'Repasa tus ejercicios mes por mes': 'Review your workouts month by month',
  'Sin entrenamientos': 'No workouts',
  'Guarda una sesión para verla reflejada en el calendario.':
    'Save a session to see it on the calendar.',
  Enero: 'January',
  Febrero: 'February',
  Marzo: 'March',
  Abril: 'April',
  Mayo: 'May',
  Junio: 'June',
  Julio: 'July',
  Agosto: 'August',
  Septiembre: 'September',
  Octubre: 'October',
  Noviembre: 'November',
  Diciembre: 'December',
  Lun: 'Mon',
  Mar: 'Tue',
  Mié: 'Wed',
  Jue: 'Thu',
  Vie: 'Fri',
  Sáb: 'Sat',
  Dom: 'Sun',

  // Datos
  Resumen: 'Summary',
  'Exportar datos': 'Export data',
  'Descarga un fichero con todas las rutinas y entrenamientos.':
    'Download a file with all routines and workouts.',
  'Exportando…': 'Exporting…',
  Exportar: 'Export',
  'Importar datos': 'Import data',
  'Carga un fichero exportado con rutinas y entrenamientos.':
    'Load an exported file with routines and workouts.',
  'Importando…': 'Importing…',
  Importar: 'Import',
  'Borrar datos': 'Clear data',
  'Elimina todas las rutinas y entrenamientos guardados.':
    'Deletes all saved routines and workouts.',
  'Esta acción eliminará los datos actuales y los reemplazará con los del fichero. ¿Estás seguro?':
    'This will delete your current data and replace it with the file contents. Are you sure?',
  'Esta acción borrará toda la información guardada en la app.':
    'This will erase all data stored in the app.',
  'Datos importados': 'Data imported',
  'Datos exportados': 'Data exported',
  'Datos eliminados': 'Data wiped',
  'No se pudo completar la acción': 'The action could not be completed',
  'El fichero no tiene el formato esperado':
    'The file does not have the expected format',
  'El fichero contiene datos con un formato no válido':
    'The file contains data in an invalid format',
  'Exportación completada': 'Export completed',
  'Backup guardado en:': 'Backup saved to:',
  'Backup automático': 'Automatic backup',
  'Guarda una copia en el dispositivo al abrir la app, una vez al día.':
    'Saves a copy on the device when the app opens, once a day.',
  Activado: 'On',
  Desactivado: 'Off',
  'Último backup: {date}': 'Last backup: {date}',
  Nunca: 'Never',
  'Hacer backup ahora': 'Back up now',
  'Guardando…': 'Saving…',
  'Backup guardado en el dispositivo': 'Backup saved on the device',
  'No se seleccionó ningún archivo': 'No file selected',
  'No se pudo leer el archivo': 'Could not read the file',
  'No se pudo acceder al archivo seleccionado':
    'Could not access the selected file',
  'No se encontró una carpeta disponible para exportar':
    'No folder available for export',

  // Nueva rutina
  'Nueva rutina': 'New routine',
  'Define los ejercicios que realizarás cada día':
    "Define each day's exercises",
  'Nombre (ej: Rutina {n})': 'Name (e.g. Routine {n})',
  'Descripción (opcional)': 'Description (optional)',
  'Ej: Push pesado': 'E.g.: Heavy push',
  'Elegir icono': 'Pick icon',
  Ejercicios: 'Exercises',
  'Ej: Press banca': 'E.g.: Bench press',
  Series: 'Sets',
  'Ej: 30-45': 'E.g.: 30-45',
  'Ej: 10-12': 'E.g.: 10-12',
  reps: 'reps',
  seg: 'sec',
  'Añadir ejercicio': 'Add exercise',
  'Añadir día': 'Add day',
  'Quitar día': 'Remove day',
  'Subir día': 'Move day up',
  'Bajar día': 'Move day down',
  '¿Eliminar el día?': 'Delete the day?',
  'Se elimina «{name}» de la rutina y los días se renumeran.':
    'This removes "{name}" from the routine and the days are renumbered.',
  'Este día tiene entrenamientos registrados; su historial dejará de verse.':
    'This day has logged workouts; its history will no longer be visible.',
  'Crear rutina': 'Create routine',
  'Crear a partir de QR': 'Create from QR',
  'Crear a partir de texto plano': 'Create from plain text',
  'Un día por bloque (sepáralos con una línea en blanco). La primera línea es el nombre del día; debajo, un ejercicio por línea. Añade una "s" tras las reps para marcar segundos (ej: Plancha 3x30s).':
    'One day per block (separate them with a blank line). The first line is the day name; below it, one exercise per line. Add an "s" after the reps for seconds (e.g. Plank 3x30s).',
  'No se reconoció ninguna rutina en el texto':
    'No routine recognised in the text',
  'Importados {n} días': '{n} days imported',
  'Importado 1 día': '1 day imported',
  'Máximo 7 días': '7 days maximum',
  'Añade al menos un día': 'Add at least one day',
  'Falta el título del Día {n}': 'Day {n} is missing a title',
  'Faltan ejercicios en el Día {n}': 'Day {n} is missing exercises',
  'Añade al menos un ejercicio': 'Add at least one exercise',
  'Elige un icono para el Día {n}': 'Pick an icon for Day {n}',
  'Nueva rutina creada': 'New routine created',
  'No se pudo crear la rutina': 'Could not create the routine',
  'Rutina personalizada ({n} días)': 'Custom routine ({n} days)',
  'Selecciona un icono para este día': 'Pick an icon for this day',
  'Selecciona un icono': 'Pick an icon',
  Cerrar: 'Close',

  // Detalle de rutina
  'Editar rutina': 'Edit routine',
  'Nombre:': 'Name:',
  'Descripción:': 'Description:',
  'Nombre de la rutina': 'Routine name',
  'Toca para editar': 'Tap to edit',
  'Temporizador de descanso': 'Rest timer',
  'Editar Temporizador': 'Edit Timer',
  'Modificar temporizador': 'Change timer',
  'Duración en segundos:': 'Duration in seconds:',
  'Equivalente:': 'Equivalent:',
  'Editar Ejercicios': 'Edit Exercises',
  'Compartir por QR': 'Share via QR',
  'Otro móvil escanea y carga la rutina':
    'Another phone scans it and loads the routine',
  'Compartir en texto plano': 'Share as plain text',
  'Copia la rutina para pegarla en «Crear a partir de texto plano»':
    'Copies the routine to paste into "Create from plain text"',
  'Compartir rutina': 'Share routine',
  'Escanea este código con la cámara de otro móvil para cargar «{name}».':
    "Scan this code with another phone's camera to load “{name}”.",
  'Rutina copiada al portapapeles': 'Routine copied to clipboard',
  'No se pudo copiar la rutina': 'Could not copy the routine',

  // Importar por QR
  'Importar rutina por QR': 'Import routine via QR',
  'Escanea con la cámara del móvil': "Scan with your phone's camera",
  'Abre la cámara de tu móvil, apunta al código QR de la rutina y GymBro se abrirá automáticamente con la rutina importada.':
    "Open your phone's camera, point it at the routine QR code and GymBro will open automatically with the imported routine.",
  'o pega el enlace': 'or paste the link',
  'Enlace del QR': 'QR link',
  'Pega el enlace del QR aquí.': 'Paste the QR link here.',
  'Enlace no válido. Usa el enlace copiado desde "Compartir por QR".':
    'Invalid link. Use the link copied from "Share via QR".',
  'Importar rutina': 'Import routine',

  // Logros / póster
  'Logros de la semana': "This week's achievements",
  'Comparte tus resultados en redes': 'Share your results on social media',
  'Compartir resultados': 'Share results',
  'Generando…': 'Generating…',
  'Generando vídeo… {p}%': 'Generating video… {p}%',
  'No se pudo generar la imagen.': 'Could not generate the image.',
  'No se pudo compartir la imagen.': 'Could not share the image.',
  'No se pudo generar el vídeo.': 'Could not generate the video.',
  'No se pudo leer la imagen': 'Could not read the image',
  'Póster no disponible': 'Poster not available',
  'Compartir logros de la semana': "Share this week's achievements",
  'Imagen guardada': 'Image saved',
  'Disponible en:': 'Available at:',
  'No se encontró una carpeta disponible para la imagen':
    'No folder available for the image',
  'El codificador de vídeo no está disponible en esta versión.':
    'The video encoder is not available in this build.',
  SEMANA: 'WEEK',
  '¡COMPLETADA!': 'COMPLETED!',
  '{n} día entrenado': '{n} day trained',
  '{n} días entrenados': '{n} days trained',
  'MEJORA DE FUERZA': 'STRENGTH GAIN',
  'respecto a la semana anterior': 'vs the previous week',
  'MAYOR PROGRESO': 'TOP PROGRESS',
  'RÉCORD PERSONAL': 'PERSONAL RECORD',
  'PESO MÁXIMO': 'MAX WEIGHT',
  ASISTENCIA: 'ATTENDANCE',
  'ni un día faltado': 'not a single day missed',
  RACHA: 'STREAK',
  'sin fallar ningún entreno': 'without missing a workout',
  'VOLUMEN MOVIDO': 'VOLUME MOVED',
  'peso total esta semana': 'total weight this week',
  'DESDE EL INICIO': 'ALL TIME',
  'entrenos completados': 'workouts completed',
  'TRABAJO SEMANAL': 'WEEKLY WORK',
  'series completadas': 'sets completed',
  REPETICIONES: 'REPS',
  'esta semana': 'this week',
  'ESTA SEMANA': 'THIS WEEK',
  kg: 'kg',
  día: 'day',
  días: 'days',
  entrenos: 'workouts',
  series: 'sets',
  entreno: 'workout',
  serie: 'set',

  // Progreso por ejercicio
  Progreso: 'Progress',
  'Elige un ejercicio para ver su evolución':
    'Pick an exercise to see how it evolved',
  'Tu evolución': 'Your progress',
  'Sesión a sesión y tus mejores marcas': 'Session by session and your bests',
  'Registra un entrenamiento y aquí verás tu evolución.':
    'Log a workout and your progress will show up here.',
  'Aún no hay dos sesiones que comparar con esta medida.':
    'Not enough sessions to compare with this metric yet.',
  '{n} sesiones · última el {date}': '{n} sessions · last one on {date}',
  '{n} sesiones · {date}': '{n} sessions · {date}',
  Volumen: 'Volume',
  Reps: 'Reps',
  Peso: 'Weight',
  Reciente: 'Recent',
  Nombre: 'Name',
  Sesiones: 'Sessions',
  'Ver más ({n})': 'Show more ({n})',
  Récords: 'Records',
  '1RM estimado': 'Estimated 1RM',
  'Peso máximo': 'Max weight',
  'Más repeticiones': 'Most reps',
  'Mejor sesión': 'Best session',
  '{w} kg × {r}': '{w} kg × {r}',
  '{r} reps con {w} kg': '{r} reps at {w} kg',
  '{r} reps': '{r} reps',

  // Hero cards (carrusel de estados)
  'Ver rutinas': 'View routines',
  'Aún no hay entrenamientos registrados.': 'No workouts logged yet.',
  'Insertar cardio': 'Add cardio',

  // Iconos de día (GYM_ICON_LABELS)
  Pecho: 'Chest',
  Hombro: 'Shoulders',
  Espalda: 'Back',
  Bíceps: 'Biceps',
  Tríceps: 'Triceps',
  Abdominales: 'Abs',
  Piernas: 'Legs',
  Torso: 'Torso',
  'Full body': 'Full body',
});
