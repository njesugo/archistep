import type { Step } from "../spec/schema";

type Props = {
  steps: Step[];
  index: number;
  atStart: boolean;
  atEnd: boolean;
  progressive: boolean;
  onToggleProgressive: () => void;
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
  onPrev,
  onNext,
  onGoTo,
  themeLabel,
  onToggleTheme,
}: Props) {
  return (
    <nav className="ctrl" aria-label="Navigation dans le schéma">
      <div className="grp">
        <button type="button" onClick={onPrev} disabled={atStart}>
          Précédent
        </button>
        <button type="button" className="primary" onClick={onNext} disabled={atEnd}>
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
        <button type="button" onClick={onToggleTheme}>
          {themeLabel}
        </button>
      </div>
    </nav>
  );
}
