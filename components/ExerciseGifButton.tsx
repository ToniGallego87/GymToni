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
}: ExerciseGifButtonProps) {
  const [showGif, setShowGif] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const handlePress = () => {
    if (catalogId) setShowGif(true);
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
        accessibilityLabel={t('Ver GIF')}
      >
        <MaterialCommunityIcons
          name="play-box-outline"
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
      />
    </>
  );
}

const styles = StyleSheet.create({
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
