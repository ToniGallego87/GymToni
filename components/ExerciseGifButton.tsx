import { subscribeTheme } from '@lib/themeStore';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '@lib/theme';
import { t } from '@lib/i18n';
import { getCatalogExercise, gifUrl, thumbUrl } from '@data/exerciseCatalog';
import { ExercisePickerModal } from './ExercisePickerModal';
import { GifViewerModal } from './GifViewerModal';

// Ampliación de la miniatura dentro del botón (los GIF del catálogo traen mucho
// margen blanco alrededor de la figura).
const THUMB_ZOOM = 1.35;

interface ExerciseGifButtonProps {
  /** Nombre del ejercicio (para buscar en el catálogo si no hay `catalogId`). */
  name: string;
  /** Id del catálogo si el ejercicio se eligió de ahí (abre su GIF directo). */
  catalogId?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
  /**
   * `cover` (por defecto) recorta el aire que el catálogo deja alrededor de la
   * figura, con zoom, para llenar botones pequeños y redondos. `contain`
   * enseña el GIF entero sin recortar (lo usa `ExerciseTileGrid`, donde la
   * casilla ya reserva el alto que haga falta).
   */
  fitMode?: 'cover' | 'contain';
  /**
   * Permite fijar un GIF al ejercicio de la rutina: aparece un botón **Asignar**
   * en el visor/buscador que guarda el `catalogId` elegido. Solo tiene sentido
   * donde el ejercicio pertenece a una rutina editable (registro e historial).
   */
  onAssign?: (catalogId: string) => void;
  /**
   * CAPA sobre una miniatura que ya pinta otro (la casilla del marco del
   * registro): sin fondo, borde ni fotograma propios, así elegir la casilla no
   * recarga su imagen (antes se cambiaba por la de este botón y parpadeaba).
   * Pinta solo el GIF EN MOVIMIENTO, que aparece cuando ha cargado (hasta
   * entonces, y sin conexión, se ve la miniatura de debajo), y una lupa
   * amarilla en la esquina: amplía en el visor, o busca uno si no tiene. Es UNA
   * casilla a la vez: varios GIF animados son los que hacían ir lenta la app
   * (ver la nota del componente).
   */
  layer?: boolean;
  /**
   * Solo imagen, sin toque propio: la miniatura dentro de una fila que ya es
   * entera un botón (la lista de Progreso). Dos dianas en una fila hacían que
   * a veces se abriera el GIF en vez de la ficha. Sin GIF enseña una mancuerna
   * neutra, no la lupa de buscar. El visor queda donde se abre la fila.
   */
  decorative?: boolean;
}

/**
 * Botón de GIF de un ejercicio, para el registro y el detalle del día ("¿qué
 * ejercicio era este?"). Con GIF asignado el propio botón enseña su fotograma
 * fijo (el JPG del catálogo, el mismo que el buscador): a un vistazo se
 * reconoce el ejercicio sin abrir nada, y el toque lleva al visor con el GIF en
 * movimiento a tamaño completo. Antes la miniatura era el GIF animado: con una
 * por tarjeta en el registro y ocho por día en Rutina, Android decodificaba
 * frames sin parar y cada una pesaba 15 veces más que el JPG. Sin GIF (tecleado
 * a mano o historial antiguo) enseña la lupa y abre el catálogo buscando por su
 * nombre, para dar con uno y asignarlo.
 */
export function ExerciseGifButton({
  name,
  catalogId,
  size = 20,
  style,
  fitMode = 'cover',
  onAssign,
  layer = false,
  decorative = false,
}: ExerciseGifButtonProps) {
  const [showGif, setShowGif] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  // La miniatura (JPG fijo) se descarga del CDN igual que el visor. Si falla
  // (sin conexión), el botón cae al icono de play y sigue funcionando.
  const [thumbFailed, setThumbFailed] = useState(false);
  // Miniatura ya pintada. Hasta entonces, un spinner en su sitio: el cuadro
  // vacío parecía roto. Por URL, para que al asignar otro GIF vuelva a salir.
  const [loadedThumb, setLoadedThumb] = useState<string | null>(null);
  // GIF animado de la capa ya pintado (hasta entonces, invisible).
  const [loadedGif, setLoadedGif] = useState<string | null>(null);
  // Los modales se montan la PRIMERA vez que se abren y luego se quedan (así
  // cierran con su animación). Montados de entrada en cada tarjeta, abrir el
  // registro, el detalle o un día de una rutina pagaba un visor y un buscador
  // por ejercicio que casi nunca se usan.
  const [gifMounted, setGifMounted] = useState(false);
  const [pickerMounted, setPickerMounted] = useState(false);
  const exercise = getCatalogExercise(catalogId);

  // Con GIF asignado el botón reproduce (play); sin él abre el buscador para
  // localizar y asignar uno. Como la acción es distinta, el icono también: play
  // solo cuando de verdad va a reproducir, lupa cuando va a buscar. Así el toque
  // es predecible en vez de significar dos cosas con el mismo icono.
  const hasGif = !!catalogId;
  const showThumb = !!exercise && !thumbFailed;
  const thumb = exercise ? thumbUrl(exercise) : null;
  const gif = layer && exercise ? gifUrl(exercise) : null;

  const handlePress = () => {
    if (hasGif) {
      setGifMounted(true);
      setShowGif(true);
    } else {
      setPickerMounted(true);
      setShowPicker(true);
    }
  };

  const renderModals = () => (
    <>
      {gifMounted && (
        <GifViewerModal
          visible={showGif}
          onRequestClose={() => setShowGif(false)}
          catalogId={catalogId}
          fallbackName={name}
        />
      )}
      {pickerMounted && (
        <ExercisePickerModal
          visible={showPicker}
          onRequestClose={() => setShowPicker(false)}
          reference
          initialQuery={name}
          onAssign={onAssign}
        />
      )}
    </>
  );

  if (layer) {
    return (
      <>
        <Pressable
          style={({ pressed }) => [
            styles.layer,
            style,
            pressed && styles.pressed,
          ]}
          onPress={handlePress}
          accessibilityRole="button"
          accessibilityLabel={hasGif ? t('Ver GIF') : t('Buscar GIF')}
        >
          {!!gif && (
            <Image
              key={gif}
              source={{ uri: gif }}
              style={[
                styles.thumb,
                styles.thumbContain,
                loadedGif !== gif && styles.hidden,
              ]}
              resizeMode="contain"
              fadeDuration={0}
              onLoad={() => setLoadedGif(gif)}
            />
          )}
          <GifCornerBadge search={!hasGif} />
        </Pressable>
        {renderModals()}
      </>
    );
  }

  if (decorative) {
    return (
      <View
        style={[styles.button, styles.buttonDecorative, style]}
        pointerEvents="none"
      >
        {showThumb && thumb ? (
          <Image
            source={{ uri: thumb }}
            style={[styles.thumb, fitMode === 'contain' && styles.thumbContain]}
            resizeMode={fitMode}
            onError={() => setThumbFailed(true)}
          />
        ) : (
          <MaterialCommunityIcons
            name="dumbbell"
            size={size}
            color={theme.colors.textSecondary}
          />
        )}
      </View>
    );
  }

  return (
    <>
      <Pressable
        style={({ pressed }) => [
          styles.button,
          style,
          pressed && styles.pressed,
        ]}
        onPress={handlePress}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={hasGif ? t('Ver GIF') : t('Buscar GIF')}
      >
        {showThumb && thumb ? (
          <>
            <Image
              source={{ uri: thumb }}
              style={[
                styles.thumb,
                fitMode === 'contain' && styles.thumbContain,
              ]}
              resizeMode={fitMode}
              onLoad={() => setLoadedThumb(thumb)}
              onError={() => setThumbFailed(true)}
            />
            {loadedThumb !== thumb && (
              <ActivityIndicator
                size="small"
                color={theme.colors.primary}
                style={styles.thumbSpinner}
              />
            )}
          </>
        ) : (
          <MaterialCommunityIcons
            name={hasGif ? 'play-box-outline' : 'movie-search-outline'}
            size={size}
            color={theme.colors.primary}
          />
        )}
      </Pressable>

      {renderModals()}
    </>
  );
}

/**
 * Lupa amarilla de la esquina de una miniatura: ampliar el GIF (o buscar uno,
 * `search`, si no tiene). La lleva cada casilla del registro; en la del marco
 * es además el botón (modo `layer`).
 */
export function GifCornerBadge({ search = false }: { search?: boolean }) {
  return (
    <View style={styles.cornerBadge} pointerEvents="none">
      <MaterialCommunityIcons
        name={search ? 'movie-search-outline' : 'magnify-plus-outline'}
        size={16}
        color={theme.colors.onGold}
      />
    </View>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    button: {
      width: 34,
      height: 34,
      borderRadius: theme.borderRadius.sm,
      borderWidth: 1,
      borderColor: theme.colors.primaryLine,
      alignItems: 'center',
      justifyContent: 'center',
      // Recorta la miniatura al radio del botón: el GIF llena el cuadro sin
      // desbordar el borde dorado, que sigue diciendo que esto es pulsable.
      overflow: 'hidden',
      backgroundColor: theme.colors.surface,
    },
    // Sin toque propio, sin el borde dorado que dice "pulsable".
    buttonDecorative: {
      borderColor: theme.colors.border,
    },
    // Los GIF del catálogo son opacos y "cover" llena el cuadro; el fondo solo
    // se ve mientras cargan, así que va el neutro de marcador (el mismo del
    // Avatar) y no un blanco que en tema día es tinta oscura.
    //
    // El zoom recorta el aire que el catálogo deja alrededor de la figura: sin
    // él, en un cuadro pequeño el muñeco sale diminuto y rodeado de blanco. El
    // `overflow: hidden` del botón se queda con lo que sobresale.
    thumb: {
      width: '100%',
      height: '100%',
      backgroundColor: theme.colors.surfaceAlt,
      transform: [{ scale: THUMB_ZOOM }],
    },
    // `contain`: se ve el GIF entero, así que ni recorta ni hace falta el zoom
    // que compensa el aire del catálogo.
    thumbContain: {
      transform: [{ scale: 1 }],
    },
    thumbSpinner: {
      position: 'absolute',
    },
    // Modo capa: ocupa la miniatura de debajo, sin piel propia.
    layer: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    hidden: {
      opacity: 0,
    },
    // Abajo a la derecha y pequeño: no tapa la figura del GIF.
    cornerBadge: {
      position: 'absolute',
      right: 4,
      bottom: 4,
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primaryFill,
      ...theme.shadow.soft,
    },
    pressed: {
      opacity: 0.8,
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
