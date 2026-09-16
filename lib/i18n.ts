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

/** Tiempo relativo corto y localizado: "hace un momento", "hace 3 min", "hace 2 h". */
export function formatAgo(ts: number): string {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return t('hace un momento');
  const m = Math.round(s / 60);
  if (m < 60) return t('hace {n} min', { n: m });
  const h = Math.round(m / 60);
  if (h < 24) return t('hace {n} h', { n: h });
  const d = Math.round(h / 24);
  return t('hace {n} d', { n: d });
}

/** Pinta los decimales de un texto ("12.6 km/h" → "12,6 km/h") en el idioma. */
export function localizeDecimals(text: string): string {
  if (decimalSeparator === '.') return text;
  return text.replace(/(\d)\.(\d)/g, `$1${decimalSeparator}$2`);
}

/**
 * Redondea a 1 decimal, quita el ".0" innecesario y pinta el decimal con el
 * separador del idioma (coma en español). Es formato de PINTADO: los datos se
 * guardan siempre con punto (ver `canonicalDecimals`).
 */
export function fmtNum(n: number): string {
  const r = Math.round(n * 10) / 10;
  return localizeDecimals(Number.isInteger(r) ? String(r) : r.toFixed(1));
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

/**
 * ¿Esta clave tiene traducción registrada? Solo para el test que recorre los
 * `t('…')` del código y falla si alguno se ha quedado sin entrada: `t()` cae al
 * español en silencio, así que sin esta red la app se va quedando a medio
 * traducir sin que nada avise.
 */
export function hasEnglish(text: string): boolean {
  return Object.prototype.hasOwnProperty.call(EN, text);
}

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
  'Datos y nube': 'Data & cloud',
  'Sin perfil': 'No profile',
  'Editar perfil': 'Edit profile',
  'Completar perfil': 'Complete profile',
  'Sin biografía: cuéntale a la gente qué entrenas.':
    'No bio yet: tell people what you train.',
  'Tu foto y tu nombre son lo que ve la gente en Comunidad.':
    'Your photo and name are what people see in Community.',
  'Sin cuenta': 'No account',
  'El perfil público vive en tu cuenta: sin ella no se puede completar. Créala en Datos y nube.':
    'Your public profile lives in your account: without one it cannot be completed. Create it in Data & cloud.',
  'Tema, idioma, tus datos en la nube y novedades':
    'Theme, language, your cloud data and news',
  'El perfil público vive en tu cuenta: créala en Datos y nube para poder guardarlo.':
    'Your public profile lives in your account: create one in Data & cloud to save it.',
  'Copias, exportar/importar y cuenta en la nube':
    'Backups, export/import and cloud account',
  Sincronizado: 'Synced',
  'Sesión iniciada': 'Signed in',
  'hace un momento': 'just now',
  'hace {n} min': '{n} min ago',
  'hace {n} h': '{n} h ago',
  'hace {n} d': '{n} d ago',
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

  // Aviso de actualización disponible
  'Hay una versión nueva': 'A new version is available',
  'Ya está disponible en Google Play. Actualiza para tenerlo todo al día.':
    "It's already on Google Play. Update to get the latest.",
  Actualizar: 'Update',
  'Ahora no': 'Not now',
  Tienes: 'You have',
  Disponible: 'Available',

  // Inicio / hero
  'Añade una rutina': 'Add a routine',
  'Rutina cerrada': 'Closed routine',
  'Pulsa para cambiar la rutina': 'Tap to change the routine',
  Preparada: 'Prepared',
  'Solo cardio': 'Cardio only',
  'Registra solo tu cardio': 'Log just your cardio',
  'Añade tu cardio antes de guardar': 'Add your cardio before saving',
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
  'Consultar detalles de esta rutina': 'View this routine in detail',
  'Consulta la que desees o crea una nueva':
    'Check any routine or create a new one',
  'Aún no tienes rutinas': "You don't have any routines yet",
  'Crea la primera aquí abajo o cógela de la comunidad':
    'Create your first one below or grab one from the community',
  // Situación de una rutina en la lista (y su lectura para el lector de pantalla)
  'La que entrenas': 'The one you train',
  'Sin estrenar': 'Not started yet',
  Cerrada: 'Closed',
  'Cerrada el {date}': 'Closed on {date}',
  'En Inicio': 'On Home',
  'Ver en Inicio': 'Show on Home',
  '{name}. {status}. {days}': '{name}. {status}. {days}',
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
  '1 ejercicio': '1 exercise',

  // Registro de entrenamiento
  Guardar: 'Save',
  Hecho: 'Done',
  'Buscar GIF': 'Search GIF',
  'Cronómetro del ejercicio': 'Exercise stopwatch',
  Cancelar: 'Cancel',
  Borrar: 'Clear',
  'Error al guardar.': 'Could not save.',
  'Rellena primero los datos': 'Fill in the data first',
  'El peso y las repeticiones no pueden ser negativos':
    'Weight and reps cannot be negative',
  'Valor demasiado alto (máx. {max}kg / {reps} reps)':
    'Value too high (max. {max}kg / {reps} reps)',
  'Valor no válido: usa solo números': 'Invalid value: numbers only',
  'Plegar día': 'Collapse day',
  'Desplegar día': 'Expand day',
  'Notas del ejercicio': 'Exercise notes',
  'Ver la nota del ejercicio': 'See the exercise note',
  'Añade una nota (ej: muy cansado, fallo en última serie)':
    'Add a note (e.g. very tired, failed last set)',
  'Descanso finalizado': 'Rest over',
  Descanso: 'Rest',
  '¡A por la siguiente serie!': 'On to the next set!',
  'Es hora de tu siguiente serie': 'Time for your next set',
  Objetivo: 'Target',
  Anterior: 'Previous',
  Actual: 'Current',
  'Peso · kg': 'Weight · kg',
  Repeticiones: 'Reps',
  Segundos: 'Seconds',
  'Añadir serie': 'Add set',
  'Saltar resto': 'Skip remaining',
  'Saltar ejercicio': 'Skip exercise',
  Nota: 'Note',
  'Completado · {a}/{b} series': 'Completed · {a}/{b} sets',
  Iniciar: 'Start',
  Parar: 'Stop',
  'Saltar descanso': 'Skip rest',
  'Añadir 30 segundos': 'Add 30 seconds',
  'Usar {n}s': 'Use {n}s',
  'Borrar serie {n}': 'Delete set {n}',
  'Plegar ejercicio': 'Collapse exercise',
  'Desplegar ejercicio': 'Expand exercise',
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
  'Detalles del cardio': 'Cardio details',
  'Se guarda solo: pulsa ✓ en el teclado o toca fuera.':
    'Saves itself: tap ✓ on the keyboard or tap outside.',
  Minutos: 'Minutes',
  'Pendiente %': 'Incline %',
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
  'Tu cuenta, tus copias y tu historial':
    'Your account, your backups and your history',
  'Tu cuenta': 'Your account',
  Cuenta: 'Account',
  Sincronización: 'Sync',
  'Copias de seguridad': 'Backups',
  'Reemplazar o borrar': 'Replace or wipe',
  'Copia automática': 'Automatic backup',
  'Guarda una copia en el dispositivo al abrir la app, una vez al día.':
    'Saves a copy on the device when the app opens, once a day.',
  Activado: 'On',
  Desactivado: 'Off',
  'Última copia: {date}': 'Last backup: {date}',
  Nunca: 'Never',
  'Guardar copia en el móvil': 'Save a copy on this phone',
  'Subir copia a la nube': 'Upload a copy to the cloud',
  'Copia subida a la nube': 'Copy uploaded to the cloud',
  'Subiendo…': 'Uploading…',
  Restaurar: 'Restore',
  'Reemplaza lo que hay en este móvil por lo que haya guardado en la nube.':
    'Replaces what is on this phone with whatever is stored in the cloud.',
  'Restaurar desde la nube': 'Restore from the cloud',
  'Restaurando…': 'Restoring…',
  'Se reemplazarán los datos de este dispositivo por los de la nube. ¿Continuar?':
    "This device's data will be replaced with the cloud's. Continue?",
  'Datos restaurados desde la nube': 'Data restored from the cloud',
  'Escribe email y contraseña': 'Enter your email and password',
  'Revisa tu correo para confirmar la cuenta':
    'Check your inbox to confirm the account',
  'Crea una cuenta para guardar tus datos en la nube y usarlos en varios dispositivos. La app funciona igual sin cuenta.':
    'Create an account to store your data in the cloud and use it on several devices. The app works the same without one.',
  'Tus cambios se sincronizan solos con la nube y con tus otros dispositivos.':
    'Your changes sync on their own with the cloud and your other devices.',
  'Última sincronización': 'Last sync',
  'Aún sin sincronizar': 'Not synced yet',
  'Sincronizar ahora': 'Sync now',
  'Sincronizando…': 'Syncing…',
  'Iniciar sesión': 'Sign in',
  'Entrando…': 'Signing in…',
  'Crear cuenta': 'Create account',
  'Creando…': 'Creating…',
  'Cerrar sesión': 'Sign out',
  Contraseña: 'Password',
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
  'Quitar ejercicio': 'Remove exercise',
  'Subir ejercicio': 'Move exercise up',
  'Bajar ejercicio': 'Move exercise down',
  'Editar {name}': 'Edit {name}',
  // Editar un día de la rutina: nombre e icono en el mismo modal
  'Editar día': 'Edit day',
  'Nombre del día:': 'Day name:',
  'Icono:': 'Icon:',
  // La rutina es de otra persona: sus ajustes no se tocan
  'No es tuya': 'Not yours',
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
  'Temporizador de descanso': 'Rest timer',
  '{time} entre series, en todas tus rutinas':
    '{time} between sets, in all your routines',
  'Editar Temporizador': 'Edit Timer',
  'Modificar temporizador': 'Change timer',
  'Duración en segundos:': 'Duration in seconds:',
  'Equivalente:': 'Equivalent:',
  'Compartir por QR': 'Share via QR',
  'Compartir rutina': 'Share routine',
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
  'Ver en la rutina': 'View in routine',
  'Ver en {routine}': 'View in {routine}',
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

register({
  // Comunidad (tablón, perfil ajeno y consulta de una rutina pública)
  Comunidad: 'Community',
  'Descubre y comparte rutinas': 'Discover and share routines',
  Populares: 'Popular',
  Siguiendo: 'Following',
  'Buscar usuarios': 'Search users',
  'Buscar personas': 'Search people',
  Personas: 'People',
  'Buscando…': 'Searching…',
  'Sin resultados': 'No results',
  'Filtrar por intensidad': 'Filter by intensity',
  'Cargando…': 'Loading…',
  Reintentar: 'Retry',
  'por {name}': 'by {name}',
  'Añadir a mis rutinas': 'Add to my routines',
  'Añadiendo…': 'Adding…',
  'Añadida a tus rutinas': 'Added to your routines',
  'Esta rutina ya no está disponible': 'This routine is no longer available',
  'Rutina de la comunidad': 'Community routine',
  'Ver rutina': 'View routine',
  'Perfil guardado': 'Profile saved',
  'Foto de perfil actualizada': 'Profile photo updated',
  'A quién sigo': 'Who I follow',
  'En tus rutinas': 'In your routines',
  'Ver perfil de {name}': "View {name}'s profile",
  'Iniciar sesión': 'Sign in',
  'Inicia sesión para compartir en la comunidad':
    'Sign in to share with the community',

  // Rutinas traídas de la comunidad: se enlazan (no se copian) y llevan crédito
  'De {name}': 'By {name}',
  'Copiada de {name}': 'Copied from {name}',
  'Hacer copia': 'Make a copy',
  'Copia creada en tus rutinas': 'Copy created in your routines',
  'Puedes entrenarla tal cual. Para cambiarla, haz una copia tuya.':
    'You can train it as is. To change it, make your own copy.',

  // Intensidad de una rutina (nº total de series por semana)
  Intensidad: 'Intensity',
  Todas: 'All',
  Suave: 'Easy',
  Medio: 'Moderate',
  Intenso: 'Hard',
  '1 serie': '1 set',
  '{n} series': '{n} sets',
  'Sin rutinas de esa intensidad': 'No routines at that intensity',

  // Comentarios de una rutina pública
  '1 comentario': '1 comment',
  '{n} comentarios': '{n} comments',
  'Todavía no hay comentarios. Rompe el hielo.':
    'No comments yet. Break the ice.',
  'Escribe un comentario': 'Write a comment',
  'Enviar comentario': 'Send comment',
  'Eliminar comentario': 'Delete comment',
  '¿Eliminar el comentario?': 'Delete this comment?',
  'Inicia sesión para comentar': 'Sign in to comment',

  // Publicar una rutina con el perfil en privado
  'Pública · firmada como «Anónimo»': 'Public · signed as “Anonymous”',
  'Saldrás como «Anónimo»': 'You will show up as “Anonymous”',
  'Tu perfil está en privado: la rutina aparecerá en el tablón sin tu nombre ni tu foto, y nadie podrá abrir tu perfil ni seguirte desde ella.':
    'Your profile is private: the routine will show on the board without your name or photo, and nobody will be able to open your profile or follow you from it.',
  'Todavía no tienes nombre visible, así que la rutina aparecerá en el tablón firmada como «Anónimo» y nadie podrá seguirte desde ella.':
    'You have no display name yet, so the routine will show on the board signed as “Anonymous” and nobody will be able to follow you from it.',
  'Hacerme visible y publicar': 'Go public and share',
  'Publicar como «Anónimo»': 'Share as “Anonymous”',
  'Nombre visible': 'Display name',

  // Tu tarjeta y tus novedades en Comunidad
  'Ver mi perfil público': 'View my public profile',
  'Así te ve la comunidad': 'This is how the community sees you',
  'Tu perfil no aparece para otros': 'Your profile is hidden from others',
  'Sin nombre visible': 'No display name',
  Seguidores: 'Followers',
  Seguidor: 'Follower',
  '1 nuevo seguidor': '1 new follower',
  '{n} nuevos seguidores': '{n} new followers',
  '1 me gusta nuevo': '1 new like',
  '{n} me gusta nuevos': '{n} new likes',
  '1 comentario nuevo': '1 new comment',
  '{n} comentarios nuevos': '{n} new comments',

  // Reportar contenido (moderación)
  Reportar: 'Report',
  'Enviando…': 'Sending…',
  '¿Reportar {what}?': 'Report {what}?',
  'Lo revisaremos. Además dejará de aparecerte en este dispositivo.':
    'We will review it. It will also stop showing up on this device.',
  'Motivo (opcional)': 'Reason (optional)',
  'Qué problema tiene': "What's wrong with it",
  'esta rutina': 'this routine',
  'este perfil': 'this profile',
  'este comentario': 'this comment',
  'Reportar esta rutina': 'Report this routine',
  'Reportar este perfil': 'Report this profile',
  'Reportar comentario': 'Report comment',
  'Inicia sesión para reportar': 'Sign in to report',
  'Gracias, lo revisaremos': 'Thanks, we will review it',

  // Buscador de la lista de ejercicios (progreso y catálogo)
  'Buscar ejercicio…': 'Search exercise…',
  'Añade tu primera rutina': 'Add your first routine',
});

// ─────────────────────────────────────────────────────────────────────────────
// Rezagados: textos que fueron entrando con Comunidad, el perfil público y la
// semana de descarga y se quedaron sin traducir, más un puñado de verbos de uso
// diario. `t()` cae al español cuando falta la entrada, así que no rompían nada
// — solo dejaban la app a medio traducir, con diálogos enteros en español.
// Lo vigila `lib/__tests__/i18n.test.ts`, que falla si algún `t('…')` del código
// no tiene su entrada aquí.
//
// Los que se repiten idénticos en inglés (1RM, Email, Cardio…) llevan su entrada
// igualmente: dice "comprobado, se escribe igual" en vez de "se nos olvidó".
register({
  // Verbos y rótulos de uso diario
  Editar: 'Edit',
  Eliminar: 'Delete',
  Borrar: 'Delete',
  Cancelar: 'Cancel',
  Continuar: 'Continue',
  Guardar: 'Save',
  Hecho: 'Done',
  Cerrar: 'Close',
  Atrás: 'Back',
  Actualizar: 'Update',
  Entendido: 'Got it',
  Opciones: 'Options',
  'Más acciones': 'More actions',
  Asignar: 'Assign',
  Duplicar: 'Duplicate',
  Iniciar: 'Start',
  Exportar: 'Export',
  Importar: 'Import',
  Todos: 'All',
  Hoy: 'Today',
  Ejercicio: 'Exercise',
  Ejercicios: 'Exercises',
  Entrenamientos: 'Workouts',
  Anterior: 'Previous',
  Actual: 'Current',
  Distancia: 'Distance',
  Disponible: 'Available',
  Activado: 'On',
  Desactivado: 'Off',
  Descanso: 'Rest',
  'Añadir nota': 'Add note',
  'Editar nota': 'Edit note',
  'Modo claro': 'Light mode',
  'Modo oscuro': 'Dark mode',
  'Abriendo…': 'Opening…',
  'Ver ejercicio': 'View exercise',
  'Ver evolución': 'View progress',
  'Ver logros': 'View achievements',
  'Ver GIF': 'View GIF',
  'Todos los ejercicios': 'All exercises',
  'Cargar más ({n})': 'Load more ({n})',
  'Ver tarjeta {n} de {total}': 'View card {n} of {total}',
  'Fecha del entreno': 'Workout date',
  '1RM': '1RM',
  Email: 'Email',

  // Catálogo y GIF de un ejercicio
  'Catálogo de ejercicios': 'Exercise catalogue',
  'Buscar en el catálogo': 'Search the catalogue',
  'GIF asignado al ejercicio': 'GIF assigned to the exercise',
  'Este ejercicio no tiene GIF de referencia.':
    'This exercise has no reference GIF.',
  'No se pudo cargar el GIF (¿sin conexión?)':
    'The GIF could not be loaded (are you offline?)',

  // Semana de descarga
  'Semana de descarga': 'Deload week',
  'Marcar descarga': 'Mark as deload',
  'Quitar descarga': 'Remove deload',
  '¿Quitar semana de descarga?': 'Remove deload week?',
  'La semana se preparará como descarga: menos series y peso más ligero. ¿Continuar?':
    'The week will be set up as a deload: fewer sets and lighter weight. Continue?',
  'La semana quedará al margen de las estadísticas: no compara ni cuenta para récords. ¿Continuar?':
    'The week will sit outside your stats: it will not be compared and will not count towards records. Continue?',
  'La semana volverá a contar como carga normal (objetivos de series y peso completos). ¿Continuar?':
    'The week will count as a normal load again (full set targets and weight). Continue?',
  'La semana volverá a contar como carga normal en racha, progreso y récords. ¿Continuar?':
    'The week will count as a normal load again for your streak, progress and records. Continue?',

  // Mover un entreno de semana y cambiar su fecha
  'Mover a la semana anterior': 'Move to the previous week',
  'Mover a la semana siguiente': 'Move to the next week',
  'Mover a una semana nueva': 'Move to a new week',
  '¿Dividir la semana?': 'Split the week?',
  'Esa fecha cae en una semana que ya tiene este día. Se partirá en dos y puede afectar a la racha y al progreso. ¿Continuar?':
    'That date falls in a week that already has this day. It will be split in two, which may affect your streak and progress. Continue?',

  // Calendario
  'Semana de la rutina': 'Week of the routine',
  'La disciplina que más calorías quemó ese día':
    'The discipline that burned the most calories that day',
  'Minutos de cardio del día': 'Minutes of cardio that day',

  // Compartir una rutina (QR y texto plano)
  'Copiar en texto plano': 'Copy as plain text',
  'Por QR o copiando el texto': 'By QR or by copying the text',
  '¿Ya tienes la rutina en otro sitio?': 'Already have the routine elsewhere?',
  'o créala a mano': 'or create it by hand',
  'Escanea el QR con la cámara de otro móvil o copia la rutina como texto para pegarla en «Crear a partir de texto plano».':
    'Scan the QR with another phone’s camera, or copy the routine as text and paste it into “Create from plain text”.',
  'Esta rutina es demasiado grande para un código QR. Cópiala como texto para pegarla en «Crear a partir de texto plano».':
    'This routine is too big for a QR code. Copy it as text and paste it into “Create from plain text”.',

  // Perfil público
  'Perfil público': 'Public profile',
  'Guardar perfil': 'Save profile',
  'Cambiar foto': 'Change photo',
  'Bio (opcional)': 'Bio (optional)',
  Público: 'Public',
  Privado: 'Private',
  'Otros pueden ver tu perfil y seguirte.':
    'Others can see your profile and follow you.',
  'Tu perfil no aparece para otros.': 'Your profile is hidden from others.',
  'Así te ven en la comunidad cuando publicas una rutina.':
    'This is how the community sees you when you share a routine.',

  // Comunidad: tablón, seguir y rutinas públicas
  Seguir: 'Follow',
  'Me gusta': 'Like',
  Anónimo: 'Anonymous',
  'Rutinas públicas': 'Public routines',
  'Compartir en la comunidad': 'Share with the community',
  Pública: 'Public',
  Privada: 'Private',
  'Pública · aparece en el tablón': 'Public · shows on the board',
  'Privada · solo tú la ves': 'Private · only you can see it',
  'Rutina publicada en la comunidad': 'Routine shared with the community',
  'Rutina retirada de la comunidad': 'Routine removed from the community',
  'Inicia sesión para seguir': 'Sign in to follow',
  'Inicia sesión para dar like': 'Sign in to like',
  'Inicia sesión para compartir': 'Sign in to share',
  '1 seguidor': '1 follower',
  '{n} seguidores': '{n} followers',
  'Aún no hay rutinas': 'No routines yet',
  'Nada por aquí todavía': 'Nothing here yet',
  'Publica una de tus rutinas desde su detalle para que aparezca aquí.':
    'Share one of your routines from its detail view so it shows up here.',
  'Sigue a alguien para ver aquí sus rutinas públicas.':
    'Follow someone to see their public routines here.',
  'Este usuario no tiene rutinas públicas.':
    'This user has no public routines.',
  'Aún no sigues a nadie. Busca usuarios en Comunidad.':
    'You are not following anyone yet. Search for people in Community.',
  'Aún no te sigue nadie.': 'Nobody follows you yet.',
});

// Peso corporal: su pantalla en Perfil y el aviso de que se ha quedado viejo.
register({
  'Peso corporal': 'Body weight',
  'Actualízalo y mira cómo ha ido cambiando':
    'Update it and see how it has changed',
  'Tu peso y cómo ha ido cambiando': 'Your weight and how it has changed',
  Histórico: 'History',
  'Actualizado hoy': 'Updated today',
  'Actualizado ayer': 'Updated yesterday',
  'Actualizado hace {n} días': 'Updated {n} days ago',
  'Aún no has anotado tu peso': 'You have not logged your weight yet',
  'Con tu peso se estiman las kcal del cardio. Los cardios ya registrados conservan el peso que tenías entonces.':
    'Your weight is used to estimate cardio calories. Sessions already logged keep the weight you had back then.',
  '¿Sigues pesando lo mismo?': 'Still the same weight?',
  'Hace {n} días que no actualizas tu peso, y con él se calculan las kcal de tu cardio.':
    'It has been {n} days since you updated your weight, and your cardio calories are worked out with it.',
  'Tu cuenta, tus copias y tus datos': 'Your account, backups and data',
});

// El día que toca y el descanso que sobrevive a salir del registro.
register({
  'Te toca': 'Up next',
  'Te toca este': 'This one is up next',
  'Ya entrenado esta semana': 'Already trained this week',
  'Elegir otro día': 'Pick another day',
  'Volver al entreno': 'Back to the workout',
});
