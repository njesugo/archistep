import { useCallback, useState } from "react";
import { clampStep, firstIndexOfStep, type Position } from "./engine/state";

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
