import type { Step } from "../spec/schema";

type Props = {
  step: Step;
  index: number;
  count: number;
  /** Sous-étape courante (0-based) ; le compteur « 2/3 » n'apparaît que s'il y en a plusieurs. */
  beat?: number;
};

export function StepCaption({ step, index, count, beat = 0 }: Props) {
  const beats = step.beats ?? [];
  const text = beats[beat]?.text ?? step.text;
  return (
    <div className="cap" aria-live="polite">
      <p className="count">
        Étape {index + 1} sur {count}
        {beats.length > 1 && (
          <span className="beat-count">
            {" "}
            · {beat + 1}/{beats.length}
          </span>
        )}
      </p>
      <h2>{step.title}</h2>
      <p className="step-text">{text}</p>
    </div>
  );
}
