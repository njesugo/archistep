import { useEffect, useMemo, useState } from "react";
import example from "./examples/youtube-pipeline.json";
import { Controls } from "./components/Controls";
import { DataPanels } from "./components/DataPanel";
import { Stage } from "./components/Stage";
import { StepCaption } from "./components/StepCaption";
import { resolveFlow } from "./engine/flow";
import { litIds } from "./engine/state";
import { validateSpec } from "./spec/validate";
import { resolveTheme, THEME_KEY, toggleTheme, type Theme } from "./theme";
import { useLayout } from "./useLayout";
import { useReducedMotion } from "./useReducedMotion";
import { useStepper } from "./useStepper";

function readStoredTheme(): string | null {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch {
    return null;
  }
}

// Pour l'instant : l'exemple intégré. Le tiroir Spec (M8) permettra d'en charger d'autres.
const parsed = validateSpec(example);
if (!parsed.ok) throw new Error(parsed.errors.map((e) => e.message).join("\n"));
const spec = parsed.spec;

export default function App() {
  const [theme, setTheme] = useState<Theme>(() =>
    resolveTheme(readStoredTheme(), window.matchMedia("(prefers-color-scheme: dark)").matches),
  );
  const layout = useLayout(spec);
  const stepper = useStepper(spec.steps.length);
  const step = spec.steps[stepper.index];
  const lit = useMemo(() => (step ? litIds(spec, step) : null), [step]);

  const reduceMotion = useReducedMotion();
  const layoutReady = layout.status === "ready" ? layout.layout : null;
  // Sans mouvement : ni paquets ni impulsion.
  const flow = useMemo(
    () => (step && layoutReady && !reduceMotion ? resolveFlow(spec, step, layoutReady) : null),
    [step, layoutReady, reduceMotion],
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  function onToggleTheme() {
    const next = toggleTheme(theme);
    setTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // stockage indisponible : le choix vaut pour la session seulement
    }
  }

  if (!step) return null;

  return (
    <main className="page">
      <header className="head">
        {spec.meta.subtitle && <p className="eyebrow">{spec.meta.subtitle}</p>}
        <h1>{spec.meta.title}</h1>
      </header>
      <Stage spec={spec} layout={layout} lit={lit} flow={flow} />
      <section className="info">
        <StepCaption step={step} index={stepper.index} count={stepper.count} />
        <DataPanels key={step.id} panels={step.panels} />
      </section>
      <Controls
        steps={spec.steps}
        index={stepper.index}
        onPrev={stepper.prev}
        onNext={stepper.next}
        onGoTo={stepper.goTo}
        themeLabel={theme === "dark" ? "Thème clair" : "Thème sombre"}
        onToggleTheme={onToggleTheme}
      />
    </main>
  );
}
