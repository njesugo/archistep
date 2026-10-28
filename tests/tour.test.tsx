import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import example from "../src/examples/youtube-pipeline.json";
import azure from "./fixtures/azure.json";
import { Controls, type AutoplayState } from "../src/components/Controls";
import { Scene } from "../src/components/Scene";
import { Stage } from "../src/components/Stage";
import { resolveAllFlows, resolveFlow } from "../src/engine/flow";
import { computeLayout } from "../src/engine/layout";
import { litIds } from "../src/engine/state";
import { nextTourIndex, TOUR_STEP_MS, tourDwellMs, tourSteps } from "../src/engine/tour";
import type { Spec } from "../src/spec/schema";
import { validateSpec } from "../src/spec/validate";

function load(input: unknown): Spec {
  const result = validateSpec(input);
  if (!result.ok) throw new Error(result.errors.map((e) => e.message).join("\n"));
  return result.spec;
}
const spec = load(example);
const azureSpec = load(azure);

describe("étapes du parcours", () => {
  it("garde les étapes qui éclairent quelque chose, dans l'ordre", () => {
    // la première étape de l'exemple est la vue d'ensemble (focus vide)
    expect(spec.steps[0]!.focus).toEqual([]);
    const indices = tourSteps(spec);
    expect(indices).toEqual([1, 2, 3, 4, 5, 6]);
    for (const i of indices) expect(spec.steps[i]!.focus.length).toBeGreaterThan(0);
  });

  it("peut être vide quand aucune étape n'éclaire quoi que ce soit", () => {
    const bare = { ...spec, steps: spec.steps.map((s) => ({ ...s, focus: [] })) };
    expect(tourSteps(bare)).toEqual([]);
  });

  it("enchaîne la dernière étape sur la première, à l'infini", () => {
    expect(nextTourIndex(0, 3)).toBe(1);
    expect(nextTourIndex(1, 3)).toBe(2);
    expect(nextTourIndex(2, 3)).toBe(0);
    let i = 0;
    for (let n = 0; n < 1000; n++) i = nextTourIndex(i, 6);
    expect(i).toBe(1000 % 6);
  });

  it("reste sur 0 quand il n'y a rien à parcourir", () => {
    expect(nextTourIndex(0, 0)).toBe(0);
    expect(nextTourIndex(5, 0)).toBe(0);
  });

  it("dure 4 s par étape, multipliées par la vitesse", () => {
    expect(TOUR_STEP_MS).toBe(4000);
    expect(tourDwellMs(1)).toBe(4000);
    expect(tourDwellMs(1.5)).toBe(6000);
    expect(tourDwellMs(0.65)).toBe(2600);
  });
});

describe("tous les flux ensemble", () => {
  it("renvoie un flux par lien, sans doublon, dans l'ordre des étapes", async () => {
    const layout = await computeLayout(spec);
    const flows = resolveAllFlows(spec, layout);
    expect(flows.map((f) => f.edgeId)).toEqual(["e1", "e2", "t1", "e3", "e4"]);
    expect(new Set(flows.map((f) => f.edgeId)).size).toBe(flows.length);
  });

  it("reprend les mêmes réglages que le flux de l'étape", async () => {
    const layout = await computeLayout(spec);
    const all = resolveAllFlows(spec, layout);
    for (const step of spec.steps) {
      const one = resolveFlow(spec, step, layout);
      if (!one) continue;
      expect(all.find((f) => f.edgeId === one.edgeId)).toEqual(one);
    }
  });

  it("ne garde qu'un flux quand deux étapes animent le même lien", async () => {
    const layout = await computeLayout(spec);
    const twice = {
      ...spec,
      steps: [...spec.steps, { ...spec.steps[2]!, id: "doublon" }],
    };
    expect(resolveAllFlows(twice, layout)).toHaveLength(resolveAllFlows(spec, layout).length);
  });

  it("est vide pour une spec sans flux", async () => {
    const layout = await computeLayout(azureSpec);
    expect(resolveAllFlows(azureSpec, layout)).toEqual([]);
  });
});

describe("rendu de l'animation continue", () => {
  it("dessine tous les flux et atténue ceux dont le lien n'est pas éclairé", async () => {
    const layout = await computeLayout(spec);
    const flows = resolveAllFlows(spec, layout);
    const lit = litIds(spec, spec.steps[2]!)!; // ingestion : éclaire e1
    const html = renderToStaticMarkup(
      <Scene spec={spec} layout={layout} lit={lit} flows={flows} />,
    );
    expect(html.match(/class="packets/g)).toHaveLength(flows.length);
    // seul le flux du lien éclairé garde sa pleine intensité
    expect(html.match(/class="packets"/g)).toHaveLength(1);
    expect(html.match(/class="packets dim"/g)).toHaveLength(flows.length - 1);
  });

  it("ne dessine qu'une impulsion en pleine intensité (le lien de déclenchement éclairé)", async () => {
    const layout = await computeLayout(spec);
    const flows = resolveAllFlows(spec, layout);
    const orchestration = spec.steps.find((s) => s.id === "orchestration")!;
    const lit = litIds(spec, orchestration)!;
    const html = renderToStaticMarkup(
      <Scene spec={spec} layout={layout} lit={lit} flows={flows} />,
    );
    expect(html.match(/class="pulse"/g)).toHaveLength(1);
    const other = renderToStaticMarkup(
      <Scene spec={spec} layout={layout} lit={litIds(spec, spec.steps[2]!)!} flows={flows} />,
    );
    expect(other).toContain('class="pulse dim"');
    expect(other).not.toContain('class="pulse"');
  });

  it("sans mise en valeur, tous les flux sont en pleine intensité", async () => {
    const layout = await computeLayout(spec);
    const flows = resolveAllFlows(spec, layout);
    const html = renderToStaticMarkup(<Scene spec={spec} layout={layout} flows={flows} />);
    expect(html).not.toContain("packets dim");
    expect(html.match(/class="packets"/g)).toHaveLength(flows.length);
  });
});

describe("bouton Animation continue", () => {
  const render = (animation: AutoplayState) =>
    renderToStaticMarkup(
      <Controls
        steps={spec.steps}
        index={0}
        atStart
        atEnd={false}
        progressive={false}
        onToggleProgressive={() => {}}
        drawerOpen={false}
        onToggleDrawer={() => {}}
        onPresent={() => {}}
        laser={false}
        onToggleLaser={() => {}}
        autoplay="off"
        onTogglePlay={() => {}}
        animation={animation}
        onToggleAnimation={() => {}}
        speed="normal"
        onSpeed={() => {}}
        onPrev={() => {}}
        onNext={() => {}}
        onGoTo={() => {}}
        themeLabel="Thème sombre"
        onToggleTheme={() => {}}
      />,
    );

  it("montre son état et annonce son raccourci", () => {
    expect(render("off")).toMatch(
      /aria-pressed="false"[^>]*aria-keyshortcuts="C"[^>]*>Animation continue : non/,
    );
    expect(render("on")).toMatch(
      /aria-pressed="true"[^>]*aria-keyshortcuts="C"[^>]*>Animation continue : oui/,
    );
    expect(render("paused")).toMatch(/aria-pressed="true"[^>]*>Animation continue : en pause/);
  });
});

describe("plein écran sur le schéma", () => {
  const ready = async () => {
    const layout = await computeLayout(spec);
    return { status: "ready" as const, spec, layout };
  };
  const render = async (fullscreen: { supported: boolean; active: boolean; showButton: boolean }) =>
    renderToStaticMarkup(
      <Stage
        layout={await ready()}
        lit={null}
        revealed={null}
        flows={[]}
        frame={undefined}
        animateCamera={false}
        aspect={undefined}
        measured
        fullscreen={{ ...fullscreen, onToggle: () => {} }}
      />,
    );

  it("propose un bouton dans le coin du schéma, annoncé avec son raccourci", async () => {
    const html = await render({ supported: true, active: false, showButton: true });
    expect(html).toContain('class="stage-fullscreen"');
    expect(html).toContain('aria-label="Plein écran sur le schéma"');
    expect(html).toContain('aria-keyshortcuts="F"');
    expect(html).toContain('aria-pressed="false"');
  });

  it("devient « Quitter le plein écran » une fois actif", async () => {
    const html = await render({ supported: true, active: true, showButton: true });
    expect(html).toContain('aria-label="Quitter le plein écran"');
    expect(html).toContain('aria-pressed="true"');
  });

  it("disparaît là où le navigateur ne sait pas faire de plein écran", async () => {
    expect(await render({ supported: false, active: false, showButton: true })).not.toContain(
      "stage-fullscreen",
    );
  });

  it("se cache pendant la présentation, sauf pour permettre d'en sortir", async () => {
    expect(await render({ supported: true, active: false, showButton: false })).not.toContain(
      "stage-fullscreen",
    );
    expect(await render({ supported: true, active: true, showButton: false })).toContain(
      "stage-fullscreen",
    );
  });
});
