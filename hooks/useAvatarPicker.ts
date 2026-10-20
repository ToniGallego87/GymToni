import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useSession } from '@lib/cloud/auth';
import { pruneAvatars, updateProfile, uploadAvatar } from '@lib/cloud/social';
import { loadMyProfile, useMyProfile } from './useMyProfile';

/**
 * Cambiar la foto de perfil, de principio a fin: elegirla de la galería,
 * recortarla a cuadrado, reducirla a 256 px jpeg, subirla al bucket `avatars`
 * de Storage, guardarla en el perfil y borrar la foto anterior.
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
  const { profile } = useMyProfile();
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

      // Antes de subir, fuera lo que no sea la foto actual del perfil: el
      // bucket admite pocas fotos por persona y los restos (otro móvil, una
      // limpieza que falló) acabarían bloqueando la subida para siempre.
      await pruneAvatars(user.id, profile?.avatar_url).catch(() => undefined);
      // Sin caída a base64 en el perfil: la nube solo admite URLs del bucket
      // propio (supabase/social-schema.sql, `profiles_avatar_url_own`). Si la
      // subida falla, sale el error y la foto anterior se queda.
      const avatar = await uploadAvatar(user.id, manip.base64);
      // Patch de SOLO el avatar: así no hace falta tener cargado el resto del
      // perfil (nombre, bio, visibilidad) para poder cambiar la foto.
      await updateProfile(user.id, { avatar_url: avatar });
      // La barra de navegación y Perfil leen el mismo store: recargarlo aquí es
      // lo que hace que la foto nueva aparezca sin reiniciar la app.
      await loadMyProfile(user.id, true);
      // La foto anterior, solo ahora que el perfil ya no apunta a ella. Si
      // falla no pasa nada: la próxima subida vuelve a limpiar.
      await pruneAvatars(user.id, avatar).catch(() => undefined);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPicking(false);
    }
  };

  return { pickAvatar, picking, error };
}
