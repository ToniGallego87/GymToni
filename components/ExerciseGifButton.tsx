import { subscribeTheme } from '@lib/themeStore';
import React, { useState } from 'react';
import { Pressable, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '@lib/theme';
import { t } from '@lib/i18n';
import { ExercisePickerModal } from './ExercisePickerModal';
import { GifViewerModal } from './GifViewerModal';

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
 * Botón de GIF (play) de un ejercicio, para el registro y el detalle del día
 * ("¿qué ejercicio era este?"). Si el ejercicio viene del catálogo abre su GIF
 * directamente; si no (tecleado a mano o historial antiguo), abre el catálogo
 * en modo consulta ya buscando por su nombre, para dar con su GIF.
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

  // Con GIF asignado el botón reproduce (play); sin él abre el buscador para
  // localizar y asignar uno. Como la acción es distinta, el icono también: play
  // solo cuando de verdad va a reproducir, lupa cuando va a buscar. Así el toque
  // es predecible en vez de significar dos cosas con el mismo icono.
  const hasGif = !!catalogId;

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
        accessibilityLabel={hasGif ? t('Ver GIF') : t('Buscar GIF')}
      >
        <MaterialCommunityIcons
          name={hasGif ? 'play-box-outline' : 'movie-search-outline'}
          size={size}
          color={theme.colors.primary}
        />
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
      backgroundColor: theme.colors.surface,
    },
    pressed: {
      opacity: 0.8,
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
