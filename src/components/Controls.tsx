import { PLAYBACK_SPEEDS } from "../engine/autoplay";
import type { Step } from "../spec/schema";

/** `paused` : la lecture est armée mais suspendue (tiroir ou fenêtre ouverts). */
export type AutoplayState = "off" | "on" | "paused";

const AUTOPLAY_LABEL: Record<AutoplayState, string> = { off: "non", on: "oui", paused: "en pause" };

type Props = {
  steps: Step[];
  index: number;
  atStart: boolean;
  atEnd: boolean;
  progressive: boolean;
  onToggleProgressive: () => void;
  drawerOpen: boolean;
  onToggleDrawer: () => void;
  onPresent: () => void;
  laser: boolean;
  onToggleLaser: () => void;
  autoplay: AutoplayState;
  onTogglePlay: () => void;
  speed: string;
  onSpeed: (id: string) => void;
  onPrev: () => void;
  onNext: () => void;
  onGoTo: (index: number) => void;
  themeLabel: string;
  onToggleTheme: () => void;
};

export function Controls({
  steps,
  index,
  atStart,
  atEnd,
  progressive,
  onToggleProgressive,
  drawerOpen,
  onToggleDrawer,
  onPresent,
  laser,
  onToggleLaser,
  autoplay,
  onTogglePlay,
  speed,
  onSpeed,
  onPrev,
  onNext,
  onGoTo,
  themeLabel,
  onToggleTheme,
}: Props) {
  return (
    <nav className="ctrl" aria-label="Navigation dans le schéma">
      <div className="grp">
        <button
          type="button"
          onClick={onPrev}
          disabled={atStart}
          aria-keyshortcuts="ArrowLeft"
          title="Précédent (flèche gauche)"
        >
          Précédent
        </button>
        <button
          type="button"
          className="primary"
          onClick={onNext}
          disabled={atEnd}
          aria-keyshortcuts="ArrowRight Space"
          title="Suivant (flèche droite ou Espace)"
        >
          Suivant
        </button>
      </div>
      <ol className="dots">
        {steps.map((step, i) => (
          <li key={step.id}>
            <button
              type="button"
              onClick={() => onGoTo(i)}
              aria-current={i === index ? "step" : undefined}
              aria-label={`Étape ${i + 1} : ${step.title}`}
            >
              {i + 1}
            </button>
          </li>
        ))}
      </ol>
      <div className="grp">
        <button
          type="button"
          aria-pressed={progressive}
          title="Les éléments n’apparaissent qu’au fil des étapes. Sans effet sur la vue d’ensemble, qui montre tout."
          onClick={onToggleProgressive}
        >
          Construction progressive : {progressive ? "oui" : "non"}
        </button>
        <button
          type="button"
          aria-pressed={autoplay !== "off"}
          aria-keyshortcuts="A"
          title="Les étapes défilent toutes seules, le temps de lire chacune (A). Un clic sur Précédent, Suivant ou une pastille reprend la main."
          onClick={onTogglePlay}
        >
          Lecture auto : {AUTOPLAY_LABEL[autoplay]}
        </button>
        <select
          aria-label="Vitesse de la lecture auto"
          value={speed}
          onChange={(e) => onSpeed(e.target.value)}
        >
          {PLAYBACK_SPEEDS.map((option) => (
            <option key={option.id} value={option.id}>
              Vitesse : {option.label.toLowerCase()}
            </option>
          ))}
        </select>
        <button
          type="button"
          aria-pressed={laser}
          aria-keyshortcuts="L"
          title="Un point lumineux suit la souris, pour montrer un endroit (L)"
          onClick={onToggleLaser}
        >
          Pointeur laser : {laser ? "oui" : "non"}
        </button>
        <button
          type="button"
          id="present-toggle"
          onClick={onPresent}
          aria-keyshortcuts="P"
          title="Mode présentation (P ; Échap pour quitter)"
        >
          Mode présentation
        </button>
        <button
          type="button"
          id="spec-toggle"
          aria-expanded={drawerOpen}
          aria-controls="spec-drawer"
          onClick={onToggleDrawer}
        >
          Spec
        </button>
        <button type="button" onClick={onToggleTheme}>
          {themeLabel}
        </button>
      </div>
    </nav>
  );
}
