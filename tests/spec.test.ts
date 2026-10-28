import { describe, expect, it } from "vitest";
import example from "../src/examples/youtube-pipeline.json";
import { parseSpecJson, validateSpec } from "../src/spec/validate";

/** Copie modifiable de l'exemple, sans type strict : on y injecte des erreurs. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fresh = (): any => structuredClone(example);

function messages(input: unknown): string[] {
  const result = validateSpec(input);
  if (result.ok) throw new Error("la spec aurait dû être refusée");
  return result.errors.map((e) => e.message);
}

describe("exemple intégré", () => {
  it("est valide", () => {
    const result = validateSpec(example);
    expect(result.ok).toBe(true);
  });

  it("a 7 étapes (vue d'ensemble + 6)", () => {
    expect(example.steps).toHaveLength(7);
  });

  it("passe aussi par le texte JSON", () => {
    expect(parseSpecJson(JSON.stringify(example)).ok).toBe(true);
  });
});

describe("schéma", () => {
  it("refuse un JSON syntaxiquement faux", () => {
    const result = parseSpecJson('{ "version": 1, ');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]?.message).toMatch(/^JSON invalide/);
  });

  it("refuse autre chose qu'un objet", () => {
    expect(messages([])).toEqual(["Spec : attendu : un objet, reçu : une liste."]);
  });

  it("signale un champ obligatoire manquant avec l'élément concerné", () => {
    const spec = fresh();
    delete spec.nodes[1].label;
    expect(messages(spec)).toEqual(['Nœud "fv" : champ "label" : champ obligatoire manquant.']);
  });

  it("signale un mauvais type", () => {
    const spec = fresh();
    spec.steps[2].focus = "yt";
    expect(messages(spec)).toEqual([
      'Étape "L’ingestion" : champ "focus" : attendu : une liste, reçu : un texte.',
    ]);
  });

  it("signale une valeur hors liste", () => {
    const spec = fresh();
    spec.nodes[0].kind = "base";
    expect(messages(spec)[0]).toMatch(
      /^Nœud "yt" : champ "kind" : valeur "base" non autorisée \(valeurs possibles : "source"/,
    );
  });

  it("signale une clé inconnue (faute de frappe)", () => {
    const spec = fresh();
    spec.steps[1].focuss = ["yt"];
    expect(messages(spec)).toEqual([
      'Étape "La source" : clé inconnue : "focuss". Vérifie l\'orthographe.',
    ]);
  });

  it("signale un type de panneau inconnu", () => {
    const spec = fresh();
    spec.steps[1].panels[0].type = "image";
    expect(messages(spec)[0]).toMatch(
      /^Étape "La source" : champ "panels\[1\]\.type" : type de panneau inconnu/,
    );
  });

  it("refuse une version inconnue", () => {
    const spec = fresh();
    spec.version = 2;
    expect(messages(spec)[0]).toMatch(/^Spec : champ "version" : valeur 2 non autorisée/);
  });

  it("refuse une spec sans étape", () => {
    const spec = fresh();
    spec.steps = [];
    expect(messages(spec)[0]).toMatch(/^Spec : champ "steps"/);
  });
});

describe("checkReferences", () => {
  it("détecte un lien inexistant dans flow.edge, avec les liens disponibles", () => {
    const spec = fresh();
    spec.steps[2].flow.edge = "e9";
    expect(messages(spec)).toEqual([
      'Étape "L’ingestion" : le lien "e9" n\'existe pas (liens disponibles : e1, e2, e3, e4, t1).',
    ]);
  });

  it("refuse un nœud là où un lien est attendu", () => {
    const spec = fresh();
    spec.steps[2].flow.edge = "yt";
    expect(messages(spec)[0]).toMatch(/"yt" est un nœud, flow\.edge doit désigner un lien/);
  });

  it("détecte un id en double, tous types confondus", () => {
    const spec = fresh();
    spec.edges.push({ id: "yt", from: "yt", to: "fv" });
    expect(messages(spec)).toEqual([
      'Lien "yt" : l\'identifiant est déjà utilisé par un nœud. Chaque id doit être unique dans toute la spec.',
    ]);
  });

  it("détecte une étape en double", () => {
    const spec = fresh();
    spec.steps[1].id = "apercu";
    expect(messages(spec)[0]).toMatch(
      /^Étape "La source" : l'identifiant "apercu" est déjà utilisé/,
    );
  });

  it("détecte un id inconnu dans focus, zoom et les sous-étapes", () => {
    const spec = fresh();
    spec.steps[1].focus.push("zz");
    spec.steps[1].zoom = ["yy"];
    spec.steps[1].beats = [{ focus: ["xx"] }];
    const out = messages(spec);
    expect(out).toHaveLength(3);
    expect(out[0]).toMatch(/\(focus\) : l'identifiant "zz" n'existe pas/);
    expect(out[1]).toMatch(/\(zoom\) : l'identifiant "yy" n'existe pas/);
    expect(out[2]).toMatch(/sous-étape 1 \(focus\) : l'identifiant "xx"/);
  });

  it("détecte une extrémité de lien inconnue ou un lien auto-référent", () => {
    const spec = fresh();
    spec.edges[0].to = "nulle-part";
    spec.edges[1].to = "fv";
    const out = messages(spec);
    expect(out[0]).toMatch(/^Lien "e1" : l'élément "nulle-part" \(to\) n'existe pas/);
    expect(out[1]).toMatch(/^Lien "e2" : l'origine et la destination sont identiques/);
  });

  it("détecte un enfant de groupe inexistant", () => {
    const spec = fresh();
    spec.groups[0].children.push("fantome");
    expect(messages(spec)[0]).toMatch(/^Groupe "ing" : l'enfant "fantome" n'existe pas/);
  });

  it("détecte un nœud à deux parents", () => {
    const spec = fresh();
    spec.groups[1].children.push("yt");
    expect(messages(spec)).toEqual([
      'Groupe "dbt" : "yt" a déjà pour parent le groupe "ing". Un élément n\'a qu\'un seul parent.',
    ]);
  });

  it("détecte un groupe qui se contient lui-même", () => {
    const spec = fresh();
    spec.groups[0].children.push("ing");
    expect(messages(spec)[0]).toMatch(/^Groupe "ing" : cycle dans la hiérarchie \(ing → ing\)/);
  });

  it("détecte un cycle entre groupes, une seule fois", () => {
    const spec = fresh();
    spec.groups[1].children.push("af"); // af contient dbt, dbt contient af
    const out = messages(spec);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatch(/cycle dans la hiérarchie \(dbt → af → dbt\)/);
  });

  it("détecte une ligne de table de mauvaise longueur", () => {
    const spec = fresh();
    spec.steps[3].panels[0].rows[2].pop();
    expect(messages(spec)).toEqual([
      'Étape "La couche Bronze", panneau "bronze.youtube_stats" : la ligne 3 compte 4 cellule(s) mais le tableau a 5 colonne(s).',
    ]);
  });

  it("détecte une colonne numérique inexistante", () => {
    const spec = fresh();
    spec.steps[3].panels[0].numericColumns = [9];
    expect(messages(spec)[0]).toMatch(/la colonne numérique 9 n'existe pas \(indices 0 à 4\)/);
  });

  /** Trois panneaux connus (table 3 × 4, code de 9 lignes, DAG), indépendants de l'exemple. */
  const withHighlightPanels = () => {
    const spec = fresh();
    spec.steps[5].panels = [
      {
        type: "table",
        title: "t",
        columns: ["a", "b", "c", "d"],
        rows: [1, 2, 3].map(() => ["1", "2", "3", "4"]),
      },
      {
        type: "code",
        title: "c",
        language: "sql",
        content: Array.from({ length: 9 }, (_, i) => `ligne ${i}`).join("\n"),
      },
      { type: "dag", title: "d", tasks: [{ name: "x", state: "ok" }] },
    ];
    return spec;
  };

  it("vérifie les indices de surlignage dans le bon panneau", () => {
    const spec = withHighlightPanels();
    spec.steps[5].beats = [
      { highlight: { rows: [0, 3], cols: [4] } }, // silver : 3 lignes, 4 colonnes
      { highlight: { panel: 1, lines: [0, 9] } }, // SQL silver : 9 lignes
    ];
    const out = messages(spec);
    expect(out).toHaveLength(3);
    expect(out[0]).toMatch(/sous-étape 1 : la ligne 3 n'existe pas \(indices 0 à 2, 3 au total\)/);
    expect(out[1]).toMatch(/sous-étape 1 : la colonne 4 n'existe pas \(indices 0 à 3/);
    expect(out[2]).toMatch(
      /sous-étape 2 : la ligne de code 9 n'existe pas \(indices 0 à 8, 9 au total\)/,
    );
  });

  it("accepte les surlignages valides", () => {
    const spec = withHighlightPanels();
    spec.steps[5].beats = [
      { highlight: { rows: [0, 2], cols: [3] } },
      { highlight: { panel: 1, lines: [0, 8] } },
    ];
    expect(validateSpec(spec).ok).toBe(true);
  });

  it("refuse un surlignage de lignes sur un panneau qui n'est pas du bon type", () => {
    const spec = withHighlightPanels();
    spec.steps[5].beats = [{ highlight: { lines: [0] } }]; // panneau 0 = table
    expect(messages(spec)[0]).toMatch(
      /highlight\.lines suppose un panneau de type code, mais le panneau 0 \("t"\) est de type table/,
    );
  });

  it("refuse un surlignage sans panneau ou avec un panneau inexistant", () => {
    const spec = withHighlightPanels();
    spec.steps[0].panels = undefined;
    spec.steps[0].beats = [{ highlight: { rows: [0] } }];
    spec.steps[5].beats = [{ highlight: { panel: 7, rows: [0] } }];
    const out = messages(spec);
    expect(out[0]).toMatch(/sous-étape 1 : highlight suppose un panneau dans l'étape/);
    expect(out[1]).toMatch(/le panneau 7 n'existe pas \(indices 0 à 2\)/);
  });

  it("accepte une disposition en colonnes", () => {
    const spec = fresh();
    spec.steps[5].panelColumns = 2;
    spec.steps[5].panels[0].span = 2;
    expect(validateSpec(spec).ok).toBe(true);
  });

  it("refuse un panneau plus large que la disposition de l'étape", () => {
    const spec = fresh();
    spec.steps[1].panels[0].span = 2; // l'étape « La source » n'a pas de panelColumns
    expect(messages(spec)).toEqual([
      'Étape "La source", panneau "Réponse de l’API · exemple fictif" : il occupe 2 colonnes, mais l\'étape n\'en a que 1 (ajoute "panelColumns" à l\'étape).',
    ]);
    spec.steps[1].panelColumns = 2;
    expect(validateSpec(spec).ok).toBe(true);
    spec.steps[1].panels[0].span = 3;
    expect(messages(spec)[0]).toMatch(/il occupe 3 colonnes, mais l'étape n'en a que 2\.$/);
  });

  it("refuse un nombre de colonnes hors limites, ou non entier", () => {
    for (const bad of [0, 4, 1.5, "2"]) {
      const spec = fresh();
      spec.steps[1].panelColumns = bad;
      expect(validateSpec(spec).ok, String(bad)).toBe(false);
    }
    const spec = fresh();
    spec.steps[1].panelColumns = 3;
    spec.steps[1].panels[0].span = 0;
    expect(validateSpec(spec).ok).toBe(false);
  });
});
