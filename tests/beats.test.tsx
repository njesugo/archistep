import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import example from "../src/examples/youtube-pipeline.json";
import { DataPanels } from "../src/components/DataPanel";
import { Scene } from "../src/components/Scene";
import { StepCaption } from "../src/components/StepCaption";
import { computeLayout } from "../src/engine/layout";
import {
  cellHighlighted,
  hasCodeHighlight,
  hasTableHighlight,
  lineHighlighted,
} from "../src/engine/highlight";
import { firstIndexOfStep, litIds, positions, revealedIds } from "../src/engine/state";
import type { Spec } from "../src/spec/schema";
import { validateSpec } from "../src/spec/validate";

const parsed = validateSpec(example);
if (!parsed.ok) throw new Error("exemple invalide");
const spec = parsed.spec;
const step = (id: string) => spec.steps.find((s) => s.id === id)!;
const all = positions(spec);
const indexOf = (id: string, beat = 0) =>
  all.findIndex((p) => spec.steps[p.step]!.id === id && p.beat === beat);
const sorted = (set: Set<string> | null) => (set ? [...set].sort() : null);

describe("exemple", () => {
  it("a au moins une étape avec trois sous-étapes", () => {
    expect(spec.steps.some((s) => s.beats?.length === 3)).toBe(true);
  });

  it("définit la vue d'ensemble par un focus vide", () => {
    expect(step("apercu").focus).toEqual([]);
  });
});

describe("états (étapes et sous-étapes)", () => {
  it("compte une étape sans sous-étape pour un état, sinon une par sous-étape", () => {
    const beatCount = spec.steps.reduce((n, s) => n + Math.max(s.beats?.length ?? 0, 1), 0);
    expect(all).toHaveLength(beatCount);
    expect(all.length).toBeGreaterThan(spec.steps.length);
    expect(all[0]).toEqual({ step: 0, beat: 0 });
  });

  it("parcourt d'abord les sous-étapes, dans l'ordre", () => {
    const i = indexOf("bronze");
    expect(all.slice(i, i + 4).map((p) => [spec.steps[p.step]!.id, p.beat])).toEqual([
      ["bronze", 0],
      ["bronze", 1],
      ["bronze", 2],
      ["orchestration", 0],
    ]);
  });

  it("mène une pastille à la première sous-étape de l'étape", () => {
    const stepIndex = spec.steps.findIndex((s) => s.id === "bronze");
    expect(firstIndexOfStep(all, stepIndex)).toBe(indexOf("bronze", 0));
    expect(firstIndexOfStep(all, 999)).toBe(0);
  });

  it("construit les états d'une spec quelconque", () => {
    const small = {
      ...spec,
      steps: [
        { id: "a", title: "a", text: "a", focus: [] },
        { id: "b", title: "b", text: "b", focus: [], beats: [{}, {}] },
      ],
    } as Spec;
    expect(positions(small)).toEqual([
      { step: 0, beat: 0 },
      { step: 1, beat: 0 },
      { step: 1, beat: 1 },
    ]);
  });
});

describe("mise en valeur par sous-étape", () => {
  it("remplace le focus de l'étape par celui de la sous-étape (groupes ancêtres inclus)", () => {
    const bronze = step("bronze");
    expect(sorted(litIds(spec, bronze))).toEqual(["br", "e2", "fv", "ing"]);
    expect(sorted(litIds(spec, bronze, bronze.beats![1]))).toEqual(["br", "ing"]);
  });

  it("garde le focus de l'étape quand la sous-étape n'en précise pas", () => {
    const silver = step("silver");
    expect(sorted(litIds(spec, silver, silver.beats![0]))).toEqual(sorted(litIds(spec, silver)));
  });

  it("n'atténue rien si le focus de la sous-étape est vide", () => {
    expect(litIds(spec, step("bronze"), { focus: [] })).toBeNull();
  });
});

describe("construction progressive", () => {
  it("montre tout hors du mode progressif", () => {
    expect(revealedIds(spec, all, indexOf("silver"), false)).toBeNull();
  });

  it("montre tout sur la vue d'ensemble, même en mode progressif", () => {
    expect(revealedIds(spec, all, 0, true)).toBeNull();
  });

  it("ne révèle que ce que les états précédents et courant ont éclairé", () => {
    expect(sorted(revealedIds(spec, all, indexOf("source"), true))).toEqual(["ing", "yt"]);
    expect(sorted(revealedIds(spec, all, indexOf("ingestion"), true))).toEqual([
      "e1",
      "fv",
      "ing",
      "yt",
    ]);
  });

  it("garde ce qui est apparu quand on avance", () => {
    const later = revealedIds(spec, all, indexOf("silver"), true)!;
    for (const id of ["yt", "fv", "br", "e1", "e2", "sv", "e3", "af", "dbt", "t1"]) {
      expect(later.has(id), id).toBe(true);
    }
    expect(later.has("gd")).toBe(false); // Gold n'est pas encore venu
    expect(later.has("e4")).toBe(false);
  });

  it("révèle sous-étape par sous-étape", () => {
    // Bronze : la première sous-étape éclaire fv, e2, br ; ils sont déjà révélés avec l'étape précédente
    const beat0 = revealedIds(spec, all, indexOf("bronze", 0), true)!;
    expect(beat0.has("br")).toBe(true);
    // un état dont le focus ajoute un élément nouveau le fait apparaître à ce moment-là
    const custom = {
      ...spec,
      steps: [
        {
          id: "a",
          title: "a",
          text: "a",
          focus: ["yt"],
          beats: [{ focus: ["yt"] }, { focus: ["fv"] }],
        },
      ],
    } as Spec;
    const pos = positions(custom);
    expect(sorted(revealedIds(custom, pos, 0, true))).toEqual(["ing", "yt"]);
    expect(sorted(revealedIds(custom, pos, 1, true))).toEqual(["fv", "ing", "yt"]);
  });

  it("revenir en arrière masque de nouveau ce qui n'est pas encore venu", () => {
    const early = revealedIds(spec, all, indexOf("source"), true)!;
    expect(early.has("gd")).toBe(false);
    expect(early.has("fv")).toBe(false);
  });
});

describe("surlignage", () => {
  it("lignes seules, colonnes seules, ou intersection des deux", () => {
    expect(cellHighlighted({ rows: [1] }, 1, 0)).toBe(true);
    expect(cellHighlighted({ rows: [1] }, 0, 0)).toBe(false);
    expect(cellHighlighted({ cols: [2] }, 5, 2)).toBe(true);
    expect(cellHighlighted({ cols: [2] }, 5, 1)).toBe(false);
    expect(cellHighlighted({ rows: [0, 1], cols: [4] }, 1, 4)).toBe(true);
    expect(cellHighlighted({ rows: [0, 1], cols: [4] }, 1, 3)).toBe(false);
    expect(cellHighlighted({ rows: [0, 1], cols: [4] }, 2, 4)).toBe(false);
  });

  it("ignore les listes vides et l'absence de surlignage", () => {
    expect(cellHighlighted(undefined, 0, 0)).toBe(false);
    expect(cellHighlighted({ rows: [], cols: [] }, 0, 0)).toBe(false);
    expect(cellHighlighted({ rows: [], cols: [1] }, 9, 1)).toBe(true);
    expect(hasTableHighlight({ rows: [] })).toBe(false);
    expect(hasTableHighlight({ cols: [0] })).toBe(true);
    expect(hasCodeHighlight({ lines: [0] })).toBe(true);
    expect(hasCodeHighlight({ rows: [0] })).toBe(false);
    expect(lineHighlighted({ lines: [2] }, 2)).toBe(true);
    expect(lineHighlighted({ lines: [2] }, 3)).toBe(false);
    expect(lineHighlighted(undefined, 0)).toBe(false);
  });
});

describe("panneaux avec surlignage", () => {
  it("surligne les cellules visées dans la table du panneau 0", () => {
    const beat = step("bronze").beats![2]!;
    const html = renderToStaticMarkup(
      <DataPanels panels={step("bronze").panels} highlight={beat.highlight} />,
    );
    expect(html).toContain('class="panel has-hl"');
    expect(html.match(/class="hl"/g)).toHaveLength(2); // _fivetran_synced des deux lignes
  });

  it("surligne des lignes entières avec rows seul", () => {
    const html = renderToStaticMarkup(
      <DataPanels panels={step("bronze").panels} highlight={step("bronze").beats![1]!.highlight} />,
    );
    expect(html.match(/<td class="(n )?hl"|<td class="hl"/g)).toHaveLength(10); // 2 lignes × 5 colonnes
  });

  it("surligne des lignes de code dans le panneau visé, sans toucher aux autres", () => {
    const beat = step("silver").beats![1]!;
    const html = renderToStaticMarkup(
      <DataPanels panels={step("silver").panels} highlight={beat.highlight} />,
    );
    expect(html.match(/class="line hl"/g)).toHaveLength(3);
    expect(html.match(/class="panel has-hl"/g)).toHaveLength(1); // seulement le panneau de code
    expect(html).toContain("qualify row_number()");
  });

  it("n'ajoute aucune marque sans surlignage", () => {
    const html = renderToStaticMarkup(<DataPanels panels={step("silver").panels} />);
    expect(html).not.toContain("has-hl");
    expect(html).not.toContain(' hl"');
  });
});

describe("légende et sous-étapes", () => {
  it("affiche le compteur 2/3 et le texte de la sous-étape", () => {
    const bronze = step("bronze");
    const html = renderToStaticMarkup(<StepCaption step={bronze} index={3} count={7} beat={1} />);
    expect(html).toContain("Étape 4 sur 7");
    expect(html).toContain("2/3");
    expect(html).toContain("apparaît deux fois");
  });

  it("garde le texte de l'étape quand la sous-étape n'en a pas", () => {
    const html = renderToStaticMarkup(
      <StepCaption step={step("bronze")} index={3} count={7} beat={0} />,
    );
    expect(html).toContain("Les données arrivent telles quelles");
    expect(html).toContain("1/3");
  });

  it("n'affiche pas de compteur sans sous-étapes", () => {
    const html = renderToStaticMarkup(<StepCaption step={step("source")} index={1} count={7} />);
    expect(html).not.toContain("beat-count");
  });
});

describe("Scene en construction progressive", () => {
  it("masque ce qui n'est pas révélé", async () => {
    const layout = await computeLayout(spec);
    const revealed = revealedIds(spec, all, indexOf("source"), true)!;
    const lit = litIds(spec, step("source"));
    const html = renderToStaticMarkup(
      <Scene spec={spec} layout={layout} lit={lit} revealed={revealed} />,
    );
    expect(html).toMatch(/class="node on" data-id="yt"/);
    expect(html).toMatch(/class="node hidden" data-id="gd"/);
    expect(html).toMatch(/class="frame hidden" data-id="af"/);
    expect(html).toMatch(/class="edge-g hidden" data-id="e1"/);
  });

  it("affiche tout sans `revealed`", async () => {
    const layout = await computeLayout(spec);
    expect(renderToStaticMarkup(<Scene spec={spec} layout={layout} />)).not.toContain("hidden");
  });
});
