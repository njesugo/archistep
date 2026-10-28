import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import example from "../src/examples/youtube-pipeline.json";
import { Scene } from "../src/components/Scene";
import type { Scheduler } from "../src/engine/animation";
import {
  animateCamera,
  boundingBox,
  fitAspect,
  FRAME_MARGIN,
  frameFor,
  frameToViewBox,
  lerpFrame,
  MAX_STAGE_ASPECT,
  MIN_FRAME_WIDTH,
  stageAspect,
  type Frame,
} from "../src/engine/camera";
import { computeLayout, parentMap, type Layout, type Rect } from "../src/engine/layout";
import { validateSpec } from "../src/spec/validate";

const parsed = validateSpec(example);
if (!parsed.ok) throw new Error("exemple invalide");
const spec = parsed.spec;
const layoutPromise = computeLayout(spec);

const contains = (outer: Rect, inner: Rect) =>
  inner.x >= outer.x - 1e-6 &&
  inner.y >= outer.y - 1e-6 &&
  inner.x + inner.width <= outer.x + outer.width + 1e-6 &&
  inner.y + inner.height <= outer.y + outer.height + 1e-6;
const aspectOf = (r: Rect) => r.width / r.height;

describe("boîte englobante", () => {
  it("réunit nœuds, groupes et tracés de liens", async () => {
    const l = await layoutPromise;
    const box = boundingBox(["yt", "fv"], l)!;
    expect(box.x).toBe(l.nodes.yt!.x);
    expect(box.x + box.width).toBe(l.nodes.fv!.x + l.nodes.fv!.width);
    const { x, y, width, height } = l.groups.ing!;
    expect(boundingBox(["ing"], l)).toEqual({ x, y, width, height });
  });

  it("prend les points d'un lien", async () => {
    const l = await layoutPromise;
    const [a, b] = l.edges.t1!;
    expect(boundingBox(["t1"], l)).toEqual({
      x: a!.x,
      y: a!.y,
      width: 0,
      height: b!.y - a!.y,
    });
  });

  it("ignore les ids inconnus et renvoie null s'il n'en reste aucun", async () => {
    const l = await layoutPromise;
    expect(boundingBox(["nulle-part"], l)).toBeNull();
    expect(boundingBox(["nulle-part", "yt"], l)).toEqual(boundingBox(["yt"], l));
  });
});

describe("cadre d'une étape", () => {
  it("fixe le rapport de la scène sur celui du schéma, plafonné", async () => {
    const l = await layoutPromise;
    expect(l.width / l.height).toBeGreaterThan(MAX_STAGE_ASPECT);
    expect(stageAspect(l)).toBe(MAX_STAGE_ASPECT);
    expect(stageAspect({ ...l, width: 300, height: 200 })).toBe(1.5);
  });

  it("revient au schéma complet sans zoom, centré, au rapport demandé", async () => {
    const l = await layoutPromise;
    const aspect = stageAspect(l);
    for (const zoom of [undefined, [], ["inconnu"]]) {
      const f = frameFor(l, zoom, aspect);
      expect(aspectOf(f)).toBeCloseTo(aspect);
      expect(contains(f, { x: 0, y: 0, width: l.width, height: l.height })).toBe(true);
      expect(f.x + f.width / 2).toBeCloseTo(l.width / 2);
      expect(f.y + f.height / 2).toBeCloseTo(l.height / 2);
    }
  });

  it("cadre chaque cible de l'exemple avec une marge, au bon rapport", async () => {
    const l = await layoutPromise;
    const aspect = stageAspect(l);
    for (const step of spec.steps.filter((s) => s.zoom)) {
      const f = frameFor(l, step.zoom, aspect, parentMap(spec));
      const box = boundingBox(step.zoom!, l)!;
      expect(aspectOf(f), step.id).toBeCloseTo(aspect);
      expect(contains(f, box), `${step.id} : cible dans le cadre`).toBe(true);
      // marge d'au moins FRAME_MARGIN de chaque côté, sauf là où le cadre touche le bord du schéma
      const pad = FRAME_MARGIN * Math.max(box.width, box.height);
      const gaps = [
        [box.x - f.x, f.x === 0],
        [box.y - f.y, f.y === 0],
        [f.x + f.width - (box.x + box.width), f.x + f.width === l.width],
        [f.y + f.height - (box.y + box.height), f.y + f.height === l.height],
      ] as const;
      for (const [gap, atEdge] of gaps) expect(atEdge || gap >= pad - 1e-6, step.id).toBe(true);
      expect(f.width, step.id).toBeLessThan(l.width * 1.2);
    }
  });

  it("reste dans le schéma quand le cadre y tient (pas de vide autour)", async () => {
    const l = await layoutPromise;
    const aspect = stageAspect(l);
    for (const step of spec.steps.filter((s) => s.zoom)) {
      const f = frameFor(l, step.zoom, aspect, parentMap(spec));
      expect(f.x, step.id).toBeGreaterThanOrEqual(0);
      expect(f.x + f.width, step.id).toBeLessThanOrEqual(l.width);
      if (f.height <= l.height) {
        expect(f.y, step.id).toBeGreaterThanOrEqual(0);
        expect(f.y + f.height, step.id).toBeLessThanOrEqual(l.height);
      }
    }
    // la source, tout à gauche, est cadrée depuis le bord gauche
    expect(frameFor(l, ["yt"], aspect).x).toBe(0);
  });

  it("n'agrandit pas un nœud isolé au-delà de la largeur minimale", async () => {
    const l = await layoutPromise;
    const f = frameFor(l, ["yt"], 2.4);
    expect(f.width).toBeGreaterThanOrEqual(MIN_FRAME_WIDTH);
    expect(f.width).toBeLessThan(MIN_FRAME_WIDTH * 2);
    expect(contains(f, l.nodes.yt!)).toBe(true);
  });

  it("garde le titre du groupe parent à l'image", async () => {
    const l = await layoutPromise;
    const parents = parentMap(spec);
    // rapport très large : le cadre est bas, il ne remonte pas de lui-même jusqu'au groupe
    const bare = frameFor(l, ["sv"], 10);
    expect(bare.y).toBeGreaterThan(l.groups.dbt!.y);
    expect(frameFor(l, ["sv"], 10, parents).y).toBeLessThanOrEqual(l.groups.dbt!.y);
    // un élément sans parent n'est pas affecté
    expect(frameFor(l, ["af"], 2.4, parents)).toEqual(frameFor(l, ["af"], 2.4));
  });

  it("zoome vraiment : le cadre est bien plus petit que le schéma", async () => {
    const l = await layoutPromise;
    expect(frameFor(l, ["yt", "fv"], 2.4).width).toBeLessThan(l.width * 0.6);
  });

  it("agrandit au rapport voulu sans déplacer le centre", () => {
    const wide = fitAspect({ x: 10, y: 20, width: 100, height: 100 }, 2);
    expect(wide).toEqual({ x: -40, y: 20, width: 200, height: 100 });
    const tall = fitAspect({ x: 0, y: 0, width: 100, height: 20 }, 1);
    expect(tall).toEqual({ x: 0, y: -40, width: 100, height: 100 });
  });

  it("n'agrandit pas à l'excès la vue d'ensemble d'une petite spec", () => {
    const small: Layout = { width: 300, height: 150, nodes: {}, groups: {}, edges: {} };
    const f = frameFor(small, undefined, 2);
    expect(f.width).toBeGreaterThanOrEqual(MIN_FRAME_WIDTH);
    expect(f.x + f.width / 2).toBeCloseTo(150); // centré sur le schéma
    expect(contains(f, { x: 0, y: 0, width: 300, height: 150 })).toBe(true);
  });

  it("gère un schéma plus étroit que la largeur minimale", () => {
    const small: Layout = {
      width: 200,
      height: 100,
      nodes: { a: { x: 10, y: 10, width: 50, height: 50 } },
      groups: {},
      edges: {},
    };
    const f = frameFor(small, ["a"], 2);
    expect(f.width).toBeLessThanOrEqual(small.width * 1.5);
    expect(contains(f, small.nodes.a!)).toBe(true);
  });
});

describe("animation de la caméra", () => {
  function fakeScheduler() {
    let next = 1;
    const pending = new Map<number, (now: number) => void>();
    const scheduler: Scheduler = {
      request: (cb) => {
        pending.set(next, cb);
        return next++;
      },
      cancel: (h) => void pending.delete(h),
    };
    const tick = () => {
      const entry = [...pending][0];
      if (!entry) return false;
      pending.delete(entry[0]);
      entry[1](0);
      return true;
    };
    return { scheduler, pending, tick };
  }
  const A: Frame = { x: 0, y: 0, width: 1000, height: 400 };
  const B: Frame = { x: 200, y: 50, width: 400, height: 160 };

  it("interpole les quatre valeurs", () => {
    expect(lerpFrame(A, B, 0)).toEqual(A);
    expect(lerpFrame(A, B, 1)).toEqual(B);
    expect(lerpFrame(A, B, 0.5)).toEqual({ x: 100, y: 25, width: 700, height: 280 });
    expect(frameToViewBox(B)).toBe("200 50 400 160");
  });

  it("va de A à B en 700 ms, finit exactement sur B puis s'arrête", () => {
    const { scheduler, pending, tick } = fakeScheduler();
    let clock = 0;
    const seen: Frame[] = [];
    animateCamera(
      A,
      B,
      (f) => seen.push(f),
      scheduler,
      () => clock,
    );
    clock = 350;
    tick();
    expect(seen[0]).toEqual(lerpFrame(A, B, 0.5)); // milieu : accélération douce symétrique
    clock = 699;
    tick();
    expect(seen[1]!.width).toBeGreaterThan(B.width);
    clock = 700;
    tick();
    expect(seen[2]).toEqual(B);
    expect(pending.size).toBe(0);
    expect(tick()).toBe(false);
  });

  it("avance de façon monotone", () => {
    const { scheduler, tick } = fakeScheduler();
    let clock = 0;
    const widths: number[] = [];
    animateCamera(
      A,
      B,
      (f) => widths.push(f.width),
      scheduler,
      () => clock,
    );
    for (clock = 50; clock <= 700; clock += 50) tick();
    expect(widths).toEqual([...widths].sort((a, b) => b - a));
  });

  it("peut être interrompue sans rien laisser en attente", () => {
    const { scheduler, pending } = fakeScheduler();
    for (let i = 0; i < 200; i++)
      animateCamera(
        A,
        B,
        () => {},
        scheduler,
        () => 0,
      )();
    expect(pending.size).toBe(0);
  });
});

describe("Scene et caméra", () => {
  it("fixe le rapport de la scène et pose un viewBox", async () => {
    const l = await layoutPromise;
    const html = renderToStaticMarkup(
      <Scene spec={spec} layout={l} frame={frameFor(l, ["yt"], 2.4)} aspect={2.4} />,
    );
    expect(html).toContain("aspect-ratio:2.4");
    expect(html).toMatch(/viewBox="0 0 \d+ \d+"/);
  });
});
