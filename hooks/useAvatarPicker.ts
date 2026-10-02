import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useSession } from '@lib/cloud/auth';
import { updateProfile, uploadAvatar } from '@lib/cloud/social';
import { loadMyProfile } from './useMyProfile';

/**
 * Cambiar la foto de perfil, de principio a fin: elegirla de la galería,
 * recortarla a cuadrado, reducirla a 256 px jpeg, subirla al bucket `avatars`
 * de Storage (y caer a base64 si el bucket no está) y guardarla en el perfil.
 *
 * Elegir la foto YA es la confirmación —has recortado tu cara y le has dado a
 * aceptar, no hay nada más que decidir—, así que se guarda sola en vez de
 * quedarse colgando de un "Guardar" fácil de olvidar.
 *
 * Vive en un hook porque lo usan el lápiz sobre la foto de Perfil (el camino
 * corto: un toque) y antes también el editor; sin él, la pantalla tendría que
 * repetir las cuatro llamadas y el manejo de errores.
 */
export function useAvatarPicker(): {
  pickAvatar: () => Promise<void>;
  picking: boolean;
  error: string | null;
} {
  const { user } = useSession();
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickAvatar = async () => {
    try {
      setPicking(true);
      setError(null);
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });
      if (res.canceled || !res.assets?.[0]) return;
      const manip = await ImageManipulator.manipulateAsync(
        res.assets[0].uri,
        [{ resize: { width: 256 } }],
        {
          compress: 0.6,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        }
      );
      if (!manip.base64 || !user) return;

      let avatar = `data:image/jpeg;base64,${manip.base64}`;
      try {
        avatar = await uploadAvatar(user.id, manip.base64);
      } catch {
        // Bucket sin configurar: el base64 cabe en el perfil y se ve igual.
      }
      // Patch de SOLO el avatar: así no hace falta tener cargado el resto del
      // perfil (nombre, bio, visibilidad) para poder cambiar la foto.
      await updateProfile(user.id, { avatar_url: avatar });
      // La barra de navegación y Perfil leen el mismo store: recargarlo aquí es
      // lo que hace que la foto nueva aparezca sin reiniciar la app.
      await loadMyProfile(user.id, true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPicking(false);
    }
  };

  return { pickAvatar, picking, error };
}
