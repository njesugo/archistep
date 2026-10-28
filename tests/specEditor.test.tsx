import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SpecDrawer } from "../src/components/SpecDrawer";
import { slugify } from "../src/download";
import { DEFAULT_EXAMPLE, EXAMPLES } from "../src/examples";
import { iconRows } from "../src/icons/report";
import { buildGeneratePrompt } from "../src/prompt";
import {
  edgeSchema,
  groupSchema,
  nodeSchema,
  panelSchema,
  specSchema,
  stepSchema,
  beatSchema,
} from "../src/spec/schema";
import { lineOf, locatePath } from "../src/spec/locate";
import { clearSavedSpec, readSavedSpec, saveSpec, SPEC_KEY } from "../src/specStore";
import { parseSpecJson } from "../src/spec/validate";
import { prettify } from "../src/useSpecEditor";

const memoryStore = (initial: Record<string, string> = {}) => {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    data,
  };
};

describe("exemples intégrés", () => {
  it("sont tous valides", () => {
    expect(EXAMPLES.length).toBeGreaterThan(0);
    for (const example of EXAMPLES) {
      expect(parseSpecJson(example.text).ok, example.id).toBe(true);
    }
    expect(DEFAULT_EXAMPLE).toBe(EXAMPLES[0]);
  });
});

describe("sauvegarde locale", () => {
  it("relit une spec valide sauvegardée", () => {
    const store = memoryStore();
    saveSpec(DEFAULT_EXAMPLE.text, store);
    expect(store.data.get(SPEC_KEY)).toBe(DEFAULT_EXAMPLE.text);
    const saved = readSavedSpec(store);
    expect(saved?.text).toBe(DEFAULT_EXAMPLE.text);
    expect(saved?.spec.meta.title).toContain("YouTube");
  });

  it("ignore un contenu absent, invalide ou qui n'est pas du JSON", () => {
    expect(readSavedSpec(memoryStore())).toBeNull();
    expect(readSavedSpec(memoryStore({ [SPEC_KEY]: "pas du json" }))).toBeNull();
    expect(readSavedSpec(memoryStore({ [SPEC_KEY]: '{"version":1}' }))).toBeNull();
  });

  it("survit à un stockage indisponible", () => {
    const broken = {
      getItem: () => {
        throw new Error("bloqué");
      },
      setItem: () => {
        throw new Error("plein");
      },
      removeItem: () => {
        throw new Error("bloqué");
      },
    };
    expect(readSavedSpec(broken)).toBeNull();
    expect(() => saveSpec("x", broken)).not.toThrow();
    expect(() => clearSavedSpec(broken)).not.toThrow();
    expect(readSavedSpec(null)).toBeNull();
  });

  it("efface la sauvegarde", () => {
    const store = memoryStore({ [SPEC_KEY]: DEFAULT_EXAMPLE.text });
    clearSavedSpec(store);
    expect(readSavedSpec(store)).toBeNull();
  });
});

describe("remise en forme à l'import", () => {
  it("indente un JSON compact", () => {
    expect(prettify('{"a":[1,2]}')).toBe('{\n  "a": [\n    1,\n    2\n  ]\n}');
  });

  it("laisse un texte illisible tel quel, pour qu'on le corrige", () => {
    expect(prettify('{"a": ')).toBe('{"a": ');
  });
});

describe("noms de fichier", () => {
  it("fabrique un nom sûr à partir du titre", () => {
    expect(slugify("De YouTube Analytics au tableau de bord")).toBe(
      "de-youtube-analytics-au-tableau-de-bord",
    );
    expect(slugify("  Été : l'ingestion !  ")).toBe("ete-l-ingestion");
    expect(slugify("***")).toBe("spec");
  });
});

describe("localisation des erreurs dans le texte", () => {
  const text = `{
  "version": 1,
  "nodes": [
    { "id": "a", "label": "A" },
    { "id": "b", "label": "B" }
  ],
  "meta": { "title": "T" }
}`;
  const at = (path: (string | number)[]) => {
    const r = locatePath(text, path)!;
    return text.slice(r.start, r.end);
  };

  it("trouve une valeur simple avec sa clé", () => {
    expect(at(["version"])).toBe('"version": 1');
    expect(at(["nodes", 1, "label"])).toBe('"label": "B"');
  });

  it("trouve un élément de liste", () => {
    expect(at(["nodes", 0, "id"])).toBe('"id": "a"');
    expect(lineOf(text, locatePath(text, ["nodes", 1])!.start)).toBe(4);
  });

  it("se limite à la première ligne d'un objet ou d'une liste", () => {
    expect(at(["nodes"])).toBe('"nodes": [');
    expect(at(["meta"])).toBe('"meta": { "title": "T" }');
  });

  it("remonte au parent quand le champ est absent (champ manquant)", () => {
    expect(at(["nodes", 0, "kind"])).toBe('{ "id": "a", "label": "A" },'.slice(0, -1));
    expect(at(["absent", "tout"])).toBe(text.split("\n")[0]);
  });

  it("renvoie null si le texte n'est pas du JSON lisible", () => {
    expect(locatePath('{ "a": ', ["a"])).toBeNull();
    expect(locatePath("", [])).toBeNull();
  });

  it("gère les chaînes avec guillemets échappés et les nombres négatifs", () => {
    const t = '{"a": "x\\"y", "b": -1.5e3, "c": [true, null]}';
    const r = locatePath(t, ["c", 1])!;
    expect(t.slice(r.start, r.end)).toBe("null");
    const b = locatePath(t, ["b"])!;
    expect(t.slice(b.start, b.end)).toBe('"b": -1.5e3');
  });

  it("donne la position d'une erreur de syntaxe JSON", () => {
    const result = parseSpecJson('{ "version": 1, ');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.offset).toBeTypeOf("number");
      expect(result.errors[0]?.path).toEqual([]);
    }
  });

  it("retrouve l'endroit de chaque erreur de l'exemple cassé", () => {
    const broken = JSON.parse(DEFAULT_EXAMPLE.text);
    broken.steps[2].flow.edge = "e9";
    const jsonText = JSON.stringify(broken, null, 2);
    const result = parseSpecJson(jsonText);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const range = locatePath(jsonText, result.errors[0]!.path)!;
      expect(jsonText.slice(range.start, range.end)).toBe('"edge": "e9"');
    }
  });
});

describe("prompt de génération", () => {
  const prompt = buildGeneratePrompt();

  it("remplace le marqueur par l'exemple intégré, valide", () => {
    expect(prompt).not.toContain("{{EXEMPLE}}");
    const block = /```json\n([\s\S]*?)\n```/.exec(prompt)?.[1];
    expect(block).toBeDefined();
    expect(parseSpecJson(block!).ok).toBe(true);
  });

  it("demande un seul bloc JSON, sans coordonnées, avec des données fictives", () => {
    expect(prompt).toMatch(/un seul bloc de code JSON/);
    expect(prompt).toMatch(/jamais de coordonnées/);
    expect(prompt).toMatch(/fictives/);
  });

  // Garde-fou : si le schéma change, le prompt doit suivre.
  it("décrit toutes les clés du schéma", () => {
    const shapes = [
      specSchema.shape,
      specSchema.shape.meta.shape,
      nodeSchema.shape,
      groupSchema.shape,
      edgeSchema.shape,
      stepSchema.shape,
      stepSchema.shape.flow.unwrap().shape,
      beatSchema.shape,
      beatSchema.shape.highlight.unwrap().shape,
    ];
    for (const shape of shapes) {
      for (const key of Object.keys(shape)) expect(prompt, `clé « ${key} »`).toContain(key);
    }
    for (const option of panelSchema.options) {
      for (const key of Object.keys(option.shape))
        expect(prompt, `panneau : « ${key} »`).toContain(key);
    }
  });

  it("liste toutes les valeurs autorisées des listes fermées", () => {
    const values = [
      ...nodeSchema.shape.kind.unwrap().options,
      ...nodeSchema.shape.layer.unwrap().options,
      ...groupSchema.shape.color.unwrap().options,
      ...edgeSchema.shape.style.unwrap().options,
      ...stepSchema.shape.flow.unwrap().shape.shape.unwrap().options,
      ...specSchema.shape.meta.shape.language.unwrap().options,
      ...specSchema.shape.meta.shape.buildMode.unwrap().options,
    ];
    for (const value of values) expect(prompt, `valeur « ${value} »`).toContain(`"${value}"`);
    for (const option of panelSchema.options) {
      expect(prompt, `type « ${option.shape.type.value} »`).toContain(
        `"${option.shape.type.value}"`,
      );
    }
  });
});

describe("tiroir Spec", () => {
  const spec = (() => {
    const r = parseSpecJson(DEFAULT_EXAMPLE.text);
    if (!r.ok) throw new Error("exemple invalide");
    return r.spec;
  })();
  const noop = () => {};
  const render = (errors: Parameters<typeof SpecDrawer>[0]["errors"], open = true) =>
    renderToStaticMarkup(
      <SpecDrawer
        open={open}
        onClose={noop}
        text={DEFAULT_EXAMPLE.text}
        onTextChange={noop}
        errors={errors}
        spec={spec}
        onImport={noop}
        onExport={noop}
        onLoadExample={noop}
      />,
    );

  it("propose import, export, exemples, éditeur et prompt", () => {
    const html = render([]);
    for (const label of ["Importer", "Exporter", "Exemples", "Copier le prompt", "Spec JSON"]) {
      expect(html, label).toContain(label);
    }
    expect(html).toContain("<textarea");
    expect(html).toContain("Pipeline YouTube Analytics (fictif)");
    expect(html).toContain("Spec valide");
    expect(html).toContain('aria-invalid="false"');
  });

  it("liste les erreurs sous forme de boutons et garde l'éditeur marqué invalide", () => {
    const html = render([
      { path: ["steps", 2, "flow", "edge"], message: "Étape « x » : le lien « e9 » n'existe pas." },
      { path: [], message: "JSON invalide : …" },
    ]);
    expect(html).toContain("2 erreurs");
    expect(html).toContain("la dernière version valide reste affichée");
    expect(html).toContain('aria-invalid="true"');
    expect(html.match(/<li><button/g)).toHaveLength(2);
  });

  it("est masqué quand il est fermé", () => {
    expect(render([], false)).toMatch(/<aside[^>]*hidden/);
    expect(render([], true)).not.toMatch(/<aside[^>]*hidden/);
  });

  it("signale les logos manquants dans le tiroir (pas sur le schéma)", () => {
    const rows = iconRows(spec);
    expect(rows.map((r) => r.key)).toEqual(["airflow", "databricks", "dbt", "fivetran", "youtube"]);
    // le résultat dépend des logos présents dans src/assets/logos : on vérifie la cohérence
    const html = render([]);
    const missing = rows.filter((r) => r.source !== "user").length;
    expect(html.match(/logo manquant/g)?.length ?? 0).toBe(missing);
    expect(rows.filter((r) => r.source === "user").length + missing).toBe(rows.length);
  });
});
