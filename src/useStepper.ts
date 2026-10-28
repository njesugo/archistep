import { useCallback, useEffect, useState } from "react";
import { clampStep, firstIndexOfStep, keyAction, type Position } from "./engine/state";

/** Éléments où les touches servent à autre chose qu'à naviguer. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/**
 * Navigation dans la liste des états (étapes et sous-étapes). `count` est le nombre d'étapes :
 * les pastilles désignent les étapes, pas les sous-étapes.
 */
export function useStepper(all: Position[], stepCount: number) {
  const [raw, setRaw] = useState(0);
  const last = all.length - 1;
  const index = clampStep(raw, all.length);
  const position = all[index] ?? { step: 0, beat: 0 };

  const goTo = useCallback((step: number) => setRaw(firstIndexOfStep(all, step)), [all]);
  const next = useCallback(() => setRaw((i) => clampStep(i + 1, all.length)), [all.length]);
  const prev = useCallback(() => setRaw((i) => clampStep(i - 1, all.length)), [all.length]);
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

  return {
    index,
    step: position.step,
    beat: position.beat,
    count: stepCount,
    atStart: index === 0,
    atEnd: index === last,
    goTo,
    next,
    prev,
    first,
  };
}
