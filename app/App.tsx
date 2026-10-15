import React, {
  useContext,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import {
  BackHandler,
  InteractionManager,
  Platform,
  StatusBar,
  StyleSheet,
  unstable_batchedUpdates,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import PagerView from 'react-native-pager-view';
import { useFonts } from 'expo-font';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';
import * as SplashScreen from 'expo-splash-screen';
// expo-notifications does not support web; load it only on native platforms
const Notifications: typeof import('expo-notifications') | null =
  Platform.OS !== 'web' ? require('expo-notifications') : null;
// Toques en notificaciones ya atendidos (ver el efecto de las notificaciones).
const handledNotificationTaps = new Set<string>();
import {
  CalendarScreen,
  CardioScreen,
  CommunityScreen,
  PublicRoutineScreen,
  UserProfileScreen,
  FollowingScreen,
  DataScreen,
  DaySelectorScreen,
  DetailScreen,
  ExerciseProgressScreen,
  HomeScreen,
  NewRoutineScreen,
  ProfileScreen,
  AchievementsScreen,
  ActivityScreen,
  BodyWeightScreen,
  SettingsScreen,
  RoutineDetailScreen,
  RoutineSelectorScreen,
  WeekAchievementScreen,
  WorkoutContext,
  WorkoutProvider,
  WorkoutLogScreen,
  useWorkout,
} from '@features/workout';
import {
  AwardModal,
  WhatsNewModal,
  UpdateAvailableModal,
  ThemeRevealOverlay,
  FloatingPrimaryNav,
  FLOATING_GLASS_BAR_HEIGHT,
  FLOATING_BACK_BUTTON_HEIGHT,
  getFloatingBackButtonMetrics,
  PipRestTimer,
  RestTimerBar,
  SplashFade,
  getFloatingPrimaryNavMetrics,
} from '@components';
import type { WeekAchievements } from '@lib/achievements';
import {
  CARDIO_ONLY_DAY,
  isCardioOnlyLog,
  splitMixedCardioLogs,
} from '@lib/cardio';
import type { WeightSegment } from '@lib/cardio';
import {
  clearAppData,
  getCardioWeightHistory,
  getLastSeenVersion,
  getLastUpdatePromptVersion,
  getSeedAppData,
  getSeedCardioWeightHistory,
  isValidWeightSegments,
  loadAppData,
  saveAppData,
  setCardioWeightHistory,
  setLastSeenVersion,
  setLastUpdatePromptVersion,
} from '@lib/storage';
import { useMyProfile } from '@hooks/useMyProfile';
import { useRecordAccountLevel } from '@hooks/useAccountLevel';
import { TabFocusContext } from '@hooks/useTabFocus';
import { shiftAward, useAwards } from '@lib/awards';
import { requestLevelPulse } from '@lib/levelPulse';
import { setAchievementsOpener } from '@lib/achievementsLink';
import { readJsonFromFile, downloadJsonFile } from '@lib/fileIO';
import { isAutoBackupDue, readAutoBackup, runAutoBackup } from '@lib/backup';
import { loadBodyWeight, maybeNotifyStaleWeight } from '@lib/bodyWeight';
import {
  rescheduleWorkoutReminders,
  WORKOUT_REMINDER_SOURCE,
} from '@lib/workoutReminder';
import { isNewerVersion, playStoreUrls } from '@lib/appUpdate';
import { fetchLatestRelease } from '@lib/cloud/release';
import type { AppRelease } from '@lib/cloud/release';
import { parseRoutineShareLink, SharedRoutineDay } from '@lib/routineShare';
import { subscribePipMode } from '@lib/pipTimer';
import { getRestTimer, useRestTimer } from '@lib/restTimerStore';
import { findDayInRoutines, getToday, logDateKey } from '@lib/utils';
import { currentWeekDayState } from '@lib/weeks';
import { theme, useThemeVersion } from '@lib/theme';
import { subscribeTheme } from '@lib/themeStore';
import { t, useLanguageVersion } from '@lib/i18n';
import { CHANGELOG, ChangelogEntry } from '@data/changelog';
import { useCloudSync } from '@hooks/useCloudSync';
import { startSession } from '@lib/cloud/auth';
import {
  getStoredCardioSplitDone,
  setStoredCardioSplitDone,
} from '@lib/appSettings';
import {
  noteTouchCancel,
  noteTouchEnd,
  noteTouchStart,
  runWhenQuiet,
} from '@lib/userQuiet';
import {
  WorkoutAppData,
  WorkoutDay,
  WorkoutLog,
  WorkoutRoutine,
} from '../types';

type Screen =
  | { type: 'home' }
  | { type: 'cardio' }
  | { type: 'routine-selector'; origin?: 'home' | 'profile' }
  // `forDate`: entreno olvidado de ese día, desde una celda vacía del Calendario.
  | { type: 'day-selector'; forDate?: string }
  | {
      type: 'workout-log';
      day: WorkoutDay;
      log?: WorkoutLog;
      cardioOnly?: boolean;
      // Abre semana nueva con este entreno (ver WorkoutLogScreen).
      startsNewWeek?: boolean;
      // Fecha de un entreno olvidado (ver WorkoutLogScreen).
      initialDate?: string;
      origin?: 'home' | 'calendar' | 'cardio';
      // Pantalla a la que vuelve "Volver" cuando no es una pestaña: el Detalle
      // desde el que se pulsó "Editar". Sin ella se vuelve a `origin`.
      back?: Screen;
    }
  | {
      type: 'detail';
      log: WorkoutLog;
      day: WorkoutDay;
      origin: 'home' | 'calendar' | 'cardio';
      // Pantalla a la que vuelve si no es una pestaña (Elige la sesión).
      back?: Screen;
    }
  | { type: 'calendar' }
  | { type: 'profile' }
  // Datos y nube se abre desde Configuración y, para "crear cuenta", desde
  // Perfil, Comunidad, perfiles ajenos, rutinas públicas y la ficha de una
  // rutina: se vuelve a donde se abrió (sin `back`, a Configuración).
  | { type: 'data'; back?: Screen }
  | { type: 'settings' }
  // Estas tres cuelgan de Perfil, pero no solo se abren desde ahí: Peso
  // corporal también desde Cardio y Logros desde la píldora de nivel de la
  // barra superior, que está en TODAS las pantallas. `back` es la vista desde
  // la que se abrió, para volver a ella (sin `back`, a Perfil).
  // Peso corporal: se edita aquí, no en el carrusel de Cardio.
  | { type: 'body-weight'; back?: Screen }
  // Logros: insignias derivadas del histórico.
  | { type: 'achievements'; back?: Screen }
  // Actividad propia (insignias, retos y días), desde los datos locales.
  | { type: 'activity'; back?: Screen }
  // El perfil público se edita desde Perfil (su tarjeta de identidad), que es
  // el único sitio desde el que se llega: Comunidad habla de otra gente.
  | { type: 'community' }
  | { type: 'following'; back: 'community' }
  | { type: 'followers'; back: 'community' }
  | {
      type: 'user-profile';
      userId: string;
      name: string;
      // Vista desde la que se abrió, para volver a ella y no siempre al tablón:
      // al perfil del autor también se llega desde tus propias rutinas (la marca
      // "de {autor}" de una rutina traída de la comunidad).
      back?: Screen;
    }
  | {
      // Consulta de una rutina PÚBLICA (solo lectura) antes de adoptarla.
      type: 'public-routine';
      routineId: string;
      name: string;
      authorName?: string;
      // Dueño de la rutina: hace falta para enlazarla y para abrir su perfil.
      ownerId?: string;
      // Vista desde la que se abrió, para volver a ella y no siempre al tablón.
      back:
        | { type: 'community' }
        | { type: 'user-profile'; userId: string; name: string };
    }
  | {
      type: 'exercise-progress';
      // Ejercicio preseleccionado al abrir la evolución desde el detalle de un
      // día. Marca además que se entró ENFOCADO: no hay lista detrás, así que
      // "Volver" sale de la pantalla en vez de subir a ella.
      initialExerciseKey?: string;
      // Ejercicio abierto ahora mismo (la ficha con su gráfica y sus récords).
      // Vive aquí, con el resto de la navegación, y no dentro de la pantalla:
      // así el "Volver" en pantalla y el atrás del móvil recorren los mismos
      // pasos. Cuando estaba dentro, el atrás físico no sabía de la selección y
      // se saltaba la lista.
      selectedKey?: string;
      // Detalle al que volver si se llegó desde ahí (si no, se vuelve a Perfil).
      detailReturn?: {
        log: WorkoutLog;
        day: WorkoutDay;
        origin: 'home' | 'calendar' | 'cardio';
      };
    }
  | {
      type: 'new-routine';
      initialDays?: SharedRoutineDay[];
      // Desde Rutinas se vuelve a Rutinas; sin `back` (Inicio, enlace), a Inicio.
      back?: Screen;
    }
  | {
      type: 'routine-details';
      routine: WorkoutRoutine;
      origin?: 'home' | 'profile';
      // Vista desde la que se abrió cuando NO fue el selector de rutinas: desde
      // la ficha de un ejercicio (Progreso) se vuelve a esa ficha, no al
      // selector. Con `back`, `origin` no se usa.
      back?: Screen;
      // Día que se abre desplegado (el del ejercicio desde el que se llegó).
      expandDayId?: string;
    }
  | {
      type: 'week-achievement';
      achievements: WeekAchievements;
      routineName?: string;
    };

// Orden de las pestañas en la barra (índice = posición para el deslizamiento).
const TAB_ORDER = [
  'home',
  'cardio',
  'calendar',
  'community',
  'profile',
] as const;
type TabType = (typeof TAB_ORDER)[number];

/**
 * Margen entre el primer frame pintado y el momento en que se considera que la
 * app está QUIETA (`idle`), que es cuando arranca la fase 1 del arranque.
 *
 * Hace falta un reloj de verdad porque `InteractionManager.runAfterInteractions`
 * NO lo es: solo espera a las "interacciones" registradas (animaciones,
 * PanResponder), y pulsar un `Pressable` no registra ninguna. Se resolvía en el
 * frame siguiente, así que todo ese trabajo caía pegado al primer pintado, justo
 * cuando el usuario ya está tocando la pantalla.
 */
const BOOT_SETTLE_MS = 450;

/**
 * Hueco MÍNIMO entre montar una pestaña de fondo y la siguiente. Cada montaje
 * son 80-210 ms de JS (medido en garnet) más el trabajo nativo de asentar sus
 * vistas; con las cuatro seguidas se juntaban en un tapón. Además de este hueco,
 * cada montaje espera a que el usuario no esté tocando (`runWhenQuiet`).
 */
const WARM_STEP_MS = 650;

/**
 * Tope de espera de cada paso del arranque si el usuario no deja de tocar: pasado
 * este rato se hace igual, para que el sync y el resto de la fase 2 no se queden
 * esperando para siempre a alguien que no suelta la pantalla.
 */
const BOOT_MAX_WAIT_MS = 8000;

/**
 * El arranque va en DOS fases, y este es el motivo de que estén separadas.
 *
 * Fase 1 (`idle`): dejar la UI lista. Montar cada pestaña de fondo cuesta
 * 80-210 ms de JS (medido en garnet), así que son trozos cortos.
 *
 * Fase 2 (`background`): las tareas de red y fichero. El sync con la nube tarda
 * **8,1-8,6 s** en un arranque en frío y lo normal es que no traiga NADA
 * (`pulled=0`); la comprobación de versión, otro segundo. Colgando de `idle`
 * caían encima de los primeros toques del usuario y era lo que hacía que pulsar
 * la barra de navegación tardase en responder: no el montaje de la pestaña, sino
 * todo eso peleando por el hilo a la vez.
 *
 * Nada de la fase 2 corre prisa —reconciliar con otro dispositivo o avisar de
 * una versión nueva aguanta tres segundos— así que espera a que no quede UI que
 * preparar.
 *
 * Y ningún paso de las dos fases va a reloj fijo: cada uno espera además a que
 * el usuario lleve un rato sin tocar (`lib/userQuiet.ts`). A reloj fijo, el
 * montaje de una pestaña caía tantas veces encima de un toque o de un scroll que
 * los primeros segundos iban a tirones. Si el usuario navega sin parar, cada
 * navegación monta su pestaña igualmente, y `BOOT_MAX_WAIT_MS` pone el tope.
 */

function AppContent({ onReady }: { onReady: () => void }) {
  const { dispatch, state } = useWorkout();
  // Logs vivos para las vueltas atrás (ver `goBackTo`): el atrás físico se
  // registra al cambiar de pantalla y su cierre no ve los logs posteriores.
  const logsRef = React.useRef(state.logs);
  logsRef.current = state.logs;
  // OJO al añadir hooks aquí: lo que haga repintar a AppContent repinta la app
  // ENTERA (las cinco pestañas montadas y la subpantalla abierta). La sesión, el
  // perfil, el sync y el nivel de la cuenta viven por eso en componentes hoja
  // (`CloudSync`, `AccountLevelRecorder`, `PrimaryNav`): al llegar la sesión o el
  // perfil durante el arranque, solo repinta lo que los enseña.
  const [screen, setScreen] = useState<Screen>({ type: 'home' });
  // Pestañas ya montadas (ver `tabLayer`). Al arrancar solo la activa, para que
  // el primer pintado sea lo más corto posible; las demás entran luego, una a una
  // y espaciadas (`WARM_STEP_MS`), y una vez montadas se QUEDAN ocultas con
  // display:none, así que volver a una pestaña ya vista nunca la remonta.
  //
  // En un REF y no en estado a propósito: apuntar la pestaña en la que se entra
  // no debe provocar un render extra —lo último que necesita una navegación es
  // repintar otra vez las cinco pantallas—, y la activa ya se pinta por ser
  // activa. El render que sí hace falta cuando el calentamiento monta una nueva
  // lo dispara `warmTick`.
  const mountedTabsRef = React.useRef<Set<TabType>>(new Set<TabType>(['home']));
  const [warmTick, setWarmTick] = useState(0);
  // Fase 1: la UI ya ha pintado y está quieta; se pueden calentar las pestañas.
  const [idle, setIdle] = useState(false);
  // Fase 2: ya no queda UI que preparar; entran las tareas de red y fichero.
  const [background, setBackground] = useState(false);

  // Cardio y fuerza son sesiones independientes; los registros viejos llevaban
  // las dos cosas en un mismo log. Se parten en dos una sola vez, para que los
  // datos de siempre se comporten como los nuevos (su cardio se consulta y se
  // borra por su cuenta). Va en la FASE 2 del arranque, no en la hidratación:
  // cada log partido encola dos escrituras en SQLite (ver lib/persistence.ts) y
  // con un historial largo esa cola le robaba el hilo al primer pintado —la app
  // se quedaba unos segundos en negro—. Nada de esto corre prisa: hasta que
  // ocurre, el cardio viejo se sigue viendo donde se veía.
  //
  // Es idempotente (no vuelve a tocar lo ya separado) y el id del log de cardio
  // se deriva del original, así que si otro dispositivo ya lo separó el sync los
  // fusiona en vez de duplicar.
  //
  // Corre UNA sola vez en la vida de la instalación: al acabar se marca la
  // bandera (`setStoredCardioSplitDone`) y los arranques siguientes no vuelven
  // ni a comprobarlo. El ref evita además repetirlo dentro del mismo arranque.
  const splitDoneRef = React.useRef(false);
  useEffect(() => {
    if (!background || splitDoneRef.current) return;
    splitDoneRef.current = true;
    if (getStoredCardioSplitDone()) return;
    const { updated, created } = splitMixedCardioLogs(logsRef.current);
    updated.forEach((log) =>
      dispatch({ type: 'UPDATE_WORKOUT_LOG', payload: log })
    );
    created.forEach((log) =>
      dispatch({ type: 'ADD_WORKOUT_LOG', payload: log })
    );
    // Se marca también cuando no había nada que partir (instalación nueva): la
    // pregunta está respondida igual.
    setStoredCardioSplitDone();
  }, [background, dispatch]);
  const insets = useSafeAreaInsets();
  // Índice de la pestaña activa (-1 en subpantallas, donde el pager queda tapado).
  const tabIndex = TAB_ORDER.indexOf(screen.type as TabType);
  const isTab = tabIndex >= 0;
  // La pestaña activa se apunta como montada aquí mismo: es lo que hace que al
  // SALIR de ella siga viva (si no, una pestaña visitada antes de que el
  // calentamiento llegara a ella se desmontaba al salir y volver costaba lo
  // mismo que la primera vez).
  if (isTab) mountedTabsRef.current.add(screen.type as TabType);
  // La última pestaña elegida en la barra. Una subpantalla encima no la cambia:
  // es la pestaña de la que se viene y a la que se vuelve (ver useTabFocus).
  const focusedTabRef = React.useRef<TabType>('home');
  if (isTab) focusedTabRef.current = screen.type as TabType;
  // Pager NATIVO (react-native-pager-view / ViewPager2): gestiona el arrastre
  // horizontal y el asentamiento de forma nativa, sin pasar por el hilo JS ni por
  // react-native-gesture-handler (el enfoque casero se colgaba por un bug de
  // gestos del dispositivo). `pagerRef.setPageWithoutAnimation` mueve a la
  // pestaña tocada en la barra; el swipe dispara `onPageSelected`.
  const pagerRef = React.useRef<PagerView>(null);
  // La vista que captura el cambio de tema (toda la app menos el overlay).
  const themeCaptureRef = React.useRef<View>(null);
  // Datos hidratados desde almacenamiento. El splash nativo se mantiene hasta
  // que esto es true, para no pintar primero los datos semilla y saltar luego
  // a los reales (el "carga a trompicones" del arranque).
  const [hydrated, setHydrated] = useState(false);
  const awards = useAwards();
  // La píldora de nivel de la barra superior (GlassTopBar, en todas las
  // pantallas) abre Logros a través de este puente, recordando la vista desde
  // la que se pulsó para que "Volver" lleve de vuelta a ella.
  useEffect(() => {
    setAchievementsOpener(() =>
      setScreen((prev) =>
        prev.type === 'achievements'
          ? prev
          : { type: 'achievements', back: prev }
      )
    );
    return () => setAchievementsOpener(null);
  }, []);
  const [isFirstInstall, setIsFirstInstall] = useState(false);
  const [whatsNewEntry, setWhatsNewEntry] = useState<ChangelogEntry | null>(
    null
  );
  const [updateRelease, setUpdateRelease] = useState<AppRelease | null>(null);

  // Hidratación: carga desde almacenamiento (o migra el JSON legacy). La
  // persistencia de cada cambio la hace el wrapper de dispatch de forma
  // granular (lib/persistence.ts), no un guardado completo periódico.
  useEffect(() => {
    let isMounted = true;

    const hydrateState = async () => {
      let data: WorkoutAppData | null = null;
      let firstInstall = false;
      // La sesión, también bajo el splash y a la vez que SQLite (ver
      // `startSession`). Aparte: un fallo de la nube no debe dejar sin datos.
      try {
        startSession();
      } catch (error) {
        console.error('Error iniciando la sesión:', error);
      }
      try {
        // El peso corporal se lee A LA VEZ que los datos y bajo el splash: los
        // retos (kcal de cardio) dependen de él. Leído después, en la fase 2,
        // obligaba a recalcular los retos y repintar media app justo cuando el
        // usuario ya estaba tocando.
        const [savedData] = await Promise.all([
          loadAppData(),
          loadBodyWeight(),
        ]);
        if (!isMounted) return;

        if (savedData) {
          data = savedData;
        } else {
          // Primer arranque: sembrar el almacenamiento y reflejar ese seed en
          // el estado. El reducer parte de datos de fábrica (WORKOUT_ROUTINES /
          // INITIAL_LOGS), así que hay que sobrescribirlo con dispatch; si no,
          // en release (seed vacío) la UI seguiría mostrando las rutinas de
          // ejemplo del estado inicial en lugar de arrancar vacía.
          const seed = getSeedAppData();
          await saveAppData(seed);
          data = seed;
          // Peso corporal del backup de dev (web): sin él las kcal del cardio
          // se calcularían con el peso por defecto.
          const seedWeights = getSeedCardioWeightHistory();
          if (seedWeights.length) {
            await setCardioWeightHistory(seedWeights);
          }
          firstInstall = true;
        }
      } catch (error) {
        console.error('Error loading app data:', error);
      }
      // Siempre marcar hidratado (aunque falle) para no dejar el splash colgado.
      if (!isMounted) return;
      // Datos y `hydrated` en UN render: fuera de un evento, la arquitectura
      // antigua pinta cada `setState` por separado, y el primero repintaba con
      // los datos nuevos una pantalla que aún no se ve.
      unstable_batchedUpdates(() => {
        if (data) dispatch({ type: 'SET_APP_DATA', payload: data });
        if (firstInstall) setIsFirstInstall(true);
        setHydrated(true);
      });
    };

    hydrateState();

    return () => {
      isMounted = false;
    };
  }, [dispatch]);

  // Popup de novedades: se muestra la primera vez que se abre la app tras
  // actualizar a una versión con changelog. En una instalación nueva no hay
  // nada que anunciar, así que solo se marca la versión actual como vista.
  useEffect(() => {
    if (!hydrated) return;

    const checkWhatsNew = async () => {
      const currentVersion = Constants.expoConfig?.version;
      if (!currentVersion) return;

      try {
        const lastSeenVersion = await getLastSeenVersion();

        if (lastSeenVersion === currentVersion) return;

        if (lastSeenVersion === null && isFirstInstall) {
          await setLastSeenVersion(currentVersion);
          return;
        }

        const entry = CHANGELOG.find((item) => item.version === currentVersion);
        if (entry) {
          setWhatsNewEntry(entry);
        } else {
          await setLastSeenVersion(currentVersion);
        }
      } catch (error) {
        console.error('Error checking novedades de versión:', error);
      }
    };

    checkWhatsNew();
  }, [hydrated, isFirstInstall]);

  const handleCloseWhatsNew = () => {
    const currentVersion = Constants.expoConfig?.version;
    setWhatsNewEntry(null);
    if (currentVersion) {
      setLastSeenVersion(currentVersion).catch((error) =>
        console.error('Error guardando versión vista:', error)
      );
    }
  };

  // Aviso de versión nueva: la app se distribuye por Google Play con
  // expo-updates deshabilitado, así que la versión publicada se lee de la nube
  // (tabla `app_releases`) y se compara con la instalada. Silencioso ante
  // cualquier fallo (sin red, tabla vacía): no avisar es siempre preferible a
  // molestar en el arranque. En web no aplica: no hay ficha de Play.
  useEffect(() => {
    if (!background || Platform.OS === 'web') return;

    let isMounted = true;

    const checkAppUpdate = async () => {
      const currentVersion = Constants.expoConfig?.version;
      if (!currentVersion) return;

      try {
        const release = await fetchLatestRelease();
        if (!isMounted || !release) return;
        if (!isNewerVersion(currentVersion, release.version)) return;

        // Ya se avisó de ESTA versión: no repetir en cada arranque (volverá a
        // salir cuando se publique una posterior).
        const promptedVersion = await getLastUpdatePromptVersion();
        if (!isMounted || promptedVersion === release.version) return;

        setUpdateRelease(release);
      } catch (error) {
        console.error('Error comprobando actualizaciones:', error);
      }
    };

    checkAppUpdate();

    return () => {
      isMounted = false;
    };
  }, [background]);

  // Cerrar el aviso lo da por visto para esa versión, se haya ido a Play o no:
  // quien ya lo ha leído no necesita verlo otra vez mañana.
  const dismissUpdate = (release: AppRelease) => {
    setUpdateRelease(null);
    setLastUpdatePromptVersion(release.version).catch((error) =>
      console.error('Error guardando aviso de actualización:', error)
    );
  };

  const handleOpenStore = async (release: AppRelease) => {
    dismissUpdate(release);
    const packageName =
      Constants.expoConfig?.android?.package ?? 'com.tonigallego.gymbro';
    const { app, web } = playStoreUrls(packageName);
    // Primero el enlace publicado (si lo hay) o el esquema market://, que abre
    // la app de Play directamente; si falla (sin Play instalado), el navegador.
    try {
      await Linking.openURL(release.storeUrl ?? app);
    } catch {
      try {
        await Linking.openURL(web);
      } catch (error) {
        console.error('Error abriendo Google Play:', error);
      }
    }
  };

  // Peso corporal: se carga en la hidratación (lo consumen Cardio y los retos
  // para estimar las kcal) y, si lleva más de dos semanas sin tocarse, aquí se
  // programa el recordatorio. El aviso salta unas horas después, no ahora: con
  // la app abierta sería avisar de algo que el usuario tiene delante.
  useEffect(() => {
    if (!background || isFirstInstall) return;
    loadBodyWeight()
      .then(() => maybeNotifyStaleWeight())
      .catch((error) => console.error('Error revisando el peso:', error));
  }, [background, isFirstInstall]);

  // Backup automático local: al abrir la app, si está activado y ha pasado el
  // intervalo (un día), se escribe un backup silencioso en el dispositivo. Sin
  // cloud; solo protege frente a perder el móvil sin haber exportado a mano.
  useEffect(() => {
    if (!background || isFirstInstall) return;
    if (!isAutoBackupDue()) return;
    handleAutoBackup().catch((error) =>
      console.error('Error en backup automático:', error)
    );
    // Solo al arrancar (con la UI ya lista); el resto de deps son estables.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [background, isFirstInstall]);

  // Retira el splash (`SplashFade`, en la raíz) una vez los datos reales ya
  // están en pantalla, pero
  // NO en el mismo tick que se marca `hydrated`: se esperan dos frames para que
  // el primer render con la UI real (incluida la fuente Anton) se pinte y MIDA
  // antes de revelarlo. Si no, en algunos arranques en frío el splash se retiraba
  // sobre un primer frame con las métricas de Anton aún sin asentar y el titular
  // de la HeroCard salía recortado/mal dibujado.
  useEffect(() => {
    if (!hydrated) return;
    const outer = requestAnimationFrame(() => {
      requestAnimationFrame(onReady);
    });
    return () => cancelAnimationFrame(outer);
  }, [hydrated]);

  // Calienta el resto de pestañas en segundo plano, de UNA EN UNA y con un hueco
  // real entre cada montaje, para que la primera entrada a cualquiera sea
  // instantánea sin secuestrar el hilo JS mientras el usuario acaba de abrir.
  //
  // Depender de `screen.type` no es decorativo: cualquier navegación reprograma
  // el temporizador, así que un toque en la barra CANCELA el montaje de fondo
  // pendiente. La pantalla a la que se va se pinta sola y el calentamiento
  // continúa después, en vez de sumarse al render de la navegación.
  //
  // Cada paso espera además a un hueco sin toques (`runWhenQuiet`): con el hueco
  // fijo solo, el montaje caía a menudo encima de un toque o de un scroll.
  useEffect(() => {
    if (!idle || background) return;
    const next = TAB_ORDER.find((type) => !mountedTabsRef.current.has(type));
    if (!next) {
      // No queda pestaña que montar: se abre la fase 2 (también en un hueco: el
      // backup diario y el sync arrancan con trabajo de JS).
      return runWhenQuiet(() => setBackground(true), 0, BOOT_MAX_WAIT_MS);
    }
    return runWhenQuiet(
      () => {
        mountedTabsRef.current.add(next);
        setWarmTick((n) => n + 1);
      },
      WARM_STEP_MS,
      BOOT_MAX_WAIT_MS
    );
  }, [idle, background, warmTick, screen.type]);

  // La app ya está quieta: a partir de aquí empieza la fase 1 (calentar las
  // pestañas) sin robarle frames a la primera pantalla. `runAfterInteractions`
  // marca el primer frame pintado y el `setTimeout` da el margen de verdad
  // (ver BOOT_SETTLE_MS): solo con el primero
  // esto se resolvía en el frame siguiente y no esperaba nada.
  useEffect(() => {
    if (!hydrated) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const task = InteractionManager.runAfterInteractions(() => {
      timer = setTimeout(() => setIdle(true), BOOT_SETTLE_MS);
    });
    return () => {
      task.cancel();
      if (timer) clearTimeout(timer);
    };
  }, [hydrated]);

  // Cambia de pestaña por índice de TAB_ORDER (lo llama el swipe del pager).
  const goToTabIndex = React.useCallback((i: number) => {
    setScreen({ type: TAB_ORDER[i] });
  }, []);

  // Página real en la que está el pager (la actualiza onPageSelected). Sirve para
  // que la sincronización con `tabIndex` NO haga nada si ya coincide (evita el
  // bucle de realimentación pager↔estado con toques rápidos en la barra).
  const pagerPageRef = React.useRef(0);
  // Destino de una navegación PROGRAMÁTICA en curso (toque en la barra). Mientras
  // está fijado, onPageSelected ignora los eventos intermedios (los del salto de
  // tramo) y solo lo limpia al llegar al destino. Así el swipe del usuario (con
  // esto a null) es lo único que empuja el estado.
  const navTargetRef = React.useRef<number | null>(null);

  // Sincroniza el pager con la pestaña activa cuando el cambio NO viene del
  // propio swipe (toque en la barra, volver de una subpantalla, deep link…).
  //
  // La animación de `setPage` de ViewPager2 va a velocidad fija, así que tardaría
  // más cuanto más lejos esté la pestaña. Para que la transición dure LO MISMO
  // sea cual sea la distancia, cuando el salto es de más de una pestaña se salta
  // sin animación hasta la contigua y se anima solo el último tramo (una pestaña).
  //
  // `useLayoutEffect` y no `useEffect`: la app corre en raíz legacy, donde el
  // efecto normal se aplaza a una tanda de JS posterior (detrás de lo que haya
  // en cola, como el repintado diferido de las otras pestañas) y la orden al
  // pager salía tarde. Así sale en la misma tanda que el toque.
  useLayoutEffect(() => {
    if (tabIndex < 0) return;
    const pager = pagerRef.current;
    if (!pager) return;
    // Ya está en esa página (p. ej. el estado cambió por un swipe): no tocar.
    if (pagerPageRef.current === tabIndex) return;
    const from = pagerPageRef.current;
    navTargetRef.current = tabIndex;
    if (Math.abs(tabIndex - from) > 1) {
      // Salto lejano: colócate instantáneo junto al destino y anima 1 tramo.
      pager.setPageWithoutAnimation(tabIndex + (tabIndex > from ? -1 : 1));
      requestAnimationFrame(() => pagerRef.current?.setPage(tabIndex));
    } else {
      pager.setPage(tabIndex);
    }
  }, [tabIndex]);

  // Navegación "atrás" compartida entre el botón físico de Android y el
  // "Volver" en pantalla de cada vista: una sola función por pantalla para
  // que ambos caminos lleven siempre al mismo sitio.
  const goHome = () => setScreen({ type: 'home' });
  const goProfile = () => setScreen({ type: 'profile' });
  const backFromRoutineSelector = (origin?: 'home' | 'profile') =>
    setScreen({ type: origin === 'home' ? 'home' : 'profile' });
  const backFromDetail = (origin: 'home' | 'calendar' | 'cardio') =>
    setScreen({
      type:
        origin === 'calendar'
          ? 'calendar'
          : origin === 'cardio'
          ? 'cardio'
          : 'home',
    });
  // Vuelta a una pantalla guardada en `back`. Un Detalle guardado lleva el log
  // tal como estaba al salir de él, y si se salió para EDITARLO (su "Editar"
  // abre el registro) volver con esa copia enseñaría los datos de antes: se
  // vuelve con el log vivo, y si ya no existe, a la pestaña de la que venía.
  // Lee los logs de un ref y no del cierre: el atrás físico se registra al
  // cambiar de pantalla y su `state` se queda viejo mientras se meten series.
  const goBackTo = (back: Screen) => {
    if (back.type === 'detail') {
      const live = logsRef.current.find((l) => l.id === back.log.id);
      if (live) setScreen({ ...back, log: live });
      else backFromDetail(back.origin);
      return;
    }
    if (back.type === 'workout-log') {
      // Mismo problema con el registro (se sale de él a Logros o a la ficha de
      // la rutina a mitad de entreno): las series metidas desde que se abrió
      // no están en la copia guardada, y la sesión pudo crearse después. Sin
      // `log`, el registro ya retoma solo el de HOY; el de un día olvidado
      // (`initialDate`) se busca aquí, o se abriría una sesión nueva encima.
      const live = back.log
        ? logsRef.current.find((l) => l.id === back.log?.id)
        : back.initialDate
        ? logsRef.current
            .filter(
              (l) => l.dayId === back.day.id && l.date === back.initialDate
            )
            .sort((a, b) => b.createdAt - a.createdAt)[0]
        : undefined;
      setScreen(live ? { ...back, log: live } : back);
      return;
    }
    setScreen(back);
  };
  const backFromProfileChild = (
    screen: Extract<
      Screen,
      { type: 'body-weight' | 'achievements' | 'activity' }
    >
  ) => goBackTo(screen.back ?? { type: 'profile' });
  const backFromWorkoutLog = (
    screen: Extract<Screen, { type: 'workout-log' }>
  ) =>
    screen.back
      ? goBackTo(screen.back)
      : setScreen({ type: screen.origin ?? 'home' });
  const backFromData = (screen: Extract<Screen, { type: 'data' }>) =>
    setScreen(screen.back ?? { type: 'settings' });
  const backFromNewRoutine = (
    screen: Extract<Screen, { type: 'new-routine' }>
  ) => setScreen(screen.back ?? { type: 'home' });
  const backFromRoutineDetails = (
    screen: Extract<Screen, { type: 'routine-details' }>
  ) =>
    goBackTo(
      screen.back ?? { type: 'routine-selector', origin: screen.origin }
    );
  // "Ir a la rutina" desde el ⋯ del Detalle, del Registro y de Inicio: la ficha
  // de la rutina a la que pertenece el día, con ese día desplegado, y vuelta a
  // la pantalla desde la que se abrió. Mismo camino que el atajo de Progreso.
  const openRoutineOfDay = (dayId: string, back: Screen) => {
    const routine = state.routines.find((r) =>
      r.days.some((d) => d.id === dayId)
    );
    if (!routine) return;
    setScreen({
      type: 'routine-details',
      routine,
      back,
      expandDayId: dayId,
    });
  };
  // "Progreso por ejercicio" son dos pasos en una pantalla (lista → ficha del
  // ejercicio), así que su vuelta atrás también: primero se cierra la ficha y
  // solo desde la lista se sale. Salvo que se entrara ENFOCADO desde el detalle
  // de un día, donde no hay lista que enseñar y se vuelve directo.
  const backFromExerciseProgress = (
    screen: Extract<Screen, { type: 'exercise-progress' }>
  ) => {
    if (screen.selectedKey && !screen.initialExerciseKey) {
      setScreen({ ...screen, selectedKey: undefined });
      return;
    }
    if (screen.detailReturn) {
      setScreen({ type: 'detail', ...screen.detailReturn });
      return;
    }
    goProfile();
  };

  // Manejar botón atrás físico en móvil: debe reproducir el mismo destino que
  // el "Volver" en pantalla (arriba), no saltar siempre a Inicio. Antes
  // Configuración/Datos/Progreso volvían a Inicio con el físico pero a Perfil
  // con el botón en pantalla, y un detalle abierto desde Calendario/Cardio
  // ignoraba el origen.
  useEffect(() => {
    if (Platform.OS === 'android' || Platform.OS === 'ios') {
      const backHandler = BackHandler.addEventListener(
        'hardwareBackPress',
        () => {
          switch (screen.type) {
            case 'home':
              // Permitir que salga de la app desde la pantalla de inicio
              return false;
            case 'day-selector':
              if (screen.forDate) setScreen({ type: 'calendar' });
              else goHome();
              return true;
            case 'cardio':
            case 'calendar':
            case 'profile':
            case 'community':
            case 'week-achievement':
              // Pantallas sin "Volver" propio en pantalla (navegación inferior
              // o destino final de un flujo corto): el físico vuelve a Inicio,
              // igual que antes.
              goHome();
              return true;
            case 'routine-selector':
              backFromRoutineSelector(screen.origin);
              return true;
            case 'new-routine':
              backFromNewRoutine(screen);
              return true;
            case 'workout-log':
              backFromWorkoutLog(screen);
              return true;
            case 'detail':
              if (screen.back) goBackTo(screen.back);
              else backFromDetail(screen.origin);
              return true;
            case 'data':
              backFromData(screen);
              return true;
            case 'settings':
              goProfile();
              return true;
            case 'body-weight':
            case 'achievements':
            case 'activity':
              backFromProfileChild(screen);
              return true;
            case 'following':
            case 'followers':
              setScreen({ type: screen.back });
              return true;
            case 'public-routine':
              // `return true` (no `break`): devolver undefined equivale a "nadie
              // ha gestionado el gesto" y Android ejecutaba además su acción por
              // defecto, cerrando la app tras navegar hacia atrás.
              setScreen(screen.back);
              return true;
            case 'user-profile':
              // Al perfil ajeno se llega desde el tablón, pero también desde
              // tus rutinas: se vuelve a donde se abrió.
              goBackTo(screen.back ?? { type: 'community' });
              return true;
            case 'exercise-progress':
              backFromExerciseProgress(screen);
              return true;
            case 'routine-details':
              backFromRoutineDetails(screen);
              return true;
            default:
              goHome();
              return true;
          }
        }
      );

      return () => backHandler.remove();
    }
  }, [screen]);

  // Descanso en curso. Se pinta como barra flotante en TODA la app menos en el
  // registro del día que lo lanzó, donde ya lo enmarca su propia tarjeta.
  const restTimer = useRestTimer();
  const isRestTimerScreen =
    screen.type === 'workout-log' && screen.day.id === restTimer?.dayId;
  // Va justo encima de lo que ya flote abajo: la barra de pestañas en las
  // pestañas, el botón "Volver" en las subpantallas.
  const restBarBottom = isTab
    ? getFloatingPrimaryNavMetrics(insets.bottom).bottom +
      FLOATING_GLASS_BAR_HEIGHT +
      10
    : getFloatingBackButtonMetrics(insets.bottom).bottom +
      FLOATING_BACK_BUTTON_HEIGHT +
      10;

  const activeRoutine = useMemo(
    () =>
      state.routines.find((routine) => routine.id === state.activeRoutineId),
    [state.activeRoutineId, state.routines]
  );

  // Recordatorios de entreno: se rehacen al abrir la app y cada vez que cambian
  // los entrenos o la rutina activa (guardar el de hoy cancela el aviso de hoy).
  // Ver lib/workoutReminder.ts.
  useEffect(() => {
    if (!background || isFirstInstall) return;
    rescheduleWorkoutReminders(state.logs, activeRoutine);
  }, [background, isFirstInstall, state.logs, activeRoutine]);

  // Rutina que se está mostrando/entrenando: la seleccionada (si existe) o, en
  // su defecto, la activa. "Empezar entrenamiento" opera sobre esta, de modo
  // que se puede entrenar una rutina "preparada" seleccionada aunque no sea la
  // activa (al registrar su primer día pasará a ser la activa).
  const displayedRoutine = useMemo(() => {
    const selected = state.routines.find(
      (routine) => routine.id === state.selectedRoutineId
    );
    return selected ?? activeRoutine;
  }, [state.routines, state.selectedRoutineId, activeRoutine]);

  // Tema e idioma: la raíz ya repinta el árbol al cambiarlos, pero las pestañas
  // van memoizadas (ver `homeTab`) y necesitan saberlo para repintarse.
  const themeVersion = useThemeVersion();
  const languageVersion = useLanguageVersion();

  // Salida de los vacíos (Calendario, Progreso por ejercicio): a elegir la
  // sesión si ya hay rutina, o a crear una si no. Misma regla que la hero de
  // Inicio (`onOpenDaySelector`).
  const hasRoutineDays = !!displayedRoutine?.days.length;
  const emptyStateAction = useMemo(
    () =>
      hasRoutineDays
        ? {
            label: t('Empezar entrenamiento'),
            onPress: () => setScreen({ type: 'day-selector' }),
          }
        : {
            label: t('Crear rutina'),
            onPress: () => setScreen({ type: 'new-routine' }),
          },
    // `languageVersion`: el rótulo va traducido.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hasRoutineDays, languageVersion]
  );

  const openWorkoutFromNotificationData = (
    data: Record<string, unknown> | undefined
  ) => {
    if (data?.source === WORKOUT_REMINDER_SOURCE) {
      openSuggestedWorkout();
      return;
    }
    if (!data || data.source !== 'rest-timer') return;

    const dayId = typeof data.dayId === 'string' ? data.dayId : undefined;
    const routineId =
      typeof data.routineId === 'string' ? data.routineId : undefined;

    if (routineId && routineId !== state.activeRoutineId) {
      const exists = state.routines.some((routine) => routine.id === routineId);
      if (exists) {
        dispatch({ type: 'SET_ACTIVE_ROUTINE', payload: routineId });
      }
    }

    const routineCandidates = routineId
      ? state.routines.filter((routine) => routine.id === routineId)
      : state.routines;

    const dayFromNotification = routineCandidates
      .flatMap((routine) => routine.days)
      .find((day) => day.id === dayId);

    if (dayFromNotification) {
      setScreen({ type: 'workout-log', day: dayFromNotification });
      return;
    }

    const fallbackRoutine =
      state.routines.find((routine) => routine.id === state.activeRoutineId) ||
      state.routines[0];
    const fallbackDay = fallbackRoutine?.days?.[0];

    if (fallbackDay) {
      setScreen({ type: 'workout-log', day: fallbackDay });
    } else {
      setScreen({ type: 'home' });
    }
  };

  // Recordatorio de entreno: el aviso no nombra el día; se decide AHORA, con la
  // misma sugerencia que Inicio y "Elige la sesión". Si hoy ya hay entreno (o no
  // hay sugerencia), se aterriza en "Elige la sesión", que explica por qué.
  const openSuggestedWorkout = () => {
    const { nextDay } = currentWeekDayState(activeRoutine, state.logs);
    const trainedToday = state.logs.some(
      (log) => !isCardioOnlyLog(log) && logDateKey(log) === getToday()
    );
    if (nextDay && !trainedToday) {
      setScreen({ type: 'workout-log', day: nextDay });
    } else if (activeRoutine) {
      setScreen({ type: 'day-selector' });
    } else {
      setScreen({ type: 'home' });
    }
  };

  // Volver de la ventanita flotante (el PiP del descanso): tocarla trae la app
  // al frente, y lo que se estaba mirando ahí es la cuenta atrás. Así que se
  // aterriza en el REGISTRO del día que la lanzó —donde está el temporizador
  // entero y las casillas de la serie siguiente—, no en la pantalla en la que
  // se dejó la app antes de minimizarla.
  useEffect(
    () =>
      subscribePipMode((inPip) => {
        if (inPip) return;
        const timer = getRestTimer();
        if (!timer) return;
        const day = findDayInRoutines(state.routines, timer.dayId);
        if (day) setScreen({ type: 'workout-log', day, origin: 'home' });
      }),
    [state.routines]
  );

  useEffect(() => {
    if (!Notifications) return;

    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        handledNotificationTaps.add(response.notification.request.identifier);
        openWorkoutFromNotificationData(
          response.notification.request.content.data as Record<string, unknown>
        );
      }
    );

    const consumeInitialNotificationTap = async () => {
      try {
        const response =
          await Notifications!.getLastNotificationResponseAsync();
        // Este efecto se repite al cambiar las rutinas, y la "última respuesta"
        // sigue siendo la misma: sin recordar cuáles ya se atendieron, editar
        // una rutina volvía a navegar al destino de un toque antiguo.
        const id = response?.notification.request.identifier;
        if (response && id && !handledNotificationTaps.has(id)) {
          handledNotificationTaps.add(id);
          openWorkoutFromNotificationData(
            response.notification.request.content.data as Record<
              string,
              unknown
            >
          );
        }
      } catch (error) {
        console.error('Error reading notification response:', error);
      }
    };

    consumeInitialNotificationTap();

    return () => subscription.remove();
  }, [dispatch, state.activeRoutineId, state.routines]);

  // Deep link de importación (QR): gymbro://import-routine?data=...
  // Abre Nueva rutina con los días prerrellenados desde el código escaneado.
  useEffect(() => {
    const handleUrl = (url: string | null) => {
      if (!url) return;
      const shared = parseRoutineShareLink(url);
      if (shared) {
        setScreen({ type: 'new-routine', initialDays: shared.days });
      }
    };

    Linking.getInitialURL()
      .then(handleUrl)
      .catch(() => {});
    const subscription = Linking.addEventListener('url', ({ url }) =>
      handleUrl(url)
    );

    return () => subscription.remove();
  }, []);

  const handleCreateRoutine = (routine: WorkoutRoutine) => {
    dispatch({ type: 'ADD_ROUTINE', payload: routine });
    setScreen({ type: 'home' });
  };

  const handleClearData = async () => {
    await clearAppData();
    dispatch({ type: 'CLEAR_DATA' });
    setScreen({ type: 'home' });
  };

  // Arma el JSON del backup (mismo formato que usa import). Incluye el historial
  // de pesos corporales: las kcal del cardio dependen del peso de cada tramo.
  const buildBackupJson = async (): Promise<string> => {
    const cardioWeightHistory = await getCardioWeightHistory();
    const payload: WorkoutAppData & {
      version: number;
      exportedAt: string;
      cardioWeightHistory: WeightSegment[];
    } = {
      version: 2,
      exportedAt: new Date().toISOString(),
      routines: state.routines,
      activeRoutineId: state.activeRoutineId,
      logs: state.logs,
      cardioWeightHistory,
    };
    return JSON.stringify(payload, null, 2);
  };

  const handleExportData = async () => {
    const fileName = `gymbro-backup-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    await downloadJsonFile(fileName, await buildBackupJson());
  };

  // Backup silencioso al almacenamiento del dispositivo. Lo usa tanto el disparo
  // automático (al hidratar, si toca) como el botón "backup ahora" de Datos.
  const handleAutoBackup = async (): Promise<void> => {
    if (state.routines.length === 0 && state.logs.length === 0) return;
    await runAutoBackup(await buildBackupJson());
  };

  // Importar un fichero y restaurar una copia automática son la misma operación:
  // solo cambia de dónde sale el JSON.
  const importFromJson = async (raw: string) => {
    const payload = JSON.parse(raw) as Partial<WorkoutAppData> & {
      cardioWeightHistory?: unknown;
    };

    if (!Array.isArray(payload?.routines) || !Array.isArray(payload?.logs)) {
      throw new Error(t('El fichero no tiene el formato esperado'));
    }

    const routinesValid = payload.routines.every(
      (routine) =>
        routine && typeof routine.id === 'string' && Array.isArray(routine.days)
    );
    const logsValid = payload.logs.every(
      (log) => log && typeof log.id === 'string' && Array.isArray(log.exercises)
    );

    if (!routinesValid || !logsValid) {
      throw new Error(t('El fichero contiene datos con un formato no válido'));
    }

    const activeRoutineId =
      payload.activeRoutineId ||
      payload.routines.find((routine) => routine.isActive)?.id ||
      payload.routines[0]?.id;

    const importedData: WorkoutAppData = {
      routines: payload.routines,
      activeRoutineId,
      logs: payload.logs,
    };

    dispatch({ type: 'SET_APP_DATA', payload: importedData });
    // SET_APP_DATA no se persiste en el wrapper (es también la acción de
    // hidratación): la importación guarda explícitamente el conjunto completo.
    await saveAppData(importedData);

    // Historial de pesos (backups v2+): sin él las kcal del cardio se
    // calcularían con el peso por defecto. Los backups antiguos no lo traen.
    if (
      isValidWeightSegments(payload.cardioWeightHistory) &&
      payload.cardioWeightHistory.length > 0
    ) {
      await setCardioWeightHistory(payload.cardioWeightHistory);
    }

    setScreen({ type: 'home' });
  };

  const handleImportData = async () => importFromJson(await readJsonFromFile());

  const handleRestoreAutoBackup = async (fileName: string) =>
    importFromJson(await readAutoBackup(fileName));

  // Las cinco pestañas, MEMOIZADAS. Creadas en línea en el render, cada
  // `setScreen` (tocar la barra, abrir el registro o un día pasado) repintaba
  // las cinco pantallas enteras antes de enseñar nada: era el medio segundo de
  // la barra y buena parte de lo que tardaba en abrirse cualquier vista. Así
  // solo se repintan por lo suyo: sus datos (el contexto, vía
  // `TabStateBoundary`), el tema, el idioma o lo que reciben aquí. Sus
  // callbacks solo usan `setScreen`, que es estable.
  const homeTab = useMemo(
    () => (
      <HomeScreen
        onSelectDay={(day) => setScreen({ type: 'workout-log', day })}
        onSelectLog={(log, day) =>
          setScreen({ type: 'detail', log, day, origin: 'home' })
        }
        onEditLog={(log, day) => setScreen({ type: 'workout-log', day, log })}
        onOpenDaySelector={() => {
          if (displayedRoutine?.days.length) {
            setScreen({ type: 'day-selector' });
          } else {
            setScreen({ type: 'new-routine' });
          }
        }}
        onOpenRoutineSelector={() =>
          setScreen({ type: 'routine-selector', origin: 'home' })
        }
        // Ficha de la rutina que Inicio ENSEÑA (la de su subtítulo), no la
        // activa: el enlace lleva a lo que nombra.
        onOpenDisplayedRoutine={
          displayedRoutine
            ? () =>
                setScreen({
                  type: 'routine-details',
                  routine: displayedRoutine,
                  back: { type: 'home' },
                })
            : undefined
        }
        onCreateRoutine={() => setScreen({ type: 'new-routine' })}
        onOpenCommunity={() => setScreen({ type: 'community' })}
        onShowWeekAchievement={(achievements, routineName) =>
          setScreen({
            type: 'week-achievement',
            achievements,
            routineName,
          })
        }
      />
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [displayedRoutine, themeVersion, languageVersion]
  );

  const cardioTab = useMemo(
    () => (
      <CardioScreen
        onSelectLog={(log, day) =>
          setScreen({ type: 'detail', log, day, origin: 'cardio' })
        }
        onInsertCardioOnly={() =>
          setScreen({
            type: 'workout-log',
            day: CARDIO_ONLY_DAY,
            cardioOnly: true,
            origin: 'cardio',
          })
        }
        onOpenBodyWeight={() =>
          setScreen({ type: 'body-weight', back: { type: 'cardio' } })
        }
      />
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [themeVersion, languageVersion]
  );

  const calendarTab = useMemo(
    () => (
      <CalendarScreen
        emptyAction={emptyStateAction}
        onSelectLog={(log, day) =>
          setScreen({ type: 'detail', log, day, origin: 'calendar' })
        }
        onEditCardioOnly={(log) =>
          setScreen({
            type: 'workout-log',
            day: CARDIO_ONLY_DAY,
            log,
            cardioOnly: true,
            origin: 'calendar',
          })
        }
        onLogForgottenDay={(date) =>
          setScreen({ type: 'day-selector', forDate: date })
        }
        onLogForgottenCardio={(date) =>
          setScreen({
            type: 'workout-log',
            day: CARDIO_ONLY_DAY,
            cardioOnly: true,
            initialDate: date,
            origin: 'calendar',
          })
        }
      />
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [emptyStateAction, themeVersion, languageVersion]
  );

  const communityActive = screen.type === 'community';
  const communityTab = useMemo(
    () => (
      <CommunityScreen
        active={communityActive}
        onOpenProfile={(userId, name) =>
          setScreen({ type: 'user-profile', userId, name })
        }
        onOpenRoutine={(routineId, name, authorName, ownerId) =>
          setScreen({
            type: 'public-routine',
            routineId,
            name,
            authorName,
            ownerId,
            back: { type: 'community' },
          })
        }
        onOpenFollowing={() =>
          setScreen({ type: 'following', back: 'community' })
        }
        onOpenFollowers={() =>
          setScreen({ type: 'followers', back: 'community' })
        }
        onOpenAccount={() =>
          setScreen({ type: 'data', back: { type: 'community' } })
        }
      />
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [communityActive, themeVersion, languageVersion]
  );

  const profileTab = useMemo(
    () => (
      <ProfileScreen
        onOpenRoutines={() =>
          setScreen({ type: 'routine-selector', origin: 'profile' })
        }
        onOpenExerciseProgress={() => setScreen({ type: 'exercise-progress' })}
        onOpenBodyWeight={() => setScreen({ type: 'body-weight' })}
        onOpenAchievements={() => setScreen({ type: 'achievements' })}
        onOpenActivity={() => setScreen({ type: 'activity' })}
        onOpenCalendar={() => setScreen({ type: 'calendar' })}
        onOpenCardio={() => setScreen({ type: 'cardio' })}
        onOpenSettings={() => setScreen({ type: 'settings' })}
        onOpenAccount={() =>
          setScreen({ type: 'data', back: { type: 'profile' } })
        }
      />
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [themeVersion, languageVersion]
  );

  // Hasta que termina la hidratación, el reducer aún tiene los datos de fábrica
  // (WORKOUT_ROUTINES / INITIAL_LOGS): pintar las pantallas con ellos hacía que,
  // al retirar el splash, se viera un fogonazo de la rutina demo antes de cargar
  // los datos reales. Mientras no haya datos reales se pinta solo el fondo (el
  // splash lo cubre); el contenido monta ya directamente con los datos del
  // usuario. Todos los hooks están declarados arriba, así que el early-return es
  // seguro (no altera el orden de hooks).
  if (!hydrated) {
    return <View style={styles.container} />;
  }

  // Pestañas montadas "en caliente": al arrancar se monta SOLO la activa (splash
  // corto), y una vez la app está quieta entran las demás espaciadas
  // (`mountedTabsRef`) y se quedan vivas, ocultas con display:none al no estar
  // activas. Así la PRIMERA entrada a cualquiera ya está lista (sus useMemo caros
  // ya calculados) y el cambio es instantáneo. Cada pantalla difiere además su
  // contenido pesado un frame (useDeferredReady), para no bloquear al calentarse.
  // El registro guarda las series en estado local (no despacha por serie), así
  // que tenerlas de fondo no recalcula durante el entreno.
  //
  // Cada página del PagerView: el contenido se monta al calentar o al ser la
  // activa, pero el View-página va SIEMPRE para que el pager mantenga sus 5
  // índices.
  const tabLayer = (type: TabType, node: React.ReactNode) => {
    const active = screen.type === type;
    const mounted = mountedTabsRef.current.has(type);
    return (
      <View key={type} style={styles.pagerPage} collapsable={false}>
        {active || mounted ? (
          <TabFocusContext.Provider value={focusedTabRef.current === type}>
            <TabStateBoundary active={active}>{node}</TabStateBoundary>
          </TabFocusContext.Provider>
        ) : null}
      </View>
    );
  };

  return (
    <View
      style={styles.container}
      // Solo apuntan cuándo toca el usuario (ver lib/userQuiet.ts): el arranque
      // coloca su trabajo de fondo en los huecos sin toques.
      onTouchStart={noteTouchStart}
      onTouchEnd={(e) => noteTouchEnd(e.nativeEvent.touches.length)}
      onTouchCancel={noteTouchCancel}
    >
      {/* Sin UI y fuera de AppContent a propósito (ver el aviso de arriba). */}
      <CloudSync enabled={background} />
      <AccountLevelRecorder />
      <View ref={themeCaptureRef} style={styles.container} collapsable={false}>
        <WhatsNewModal
          visible={whatsNewEntry !== null}
          entry={whatsNewEntry}
          onClose={handleCloseWhatsNew}
        />

        {/* Premios (reto superado, logro nuevo, subida de nivel): un popup por
          premio, en el orden en que cayeron. Ceden el paso a las novedades. */}
        {whatsNewEntry === null && (
          <AwardModal
            award={awards[0] ?? null}
            onClose={() => {
              shiftAward();
              // Latido de la píldora de nivel de la barra: que se vea dónde
              // han ido a parar los puntos del premio que se acaba de cerrar.
              requestLevelPulse();
            }}
          />
        )}

        {/* Aviso de versión nueva. Cede el paso a las novedades si ambos caen en
          el mismo arranque (primero qué ha cambiado, después que hay más). */}
        {updateRelease && (
          <UpdateAvailableModal
            visible={whatsNewEntry === null}
            currentVersion={Constants.expoConfig?.version ?? ''}
            latestVersion={updateRelease.version}
            onUpdate={() => handleOpenStore(updateRelease)}
            onDismiss={() => dismissUpdate(updateRelease)}
          />
        )}

        {/* Pager de pestañas NATIVO (react-native-pager-view): las 5 vistas
          principales. El arrastre y el asentamiento los gestiona ViewPager2 de
          forma nativa. Va lo PRIMERO del árbol: cualquier subpantalla se renderiza
          después (encima) y, siendo opaca a pantalla completa, la tapa. El scroll
          horizontal solo se habilita en pestañas (no en subpantallas). */}
        <PagerView
          ref={pagerRef}
          style={StyleSheet.absoluteFill}
          initialPage={0}
          scrollEnabled={isTab}
          offscreenPageLimit={4}
          onPageSelected={(e) => {
            const p = e.nativeEvent.position;
            pagerPageRef.current = p;
            if (navTargetRef.current !== null) {
              // Navegación programática (barra): ignora intermedios; limpia al
              // llegar al destino. No empuja el estado (ya lo hizo el toque).
              if (p === navTargetRef.current) navTargetRef.current = null;
              return;
            }
            // Swipe real del usuario: sincroniza el estado con la página.
            if (isTab && p !== tabIndex) goToTabIndex(p);
          }}
        >
          {tabLayer('home', homeTab)}
          {tabLayer('cardio', cardioTab)}
          {tabLayer('calendar', calendarTab)}
          {tabLayer('community', communityTab)}
          {tabLayer('profile', profileTab)}
        </PagerView>

        {screen.type === 'routine-selector' && (
          <RoutineSelectorScreen
            onOpenRoutineDetails={(routine) =>
              setScreen({
                type: 'routine-details',
                routine,
                origin: screen.origin,
              })
            }
            onCreateRoutine={() =>
              setScreen({ type: 'new-routine', back: screen })
            }
            // Perfil del autor de una rutina traída de la comunidad. Se vuelve
            // aquí, no al tablón: a Rutinas no se llega desde Comunidad.
            onOpenProfile={(userId, name) =>
              setScreen({
                type: 'user-profile',
                userId,
                name,
                back: { type: 'routine-selector', origin: screen.origin },
              })
            }
            // Volver a la vista desde la que se abrió Rutinas (Fuerza o Perfil).
            onBack={() => backFromRoutineSelector(screen.origin)}
          />
        )}

        {screen.type === 'day-selector' && (
          <DaySelectorScreen
            routine={displayedRoutine}
            forDate={screen.forDate}
            onSelectDay={(day, options) => {
              if (screen.forDate) {
                setScreen({
                  type: 'workout-log',
                  day,
                  initialDate: screen.forDate,
                  origin: 'calendar',
                });
                return;
              }
              // Si el día ya tiene un log de hoy, WorkoutLogScreen lo detecta solo
              // (getLatestTodayLog) y abre ese registro para seguir metiendo series,
              // igual que la hero "Continúa tu entrenamiento": no hay que volver a
              // Inicio en silencio, eso solo confunde ("¿no ha funcionado el toque?").
              setScreen({
                type: 'workout-log',
                day,
                startsNewWeek: options?.startsNewWeek,
              });
            }}
            onOpenLog={(log, day) =>
              setScreen({
                type: 'detail',
                log,
                day,
                origin: 'home',
                back: { type: 'day-selector' },
              })
            }
            onBack={() =>
              screen.forDate ? setScreen({ type: 'calendar' }) : goHome()
            }
          />
        )}

        {screen.type === 'workout-log' && (
          <WorkoutLogScreen
            day={screen.day}
            log={screen.log}
            cardioOnly={screen.cardioOnly}
            startsNewWeek={screen.startsNewWeek}
            initialDate={screen.initialDate}
            onBack={() => backFromWorkoutLog(screen)}
            onOpenRoutine={() => openRoutineOfDay(screen.day.id, screen)}
          />
        )}

        {screen.type === 'detail' && (
          <DetailScreen
            log={screen.log}
            day={screen.day}
            onBack={() =>
              screen.back
                ? goBackTo(screen.back)
                : backFromDetail(screen.origin)
            }
            onOpenRoutine={() => openRoutineOfDay(screen.day.id, screen)}
            onEdit={() =>
              setScreen({
                type: 'workout-log',
                day: screen.day,
                log: screen.log,
                cardioOnly: screen.log.cardioOnly || undefined,
                origin: screen.origin,
                // Al terminar de corregir se vuelve a ESTE Detalle (con el log
                // ya corregido, ver `goBackTo`), no a la pestaña de la que venía.
                back: screen,
              })
            }
            onDelete={() => {
              dispatch({ type: 'DELETE_WORKOUT_LOG', payload: screen.log.id });
              if (screen.back) goBackTo(screen.back);
              else backFromDetail(screen.origin);
            }}
            onOpenExerciseProgress={(exerciseKey) =>
              setScreen({
                type: 'exercise-progress',
                initialExerciseKey: exerciseKey,
                detailReturn: {
                  log: screen.log,
                  day: screen.day,
                  origin: screen.origin,
                },
              })
            }
          />
        )}

        {screen.type === 'body-weight' && (
          <BodyWeightScreen onBack={() => backFromProfileChild(screen)} />
        )}
        {screen.type === 'achievements' && (
          <AchievementsScreen onBack={() => backFromProfileChild(screen)} />
        )}

        {screen.type === 'activity' && (
          <ActivityScreen
            onBack={() => backFromProfileChild(screen)}
            onOpenRoutine={(routine) =>
              setScreen({
                type: 'routine-details',
                routine,
                // La Actividad entera (con su propio `back`), para que al
                // volver de la ficha "Volver" siga llevando a donde se abrió.
                back: screen,
              })
            }
          />
        )}

        {screen.type === 'settings' && (
          <SettingsScreen
            onBack={goProfile}
            onOpenData={() =>
              setScreen({ type: 'data', back: { type: 'settings' } })
            }
          />
        )}

        {screen.type === 'following' && (
          <FollowingScreen
            mode="following"
            onBack={() => setScreen({ type: screen.back })}
            onOpenProfile={(userId, name) =>
              setScreen({ type: 'user-profile', userId, name, back: screen })
            }
          />
        )}

        {screen.type === 'followers' && (
          <FollowingScreen
            mode="followers"
            onBack={() => setScreen({ type: screen.back })}
            onOpenProfile={(userId, name) =>
              setScreen({ type: 'user-profile', userId, name, back: screen })
            }
          />
        )}

        {screen.type === 'user-profile' && (
          <UserProfileScreen
            // Un perfil distinto es una pantalla distinta: sin `key`, React
            // reutiliza la instancia y se quedarían en pantalla los datos del
            // anterior (y su caché) hasta que llegaran los nuevos.
            key={screen.userId}
            userId={screen.userId}
            name={screen.name}
            onBack={() => goBackTo(screen.back ?? { type: 'community' })}
            onOpenRoutine={(routineId, name, authorName) =>
              setScreen({
                type: 'public-routine',
                routineId,
                name,
                authorName,
                ownerId: screen.userId,
                back: {
                  type: 'user-profile',
                  userId: screen.userId,
                  name: screen.name,
                },
              })
            }
            onOpenAccount={() => setScreen({ type: 'data', back: screen })}
            // Tu propio perfil visto desde Comunidad: editarlo vive en Perfil.
            onOpenOwnProfile={goProfile}
          />
        )}

        {screen.type === 'public-routine' && (
          <PublicRoutineScreen
            routineId={screen.routineId}
            name={screen.name}
            authorName={screen.authorName}
            ownerId={screen.ownerId}
            onBack={() => setScreen(screen.back)}
            onOpenProfile={(userId, name) =>
              setScreen({ type: 'user-profile', userId, name, back: screen })
            }
            onOpenAccount={() => setScreen({ type: 'data', back: screen })}
          />
        )}

        {screen.type === 'exercise-progress' && (
          <ExerciseProgressScreen
            emptyAction={emptyStateAction}
            selectedKey={screen.selectedKey ?? screen.initialExerciseKey}
            focused={!!screen.initialExerciseKey}
            onSelectExercise={(exerciseKey) =>
              setScreen({ ...screen, selectedKey: exerciseKey })
            }
            // El mismo camino que recorre el atrás del móvil (ver
            // `backFromExerciseProgress`): una sola función para los dos gestos.
            onBack={() => backFromExerciseProgress(screen)}
            // Ficha de la rutina que tiene el ejercicio, con su día abierto. Se
            // vuelve a esta misma ficha del ejercicio, no al selector de rutinas.
            onOpenRoutine={(routine, dayId) =>
              setScreen({
                type: 'routine-details',
                routine,
                back: screen,
                expandDayId: dayId,
              })
            }
          />
        )}

        {screen.type === 'data' && (
          <DataScreen
            onImportData={handleImportData}
            onRestoreAutoBackup={handleRestoreAutoBackup}
            onExportData={handleExportData}
            onBackupNow={handleAutoBackup}
            onClearData={handleClearData}
            onBack={() => backFromData(screen)}
          />
        )}

        {screen.type === 'new-routine' && (
          <NewRoutineScreen
            key={
              screen.initialDays
                ? `import-${screen.initialDays.length}-${
                    screen.initialDays[0]?.title ?? ''
                  }`
                : 'blank'
            }
            existingRoutineCount={state.routines.length}
            onCreateRoutine={handleCreateRoutine}
            onBack={() => backFromNewRoutine(screen)}
            onOpenCommunity={() => setScreen({ type: 'community' })}
            initialDays={screen.initialDays}
          />
        )}

        {screen.type === 'routine-details' && (
          <RoutineDetailScreen
            routine={screen.routine}
            initialExpandedDayId={screen.expandDayId}
            onBack={() => backFromRoutineDetails(screen)}
            // Al copiar una rutina ajena se abre la copia: es la que ya se puede
            // tocar, y dejar al usuario en la de solo lectura sería un callejón.
            onForked={(copy) =>
              setScreen({
                type: 'routine-details',
                routine: copy,
                origin: screen.origin,
                back: screen.back,
              })
            }
            // Borrada desde su ⋮: se vuelve a donde se abrió (normalmente Rutinas).
            onDeleted={() => backFromRoutineDetails(screen)}
            onOpenAccount={() => setScreen({ type: 'data', back: screen })}
            // La marca "de {autor}" de la ficha lleva a su perfil, y de ahí se
            // vuelve a esta misma ficha (tal cual: con su propio camino de vuelta).
            onOpenProfile={(userId, name) =>
              setScreen({ type: 'user-profile', userId, name, back: screen })
            }
          />
        )}

        {screen.type === 'week-achievement' && (
          <WeekAchievementScreen
            achievements={screen.achievements}
            routineName={screen.routineName}
            onBack={goHome}
          />
        )}

        {/* Barra de navegación FIJA (fuera del pager): solo en pestañas. El
          contenido de cada pestaña desliza por debajo; la barra no se mueve. */}
        {isTab && (
          <PrimaryNav
            bottom={getFloatingPrimaryNavMetrics(insets.bottom).bottom}
            activeTab={screen.type as TabType}
            onPressHome={() => setScreen({ type: 'home' })}
            onPressCardio={() => setScreen({ type: 'cardio' })}
            onPressCalendar={() => setScreen({ type: 'calendar' })}
            onPressCommunity={() => setScreen({ type: 'community' })}
            onPressProfile={() => setScreen({ type: 'profile' })}
          />
        )}

        {/* El descanso en curso, cuando NO se está en el registro que lo lanzó.
          Antes salir de esa pantalla lo mataba (vivía en su estado); ahora vive
          en el store y sigue contando mientras miras el calendario o el
          histórico, con esta barra para volver al entreno de un toque. */}
        {!!restTimer && !isRestTimerScreen && (
          <RestTimerBar
            bottom={restBarBottom}
            onPress={() => {
              const day = findDayInRoutines(state.routines, restTimer.dayId);
              if (day) setScreen({ type: 'workout-log', day, origin: 'home' });
            }}
          />
        )}
      </View>

      {/* Encima de todo (incluidas las barras flotantes): el círculo del cambio
          de tema en caliente, con un pantallazo de la vista de arriba. */}
      <ThemeRevealOverlay captureTarget={themeCaptureRef} />
    </View>
  );
}

/**
 * Sync de fondo con la nube: al iniciar sesión y al volver a primer plano.
 * Refresca el estado si el pull trae cambios de otro dispositivo y pone al día
 * las rutinas enlazadas de la comunidad si su autor las cambió.
 *
 * Espera a la fase 2 (ver `background`): son 8,5 s de red que casi nunca traen
 * nada, y arrancando antes se comían los primeros toques del usuario. Y es un
 * componente aparte porque escucha la sesión: dentro de AppContent, su llegada
 * repintaba la app entera.
 */
function CloudSync({ enabled }: { enabled: boolean }) {
  const { dispatch, state } = useWorkout();
  useCloudSync(dispatch, state.routines, enabled);
  return null;
}

/**
 * Retos semanales: aquí (y solo aquí) se apuntan los superados, se avisa de lo
 * nuevo (retos, logros, nivel: cola de `lib/awards`) y se sube el nivel al
 * perfil público. Se monta ya con los datos reales: con los semilla de antes de
 * hidratar, todo parecería "nuevo". Aparte de AppContent por lo mismo que
 * `CloudSync`: escucha sesión, perfil y peso.
 */
function AccountLevelRecorder() {
  useRecordAccountLevel(true);
  return null;
}

/**
 * La barra de pestañas con la foto del perfil público en la de Perfil. El perfil
 * se lee aquí y no en AppContent: llega de la copia local y luego de la nube, ya
 * con la app en pantalla, y cada llegada repintaba la app entera.
 */
function PrimaryNav(
  props: Omit<
    React.ComponentProps<typeof FloatingPrimaryNav>,
    'profileAvatarUri'
  >
) {
  const { profile } = useMyProfile();
  return (
    <FloatingPrimaryNav {...props} profileAvatarUri={profile?.avatar_url} />
  );
}

/**
 * Las cinco pestañas están montadas a la vez, así que un cambio de logs
 * (guardar una serie, importar) repintaba las cinco en el mismo commit aunque
 * solo se viera una. Cada pestaña recibe el contexto a través de esta frontera:
 * la activa lo lee al momento y las demás con `useDeferredValue`, que React
 * pinta después y en prioridad baja (interrumpible si hay un toque). El trabajo
 * total es el mismo, pero deja de estar delante de lo que el usuario mira; y
 * al cambiar de pestaña no hay nada que remontar. Los stores de módulo (peso,
 * retos superados, tema) no pasan por aquí: son baratos.
 */
function TabStateBoundary({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  const value = useContext(WorkoutContext);
  const deferred = useDeferredValue(value);
  return (
    <WorkoutContext.Provider value={active ? value : deferred}>
      {children}
    </WorkoutContext.Provider>
  );
}

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  // Suscribe la RAÍZ del árbol al modo de tema: al cambiarlo (setThemeMode) todo
  // el árbol se re-renderiza y cada componente relee sus `styles` vivos (ningún
  // componente está memoizado, así que el re-render cascada llega a todos).
  useThemeVersion();
  // Igual que el tema: al cambiar el idioma en caliente, re-renderiza todo el
  // árbol para que los t() inline y las fechas se repinten sin reiniciar.
  useLanguageVersion();
  const [fontsLoaded] = useFonts({
    Anton: require('../assets/fonts/Anton-Regular.ttf'),
  });

  // ¿Está la app encogida en la ventanita del descanso? Lo dice el sistema
  // (modules/pip-timer), no la app: también se sale de ella tocándola o
  // cerrándola desde la propia ventana.
  const [inPip, setInPip] = useState(false);
  useEffect(() => subscribePipMode(setInPip), []);
  // La app ya está pintada con sus datos: el splash puede desvanecerse.
  const [appReady, setAppReady] = useState(false);
  // La copia del splash (SplashFade) ya pintó su logo. Hasta entonces no se
  // dibuja nada opaco: la raíz es transparente y se ve el splash de la ventana,
  // idéntico. Antes la raíz y el fondo negro de la copia salían antes que su
  // logo (la imagen carga asíncrona) y había unos fotogramas en negro.
  const [splashLogoShown, setSplashLogoShown] = useState(false);

  // El splash nativo se mantiene (preventAutoHide) hasta que AppContent termina
  // de hidratar los datos; entonces `SplashFade` lo retira y se desvanece. Así no se
  // oculta solo con las fuentes cargadas, evitando el parpadeo de datos semilla.
  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView
      style={[styles.container, !splashLogoShown && styles.transparent]}
    >
      {splashLogoShown && (
        <WorkoutProvider>
          <StatusBar
            barStyle={
              theme.statusBarStyle === 'light'
                ? 'light-content'
                : 'dark-content'
            }
            backgroundColor="transparent"
            translucent
          />
          <View style={styles.container}>
            <AppContent onReady={() => setAppReady(true)} />
            {/* Ventanita flotante del descanso: el sistema encoge la app entera a
              un recuadro movible (Picture-in-Picture), donde la pantalla de
              registro no se lee. Se tapa con la cuenta atrás a tamaño grande y
              se destapa al volver, con el árbol intacto por debajo. */}
            {inPip && <PipRestTimer />}
          </View>
        </WorkoutProvider>
      )}
      {/* Copia del splash nativo que se desvanece sobre la app. */}
      <SplashFade
        ready={appReady}
        onLogoShown={() => setSplashLogoShown(true)}
      />
    </GestureHandlerRootView>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    transparent: {
      backgroundColor: 'transparent',
    },
    // Cada página del PagerView ocupa toda la vista.
    pagerPage: {
      flex: 1,
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
