import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { AppModal, Avatar, Button, OptionToggle } from '@components';
import { theme } from '@lib/theme';
import { subscribeTheme } from '@lib/themeStore';
import { t } from '@lib/i18n';
import { useSession } from '@lib/cloud/auth';
import { loadMyProfile } from '@hooks/useMyProfile';
import { getProfile, updateProfile, uploadAvatar } from '@lib/cloud/social';

interface ProfileEditModalProps {
  visible: boolean;
  onClose: () => void;
}

// Edición del perfil público (Fase 4): foto, nombre visible, bio y visibilidad.
// Es un popup sobre PERFIL, que es donde uno se ve a sí mismo; la gestión de
// la cuenta y las copias vive aparte, en "Datos y nube", y los contadores de
// seguidores/seguidos están en tu tarjeta de Comunidad, que es donde se usan.
export function ProfileEditModal({ visible, onClose }: ProfileEditModalProps) {
  const { user } = useSession();

  const [profileName, setProfileName] = useState('');
  const [profileBio, setProfileBio] = useState('');
  const [profilePublic, setProfilePublic] = useState(false);
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  const [pickingAvatar, setPickingAvatar] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Carga el perfil cada vez que se abre: lo que se ve es lo guardado.
  useEffect(() => {
    if (!visible || !user) return;
    let active = true;
    setError(null);
    getProfile(user.id)
      .then((p) => {
        if (!active || !p) return;
        setProfileName(p.display_name ?? '');
        setProfileBio(p.bio ?? '');
        setProfilePublic(p.is_public);
        setProfileAvatar(p.avatar_url ?? null);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, user?.id]);

  // Selecciona una foto, la recorta a cuadrado y la reduce a 256px jpeg. Se sube
  // al bucket `avatars` de Storage (URL ligera); si no está, cae a base64.
  const handlePickAvatar = async () => {
    try {
      setPickingAvatar(true);
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
      if (!manip.base64) return;
      const dataUri = `data:image/jpeg;base64,${manip.base64}`;
      if (!user) {
        setProfileAvatar(dataUri);
        return;
      }
      let avatar = dataUri;
      try {
        avatar = await uploadAvatar(user.id, manip.base64);
      } catch {
        avatar = dataUri;
      }
      setProfileAvatar(avatar);
      // Elegir la foto YA es la confirmación: has recortado tu cara y le has
      // dado a aceptar, no hay nada más que decidir. Se guarda sola (el resto
      // del formulario viaja con ella, tal y como esté) en vez de dejar el
      // avatar nuevo colgando de un "Guardar" fácil de olvidar.
      await persistProfile(avatar);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPickingAvatar(false);
    }
  };

  // Escritura del perfil. El avatar llega por parámetro porque quien acaba de
  // elegir foto todavía no lo tiene en el estado del render en curso.
  const persistProfile = async (avatarUrl: string | null) => {
    if (!user) return;
    await updateProfile(user.id, {
      display_name: profileName.trim() || null,
      bio: profileBio.trim() || null,
      is_public: profilePublic,
      avatar_url: avatarUrl,
    });
    // La barra de navegación y Perfil leen el mismo store: recargarlo aquí
    // es lo que hace que la foto nueva aparezca sin reiniciar la app.
    await loadMyProfile(user.id, true);
  };

  // Guardar cierra el popup: la tarjeta de Perfil, detrás, ya enseña el cambio.
  const handleSaveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    setError(null);
    try {
      await persistProfile(profileAvatar);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <AppModal
      visible={visible}
      onRequestClose={onClose}
      title={t('Editar perfil')}
      icon="account-circle-outline"
      align="left"
      footer={
        <View style={styles.buttonRow}>
          <Button
            title={t('Cancelar')}
            variant="secondary"
            size="medium"
            onPress={onClose}
            style={styles.button}
          />
          <Button
            title={savingProfile ? t('Guardando…') : t('Guardar')}
            variant="primary"
            size="medium"
            onPress={handleSaveProfile}
            disabled={savingProfile || !user}
            style={styles.button}
          />
        </View>
      }
    >
      <View style={styles.form}>
        {/* Los contadores de seguidores/siguiendo ya NO viven aquí: esto es
            un formulario de edición, y verse a uno mismo se hace en tu
            tarjeta de Comunidad, que además lleva a las dos listas. */}
        <View style={styles.avatarRow}>
          <Avatar uri={profileAvatar} size={56} />
          <Button
            title={pickingAvatar ? t('Abriendo…') : t('Cambiar foto')}
            variant="secondary"
            size="medium"
            onPress={handlePickAvatar}
            disabled={pickingAvatar}
            style={styles.avatarButton}
          />
        </View>
        <TextInput
          style={styles.input}
          placeholder={t('Nombre visible')}
          placeholderTextColor={theme.colors.textMuted}
          value={profileName}
          onChangeText={setProfileName}
          maxLength={40}
        />
        <TextInput
          style={[styles.input, styles.bioInput]}
          placeholder={t('Bio (opcional)')}
          placeholderTextColor={theme.colors.textMuted}
          value={profileBio}
          onChangeText={setProfileBio}
          multiline
          maxLength={160}
        />
        <OptionToggle
          options={[
            { value: true, label: t('Público') },
            { value: false, label: t('Privado') },
          ]}
          value={profilePublic}
          onChange={setProfilePublic}
        />
        <Text style={styles.hint}>
          {profilePublic
            ? t('Otros pueden ver tu perfil y seguirte.')
            : t('Tu perfil no aparece para otros.')}
        </Text>
        {!user && (
          <Text style={styles.hint}>
            {t(
              'El perfil público vive en tu cuenta: créala en Datos y nube para poder guardarlo.'
            )}
          </Text>
        )}
        {!!error && <Text style={styles.error}>{error}</Text>}
      </View>
    </AppModal>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    form: { gap: 12 },
    hint: { color: theme.colors.textMuted, fontSize: 13, lineHeight: 18 },
    error: { color: theme.colors.error, fontSize: 13, lineHeight: 18 },
    avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    avatarButton: { flex: 1 },
    input: {
      backgroundColor: theme.colors.backgroundElevated,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: theme.colors.text,
      fontSize: 16,
    },
    bioInput: { minHeight: 76, textAlignVertical: 'top' },
    buttonRow: { flexDirection: 'row', gap: 10 },
    button: { flex: 1 },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
