/**
 * Puente para abrir la pantalla de Logros desde cualquier sitio que no cuelgue
 * de `App.tsx` (la píldora de nivel de `GlassTopBar`, que está en todas las
 * pantallas). La raíz registra el abridor al montar; hasta entonces la
 * llamada no hace nada.
 */
let opener: (() => void) | null = null;

export function setAchievementsOpener(fn: (() => void) | null): void {
  opener = fn;
}

export function openAchievements(): void {
  opener?.();
}
