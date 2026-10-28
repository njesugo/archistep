import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Controls, type AutoplayState } from "./components/Controls";
import { DataPanels } from "./components/DataPanel";
import { LaserPointer } from "./components/LaserPointer";
import { SpecDrawer } from "./components/SpecDrawer";
import { Stage } from "./components/Stage";
import { StepCaption } from "./components/StepCaption";
import { downloadText, slugify } from "./download";
import { frameFor, minFrameWidth, stageAspect } from "./engine/camera";
import { parentMap } from "./engine/layout";
import { resolveFlow } from "./engine/flow";
import { DEFAULT_SPEED, dwellMs, speedFactor } from "./engine/autoplay";
import { litIds, positions, revealedIds } from "./engine/state";
import { resolveTheme, THEME_KEY, toggleTheme, type Theme } from "./theme";
import { useElementWidth } from "./useElementWidth";
import { useLayout } from "./useLayout";
import { useAutoAdvance } from "./useAutoAdvance";
import { useReducedMotion } from "./useReducedMotion";
import { useShortcuts } from "./useShortcuts";
import { useSpecEditor } from "./useSpecEditor";

// Chargé à la demande : la génération par IA (et son SDK) n'alourdit pas le premier affichage.
const GenerateDialog = lazy(() => import("./components/GenerateDialog"));
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  // Une fois ouverte, la fenêtre reste montée : elle garde la description, les images et le résultat.
  const [generateMounted, setGenerateMounted] = useState(false);
  // Un lien de partage illisible : on ouvre le tiroir, où l'erreur est expliquée.
  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const editor = useSpecEditor({ onLinkError: openDrawer });
  const [presenting, setPresenting] = useState(false);
  const [laser, setLaser] = useState(false);
  // Lecture automatique : les étapes défilent seules ; toute navigation à la main la coupe.
  const [playing, setPlaying] = useState(false);
  const [speedId, setSpeedId] = useState<string>(DEFAULT_SPEED);

  // Tout ce qui est affiché vient de la spec à laquelle appartient le placement : pendant un
  // nouveau calcul, l'ancien schéma reste à l'écran, cohérent avec sa légende.
  const layout = useLayout(editor.opening ? null : editor.spec);
  const spec = layout.status === "ready" ? layout.spec : editor.spec;
  const parents = useMemo(() => parentMap(spec), [spec]);
  const allPositions = useMemo(() => positions(spec), [spec]);

  const stepper = useStepper(allPositions, spec.steps.length);
  const step = spec.steps[stepper.step];
  const beat = step?.beats?.[stepper.beat];

  const { next, prev, first, goTo: goToStep, index, atEnd } = stepper;

  // Lecture automatique : un minuteur fait avancer d'un état quand le temps de lecture est écoulé.
  // Elle est suspendue pendant que le tiroir ou la fenêtre de génération sont ouverts, s'arrête
  // à la fin, et toute navigation à la main la coupe (on reprend la main).
  const lastIndex = allPositions.length - 1;
  const idle = !drawerOpen && !generateOpen;
  const autoplay: AutoplayState = !playing ? "off" : idle ? "on" : "paused";
  const advance = useCallback(() => {
    next();
    if (index + 1 >= lastIndex) setPlaying(false);
  }, [next, index, lastIndex]);
  const dwell = step ? dwellMs(step, beat, speedFactor(speedId)) : 0;
  useAutoAdvance(playing && idle, dwell, advance, index);
  const togglePlay = useCallback(() => {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (atEnd) first(); // relancer depuis la fin : on repart du début
    setPlaying(true);
  }, [playing, atEnd, first]);
  const goPrev = useCallback(() => {
    setPlaying(false);
    prev();
  }, [prev]);
  const goNext = useCallback(() => {
    setPlaying(false);
    next();
  }, [next]);
  const goFirst = useCallback(() => {
    setPlaying(false);
    first();
  }, [first]);
  const goTo = useCallback(
    (index: number) => {
      setPlaying(false);
      goToStep(index);
    },
    [goToStep],
  );

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

  // La caméra s'adapte à la largeur réelle de la scène (téléphone, tiroir ouvert, présentation).
  const [stageRef, stageWidth] = useElementWidth<HTMLElement>();
  const aspect = layoutReady && stageWidth ? stageAspect(layoutReady, stageWidth) : undefined;
  const frame = useMemo(
    () =>
      step && layoutReady && aspect
        ? frameFor(layoutReady, step.zoom, aspect, parents, minFrameWidth(stageWidth))
        : undefined,
    [step, layoutReady, aspect, parents, stageWidth],
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

  // Mode présentation : en-tête, tiroir et barre de contrôle masqués, texte agrandi ;
  // on avance au clavier. P bascule, Échap quitte.
  const present = useCallback(() => {
    setPresenting((on) => {
      if (!on) {
        setDrawerOpen(false);
        window.scrollTo(0, 0);
        // Pas d'anneau de focus visible pendant l'enregistrement.
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      }
      return !on;
    });
  }, []);
  const exitPresentation = useCallback(() => setPresenting(false), []);
  const toggleLaser = useCallback(() => setLaser((on) => !on), []);

  // En quittant le mode, le focus revient sur le bouton qui l'a ouvert.
  const wasPresenting = useRef(false);
  useEffect(() => {
    if (!presenting && wasPresenting.current) document.getElementById("present-toggle")?.focus();
    wasPresenting.current = presenting;
  }, [presenting]);

  const shortcuts = useMemo(
    () => ({
      next: goNext,
      prev: goPrev,
      first: goFirst,
      present,
      exit: exitPresentation,
      laser: toggleLaser,
      play: togglePlay,
    }),
    [goNext, goPrev, goFirst, present, exitPresentation, toggleLaser, togglePlay],
  );
  useShortcuts(shortcuts);

  /** Après un import ou le choix d'un exemple : on repart de la première étape. */
  function afterLoad(loaded: unknown) {
    if (!loaded) return;
    setPlaying(false);
    stepper.first();
    setOverride(null);
  }

  if (editor.opening) {
    return (
      <main className="page">
        <p className="stage-msg" role="status">
          Ouverture du lien de partage…
        </p>
      </main>
    );
  }

  if (!step) return null;

  return (
    <>
      <main
        className={["page", drawerOpen && "has-drawer", presenting && "presenting"]
          .filter(Boolean)
          .join(" ")}
      >
        <header className="head" lang={spec.meta.language}>
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
          measured={stageWidth > 0}
          lang={spec.meta.language}
          ref={stageRef}
        />
        <section
          className={(step.panelColumns ?? 1) > 1 ? "info wide" : "info"}
          lang={spec.meta.language}
        >
          <StepCaption step={step} index={stepper.step} count={stepper.count} beat={stepper.beat} />
          <DataPanels
            key={step.id}
            panels={step.panels}
            highlight={beat?.highlight}
            columns={step.panelColumns}
          />
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
          onPresent={present}
          laser={laser}
          onToggleLaser={toggleLaser}
          autoplay={autoplay}
          onTogglePlay={togglePlay}
          speed={speedId}
          onSpeed={setSpeedId}
          onPrev={goPrev}
          onNext={goNext}
          onGoTo={goTo}
          themeLabel={theme === "dark" ? "Thème clair" : "Thème sombre"}
          onToggleTheme={onToggleTheme}
        />
      </main>
      {presenting && (
        <button type="button" className="exit-presentation" onClick={exitPresentation}>
          Quitter le mode présentation
        </button>
      )}
      {generateMounted && (
        <Suspense fallback={null}>
          <GenerateDialog
            open={generateOpen}
            onClose={() => setGenerateOpen(false)}
            onUse={(json) => afterLoad(editor.load(json))}
          />
        </Suspense>
      )}
      <LaserPointer active={laser} />
      <SpecDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        text={editor.text}
        onTextChange={editor.setText}
        errors={editor.errors}
        spec={editor.spec}
        fromLink={editor.fromLink}
        onImport={(text) => afterLoad(editor.load(text))}
        onExport={() =>
          downloadText(
            `${slugify(editor.spec.meta.title)}.json`,
            JSON.stringify(editor.spec, null, 2),
          )
        }
        onLoadExample={(id) => afterLoad(editor.loadExample(id))}
        onGenerate={() => {
          setGenerateMounted(true);
          setGenerateOpen(true);
        }}
      />
    </>
  );
}
