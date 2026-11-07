import React, { useState } from 'react';
import { signOut } from '@lib/cloud/auth';
import { t } from '@lib/i18n';
import { ConfirmModal } from './ConfirmModal';

interface SignOutConfirmModalProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * "¿Cerrar sesión?": el mismo popup desde Perfil (la X junto al lápiz) y desde
 * Datos y nube. Cierra la sesión él mismo; lo de la cuenta en el móvil lo
 * olvida `useForgetSignedOutAccount`, en la raíz.
 */
export function SignOutConfirmModal({
  visible,
  onClose,
}: SignOutConfirmModalProps) {
  const [busy, setBusy] = useState(false);

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await signOut();
    } finally {
      setBusy(false);
      onClose();
    }
  };

  return (
    <ConfirmModal
      visible={visible}
      icon="logout"
      title={t('¿Cerrar sesión?')}
      message={t(
        'Tus entrenos y rutinas se quedan en este móvil y en la nube. Para volver a sincronizar y usar Comunidad tendrás que iniciar sesión otra vez.'
      )}
      confirmLabel={busy ? t('Cerrando sesión…') : t('Cerrar sesión')}
      busy={busy}
      onConfirm={handleConfirm}
      onCancel={onClose}
    />
  );
}
