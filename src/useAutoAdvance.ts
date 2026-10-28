import { useEffect } from "react";

/**
 * Appelle `onAdvance` une fois `delay` ms écoulées, tant que `active`. Le compte à rebours repart
 * à zéro quand `key` change (on a changé d'état, à la main ou automatiquement) et s'arrête net
 * quand `active` devient faux ou que le composant disparaît : aucun minuteur ne reste en attente.
 */
export function useAutoAdvance(
  active: boolean,
  delay: number,
  onAdvance: () => void,
  key: unknown,
) {
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(onAdvance, delay);
    return () => clearTimeout(timer);
  }, [active, delay, onAdvance, key]);
}
