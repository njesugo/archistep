import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import example from "../src/examples/youtube-pipeline.json";
import { Scene } from "../src/components/Scene";
import { computeLayout } from "../src/engine/layout";
import { validateSpec } from "../src/spec/validate";

describe("Scene", () => {
  it("dessine tous les groupes, liens et nœuds de l'exemple", async () => {
    const parsed = validateSpec(example);
    if (!parsed.ok) throw new Error("exemple invalide");
    const spec = parsed.spec;
    const html = renderToStaticMarkup(<Scene spec={spec} layout={await computeLayout(spec)} />);

    for (const id of [...spec.nodes, ...spec.groups, ...spec.edges].map((e) => e.id)) {
      expect(html, id).toContain(`data-id="${id}"`);
    }
    expect(html).toContain("APACHE AIRFLOW · ORCHESTRATION");
    expect(html).toContain("BRONZE · brut");
    expect(html).toContain("déclenche");
    expect(html).toContain("edge trigger");
    // groupes dessinés avant les liens, liens avant les nœuds
    expect(html.indexOf('data-id="af"')).toBeLessThan(html.indexOf('data-id="e1"'));
    expect(html.indexOf('data-id="e1"')).toBeLessThan(html.indexOf('data-id="yt"'));
    // le groupe extérieur est dessiné avant son enfant
    expect(html.indexOf('data-id="af"')).toBeLessThan(html.indexOf('data-id="dbt"'));
  });

  it("tronque un titre de groupe avant la flèche vers le groupe contenu", async () => {
    const parsed = validateSpec(example);
    if (!parsed.ok) throw new Error("exemple invalide");
    const spec = structuredClone(parsed.spec);
    spec.groups.find((g) => g.id === "af")!.label =
      "Apache Airflow · Orchestration des tâches quotidiennes de production";
    const layout = await computeLayout(spec);
    const html = renderToStaticMarkup(<Scene spec={spec} layout={layout} />);
    const title = /data-id="af"[\s\S]*?<text[^>]*>([^<]*)<\/text>/.exec(html)?.[1] ?? "";
    expect(title.endsWith("…")).toBe(true);
    // largeur estimée du titre : 14 px × (0,6 + 0,1 em) par caractère, depuis x + 54
    const af = layout.groups.af!;
    const arrowX = layout.edges.t1![0]!.x;
    expect(af.x + 54 + title.length * 14 * 0.7).toBeLessThanOrEqual(arrowX - 12 + 1e-6);
    // le titre complet reste disponible en infobulle
    expect(html).toContain(
      "<title>Apache Airflow · Orchestration des tâches quotidiennes de production</title>",
    );
  });
});
