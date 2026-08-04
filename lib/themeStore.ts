// Store mínimo de suscripción al modo de tema (día/noche), independiente de
// `theme.ts` y `glassTokens.ts` para no crear ciclos de import. Al cambiar el
// tema se muta el singleton `theme` en su sitio (lib/theme.ts) y se llama a
// `notifyThemeChange()`: los `let` vivos de glassTokens se recalculan y la raíz
// (`useThemeVersion`) re-renderiza el árbol, que relee la paleta.
type Listener = () => void;

const listeners = new Set<Listener>();
let version = 0;

export function subscribeTheme(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getThemeVersion(): number {
  return version;
}

export function notifyThemeChange(): void {
  version += 1;
  // Copia defensiva: algún listener podría desuscribirse durante la iteración.
  for (const listener of Array.from(listeners)) {
    listener();
  }
}
