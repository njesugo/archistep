import { useEffect, useState } from "react";
import { computeLayout, type Layout } from "./engine/layout";
import type { Spec } from "./spec/schema";

/**
 * `ready` porte la spec à laquelle le placement appartient : pendant qu'un nouveau calcul
 * tourne, c'est l'ancienne paire (spec, placement) qui reste affichée, sans clignotement.
 */
export type LayoutState =
  | { status: "loading" }
  | { status: "ready"; spec: Spec; layout: Layout }
  | { status: "error"; message: string };

export function useLayout(spec: Spec): LayoutState {
  const [done, setDone] = useState<{ spec: Spec; layout: Layout } | null>(null);
  const [failed, setFailed] = useState<{ spec: Spec; message: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    computeLayout(spec).then(
      (layout) => {
        if (cancelled) return;
        setDone({ spec, layout });
        setFailed(null);
      },
      (error: unknown) => {
        if (cancelled) return;
        setFailed({ spec, message: error instanceof Error ? error.message : String(error) });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [spec]);

  if (failed?.spec === spec) return { status: "error", message: failed.message };
  if (done) return { status: "ready", ...done };
  return { status: "loading" };
}
