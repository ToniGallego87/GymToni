import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput } from 'react-native';
import { AppModal, Button, OptionToggle } from '@components';
import { theme } from '@lib/theme';
import { subscribeTheme } from '@lib/themeStore';
import { t } from '@lib/i18n';
import { useSession } from '@lib/cloud/auth';
import { loadMyProfile } from '@hooks/useMyProfile';
import { getProfile, updateProfile } from '@lib/cloud/social';
import { deleteActivity } from '@lib/cloud/activity';

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
  // Compartir la Actividad (insignias, retos y días entrenados) en el perfil.
  // Quién la ve lo decide la misma regla que el perfil; esto solo permite
  // apagarla sin tener que volver el perfil entero privado.
  const [shareActivity, setShareActivity] = useState(true);
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
        // Las filas anteriores a la columna vienen sin ella: cuentan como
        // encendido, que es el valor por defecto de la tabla.
        setShareActivity(p.share_activity !== false);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, user?.id]);

  // Escritura del perfil. La FOTO no viaja aquí: se cambia con el lápiz de su
  // esquina en Perfil (hooks/useAvatarPicker.ts), que la guarda sola. Si este
  // formulario la mandara también, guardar el nombre pisaría una foto recién
  // cambiada con la que tenía al abrirse.
  const persistProfile = async () => {
    if (!user) return;
    await updateProfile(user.id, {
      display_name: profileName.trim() || null,
      bio: profileBio.trim() || null,
      is_public: profilePublic,
      share_activity: shareActivity,
    });
    // Apagarlo RETIRA lo publicado, no lo esconde: si alguien deja de compartir
    // su actividad, no debe quedarse en la nube esperando que nadie la lea.
    if (!shareActivity) await deleteActivity(user.id).catch(() => {});
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
      await persistProfile();
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
        {/* Ni la foto ni los contadores viven aquí: la foto se cambia con el
            lápiz de su esquina en Perfil (un toque, sin abrir este popup) y
            verse a uno mismo se hace en tu tarjeta de Comunidad. Esto es solo
            el texto y la visibilidad. */}
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
        {/* La Actividad por separado: se puede compartir el perfil y las
            rutinas sin publicar los días que entrenas. Quién la ve es la misma
            regla de arriba; esto solo decide si se publica. */}
        <Text style={styles.sectionLabel}>{t('Actividad')}</Text>
        <OptionToggle
          options={[
            { value: true, label: t('Compartir') },
            { value: false, label: t('No compartir') },
          ]}
          value={shareActivity}
          onChange={setShareActivity}
        />
        <Text style={styles.hint}>
          {shareActivity
            ? t(
                'Tu perfil enseña tus insignias, retos superados y días entrenados.'
              )
            : t('Nadie verá tu actividad, y se retira la ya publicada.')}
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
    // Rótulo del bloque de la Actividad: separa sus dos posiciones de las de
    // visibilidad del perfil, que están justo encima.
    sectionLabel: {
      color: theme.colors.textSecondary,
      fontSize: 13,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginTop: 4,
    },
    error: { color: theme.colors.error, fontSize: 13, lineHeight: 18 },
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
