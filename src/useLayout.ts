import { useEffect, useState } from "react";
import { computeLayout, type Layout } from "./engine/layout";
import type { Spec } from "./spec/schema";

export type LayoutState =
  | { status: "loading" }
  | { status: "ready"; layout: Layout }
  | { status: "error"; message: string };

export function useLayout(spec: Spec): LayoutState {
  // Le résultat est rangé avec la spec qui l'a produit : tant qu'il ne correspond pas, on charge.
  const [done, setDone] = useState<{ spec: Spec; state: LayoutState } | null>(null);

  useEffect(() => {
    let cancelled = false;
    computeLayout(spec).then(
      (layout) => !cancelled && setDone({ spec, state: { status: "ready", layout } }),
      (error: unknown) =>
        !cancelled &&
        setDone({
          spec,
          state: {
            status: "error",
            message: error instanceof Error ? error.message : String(error),
          },
        }),
    );
    return () => {
      cancelled = true;
    };
  }, [spec]);

  return done?.spec === spec ? done.state : { status: "loading" };
}
