import React, { useEffect, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { AppModal, Button, CheckRow } from '@components';
import { theme } from '@lib/theme';
import { subscribeTheme } from '@lib/themeStore';
import { t } from '@lib/i18n';
import {
  acceptLegalTexts,
  getAccountDeletionRequest,
  useSession,
} from '@lib/cloud/auth';
import { MIN_ACCOUNT_AGE, needsLegalAcceptance } from '@lib/legalConsent';
import { LEGAL_VERSION, LegalDocId } from '@data/legal';
import { LegalModal } from './LegalScreen';

interface LegalAcceptanceChecksProps {
  acceptedTerms: boolean;
  onToggleTerms: () => void;
  acceptedHealth: boolean;
  onToggleHealth: () => void;
  /** Abre un texto para leerlo sin salir (`LegalModal`). */
  onOpenDoc: (doc: LegalDocId) => void;
}

/**
 * Las dos casillas de los textos legales: Términos y Política con la edad
 * mínima, y aparte (el RGPD pide distinguirlo, art. 7.2) el consentimiento
 * para los datos de salud. Las mismas al crear la cuenta (Datos y nube) y al
 * volver a aceptar (`LegalConsentPrompt`).
 */
export function LegalAcceptanceChecks({
  acceptedTerms,
  onToggleTerms,
  acceptedHealth,
  onToggleHealth,
  onOpenDoc,
}: LegalAcceptanceChecksProps) {
  return (
    <>
      <CheckRow
        style={styles.row}
        textStyle={styles.text}
        checked={acceptedTerms}
        onToggle={onToggleTerms}
      >
        {t('Tengo {age} años o más y acepto los', { age: MIN_ACCOUNT_AGE })}{' '}
        <Text style={styles.link} onPress={() => onOpenDoc('terms')}>
          {t('Términos de uso')}
        </Text>{' '}
        {t('y la')}{' '}
        <Text style={styles.link} onPress={() => onOpenDoc('privacy')}>
          {t('Política de privacidad')}
        </Text>
        .
      </CheckRow>
      <CheckRow
        style={styles.row}
        textStyle={styles.text}
        checked={acceptedHealth}
        onToggle={onToggleHealth}
      >
        {t(
          'Consiento que mis entrenos y mi peso corporal, que pueden ser datos de salud, se guarden en la nube con mi cuenta.'
        )}
      </CheckRow>
    </>
  );
}

/**
 * Pide aceptar los textos legales a una cuenta con sesión que no aceptó la
 * versión vigente: las creadas antes de que existieran (2026-11-16) y todas
 * cuando cambie \`LEGAL_VERSION\` (la política promete avisar antes de aplicar
 * un cambio). Va en la raíz, como \`AccountDeletionPrompt\`, y cede ante él: una
 * cuenta con el borrado pedido decide eso primero.
 *
 * "Ahora no" lo aparca hasta el próximo arranque de la app: cerrar la puerta
 * a quien ya tenía cuenta por no aceptar a la primera sería castigarle.
 */
export function LegalConsentPrompt() {
  const { user, restoring } = useSession();
  const userId = restoring ? null : user?.id ?? null;
  const pending =
    !!userId && needsLegalAcceptance(user?.user_metadata, LEGAL_VERSION);

  const [deletionChecked, setDeletionChecked] = useState(false);
  const [deletionPending, setDeletionPending] = useState(false);
  const [postponedFor, setPostponedFor] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedHealth, setAcceptedHealth] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [legalDoc, setLegalDoc] = useState<LegalDocId | null>(null);

  // ¿Tiene el borrado pedido? Entonces manda su aviso. Se mira al entrar y al
  // volver a la app (sin red la primera lectura no dice nada).
  useEffect(() => {
    setDeletionChecked(false);
    setDeletionPending(false);
    setAcceptedTerms(false);
    setAcceptedHealth(false);
    setProblem(null);
    if (!userId || !pending) return;
    let active = true;
    const check = async () => {
      try {
        const requested = await getAccountDeletionRequest(userId);
        if (!active) return;
        setDeletionPending(!!requested);
        setDeletionChecked(true);
      } catch {
        // Sin red: se pregunta al volver a la app.
      }
    };
    void check();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void check();
    });
    return () => {
      active = false;
      sub.remove();
    };
  }, [userId, pending]);

  const handleAccept = async () => {
    if (!acceptedTerms || !acceptedHealth) {
      setProblem(t('Marca las dos casillas para seguir con tu cuenta.'));
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      await acceptLegalTexts(LEGAL_VERSION);
    } catch {
      setProblem(t('No se ha podido guardar. Comprueba la conexión.'));
    } finally {
      setBusy(false);
    }
  };

  const visible =
    pending && deletionChecked && !deletionPending && postponedFor !== userId;

  return (
    <>
      <AppModal
        visible={visible && legalDoc === null}
        // Atrás del móvil = "Ahora no".
        onRequestClose={() => setPostponedFor(userId)}
        icon="file-document-outline"
        title={t('Términos y privacidad')}
        message={
          problem ??
          (typeof user?.user_metadata?.terms_version === 'string'
            ? t(
                'Hemos actualizado los Términos de uso y la Política de privacidad. Léelos y acéptalos para seguir usando tu cuenta en la nube.'
              )
            : t(
                'Tu cuenta es anterior a los Términos de uso y la Política de privacidad. Léelos y acéptalos para seguir usando tu cuenta en la nube.'
              ))
        }
        footer={
          <View style={styles.buttons}>
            <Button
              title={busy ? t('Guardando…') : t('Aceptar')}
              onPress={handleAccept}
              disabled={busy}
            />
            <Button
              title={t('Ahora no')}
              variant="secondary"
              onPress={() => setPostponedFor(userId)}
              disabled={busy}
            />
          </View>
        }
      >
        <View style={styles.checks}>
          <LegalAcceptanceChecks
            acceptedTerms={acceptedTerms}
            onToggleTerms={() => setAcceptedTerms((v) => !v)}
            acceptedHealth={acceptedHealth}
            onToggleHealth={() => setAcceptedHealth((v) => !v)}
            onOpenDoc={setLegalDoc}
          />
        </View>
      </AppModal>
      {/* Leer un texto cierra un momento el aviso (dos modales a la vez no se
          apilan bien en Android) y al volver sigue donde estaba. */}
      <LegalModal doc={legalDoc} onClose={() => setLegalDoc(null)} />
    </>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    // Texto largo y con enlaces: la casilla arriba y letra secundaria.
    row: {
      alignItems: 'flex-start',
    },
    text: {
      fontSize: 13,
      fontWeight: '400',
      color: theme.colors.textSecondary,
    },
    link: {
      color: theme.colors.primary,
      fontWeight: '700',
    },
    checks: {
      gap: 12,
      marginTop: 16,
    },
    buttons: {
      gap: 10,
    },
  });

let styles = makeStyles();
subscribeTheme(() => {
  styles = makeStyles();
});
