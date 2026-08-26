import { subscribeTheme } from '@lib/themeStore';
import React, { useState } from 'react';
import {
  Image,
  Pressable,
  StyleProp,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '@lib/theme';
import { t } from '@lib/i18n';
import { getCatalogExercise, gifUrl } from '@data/exerciseCatalog';
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
   * Permite fijar un GIF al ejercicio de la rutina: aparece un botón **Asignar**
   * en el visor/buscador que guarda el `catalogId` elegido. Solo tiene sentido
   * donde el ejercicio pertenece a una rutina editable (registro e historial).
   */
  onAssign?: (catalogId: string) => void;
}

/**
 * Botón de GIF de un ejercicio, para el registro y el detalle del día ("¿qué
 * ejercicio era este?"). Con GIF asignado el propio botón **es el GIF**, en
 * miniatura y en movimiento: a un vistazo se reconoce el ejercicio sin abrir
 * nada, y el toque sigue llevando al visor a tamaño completo. Sin GIF (tecleado
 * a mano o historial antiguo) enseña la lupa y abre el catálogo buscando por su
 * nombre, para dar con uno y asignarlo.
 */
export function ExerciseGifButton({
  name,
  catalogId,
  size = 20,
  style,
  onAssign,
}: ExerciseGifButtonProps) {
  const [showGif, setShowGif] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  // La miniatura se descarga del CDN igual que el visor. Si falla (sin
  // conexión), el botón cae al icono de play y sigue funcionando.
  const [thumbFailed, setThumbFailed] = useState(false);
  const exercise = getCatalogExercise(catalogId);

  // Con GIF asignado el botón reproduce (play); sin él abre el buscador para
  // localizar y asignar uno. Como la acción es distinta, el icono también: play
  // solo cuando de verdad va a reproducir, lupa cuando va a buscar. Así el toque
  // es predecible en vez de significar dos cosas con el mismo icono.
  const hasGif = !!catalogId;
  const showThumb = !!exercise && !thumbFailed;

  const handlePress = () => {
    if (hasGif) setShowGif(true);
    else setShowPicker(true);
  };

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
        {showThumb ? (
          <Image
            source={{ uri: gifUrl(exercise) }}
            style={styles.thumb}
            resizeMode="cover"
            onError={() => setThumbFailed(true)}
          />
        ) : (
          <MaterialCommunityIcons
            name={hasGif ? 'play-box-outline' : 'movie-search-outline'}
            size={size}
            color={theme.colors.primary}
          />
        )}
      </Pressable>

      <GifViewerModal
        visible={showGif}
        onRequestClose={() => setShowGif(false)}
        catalogId={catalogId}
        fallbackName={name}
      />
      <ExercisePickerModal
        visible={showPicker}
        onRequestClose={() => setShowPicker(false)}
        reference
        initialQuery={name}
        onAssign={onAssign}
      />
    </>
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
    pressed: {
      opacity: 0.8,
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
