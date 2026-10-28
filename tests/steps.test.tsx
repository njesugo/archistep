import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import example from "../src/examples/youtube-pipeline.json";
import { Controls } from "../src/components/Controls";
import { DataPanels } from "../src/components/DataPanel";
import { Scene } from "../src/components/Scene";
import { StepCaption } from "../src/components/StepCaption";
import { computeLayout } from "../src/engine/layout";
import { clampStep, keyAction, litIds } from "../src/engine/state";
import { validateSpec } from "../src/spec/validate";

const parsed = validateSpec(example);
if (!parsed.ok) throw new Error("exemple invalide");
const spec = parsed.spec;
const step = (id: string) => spec.steps.find((s) => s.id === id)!;

describe("mise en valeur", () => {
  it("ajoute les groupes ancêtres des éléments listés", () => {
    // sv est dans dbt, lui-même dans af
    expect([...litIds(spec, { ...step("silver"), focus: ["sv"] })!].sort()).toEqual([
      "af",
      "dbt",
      "sv",
    ]);
  });

  it("garde le groupe commun aux deux extrémités d'un lien", () => {
    const lit = litIds(spec, { ...step("silver"), focus: ["e4"] })!; // sv → gd, tous deux dans dbt
    expect([...lit].sort()).toEqual(["af", "dbt", "e4"]);
  });

  it("n'ajoute rien pour un lien qui traverse des groupes distincts", () => {
    expect([...litIds(spec, { ...step("silver"), focus: ["e3"] })!]).toEqual(["e3"]); // br → sv
  });

  it("n'atténue rien quand focus est vide", () => {
    expect(litIds(spec, { ...step("source"), focus: [] })).toBeNull();
  });

  it("couvre les 7 étapes : tout ce qui est listé est éclairé", () => {
    expect(spec.steps).toHaveLength(7);
    for (const s of spec.steps) {
      const lit = litIds(spec, s)!;
      for (const id of s.focus) expect(lit.has(id), `${s.id} : ${id}`).toBe(true);
    }
  });

  it("à l'étape Source, seul YouTube est éclairé (et son groupe)", () => {
    expect([...litIds(spec, step("source"))!].sort()).toEqual(["ing", "yt"]);
  });
});

describe("navigation", () => {
  it("borne l'indice d'étape", () => {
    expect(clampStep(-3, 7)).toBe(0);
    expect(clampStep(9, 7)).toBe(6);
    expect(clampStep(4, 7)).toBe(4);
    expect(clampStep(2, 0)).toBe(0);
  });

  it("associe les touches aux actions", () => {
    expect(keyAction("ArrowRight", false)).toBe("next");
    expect(keyAction(" ", false)).toBe("next");
    expect(keyAction("ArrowLeft", false)).toBe("prev");
    expect(keyAction("Home", false)).toBe("first");
    expect(keyAction("0", false)).toBe("first");
    expect(keyAction("p", false)).toBe("present");
    expect(keyAction("P", false)).toBe("present");
    expect(keyAction("Escape", false)).toBe("exit");
    expect(keyAction("l", false)).toBe("laser");
    expect(keyAction("L", false)).toBe("laser");
    expect(keyAction("a", false)).toBe("play");
    expect(keyAction("A", false)).toBe("play");
    expect(keyAction("c", false)).toBe("animate");
    expect(keyAction("C", false)).toBe("animate");
    expect(keyAction("f", false)).toBe("fullscreen");
    expect(keyAction("F", false)).toBe("fullscreen");
    expect(keyAction("z", false)).toBeNull();
  });

  it("laisse Espace au bouton focalisé (pas de double avance)", () => {
    expect(keyAction(" ", true)).toBeNull();
    expect(keyAction("ArrowRight", true)).toBe("next");
  });
});

describe("Controls", () => {
  const render = (index: number) =>
    renderToStaticMarkup(
      <Controls
        steps={spec.steps}
        index={index}
        atStart={index === 0}
        atEnd={index === spec.steps.length - 1}
        progressive={false}
        onToggleProgressive={() => {}}
        drawerOpen={false}
        onToggleDrawer={() => {}}
        onPresent={() => {}}
        laser={false}
        onToggleLaser={() => {}}
        autoplay="off"
        onTogglePlay={() => {}}
        animation="off"
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

  it("numérote les pastilles et marque l'étape courante", () => {
    const html = render(2);
    expect(html.match(/aria-current="step"/g)).toHaveLength(1);
    expect(html).toContain('aria-label="Étape 3 : L’ingestion"');
    expect(html).toMatch(
      /aria-current="step"[^>]*aria-label="Étape 3|aria-label="Étape 3[^>]*aria-current="step"/,
    );
  });

  it("montre l'état de la construction progressive (texte et aria-pressed)", () => {
    const render = (progressive: boolean) =>
      renderToStaticMarkup(
        <Controls
          steps={spec.steps}
          index={0}
          atStart
          atEnd={false}
          progressive={progressive}
          onToggleProgressive={() => {}}
          drawerOpen={false}
          onToggleDrawer={() => {}}
          onPresent={() => {}}
          laser={false}
          onToggleLaser={() => {}}
          autoplay="off"
          onTogglePlay={() => {}}
          animation="off"
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
    expect(render(false)).toContain('aria-pressed="false"');
    expect(render(false)).toContain("Construction progressive : non");
    expect(render(true)).toContain('aria-pressed="true"');
    expect(render(true)).toContain("Construction progressive : oui");
  });

  it("annonce les raccourcis clavier des boutons", () => {
    const html = render(2);
    expect(html).toContain('aria-keyshortcuts="ArrowRight Space"');
    expect(html).toContain('aria-keyshortcuts="ArrowLeft"');
    expect(html).toMatch(/aria-keyshortcuts="P"[^>]*>Mode présentation/);
    expect(html).toMatch(/aria-keyshortcuts="L"/);
  });

  it("désactive Précédent au début et Suivant à la fin", () => {
    expect(render(0)).toMatch(/<button[^>]*disabled[^>]*>Précédent/);
    expect(render(6)).toMatch(/<button[^>]*disabled[^>]*>Suivant/);
    expect(render(3)).not.toContain("disabled");
  });
});

describe("légende et panneaux", () => {
  it("affiche compteur, titre et texte dans une zone aria-live", () => {
    const html = renderToStaticMarkup(<StepCaption step={step("bronze")} index={3} count={7} />);
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("Étape 4 sur 7");
    expect(html).toContain("La couche Bronze");
  });

  it("rend table, code, liste et DAG", () => {
    const bronze = renderToStaticMarkup(<DataPanels panels={step("bronze").panels} />);
    expect(bronze).toContain("bronze.youtube_stats");
    expect(bronze).toMatch(/<th scope="col" class="n">views/);
    expect(bronze).toContain("Bronze</span>");
    expect(bronze.match(/<tr>/g)).toHaveLength(5); // en-tête + 4 lignes

    const source = renderToStaticMarkup(<DataPanels panels={step("source").panels} />);
    expect(source).toContain("estimatedMinutesWatched");

    const orchestration = renderToStaticMarkup(
      <DataPanels panels={step("orchestration").panels} />,
    );
    expect(orchestration).toContain("<b>Ordre.</b>");
    expect(orchestration).toContain("sync_fivetran");
    expect(orchestration).toContain("succès");
    expect(orchestration).toContain("en attente");

    const silver = renderToStaticMarkup(<DataPanels panels={step("silver").panels} />);
    expect(silver).toContain("en cours");
    expect(silver.match(/class="panel"/g)).toHaveLength(4); // 2 tables + SQL + DAG
  });

  it("empile les panneaux par défaut, sans grille", () => {
    const html = renderToStaticMarkup(<DataPanels panels={step("silver").panels} />);
    expect(html).toContain('class="panels"');
    expect(html).not.toContain("--cols");
    expect(html).not.toContain("--span");
  });

  it("place les panneaux dans une grille de colonnes, avec des étendues bornées", () => {
    const silver = step("silver");
    expect(silver.panelColumns).toBe(2);
    const html = renderToStaticMarkup(<DataPanels panels={silver.panels} columns={2} />);
    expect(html).toContain('class="panels grid" style="--cols:2"');
    // deux tables côte à côte (1 colonne chacune), puis la requête et le DAG sur 2 colonnes
    expect([...html.matchAll(/style="--span:(\d)"/g)].map((m) => m[1])).toEqual([
      "1",
      "1",
      "2",
      "2",
    ]);
    // une étendue supérieure au nombre de colonnes est ramenée à ce nombre
    const wide = renderToStaticMarkup(
      <DataPanels panels={[{ ...silver.panels![2]!, span: 3 }]} columns={2} />,
    );
    expect(wide).toContain('style="--span:2"');
  });

  it("n'affiche rien sans panneau", () => {
    expect(renderToStaticMarkup(<DataPanels panels={undefined} />)).toBe("");
  });
});

describe("Scene par étape", () => {
  it("atténue ce qui n'est pas éclairé et éclaire le reste", async () => {
    const layout = await computeLayout(spec);
    const lit = litIds(spec, step("ingestion"))!;
    const html = renderToStaticMarkup(<Scene spec={spec} layout={layout} lit={lit} />);
    expect(html).toMatch(/class="node on" data-id="fv"/);
    expect(html).toMatch(/class="node dim" data-id="gd"/);
    expect(html).toMatch(/class="frame on" data-id="ing"/);
    expect(html).toMatch(/class="frame dim" data-id="af"/);
    expect(html).toMatch(/class="edge-g on" data-id="e1"/);
    expect(html).toMatch(/class="edge-g dim" data-id="e4"/);
  });

  it("n'atténue rien sans mise en valeur", async () => {
    const layout = await computeLayout(spec);
    expect(renderToStaticMarkup(<Scene spec={spec} layout={layout} />)).not.toContain("dim");
  });
});
