import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import example from "../src/examples/youtube-pipeline.json";
import { Scene } from "../src/components/Scene";
import {
  packetFrame,
  pointAt,
  polylineLength,
  resolveFlow,
  travelDuration,
} from "../src/engine/flow";
import { runAnimation, type Scheduler } from "../src/engine/animation";
import { computeLayout } from "../src/engine/layout";
import { validateSpec } from "../src/spec/validate";

const parsed = validateSpec(example);
if (!parsed.ok) throw new Error("exemple invalide");
const spec = parsed.spec;
const step = (id: string) => spec.steps.find((s) => s.id === id)!;

const line = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 50 },
];

describe("géométrie du tracé", () => {
  it("mesure une polyligne", () => {
    expect(polylineLength(line)).toBe(150);
    expect(polylineLength([])).toBe(0);
  });

  it("donne le point à une distance, en suivant les coudes", () => {
    expect(pointAt(line, 0)).toEqual({ x: 0, y: 0 });
    expect(pointAt(line, 50)).toEqual({ x: 50, y: 0 });
    expect(pointAt(line, 125)).toEqual({ x: 100, y: 25 });
  });

  it("borne aux extrémités", () => {
    expect(pointAt(line, -10)).toEqual({ x: 0, y: 0 });
    expect(pointAt(line, 9999)).toEqual({ x: 100, y: 50 });
  });
});

describe("temps des paquets", () => {
  it("borne la durée d'un trajet", () => {
    expect(travelDuration(10)).toBe(1200);
    expect(travelDuration(150)).toBeCloseTo(1875);
    expect(travelDuration(100000)).toBe(3200);
  });

  it("garde chaque paquet caché avant son départ décalé", () => {
    expect(packetFrame(line, 3, 2, 100).visible).toBe(false); // part à 520 ms
    expect(packetFrame(line, 3, 0, 100).visible).toBe(true);
  });

  it("va de l'origine à la destination, apparaît et disparaît en fondu", () => {
    const duration = travelDuration(polylineLength(line));
    const start = packetFrame(line, 1, 0, 1);
    const middle = packetFrame(line, 1, 0, duration / 2);
    expect(start).toMatchObject({ visible: true, opacity: expect.closeTo(0, 1) as number });
    expect(middle).toMatchObject({ visible: true, x: 75, y: 0, opacity: 1 });
    const end = packetFrame(line, 1, 0, duration - 1);
    expect(end.visible && end.opacity).toBeLessThan(0.1);
  });

  it("se cache pendant la pause puis recommence (boucle)", () => {
    const duration = travelDuration(polylineLength(line));
    expect(packetFrame(line, 1, 0, duration + 300).visible).toBe(false);
    const cycle = duration + 700 + 260;
    expect(packetFrame(line, 1, 0, cycle + duration / 2).visible).toBe(true);
  });
});

describe("runAnimation (arrêt propre)", () => {
  /** Planificateur factice : compte les demandes d'image en attente. */
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
    const flush = () => {
      const entry = [...pending][0];
      if (!entry) return false;
      const [handle, cb] = entry;
      pending.delete(handle);
      cb(0);
      return true;
    };
    return { scheduler, pending, flush };
  }

  it("appelle la fonction à chaque image avec le temps écoulé", () => {
    const { scheduler, flush } = fakeScheduler();
    let clock = 1000;
    const seen: number[] = [];
    runAnimation(
      (t) => seen.push(t),
      scheduler,
      () => clock,
    );
    clock = 1016;
    flush();
    clock = 1033;
    flush();
    expect(seen).toEqual([16, 33]);
  });

  it("n'a qu'une demande en attente, et aucune après l'arrêt", () => {
    const { scheduler, pending, flush } = fakeScheduler();
    const stop = runAnimation(
      () => {},
      scheduler,
      () => 0,
    );
    for (let i = 0; i < 5; i++) {
      expect(pending.size).toBe(1);
      flush();
    }
    stop();
    expect(pending.size).toBe(0);
  });

  it("ne fuit pas quand on enchaîne les étapes très vite", () => {
    const { scheduler, pending, flush } = fakeScheduler();
    let calls = 0;
    for (let i = 0; i < 1000; i++) {
      const stop = runAnimation(
        () => calls++,
        scheduler,
        () => 0,
      );
      if (i % 3 === 0) flush(); // parfois une image passe avant le changement d'étape
      stop();
    }
    expect(pending.size).toBe(0);
    flush();
    const before = calls;
    flush();
    expect(calls).toBe(before); // plus rien ne tourne
  });

  it("ne replanifie pas quand l'arrêt est demandé depuis la fonction d'image", () => {
    const { scheduler, pending, flush } = fakeScheduler();
    const stop: { current: () => void } = { current: () => {} };
    stop.current = runAnimation(
      () => stop.current(),
      scheduler,
      () => 0,
    );
    flush();
    expect(pending.size).toBe(0);
  });

  it("ignore une image déjà partie quand on arrête dans le même instant", () => {
    const { scheduler, pending } = fakeScheduler();
    let calls = 0;
    const stop = runAnimation(
      () => calls++,
      scheduler,
      () => 0,
    );
    const inFlight = [...pending.values()][0];
    stop();
    inFlight?.(0); // image déjà en vol côté navigateur
    expect(calls).toBe(0);
    expect(pending.size).toBe(0);
  });
});

describe("resolveFlow", () => {
  it("n'a pas de flux sans `flow`", async () => {
    const layout = await computeLayout(spec);
    expect(resolveFlow(spec, step("source"), layout)).toBeNull();
  });

  it("reprend les réglages de l'exemple pour chaque étape à flux", async () => {
    const layout = await computeLayout(spec);
    const flows = Object.fromEntries(
      spec.steps.flatMap((s) => {
        const f = resolveFlow(spec, s, layout);
        return f ? [[s.id, f]] : [];
      }),
    );
    expect(Object.keys(flows)).toEqual(["ingestion", "bronze", "orchestration", "silver", "gold"]);
    expect(flows.ingestion).toMatchObject({
      shape: "dot",
      count: 4,
      color: "--g-blue",
      pulse: null,
    });
    expect(flows.bronze).toMatchObject({ shape: "dot", color: "--bronze" });
    expect(flows.silver).toMatchObject({ shape: "square", color: "--silver" });
    expect(flows.gold).toMatchObject({ shape: "bar", count: 3, color: "--gold" });
  });

  it("fait pulser la destination d'un lien de déclenchement", async () => {
    const layout = await computeLayout(spec);
    const flow = resolveFlow(spec, step("orchestration"), layout)!;
    expect(flow.color).toBe("--g-teal");
    expect(flow.count).toBe(2);
    expect(flow.pulse).toEqual(layout.groups.dbt);
  });

  it("déduit forme et couleur de la couche quand `flow` ne les précise pas", async () => {
    const layout = await computeLayout(spec);
    const bare = { ...step("gold"), flow: { edge: "e4" } };
    expect(resolveFlow(spec, bare, layout)).toMatchObject({
      shape: "bar",
      count: 4,
      color: "--gold",
    });
    const toSilver = { ...step("gold"), flow: { edge: "e3" } };
    expect(resolveFlow(spec, toSilver, layout)).toMatchObject({
      shape: "square",
      color: "--silver",
    });
  });

  it("laisse `shape` explicite l'emporter", async () => {
    const layout = await computeLayout(spec);
    const forced = { ...step("gold"), flow: { edge: "e4", shape: "dot" as const } };
    expect(resolveFlow(spec, forced, layout)?.shape).toBe("dot");
  });
});

describe("Scene avec flux", () => {
  it("dessine les paquets et l'impulsion de l'orchestration", async () => {
    const layout = await computeLayout(spec);
    const flow = resolveFlow(spec, step("orchestration"), layout);
    const html = renderToStaticMarkup(
      <Scene spec={spec} layout={layout} flows={flow ? [flow] : []} />,
    );
    expect(html.match(/class="packet"/g)).toHaveLength(2);
    expect(html).toContain('class="pulse"');
    // les paquets sont dessinés en dernier, au-dessus des nœuds
    expect(html.indexOf('class="packets"')).toBeGreaterThan(html.indexOf('data-id="gd"'));
  });

  it("n'ajoute rien sans flux", async () => {
    const layout = await computeLayout(spec);
    const html = renderToStaticMarkup(<Scene spec={spec} layout={layout} />);
    expect(html).not.toContain("packet");
    expect(html).not.toContain("pulse");
  });
});
