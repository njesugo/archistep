import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import example from "../src/examples/youtube-pipeline.json";
import { Stage } from "../src/components/Stage";
import { MAX_USER_ZOOM, panFrame, parseViewBox, zoomAt, type Frame } from "../src/engine/camera";
import { computeLayout } from "../src/engine/layout";
import { keyAction } from "../src/engine/state";
import { validateSpec } from "../src/spec/validate";

const whole: Frame = { x: 0, y: 0, width: 1600, height: 800 };

describe("zoom libre : calcul", () => {
  it("garde fixe le point sous le curseur", () => {
    const point = { x: 400, y: 200 };
    const next = zoomAt(whole, point, 2, whole);
    expect(next.width).toBe(800);
    expect(next.height).toBe(400);
    // même position relative du point dans le cadre avant et après
    expect((point.x - next.x) / next.width).toBeCloseTo((point.x - whole.x) / whole.width);
    expect((point.y - next.y) / next.height).toBeCloseTo((point.y - whole.y) / whole.height);
  });

  it("garde le rapport du cadre", () => {
    const next = zoomAt(whole, { x: 10, y: 10 }, 1.7, whole);
    expect(next.width / next.height).toBeCloseTo(whole.width / whole.height);
  });

  it("s'approche jusqu'à 4× la vue d'ensemble, pas plus", () => {
    let frame = whole;
    for (let i = 0; i < 50; i++) frame = zoomAt(frame, { x: 800, y: 400 }, 1.5, whole);
    expect(frame.width).toBeCloseTo(whole.width / MAX_USER_ZOOM);
  });

  it("n'a pas de limite pour s'éloigner", () => {
    let frame = whole;
    for (let i = 0; i < 40; i++) frame = zoomAt(frame, { x: 800, y: 400 }, 0.5, whole);
    expect(frame.width).toBeGreaterThan(whole.width * 1e5);
    expect(Number.isFinite(frame.width)).toBe(true);
  });

  it("revient exactement après un zoom avant puis arrière au même point", () => {
    const p = { x: 300, y: 500 };
    const back = zoomAt(zoomAt(whole, p, 2, whole), p, 0.5, whole);
    expect(back.x).toBeCloseTo(whole.x);
    expect(back.width).toBeCloseTo(whole.width);
  });

  it("déplace le cadre sans le redimensionner", () => {
    expect(panFrame(whole, 30, -10)).toEqual({ ...whole, x: 30, y: -10 });
  });

  it("relit un viewBox, ou refuse ce qui n'en est pas un", () => {
    expect(parseViewBox("1 2 300 400")).toEqual({ x: 1, y: 2, width: 300, height: 400 });
    expect(parseViewBox("1,2,300,400")).toEqual({ x: 1, y: 2, width: 300, height: 400 });
    expect(parseViewBox(null)).toBeNull();
    expect(parseViewBox("a b c d")).toBeNull();
    expect(parseViewBox("0 0 0 10")).toBeNull();
  });
});

describe("zoom libre : touches", () => {
  it("+ et - zooment, 0 reste « première étape » (le plein écran l'utilise pour tout revoir)", () => {
    expect(keyAction("+", false)).toBe("zoomIn");
    expect(keyAction("=", false)).toBe("zoomIn");
    expect(keyAction("-", false)).toBe("zoomOut");
    expect(keyAction("0", false)).toBe("first");
  });
});

describe("bouton « Tout »", () => {
  const parsed = validateSpec(example);
  if (!parsed.ok) throw new Error("exemple invalide");
  const render = async (active: boolean, zoomed: boolean) => {
    const layout = await computeLayout(parsed.spec);
    return renderToStaticMarkup(
      <Stage
        layout={{ status: "ready", spec: parsed.spec, layout }}
        lit={null}
        revealed={null}
        flows={[]}
        frame={undefined}
        animateCamera={false}
        aspect={undefined}
        measured
        fullscreen={{ supported: true, active, onToggle: () => {}, showButton: true }}
        zoom={{ zoomed, onReset: () => {} }}
      />,
    );
  };

  it("n'apparaît qu'en plein écran, une fois la vue modifiée", async () => {
    expect(await render(true, true)).toContain('class="stage-reset"');
    expect(await render(true, false)).not.toContain("stage-reset");
    expect(await render(false, true)).not.toContain("stage-reset");
  });
});
