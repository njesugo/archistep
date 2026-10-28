import { useEffect, useMemo, useState } from "react";
import { Controls } from "./components/Controls";
import { DataPanels } from "./components/DataPanel";
import { SpecDrawer } from "./components/SpecDrawer";
import { Stage } from "./components/Stage";
import { StepCaption } from "./components/StepCaption";
import { downloadText, slugify } from "./download";
import { frameFor, stageAspect } from "./engine/camera";
import { parentMap } from "./engine/layout";
import { resolveFlow } from "./engine/flow";
import { litIds, positions, revealedIds } from "./engine/state";
import { resolveTheme, THEME_KEY, toggleTheme, type Theme } from "./theme";
import { useLayout } from "./useLayout";
import { useReducedMotion } from "./useReducedMotion";
import { useSpecEditor } from "./useSpecEditor";
import { useStepper } from "./useStepper";

function readStoredTheme(): string | null {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch {
    return null;
  }
}

export default function App() {
  const [theme, setTheme] = useState<Theme>(() =>
    resolveTheme(readStoredTheme(), window.matchMedia("(prefers-color-scheme: dark)").matches),
  );
  const editor = useSpecEditor();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Tout ce qui est affiché vient de la spec à laquelle appartient le placement : pendant un
  // nouveau calcul, l'ancien schéma reste à l'écran, cohérent avec sa légende.
  const layout = useLayout(editor.spec);
  const spec = layout.status === "ready" ? layout.spec : editor.spec;
  const parents = useMemo(() => parentMap(spec), [spec]);
  const allPositions = useMemo(() => positions(spec), [spec]);

  const stepper = useStepper(allPositions, spec.steps.length);
  const step = spec.steps[stepper.step];
  const beat = step?.beats?.[stepper.beat];

  // Construction progressive : l'option de la spec, que le bouton peut remplacer le temps de la
  // session (jusqu'au prochain chargement de spec).
  const [override, setOverride] = useState<boolean | null>(null);
  const progressive = override ?? spec.meta.buildMode === "progressive";

  const lit = useMemo(() => (step ? litIds(spec, step, beat) : null), [spec, step, beat]);
  const revealed = useMemo(
    () => revealedIds(spec, allPositions, stepper.index, progressive),
    [spec, allPositions, stepper.index, progressive],
  );

  const reduceMotion = useReducedMotion();
  const layoutReady = layout.status === "ready" ? layout.layout : null;
  // Sans mouvement : ni paquets ni impulsion.
  const flow = useMemo(
    () => (step && layoutReady && !reduceMotion ? resolveFlow(spec, step, layoutReady) : null),
    [spec, step, layoutReady, reduceMotion],
  );

  const aspect = layoutReady ? stageAspect(layoutReady) : undefined;
  const frame = useMemo(
    () =>
      step && layoutReady && aspect ? frameFor(layoutReady, step.zoom, aspect, parents) : undefined,
    [step, layoutReady, aspect, parents],
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    document.title = `${spec.meta.title} · ArchiStep`;
  }, [spec.meta.title]);

  function onToggleTheme() {
    const next = toggleTheme(theme);
    setTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // stockage indisponible : le choix vaut pour la session seulement
    }
  }

  /** Après un import ou le choix d'un exemple : on repart de la première étape. */
  function afterLoad(loaded: unknown) {
    if (!loaded) return;
    stepper.first();
    setOverride(null);
  }

  if (!step) return null;

  return (
    <>
      <main className={drawerOpen ? "page has-drawer" : "page"}>
        <header className="head">
          {spec.meta.subtitle && <p className="eyebrow">{spec.meta.subtitle}</p>}
          <h1>{spec.meta.title}</h1>
        </header>
        <Stage
          layout={layout}
          lit={lit}
          revealed={revealed}
          flow={flow}
          frame={frame}
          animateCamera={!reduceMotion}
          aspect={aspect}
        />
        <section className="info">
          <StepCaption step={step} index={stepper.step} count={stepper.count} beat={stepper.beat} />
          <DataPanels key={step.id} panels={step.panels} highlight={beat?.highlight} />
        </section>
        <Controls
          steps={spec.steps}
          index={stepper.step}
          atStart={stepper.atStart}
          atEnd={stepper.atEnd}
          progressive={progressive}
          onToggleProgressive={() => setOverride(!progressive)}
          drawerOpen={drawerOpen}
          onToggleDrawer={() => setDrawerOpen((open) => !open)}
          onPrev={stepper.prev}
          onNext={stepper.next}
          onGoTo={stepper.goTo}
          themeLabel={theme === "dark" ? "Thème clair" : "Thème sombre"}
          onToggleTheme={onToggleTheme}
        />
      </main>
      <SpecDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        text={editor.text}
        onTextChange={editor.setText}
        errors={editor.errors}
        spec={editor.spec}
        onImport={(text) => afterLoad(editor.load(text))}
        onExport={() =>
          downloadText(
            `${slugify(editor.spec.meta.title)}.json`,
            JSON.stringify(editor.spec, null, 2),
          )
        }
        onLoadExample={(id) => afterLoad(editor.loadExample(id))}
      />
    </>
  );
}
