import type { Step } from "../spec/schema";

export function StepCaption({ step, index, count }: { step: Step; index: number; count: number }) {
  return (
    <div className="cap" aria-live="polite">
      <p className="count">
        Étape {index + 1} sur {count}
      </p>
      <h2>{step.title}</h2>
      <p className="step-text">{step.text}</p>
    </div>
  );
}
