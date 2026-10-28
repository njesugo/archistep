import type { Ref } from "react";
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
  /** Largeur de la scène mesurée : la caméra en dépend, donc on attend de la connaître. */
  measured: boolean;
  /** Langue du contenu de la spec, si elle diffère de celle de l'interface. */
  lang?: string;
  ref?: Ref<HTMLElement>;
};

/** Cadre du schéma : placement en cours, erreur, ou scène. */
export function Stage({
  layout,
  lit,
  revealed,
  flow,
  frame,
  animateCamera,
  aspect,
  measured,
  lang,
  ref,
}: Props) {
  const showScene = layout.status === "ready" && measured;
  return (
    <section ref={ref} className="stage" aria-label="Schéma de l’architecture" lang={lang}>
      <div className="scroll">
        {showScene && (
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
        {(layout.status === "loading" || (layout.status === "ready" && !measured)) && (
          <p className="stage-msg">Calcul du placement…</p>
        )}
        {layout.status === "error" && (
          <p className="stage-msg" role="alert">
            Placement impossible : {layout.message}
          </p>
        )}
      </div>
    </section>
  );
}
