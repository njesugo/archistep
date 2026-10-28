import type { ReactNode, Ref } from "react";
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
  flows: ResolvedFlow[];
  frame: Frame | undefined;
  animateCamera: boolean;
  aspect: number | undefined;
  /** Largeur de la scène mesurée : la caméra en dépend, donc on attend de la connaître. */
  measured: boolean;
  /** Langue du contenu de la spec, si elle diffère de celle de l'interface. */
  lang?: string;
  /** Plein écran sur le schéma ; le bouton se cache pendant la présentation (la touche F reste). */
  fullscreen: { supported: boolean; active: boolean; onToggle: () => void; showButton: boolean };
  /** Vue libre en plein écran : « Tout » revient à la vue d'ensemble quand on s'en est écarté. */
  zoom?: { zoomed: boolean; onReset: () => void };
  /** Éléments à garder visibles en plein écran (seul ce qui est dans le cadre l'est). */
  children?: ReactNode;
  ref?: Ref<HTMLElement>;
};

function FullscreenIcon({ active }: { active: boolean }) {
  // Quatre coins qui s'écartent (entrer) ou se rapprochent (sortir).
  const d = active
    ? "M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"
    : "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5";
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Cadre du schéma : placement en cours, erreur, ou scène. */
export function Stage({
  layout,
  lit,
  revealed,
  flows,
  frame,
  animateCamera,
  aspect,
  measured,
  lang,
  fullscreen,
  zoom,
  children,
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
            flows={flows}
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
      {fullscreen.supported && showScene && (fullscreen.showButton || fullscreen.active) && (
        <button
          type="button"
          className="stage-fullscreen"
          aria-pressed={fullscreen.active}
          aria-keyshortcuts="F"
          aria-label={fullscreen.active ? "Quitter le plein écran" : "Plein écran sur le schéma"}
          title={
            fullscreen.active ? "Quitter le plein écran (Échap)" : "Le schéma en plein écran (F)"
          }
          onClick={fullscreen.onToggle}
        >
          <FullscreenIcon active={fullscreen.active} />
        </button>
      )}
      {fullscreen.active && zoom?.zoomed && (
        <button
          type="button"
          className="stage-reset"
          aria-keyshortcuts="0"
          title="Revoir tout le schéma (0)"
          onClick={zoom.onReset}
        >
          Tout
        </button>
      )}
      {children}
    </section>
  );
}
