/**
 * Constancia de que una cuenta aceptó los textos legales (Términos y Política,
 * con la edad mínima) y dio el consentimiento para los datos de salud (entrenos
 * y peso). Va en los metadatos de la cuenta (`user_metadata` de Supabase): se
 * escribe al crearla y al volver a aceptar cuando cambia la versión. Si está
 * ejecutado el SQL de `supabase/schema.sql` ("Aceptación de los textos
 * legales"), el servidor guarda además cada aceptación con su hora.
 */

/** Edad mínima para tener cuenta (Términos §3; la del consentimiento digital en España). */
export const MIN_ACCOUNT_AGE = 14;

export interface LegalAcceptance {
  /** Versión aceptada de los textos (`LEGAL_VERSION`, la fecha de `data/legal.json`). */
  terms_version: string;
  terms_accepted_at: string;
  /** Declara tener la edad mínima (va con la aceptación de los Términos). */
  min_age: number;
  /** Consentimiento aparte para guardar entrenos y peso (datos de salud). */
  health_consent_at: string;
}

/** Lo que se guarda en la cuenta al aceptar la versión `version`. */
export function legalAcceptanceMetadata(
  version: string,
  now: Date = new Date()
): LegalAcceptance {
  const at = now.toISOString();
  return {
    terms_version: version,
    terms_accepted_at: at,
    min_age: MIN_ACCOUNT_AGE,
    health_consent_at: at,
  };
}

/**
 * ¿Hay que pedirle a esta cuenta que acepte (otra vez) los textos? Sí si nunca
 * los aceptó (cuentas creadas antes de que existieran), si aceptó otra versión
 * o si le falta el consentimiento de los datos de salud.
 */
export function needsLegalAcceptance(
  metadata: Record<string, unknown> | null | undefined,
  version: string
): boolean {
  return (
    metadata?.terms_version !== version ||
    typeof metadata?.health_consent_at !== 'string'
  );
}
