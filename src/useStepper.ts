import { useCallback, useEffect, useState } from "react";
import { clampStep, keyAction } from "./engine/state";

/** Éléments où les touches servent à autre chose qu'à naviguer. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export function useStepper(count: number) {
  const [raw, setRaw] = useState(0);
  const index = clampStep(raw, count);

  const goTo = useCallback((i: number) => setRaw(clampStep(i, count)), [count]);
  const next = useCallback(() => setRaw((i) => clampStep(i + 1, count)), [count]);
  const prev = useCallback(() => setRaw((i) => clampStep(i - 1, count)), [count]);
  const first = useCallback(() => setRaw(0), []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return;
      const onButton = e.target instanceof HTMLElement && e.target.closest("button, a") !== null;
      const action = keyAction(e.key, onButton);
      if (!action) return;
      if (e.key === " ") e.preventDefault(); // pas de défilement de la page
      ({ next, prev, first })[action]();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [next, prev, first]);

  return { index, count, goTo, next, prev, first };
}
