import React, { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import {
  cancelAccountDeletion,
  getAccountDeletionRequest,
  signOut,
  useSession,
} from '@lib/cloud/auth';
import { forgetAccountOnDevice } from '@hooks/useMyProfile';
import { t } from '@lib/i18n';
import { accountPurgeDateKey, longDate } from '@lib/utils';
import { AppModal } from './AppModal';
import { Button } from './Button';

type Action = 'recover' | 'signout' | null;

/**
 * Aviso al iniciar sesión en una cuenta con el borrado pedido: durante el plazo
 * de gracia, entrar es la forma de arrepentirse (supabase/social-schema.sql,
 * "Borrado de cuenta"). Va en la raíz porque se puede entrar en cualquier
 * móvil y la sesión de otro dispositivo puede seguir abierta.
 *
 * Hay que elegir: recuperar o salir. Seguir dentro sin más dejaría usando una
 * cuenta que se va a borrar sola.
 */
export function AccountDeletionPrompt() {
  const { user } = useSession();
  const userId = user?.id ?? null;
  const [requestedAt, setRequestedAt] = useState<string | null>(null);
  const [action, setAction] = useState<Action>(null);
  // Texto que sustituye al mensaje tras intentar recuperar sin éxito.
  const [problem, setProblem] = useState<string | null>(null);

  const check = useCallback(async () => {
    if (!userId) return;
    setRequestedAt(await getAccountDeletionRequest(userId));
  }, [userId]);

  // Al entrar y al volver a la app: la lectura no avisa si falla por falta de
  // red, y sin el segundo disparo el aviso no saldría hasta el próximo arranque.
  useEffect(() => {
    setRequestedAt(null);
    setProblem(null);
    void check();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void check();
    });
    return () => sub.remove();
  }, [check]);

  const handleRecover = async () => {
    setAction('recover');
    setProblem(null);
    try {
      if (await cancelAccountDeletion()) setRequestedAt(null);
      else setProblem(t('El plazo para recuperar esta cuenta ha terminado.'));
    } catch {
      setProblem(t('No se pudo recuperar la cuenta. Comprueba la conexión.'));
    } finally {
      setAction(null);
    }
  };

  const handleSignOut = async () => {
    if (!userId) return;
    setAction('signout');
    try {
      await signOut();
      // Entrar ha vuelto a guardar su perfil y sus marcas en el móvil.
      await forgetAccountOnDevice(userId);
    } finally {
      setAction(null);
    }
  };

  if (!userId || !requestedAt) return null;

  return (
    <AppModal
      visible
      // Sin salida por el botón atrás: hay que elegir (ver cabecera).
      onRequestClose={() => undefined}
      title={t('Cuenta pendiente de eliminar')}
      icon="account-clock-outline"
      message={
        problem ??
        t(
          'Pediste eliminar esta cuenta. Se borrará el {date}, salvo que la recuperes ahora.',
          { date: longDate(accountPurgeDateKey(requestedAt)) }
        )
      }
      footer={
        <>
          <Button
            title={
              action === 'recover'
                ? t('Recuperando…')
                : t('Recuperar mi cuenta')
            }
            onPress={handleRecover}
            disabled={action !== null}
            size="large"
          />
          <Button
            title={t('Cerrar sesión')}
            variant="secondary"
            onPress={handleSignOut}
            disabled={action !== null}
          />
        </>
      }
    />
  );
}
