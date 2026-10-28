import type { Step } from "../spec/schema";

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
