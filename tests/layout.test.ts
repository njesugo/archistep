import { describe, expect, it } from "vitest";
import example from "../src/examples/youtube-pipeline.json";
import { computeLayout, parentMap, type Layout, type Rect } from "../src/engine/layout";
import { validateSpec } from "../src/spec/validate";
import type { Spec } from "../src/spec/schema";

function load(input: unknown): Spec {
  const result = validateSpec(input);
  if (!result.ok) throw new Error(result.errors.map((e) => e.message).join("\n"));
  return result.spec;
}

const exampleSpec = load(example);

const right = (r: Rect) => r.x + r.width;
const bottom = (r: Rect) => r.y + r.height;
const overlap = (a: Rect, b: Rect) =>
  a.x < right(b) && b.x < right(a) && a.y < bottom(b) && b.y < bottom(a);
const contains = (outer: Rect, inner: Rect) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  right(inner) <= right(outer) &&
  bottom(inner) <= bottom(outer);

function rectOf(layout: Layout, id: string): Rect {
  const rect = layout.nodes[id] ?? layout.groups[id];
  if (!rect) throw new Error(`pas de rectangle pour ${id}`);
  return rect;
}

/** Vérifie les invariants géométriques sur n'importe quel placement. */
function expectSoundLayout(spec: Spec, layout: Layout) {
  const parents = parentMap(spec);
  const ids = [...spec.nodes.map((n) => n.id), ...spec.groups.map((g) => g.id)];

  // aucun chevauchement entre éléments frères (même parent, nœuds et groupes confondus)
  for (const a of ids) {
    for (const b of ids) {
      if (a < b && parents.get(a) === parents.get(b)) {
        expect(overlap(rectOf(layout, a), rectOf(layout, b)), `${a} chevauche ${b}`).toBe(false);
      }
    }
  }
  // chaque enfant est contenu dans son groupe
  for (const [child, parent] of parents) {
    expect(
      contains(rectOf(layout, parent), rectOf(layout, child)),
      `${child} sort de ${parent}`,
    ).toBe(true);
  }
  // tout tient dans le cadre global, et chaque lien a un tracé d'au moins deux points
  for (const id of ids) {
    expect(
      contains({ x: 0, y: 0, width: layout.width, height: layout.height }, rectOf(layout, id)),
    ).toBe(true);
  }
  for (const edge of spec.edges) {
    expect(layout.edges[edge.id]?.length ?? 0, `tracé de ${edge.id}`).toBeGreaterThanOrEqual(2);
  }
}

describe("placement de l'exemple intégré", () => {
  it("respecte les invariants géométriques", async () => {
    expectSoundLayout(exampleSpec, await computeLayout(exampleSpec));
  });

  it("place l'ingestion à gauche et Airflow autour de dbt à droite", async () => {
    const l = await computeLayout(exampleSpec);
    const g = l.groups;
    const n = l.nodes;
    // le flux va de gauche à droite : yt, fv, br, sv, gd
    const order = ["yt", "fv", "br", "sv", "gd"].map((id) => rectOf(l, id).x);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(new Set(order).size).toBe(5);
    // l'ingestion est entièrement à gauche d'Airflow
    expect(right(g.ing!)).toBeLessThan(g.af!.x);
    // Airflow englobe dbt, qui englobe Silver et Gold
    expect(contains(g.af!, g.dbt!)).toBe(true);
    expect(contains(g.dbt!, n.sv!) && contains(g.dbt!, n.gd!)).toBe(true);
    expect([g.ing!.depth, g.af!.depth, g.dbt!.depth]).toEqual([0, 0, 1]);
    // Silver et Gold ne sortent pas d'Airflow, Bronze reste dans l'ingestion
    expect(contains(g.ing!, n.br!)).toBe(true);
    expect(overlap(n.br!, g.af!)).toBe(false);
  });

  it("dessine le lien de déclenchement du bord haut d'Airflow à celui de dbt", async () => {
    const l = await computeLayout(exampleSpec);
    const [start, end] = l.edges.t1!;
    expect(start!.y).toBe(l.groups.af!.y);
    expect(end!.y).toBe(l.groups.dbt!.y);
    expect(start!.x).toBe(end!.x);
    expect(start!.x).toBeGreaterThan(l.groups.dbt!.x);
    expect(start!.x).toBeLessThan(right(l.groups.dbt!));
  });

  it("relie les nœuds par des tracés qui partent et arrivent à leurs bords", async () => {
    const l = await computeLayout(exampleSpec);
    const e1 = l.edges.e1!;
    expect(e1[0]!.x).toBe(right(l.nodes.yt!));
    expect(e1[e1.length - 1]!.x).toBe(l.nodes.fv!.x);
  });

  it("est stable d'un calcul à l'autre", async () => {
    const first = await computeLayout(exampleSpec);
    const second = await computeLayout(structuredClone(exampleSpec));
    expect(second).toEqual(first);
  });

  it("garde le même placement (instantané)", async () => {
    // Si un changement volontaire de réglages modifie ceci : npx vitest -u
    expect(await computeLayout(exampleSpec)).toMatchSnapshot();
  });
});

describe("placement de specs variées", () => {
  const base = {
    version: 1,
    meta: { title: "t" },
    groups: [],
    edges: [],
    steps: [{ id: "s", title: "s", text: "s", focus: [] }],
  };
  const n = (id: string) => ({ id, label: id });

  it("gère des nœuds sans lien ni groupe", async () => {
    const spec = load({ ...base, nodes: [n("a"), n("b"), n("c")] });
    const l = await computeLayout(spec);
    expectSoundLayout(spec, l);
    expect(Object.keys(l.nodes).sort()).toEqual(["a", "b", "c"]);
  });

  it("gère trois niveaux de groupes imbriqués et des liens qui les traversent", async () => {
    const spec = load({
      ...base,
      nodes: [n("a"), n("b"), n("c"), n("d")],
      groups: [
        { id: "g1", label: "g1", children: ["g2", "d"] },
        { id: "g2", label: "g2", children: ["g3", "c"] },
        { id: "g3", label: "g3", children: ["a", "b"] },
      ],
      edges: [
        { id: "e1", from: "a", to: "b" },
        { id: "e2", from: "b", to: "c" },
        { id: "e3", from: "c", to: "d" },
        { id: "e4", from: "g1", to: "g3", style: "trigger" },
      ],
    });
    const l = await computeLayout(spec);
    expectSoundLayout(spec, l);
    expect([l.groups.g1!.depth, l.groups.g2!.depth, l.groups.g3!.depth]).toEqual([0, 1, 2]);
    expect(l.edges.e4![1]!.y).toBe(l.groups.g3!.y); // lien conteneur → descendant, même non direct
  });

  it("gère un lien entre groupes et un cycle de données", async () => {
    const spec = load({
      ...base,
      nodes: [n("a"), n("b")],
      groups: [
        { id: "g1", label: "g1", children: ["a"] },
        { id: "g2", label: "g2", children: ["b"] },
      ],
      edges: [
        { id: "e1", from: "g1", to: "g2" },
        { id: "e2", from: "b", to: "a" },
      ],
    });
    expectSoundLayout(spec, await computeLayout(spec));
  });
});
