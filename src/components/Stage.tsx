import type { Frame } from "../engine/camera";
import type { ResolvedFlow } from "../engine/flow";
import type { Layout } from "../engine/layout";
import type { LayoutState } from "../useLayout";
import { Scene } from "./Scene";

// Chaque nouveau placement redémarre la scène : la caméra ne glisse pas d'un schéma à un autre.
const layoutIds = new WeakMap<Layout, number>();
let nextLayoutId = 0;
function layoutId(layout: Layout): number {
  let id = layoutIds.get(layout);
  if (id === undefined) layoutIds.set(layout, (id = nextLayoutId++));
  return id;
}

type Props = {
  layout: LayoutState;
  lit: ReadonlySet<string> | null;
  revealed: ReadonlySet<string> | null;
  flow: ResolvedFlow | null;
  frame: Frame | undefined;
  animateCamera: boolean;
  aspect: number | undefined;
};

/** Cadre du schéma : placement en cours, erreur, ou scène. */
export function Stage({ layout, lit, revealed, flow, frame, animateCamera, aspect }: Props) {
  return (
    <section className="stage" aria-label="Schéma de l’architecture">
      <div className="scroll">
        {layout.status === "ready" && (
          <Scene
            key={layoutId(layout.layout)}
            spec={layout.spec}
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
