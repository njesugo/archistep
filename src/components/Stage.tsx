import type { ResolvedFlow } from "../engine/flow";
import type { Spec } from "../spec/schema";
import type { LayoutState } from "../useLayout";
import { Scene } from "./Scene";

/** Cadre du schéma : placement en cours, erreur, ou scène. */
export function Stage({
  spec,
  layout,
  lit,
  flow,
}: {
  spec: Spec;
  layout: LayoutState;
  lit: ReadonlySet<string> | null;
  flow: ResolvedFlow | null;
}) {
  return (
    <section className="stage" aria-label="Schéma de l’architecture">
      <div className="scroll">
        {layout.status === "ready" && (
          <Scene spec={spec} layout={layout.layout} lit={lit} flow={flow} />
        )}
        {layout.status === "loading" && <p className="stage-msg">Calcul du placement…</p>}
        {layout.status === "error" && (
          <p className="stage-msg" role="alert">
            Placement impossible : {layout.message}
          </p>
        )}
      </div>
    </section>
  );
}
