import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import azure from "./fixtures/azure.json";
import example from "../src/examples/youtube-pipeline.json";
import { Scene } from "../src/components/Scene";
import {
  computeLayout,
  groupMinWidth,
  MAX_NODE_WIDTH,
  NODE_WIDTH,
  nodeWidth,
  parentMap,
  type Layout,
  type Rect,
} from "../src/engine/layout";
import {
  edgeLabelBox,
  EDGE_LABEL,
  GROUP_TITLE,
  textWidth,
  wrapText,
  MONO_STYLE,
} from "../src/engine/text";
import type { Spec } from "../src/spec/schema";
import { validateSpec } from "../src/spec/validate";

function load(input: unknown): Spec {
  const result = validateSpec(input);
  if (!result.ok) throw new Error(result.errors.map((e) => e.message).join("\n"));
  return result.spec;
}
const azureSpec = load(azure);
const exampleSpec = load(example);

const overlap = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

describe("texte réparti sur des lignes", () => {
  it("garde un texte court sur une ligne", () => {
    expect(wrapText("transformation", 130, 13, MONO_STYLE)).toEqual(["transformation"]);
  });

  it("coupe un texte long sur deux lignes, près du milieu", () => {
    expect(wrapText("extraction de données", 130, 13, MONO_STYLE)).toEqual([
      "extraction",
      "de données",
    ]);
  });

  it("tronque chaque ligne si deux ne suffisent pas, et un mot unique trop long", () => {
    const lines = wrapText(
      "une étiquette vraiment beaucoup trop longue pour deux lignes",
      130,
      13,
      MONO_STYLE,
    );
    expect(lines).toHaveLength(2);
    for (const line of lines) expect(textWidth(line, 13, MONO_STYLE)).toBeLessThanOrEqual(130);
    expect(wrapText("Supercalifragilisticexpialidocious", 130, 13, MONO_STYLE)[0]).toMatch(/…$/);
  });

  it("donne à une étiquette la taille de son texte, avec une marge", () => {
    const one = edgeLabelBox("transformation");
    expect(one.lines).toEqual(["transformation"]);
    expect(one.height).toBe(EDGE_LABEL.lineHeight + EDGE_LABEL.pad);
    const two = edgeLabelBox("extraction de données");
    expect(two.lines).toHaveLength(2);
    expect(two.height).toBe(2 * EDGE_LABEL.lineHeight + EDGE_LABEL.pad);
    expect(two.width).toBeLessThanOrEqual(EDGE_LABEL.maxWidth + 2 * EDGE_LABEL.pad);
  });
});

describe("largeur des nœuds", () => {
  it("reste à 140 sans sous-titre ou avec un sous-titre court", () => {
    expect(nodeWidth({})).toBe(NODE_WIDTH);
    expect(nodeWidth({ sub: "connecteur géré" })).toBe(NODE_WIDTH);
    expect(nodeWidth({ sub: "SILVER · nettoyé" })).toBe(NODE_WIDTH);
  });

  it("s'élargit pour un sous-titre long, jusqu'à un maximum", () => {
    const wide = nodeWidth({ sub: "code exécuté dans Databricks" });
    expect(wide).toBeGreaterThan(NODE_WIDTH);
    expect(textWidth("code exécuté dans Databricks", 12, MONO_STYLE) + 20).toBeLessThanOrEqual(
      wide,
    );
    expect(nodeWidth({ sub: "x".repeat(200) })).toBe(MAX_NODE_WIDTH);
  });
});

describe("largeur des groupes", () => {
  it("laisse la place du titre, du logo éventuel et de la flèche", () => {
    const bare = groupMinWidth({ label: "Databricks" }, false);
    expect(bare).toBeGreaterThanOrEqual(
      22 + textWidth("DATABRICKS", GROUP_TITLE.size, GROUP_TITLE.style) + 16,
    );
    expect(groupMinWidth({ label: "Databricks", icon: "databricks" }, false)).toBeGreaterThan(
      bare + 50,
    );
    expect(groupMinWidth({ label: "Databricks" }, true)).toBe(bare + 70);
  });
});

describe.each([
  ["exemple YouTube", exampleSpec],
  ["architecture Azure", azureSpec],
])("placement lisible : %s", (_, spec) => {
  let layout: Layout;
  const get = async () => (layout ??= await computeLayout(spec));

  it("tout groupe est assez large pour son titre", async () => {
    const l = await get();
    const withArrow = new Set(
      spec.edges.flatMap((e) => {
        const parents = parentMap(spec);
        const isIn = (a: string, b: string) => {
          for (let p = parents.get(b); p !== undefined; p = parents.get(p))
            if (p === a) return true;
          return false;
        };
        return isIn(e.from, e.to) ? [e.from] : isIn(e.to, e.from) ? [e.to] : [];
      }),
    );
    for (const group of spec.groups) {
      expect(l.groups[group.id]!.width, group.id).toBeGreaterThanOrEqual(
        groupMinWidth(group, withArrow.has(group.id)),
      );
    }
  });

  it("tout nœud est au moins aussi large que son sous-titre l'exige", async () => {
    const l = await get();
    for (const node of spec.nodes) expect(l.nodes[node.id]!.width, node.id).toBe(nodeWidth(node));
  });

  it("chaque lien routé qui a une étiquette a un emplacement réservé", async () => {
    const l = await get();
    const containment = new Set(
      spec.edges
        .filter((e) => l.edges[e.id]?.length === 2 && l.edges[e.id]![0]!.x === l.edges[e.id]![1]!.x)
        .map((e) => e.id),
    );
    for (const edge of spec.edges) {
      if (!edge.label || containment.has(edge.id)) continue;
      expect(l.edgeLabels[edge.id], edge.id).toBeDefined();
    }
  });

  it("aucune étiquette ne recouvre un nœud, ni une autre étiquette", async () => {
    const l = await get();
    const boxes = Object.entries(l.edgeLabels);
    for (const [id, box] of boxes) {
      for (const [nodeId, node] of Object.entries(l.nodes)) {
        expect(overlap(box, node), `étiquette de ${id} sur le nœud ${nodeId}`).toBe(false);
      }
    }
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        expect(overlap(boxes[i]![1], boxes[j]![1]), `${boxes[i]![0]} sur ${boxes[j]![0]}`).toBe(
          false,
        );
      }
    }
  });

  it("chaque étiquette est dans le cadre du schéma et près de son tracé", async () => {
    const l = await get();
    for (const [id, box] of Object.entries(l.edgeLabels)) {
      expect(box.x, id).toBeGreaterThanOrEqual(0);
      expect(box.y, id).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, id).toBeLessThanOrEqual(l.width);
      expect(box.y + box.height, id).toBeLessThanOrEqual(l.height);
      const points = l.edges[id]!;
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      // distance du centre de l'étiquette au segment le plus proche du tracé
      const distance = Math.min(
        ...points.slice(1).map((b, i) => {
          const a = points[i]!;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const t =
            dx === 0 && dy === 0
              ? 0
              : Math.max(0, Math.min(1, ((cx - a.x) * dx + (cy - a.y) * dy) / (dx * dx + dy * dy)));
          return Math.hypot(cx - (a.x + t * dx), cy - (a.y + t * dy));
        }),
      );
      expect(distance, `${id} : étiquette trop loin de son lien`).toBeLessThan(40);
    }
  });
});

describe("rendu des étiquettes", () => {
  it("dessine les étiquettes au-dessus des nœuds, avec leurs lignes", async () => {
    const layout = await computeLayout(azureSpec);
    const html = renderToStaticMarkup(<Scene spec={azureSpec} layout={layout} />);
    const lastNode = html.lastIndexOf('class="node');
    const firstLabel = html.indexOf('class="edge-label-g');
    expect(firstLabel).toBeGreaterThan(lastNode);
    expect(html.match(/data-label-for=/g)).toHaveLength(8);
    // « extraction de données » est sur deux lignes
    expect(html).toMatch(/<tspan[^>]*>extraction<\/tspan><tspan[^>]*>de données<\/tspan>/);
  });

  it("garde l'étiquette d'un lien conteneur → contenu le long de sa flèche", async () => {
    const layout = await computeLayout(exampleSpec);
    expect(layout.edgeLabels.t1).toBeUndefined();
    const html = renderToStaticMarkup(<Scene spec={exampleSpec} layout={layout} />);
    expect(html).toContain("déclenche");
  });

  it("l'étiquette suit l'atténuation et la construction progressive de son lien", async () => {
    const layout = await computeLayout(azureSpec);
    const lit = new Set(["sql", "br", "e4"]);
    const html = renderToStaticMarkup(<Scene spec={azureSpec} layout={layout} lit={lit} />);
    expect(html).toMatch(/class="edge-label-g on" data-label-for="e4"/);
    expect(html).toMatch(/class="edge-label-g dim" data-label-for="e1"/);
    const hidden = renderToStaticMarkup(
      <Scene spec={azureSpec} layout={layout} revealed={new Set(["e4"])} />,
    );
    expect(hidden).toMatch(/class="edge-label-g hidden" data-label-for="e1"/);
  });
});
