import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import example from "../src/examples/youtube-pipeline.json";
import { Controls, type AutoplayState } from "../src/components/Controls";
import { DEFAULT_SPEED, dwellMs, PLAYBACK_SPEEDS, speedFactor } from "../src/engine/autoplay";
import type { Spec, Step } from "../src/spec/schema";
import { validateSpec } from "../src/spec/validate";

const parsed = validateSpec(example);
if (!parsed.ok) throw new Error("exemple invalide");
const spec: Spec = parsed.spec;
const step = (id: string) => spec.steps.find((s) => s.id === id)!;
const plain = (text: string, over: Partial<Step> = {}): Step => ({
  id: "x",
  title: "x",
  text,
  focus: [],
  ...over,
});

describe("durée d'affichage en lecture automatique", () => {
  it("laisse plus de temps à un texte plus long", () => {
    const short = dwellMs(plain("Une phrase courte."), undefined, 1);
    const long = dwellMs(plain("Une phrase bien plus longue. ".repeat(8)), undefined, 1);
    expect(long).toBeGreaterThan(short);
  });

  it("compte environ 55 ms par caractère, plus un temps d'orientation", () => {
    const text = "x".repeat(100);
    expect(dwellMs(plain(text), undefined, 1)).toBe(2500 + 100 * 55);
  });

  it("ajoute du temps quand l'étape a des panneaux à regarder", () => {
    const text = "x".repeat(100); // assez long pour ne pas toucher la durée minimale
    const withPanels = plain(text, {
      panels: [{ type: "list", title: "t", items: [{ label: "a", text: "b" }] }],
    });
    expect(dwellMs(withPanels, undefined, 1)).toBe(dwellMs(plain(text), undefined, 1) + 2500);
  });

  it("utilise le texte de la sous-étape quand elle en a un", () => {
    const withBeat = plain("x".repeat(400));
    const beatText = "y".repeat(50);
    expect(dwellMs(withBeat, { text: beatText }, 1)).toBe(2500 + 50 * 55);
    expect(dwellMs(withBeat, {}, 1)).toBe(2500 + 400 * 55);
  });

  it("applique la vitesse choisie", () => {
    const s = step("bronze");
    const normal = dwellMs(s, undefined, speedFactor("normal"));
    expect(dwellMs(s, undefined, speedFactor("slow"))).toBeGreaterThan(normal);
    expect(dwellMs(s, undefined, speedFactor("fast"))).toBeLessThan(normal);
  });

  it("reste dans des bornes raisonnables, quelle que soit la longueur ou la vitesse", () => {
    const empty = plain("");
    const huge = plain("x".repeat(100_000));
    for (const speed of PLAYBACK_SPEEDS) {
      expect(dwellMs(empty, undefined, speed.factor)).toBeGreaterThanOrEqual(3000);
      expect(dwellMs(huge, undefined, speed.factor)).toBeLessThanOrEqual(40_000);
    }
    // toujours plus long que le glissement de caméra (700 ms)
    expect(dwellMs(empty, undefined, 0.01)).toBeGreaterThan(700);
  });

  it("donne à chaque état de l'exemple un temps de lecture plausible (4 à 30 s en vitesse normale)", () => {
    for (const s of spec.steps) {
      for (const beat of s.beats?.length ? s.beats : [undefined]) {
        const ms = dwellMs(s, beat, 1);
        expect(ms, s.id).toBeGreaterThanOrEqual(4000);
        expect(ms, s.id).toBeLessThanOrEqual(30_000);
      }
    }
  });
});

describe("vitesses", () => {
  it("propose lente, normale et rapide, normale par défaut", () => {
    expect(PLAYBACK_SPEEDS.map((s) => s.id)).toEqual(["slow", "normal", "fast"]);
    expect(DEFAULT_SPEED).toBe("normal");
    expect(speedFactor("normal")).toBe(1);
  });

  it("retombe sur la vitesse normale pour un identifiant inconnu", () => {
    expect(speedFactor("turbo")).toBe(1);
  });
});

describe("bouton Lecture auto", () => {
  const render = (autoplay: AutoplayState, speed = "normal") =>
    renderToStaticMarkup(
      <Controls
        steps={spec.steps}
        index={0}
        atStart
        atEnd={false}
        progressive={false}
        onToggleProgressive={() => {}}
        drawerOpen={false}
        onToggleDrawer={() => {}}
        onPresent={() => {}}
        laser={false}
        onToggleLaser={() => {}}
        autoplay={autoplay}
        onTogglePlay={() => {}}
        animation="off"
        onToggleAnimation={() => {}}
        speed={speed}
        onSpeed={() => {}}
        onPrev={() => {}}
        onNext={() => {}}
        onGoTo={() => {}}
        themeLabel="Thème sombre"
        onToggleTheme={() => {}}
      />,
    );

  it("montre son état en texte et en aria-pressed, et annonce son raccourci", () => {
    expect(render("off")).toMatch(
      /aria-pressed="false"[^>]*aria-keyshortcuts="A"[^>]*>Lecture auto : non/,
    );
    expect(render("on")).toMatch(
      /aria-pressed="true"[^>]*aria-keyshortcuts="A"[^>]*>Lecture auto : oui/,
    );
    expect(render("paused")).toMatch(/aria-pressed="true"[^>]*>Lecture auto : en pause/);
  });

  it("propose les trois vitesses, avec la vitesse courante sélectionnée", () => {
    const html = render("off", "fast");
    expect(html).toContain("Vitesse de la lecture auto et de l’animation continue");
    expect(html).toMatch(/<option value="slow">Vitesse : lente<\/option>/);
    expect(html).toMatch(/<option value="fast" selected="">Vitesse : rapide<\/option>/);
  });
});
