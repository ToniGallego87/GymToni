import React, { useEffect, useMemo, useState } from 'react';
import {
  BackHandler,
  InteractionManager,
  Platform,
  StatusBar,
  StyleSheet,
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
import {
  CalendarScreen,
  CardioScreen,
  ProfileEditScreen,
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
  QRScannerScreen,
  RoutineDetailScreen,
  RoutineSelectorScreen,
  SettingsScreen,
  WeekAchievementScreen,
  WorkoutProvider,
  WorkoutLogScreen,
  useWorkout,
} from '@features/workout';
import {
  WhatsNewModal,
  ThemeRevealOverlay,
  FloatingPrimaryNav,
  getFloatingPrimaryNavMetrics,
} from '@components';
import type { WeekAchievements } from '@lib/achievements';
import { CARDIO_ONLY_DAY, hasAnyCardio } from '@lib/cardio';
import type { WeightSegment } from '@lib/cardio';
import {
  clearAppData,
  getCardioWeightHistory,
  getLastSeenVersion,
  getSeedAppData,
  getSeedCardioWeightHistory,
  isValidWeightSegments,
  loadAppData,
  saveAppData,
  setCardioWeightHistory,
  setLastSeenVersion,
} from '@lib/storage';
import { readJsonFromFile, downloadJsonFile } from '@lib/fileIO';
import { isAutoBackupDue, runAutoBackup } from '@lib/backup';
import { parseRoutineShareLink, SharedRoutineDay } from '@lib/routineShare';
import type { SharedRoutine } from '@lib/routineShare';
import { theme, useThemeVersion } from '@lib/theme';
import { subscribeTheme } from '@lib/themeStore';
import { t, useLanguageVersion } from '@lib/i18n';
import { CHANGELOG, ChangelogEntry } from '@data/changelog';
import { useCloudSync } from '@hooks/useCloudSync';
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
  | { type: 'day-selector' }
  | {
      type: 'workout-log';
      day: WorkoutDay;
      log?: WorkoutLog;
      startsNewWeek?: boolean;
      cardioOnly?: boolean;
      origin?: 'home' | 'calendar' | 'cardio';
    }
  | {
      type: 'detail';
      log: WorkoutLog;
      day: WorkoutDay;
      origin: 'home' | 'calendar' | 'cardio';
    }
  | { type: 'calendar' }
  | { type: 'profile' }
  | { type: 'settings' }
  | { type: 'data' }
  | { type: 'profile-edit' }
  | { type: 'community' }
  | { type: 'following'; back: 'community' | 'profile-edit' }
  | { type: 'followers'; back: 'community' | 'profile-edit' }
  | { type: 'user-profile'; userId: string; name: string }
  | {
      // Consulta de una rutina PÚBLICA (solo lectura) antes de copiarla.
      type: 'public-routine';
      routineId: string;
      name: string;
      authorName?: string;
      // Vista desde la que se abrió, para volver a ella y no siempre al tablón.
      back:
        | { type: 'community' }
        | { type: 'user-profile'; userId: string; name: string };
    }
  | {
      type: 'exercise-progress';
      // Ejercicio preseleccionado al abrir la evolución desde el detalle de un día.
      initialExerciseKey?: string;
      // Detalle al que volver si se llegó desde ahí (si no, se vuelve a Perfil).
      detailReturn?: {
        log: WorkoutLog;
        day: WorkoutDay;
        origin: 'home' | 'calendar' | 'cardio';
      };
    }
  | { type: 'new-routine'; initialDays?: SharedRoutineDay[] }
  | {
      type: 'routine-details';
      routine: WorkoutRoutine;
      origin?: 'home' | 'profile';
    }
  | { type: 'qr-scanner' }
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

function AppContent() {
  const { dispatch, state } = useWorkout();
  // Sync de fondo con la nube (Fase 3): al iniciar sesión y al volver a primer
  // plano. Refresca el estado si el pull trae cambios de otro dispositivo.
  useCloudSync(dispatch);
  const [screen, setScreen] = useState<Screen>({ type: 'home' });
  // "Calentar" el resto de pestañas: al arrancar se monta SOLO la activa (splash
  // corto y arranque ágil); tras el primer render se montan las demás en segundo
  // plano, de modo que la primera entrada a cualquiera ya sea instantánea.
  const [warmTabs, setWarmTabs] = useState(false);
  const insets = useSafeAreaInsets();
  // Índice de la pestaña activa (-1 en subpantallas, donde el pager queda tapado).
  const tabIndex = TAB_ORDER.indexOf(screen.type as TabType);
  const isTab = tabIndex >= 0;
  // Pager NATIVO (react-native-pager-view / ViewPager2): gestiona el arrastre
  // horizontal y el asentamiento de forma nativa, sin pasar por el hilo JS ni por
  // react-native-gesture-handler (el enfoque casero se colgaba por un bug de
  // gestos del dispositivo). `pagerRef.setPageWithoutAnimation` mueve a la
  // pestaña tocada en la barra; el swipe dispara `onPageSelected`.
  const pagerRef = React.useRef<PagerView>(null);
  // La barra oculta la pestaña de cardio si no hay ningún cardio.
  const showCardio = hasAnyCardio(state.logs);
  // Datos hidratados desde almacenamiento. El splash nativo se mantiene hasta
  // que esto es true, para no pintar primero los datos semilla y saltar luego
  // a los reales (el "carga a trompicones" del arranque).
  const [hydrated, setHydrated] = useState(false);
  const [isFirstInstall, setIsFirstInstall] = useState(false);
  const [whatsNewEntry, setWhatsNewEntry] = useState<ChangelogEntry | null>(
    null
  );

  // Hidratación: carga desde almacenamiento (o migra el JSON legacy). La
  // persistencia de cada cambio la hace el wrapper de dispatch de forma
  // granular (lib/persistence.ts), no un guardado completo periódico.
  useEffect(() => {
    let isMounted = true;

    const hydrateState = async () => {
      try {
        const savedData = await loadAppData();
        if (!isMounted) return;

        if (savedData) {
          dispatch({ type: 'SET_APP_DATA', payload: savedData });
        } else {
          // Primer arranque: sembrar el almacenamiento y reflejar ese seed en
          // el estado. El reducer parte de datos de fábrica (WORKOUT_ROUTINES /
          // INITIAL_LOGS), así que hay que sobrescribirlo con dispatch; si no,
          // en release (seed vacío) la UI seguiría mostrando las rutinas de
          // ejemplo del estado inicial en lugar de arrancar vacía.
          const seed = getSeedAppData();
          await saveAppData(seed);
          dispatch({ type: 'SET_APP_DATA', payload: seed });
          // Peso corporal del backup de dev (web): sin él las kcal del cardio
          // se calcularían con el peso por defecto.
          const seedWeights = getSeedCardioWeightHistory();
          if (seedWeights.length) {
            await setCardioWeightHistory(seedWeights);
          }
          setIsFirstInstall(true);
        }
      } catch (error) {
        console.error('Error loading app data:', error);
      } finally {
        // Siempre marcar hidratado (aunque falle) para no dejar el splash colgado.
        if (isMounted) setHydrated(true);
      }
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

  // Backup automático local: al abrir la app, si está activado y ha pasado el
  // intervalo (un día), se escribe un backup silencioso en el dispositivo. Sin
  // cloud; solo protege frente a perder el móvil sin haber exportado a mano.
  useEffect(() => {
    if (!hydrated || isFirstInstall) return;
    if (!isAutoBackupDue()) return;
    handleAutoBackup().catch((error) =>
      console.error('Error en backup automático:', error)
    );
    // Solo al arrancar (tras hidratar); el resto de deps son estables.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, isFirstInstall]);

  // Oculta el splash nativo una vez los datos reales ya están en pantalla, pero
  // NO en el mismo tick que se marca `hydrated`: se esperan dos frames para que
  // el primer render con la UI real (incluida la fuente Anton) se pinte y MIDA
  // antes de revelarlo. Si no, en algunos arranques en frío el splash se retiraba
  // sobre un primer frame con las métricas de Anton aún sin asentar y el titular
  // de la HeroCard salía recortado/mal dibujado.
  useEffect(() => {
    if (!hydrated) return;
    const outer = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        SplashScreen.hideAsync().catch(() => {});
      });
    });
    return () => cancelAnimationFrame(outer);
  }, [hydrated]);

  // Tras hidratar y pintar la pantalla inicial, monta el resto de pestañas en
  // segundo plano (runAfterInteractions) para que ya estén listas al entrar.
  useEffect(() => {
    if (!hydrated) return;
    const task = InteractionManager.runAfterInteractions(() =>
      setWarmTabs(true)
    );
    return () => task.cancel();
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
  useEffect(() => {
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
  const backFromWorkoutLog = (origin?: 'home' | 'calendar' | 'cardio') =>
    setScreen({ type: origin ?? 'home' });
  const backFromDetail = (origin: 'home' | 'calendar' | 'cardio') =>
    setScreen({
      type:
        origin === 'calendar'
          ? 'calendar'
          : origin === 'cardio'
          ? 'cardio'
          : 'home',
    });
  const backFromRoutineDetails = (origin?: 'home' | 'profile') =>
    setScreen({ type: 'routine-selector', origin });
  const backToNewRoutine = () => setScreen({ type: 'new-routine' });

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
            case 'cardio':
            case 'calendar':
            case 'profile':
            case 'community':
            case 'day-selector':
            case 'new-routine':
            case 'week-achievement':
              // Pantallas sin "Volver" propio en pantalla (navegación inferior
              // o destino final de un flujo corto): el físico vuelve a Inicio,
              // igual que antes.
              goHome();
              return true;
            case 'routine-selector':
              backFromRoutineSelector(screen.origin);
              return true;
            case 'workout-log':
              backFromWorkoutLog(screen.origin);
              return true;
            case 'detail':
              backFromDetail(screen.origin);
              return true;
            case 'settings':
            case 'data':
              goProfile();
              return true;
            case 'profile-edit':
              setScreen({ type: 'community' });
              return true;
            case 'following':
            case 'followers':
              setScreen({ type: screen.back });
              return true;
            case 'public-routine':
              setScreen(screen.back);
              break;
            case 'user-profile':
              setScreen({ type: 'community' });
              return true;
            case 'exercise-progress':
              // Vuelve al detalle si se abrió desde ahí; si no, a Perfil.
              if (screen.detailReturn) {
                setScreen({ type: 'detail', ...screen.detailReturn });
              } else {
                goProfile();
              }
              return true;
            case 'routine-details':
              backFromRoutineDetails(screen.origin);
              return true;
            case 'qr-scanner':
              backToNewRoutine();
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

  const activeRoutine = useMemo(
    () =>
      state.routines.find((routine) => routine.id === state.activeRoutineId),
    [state.activeRoutineId, state.routines]
  );

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

  const openWorkoutFromNotificationData = (
    data: Record<string, unknown> | undefined
  ) => {
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

  useEffect(() => {
    if (!Notifications) return;

    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        openWorkoutFromNotificationData(
          response.notification.request.content.data as Record<string, unknown>
        );
      }
    );

    const consumeInitialNotificationTap = async () => {
      try {
        const response =
          await Notifications!.getLastNotificationResponseAsync();
        if (response) {
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

  const handleImportData = async () => {
    const raw = await readJsonFromFile();
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
  // corto), y tras el primer render se montan las demás (warmTabs) y se quedan
  // vivas, ocultas con display:none al no estar activas. Así la PRIMERA entrada a
  // cualquiera ya está lista (sus useMemo caros ya calculados) y el cambio es
  // instantáneo. Cada pantalla difiere además su contenido pesado un frame
  // (useDeferredReady), para no bloquear al calentarse. El registro guarda las
  // series en estado local (no despacha por serie), así que tenerlas de fondo no
  // recalcula durante el entreno.
  // Cada página del PagerView. El contenido se monta al calentar o si es la
  // activa (al arrancar solo la activa; las demás esperan a warmTabs), pero el
  // View-página va SIEMPRE para que el pager mantenga sus 5 índices.
  const tabLayer = (type: TabType, node: React.ReactNode) => {
    const active = screen.type === type;
    return (
      <View key={type} style={styles.pagerPage} collapsable={false}>
        {active || warmTabs ? node : null}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <WhatsNewModal
        visible={whatsNewEntry !== null}
        entry={whatsNewEntry}
        onClose={handleCloseWhatsNew}
      />

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
        {tabLayer(
          'home',
          <HomeScreen
            onSelectDay={(day) => setScreen({ type: 'workout-log', day })}
            onSelectLog={(log, day) =>
              setScreen({ type: 'detail', log, day, origin: 'home' })
            }
            onEditLog={(log, day) =>
              setScreen({ type: 'workout-log', day, log })
            }
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
            onCreateRoutine={() => setScreen({ type: 'new-routine' })}
            onShowWeekAchievement={(achievements, routineName) =>
              setScreen({
                type: 'week-achievement',
                achievements,
                routineName,
              })
            }
          />
        )}

        {tabLayer(
          'cardio',
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
          />
        )}

        {tabLayer(
          'calendar',
          <CalendarScreen
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
          />
        )}

        {tabLayer(
          'community',
          <CommunityScreen
            active={screen.type === 'community'}
            onOpenProfile={(userId, name) =>
              setScreen({ type: 'user-profile', userId, name })
            }
            onOpenRoutine={(routineId, name, authorName) =>
              setScreen({
                type: 'public-routine',
                routineId,
                name,
                authorName,
                back: { type: 'community' },
              })
            }
            onOpenProfileEdit={() => setScreen({ type: 'profile-edit' })}
            onOpenFollowing={() =>
              setScreen({ type: 'following', back: 'community' })
            }
            onOpenFollowers={() =>
              setScreen({ type: 'followers', back: 'community' })
            }
          />
        )}

        {tabLayer(
          'profile',
          <ProfileScreen
            onOpenRoutines={() =>
              setScreen({ type: 'routine-selector', origin: 'profile' })
            }
            onOpenExerciseProgress={() =>
              setScreen({ type: 'exercise-progress' })
            }
            onOpenData={() => setScreen({ type: 'data' })}
            onOpenSettings={() => setScreen({ type: 'settings' })}
          />
        )}
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
          onCreateRoutine={() => setScreen({ type: 'new-routine' })}
          // Volver a la vista desde la que se abrió Rutinas (Fuerza o Perfil).
          onBack={() => backFromRoutineSelector(screen.origin)}
        />
      )}

      {screen.type === 'day-selector' && (
        <DaySelectorScreen
          routine={displayedRoutine}
          onSelectDay={(day, startsNewWeek) => {
            // Si el día ya tiene un log de hoy, WorkoutLogScreen lo detecta solo
            // (getLatestTodayLog) y abre ese registro para seguir metiendo series,
            // igual que la hero "Continúa tu entrenamiento": no hay que volver a
            // Inicio en silencio, eso solo confunde ("¿no ha funcionado el toque?").
            setScreen({ type: 'workout-log', day, startsNewWeek });
          }}
          onSelectCardioOnly={() =>
            setScreen({
              type: 'workout-log',
              day: CARDIO_ONLY_DAY,
              cardioOnly: true,
            })
          }
          onBack={goHome}
        />
      )}

      {screen.type === 'workout-log' && (
        <WorkoutLogScreen
          day={screen.day}
          log={screen.log}
          startsNewWeek={screen.startsNewWeek}
          cardioOnly={screen.cardioOnly}
          onSave={() => backFromWorkoutLog(screen.origin)}
          onBack={() => backFromWorkoutLog(screen.origin)}
        />
      )}

      {screen.type === 'detail' && (
        <DetailScreen
          log={screen.log}
          day={screen.day}
          onBack={() => backFromDetail(screen.origin)}
          onEdit={() =>
            setScreen({
              type: 'workout-log',
              day: screen.day,
              log: screen.log,
              cardioOnly: screen.log.cardioOnly || undefined,
              origin: screen.origin,
            })
          }
          onDelete={() => {
            dispatch({ type: 'DELETE_WORKOUT_LOG', payload: screen.log.id });
            backFromDetail(screen.origin);
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

      {screen.type === 'settings' && <SettingsScreen onBack={goProfile} />}

      {screen.type === 'profile-edit' && (
        <ProfileEditScreen
          onBack={() => setScreen({ type: 'community' })}
          onOpenFollowing={() =>
            setScreen({ type: 'following', back: 'profile-edit' })
          }
          onOpenFollowers={() =>
            setScreen({ type: 'followers', back: 'profile-edit' })
          }
        />
      )}

      {screen.type === 'following' && (
        <FollowingScreen
          mode="following"
          onBack={() => setScreen({ type: screen.back })}
          onOpenProfile={(userId, name) =>
            setScreen({ type: 'user-profile', userId, name })
          }
        />
      )}

      {screen.type === 'followers' && (
        <FollowingScreen
          mode="followers"
          onBack={() => setScreen({ type: screen.back })}
          onOpenProfile={(userId, name) =>
            setScreen({ type: 'user-profile', userId, name })
          }
        />
      )}

      {screen.type === 'user-profile' && (
        <UserProfileScreen
          userId={screen.userId}
          name={screen.name}
          onBack={() => setScreen({ type: 'community' })}
          onOpenRoutine={(routineId, name, authorName) =>
            setScreen({
              type: 'public-routine',
              routineId,
              name,
              authorName,
              back: {
                type: 'user-profile',
                userId: screen.userId,
                name: screen.name,
              },
            })
          }
        />
      )}

      {screen.type === 'public-routine' && (
        <PublicRoutineScreen
          routineId={screen.routineId}
          name={screen.name}
          authorName={screen.authorName}
          onBack={() => setScreen(screen.back)}
        />
      )}

      {screen.type === 'exercise-progress' && (
        <ExerciseProgressScreen
          initialExerciseKey={screen.initialExerciseKey}
          onBack={() =>
            screen.detailReturn
              ? setScreen({ type: 'detail', ...screen.detailReturn })
              : goProfile()
          }
        />
      )}

      {screen.type === 'data' && (
        <DataScreen
          onImportData={handleImportData}
          onExportData={handleExportData}
          onBackupNow={handleAutoBackup}
          onClearData={handleClearData}
          onBack={goProfile}
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
          onBack={goHome}
          onScanRoutineQR={() => setScreen({ type: 'qr-scanner' })}
          initialDays={screen.initialDays}
        />
      )}

      {screen.type === 'routine-details' && (
        <RoutineDetailScreen
          routine={screen.routine}
          onBack={() => backFromRoutineDetails(screen.origin)}
        />
      )}

      {screen.type === 'qr-scanner' && (
        <QRScannerScreen
          onScanSuccess={(shared: SharedRoutine) =>
            setScreen({ type: 'new-routine', initialDays: shared.days })
          }
          onBack={backToNewRoutine}
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
        <FloatingPrimaryNav
          bottom={getFloatingPrimaryNavMetrics(insets.bottom).bottom}
          activeTab={screen.type as TabType}
          showCardio={showCardio}
          onPressHome={() => setScreen({ type: 'home' })}
          onPressCardio={() => setScreen({ type: 'cardio' })}
          onPressCalendar={() => setScreen({ type: 'calendar' })}
          onPressCommunity={() => setScreen({ type: 'community' })}
          onPressProfile={() => setScreen({ type: 'profile' })}
        />
      )}

      {/* Encima de todo (incluidas las barras flotantes): el círculo del cambio
          de tema en caliente. */}
      <ThemeRevealOverlay />
    </View>
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

  // El splash nativo se mantiene (preventAutoHide) hasta que AppContent termina
  // de hidratar los datos; allí se llama a SplashScreen.hideAsync(). Así no se
  // oculta solo con las fuentes cargadas, evitando el parpadeo de datos semilla.
  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <WorkoutProvider>
        <StatusBar
          barStyle={
            theme.statusBarStyle === 'light' ? 'light-content' : 'dark-content'
          }
          backgroundColor="transparent"
          translucent
        />
        <View style={styles.container}>
          <AppContent />
        </View>
      </WorkoutProvider>
    </GestureHandlerRootView>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
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
