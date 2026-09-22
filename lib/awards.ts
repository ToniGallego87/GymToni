import { useSyncExternalStore } from 'react';

/**
 * Cola de "premios" por avisar: un reto superado, un logro desbloqueado o una
 * subida de nivel. La alimenta `useAccountLevel({ record: true })` (la raíz)
 * al detectar lo nuevo, y la consume `App.tsx`, que enseña un popup por
 * premio, en orden. Store de módulo con suscriptores, como `level.ts`.
 *
 * Nada se guarda aquí: lo que ya se ha avisado se recuerda en ajustes
 * (`challengeWins` para los retos, `seenBadges` para los logros), así que un
 * premio no se repite aunque se reinicie la app.
 */
export type Award =
  | {
      kind: 'challenge';
      name: string;
      icon: string;
      description: string;
      xp: number;
    }
  | {
      kind: 'badge';
      name: string;
      icon: string;
      description: string;
      xp: number;
    }
  | { kind: 'level'; level: number };

type Listener = () => void;
const listeners = new Set<Listener>();
let queue: Award[] = [];

function emit() {
  for (const listener of Array.from(listeners)) listener();
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getQueue(): Award[] {
  return queue;
}

export function pushAwards(awards: Award[]): void {
  if (awards.length === 0) return;
  queue = [...queue, ...awards];
  emit();
}

/** Quita el primero de la cola (el popup que se acaba de cerrar). */
export function shiftAward(): void {
  if (queue.length === 0) return;
  queue = queue.slice(1);
  emit();
}

/** Cola de premios pendientes de avisar, reactiva. */
export function useAwards(): Award[] {
  return useSyncExternalStore(subscribe, getQueue, getQueue);
}
