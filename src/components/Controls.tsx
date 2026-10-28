import type { Step } from "../spec/schema";

type Props = {
  steps: Step[];
  index: number;
  onPrev: () => void;
  onNext: () => void;
  onGoTo: (index: number) => void;
  themeLabel: string;
  onToggleTheme: () => void;
};

export function Controls({
  steps,
  index,
  onPrev,
  onNext,
  onGoTo,
  themeLabel,
  onToggleTheme,
}: Props) {
  return (
    <nav className="ctrl" aria-label="Navigation dans le schéma">
      <div className="grp">
        <button type="button" onClick={onPrev} disabled={index === 0}>
          Précédent
        </button>
        <button
          type="button"
          className="primary"
          onClick={onNext}
          disabled={index === steps.length - 1}
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
        <button type="button" onClick={onToggleTheme}>
          {themeLabel}
        </button>
      </div>
    </nav>
  );
}
