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
});
