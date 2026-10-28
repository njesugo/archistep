import type { Frame } from "../engine/camera";
import type { ResolvedFlow } from "../engine/flow";
import type { Spec } from "../spec/schema";
import type { LayoutState } from "../useLayout";
import { Scene } from "./Scene";

/** Cadre du schéma : placement en cours, erreur, ou scène. */
export function Stage({
  spec,
  layout,
  lit,
  revealed,
  flow,
  frame,
  animateCamera,
  aspect,
}: {
  spec: Spec;
  layout: LayoutState;
  lit: ReadonlySet<string> | null;
  revealed: ReadonlySet<string> | null;
  flow: ResolvedFlow | null;
  frame: Frame | undefined;
  animateCamera: boolean;
  aspect: number | undefined;
}) {
  return (
    <section className="stage" aria-label="Schéma de l’architecture">
      <div className="scroll">
        {layout.status === "ready" && (
          <Scene
            spec={spec}
            layout={layout.layout}
            lit={lit}
            revealed={revealed}
            flow={flow}
            frame={frame}
            animateCamera={animateCamera}
            aspect={aspect}
          />
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
