import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Controls } from "../src/components/Controls";
import { LaserPointer } from "../src/components/LaserPointer";
import { laserStyle } from "../src/engine/laser";
import { DEFAULT_EXAMPLE } from "../src/examples";
import { parseSpecJson } from "../src/spec/validate";

describe("style du point lumineux", () => {
  it("se place à la position de la souris", () => {
    expect(laserStyle({ x: 400, y: 300 })).toEqual({
      transform: "translate3d(400px, 300px, 0)",
      opacity: "1",
    });
  });

  it("est invisible et hors de l'écran sans position", () => {
    expect(laserStyle(null)).toEqual({ transform: "translate3d(-100px, -100px, 0)", opacity: "0" });
  });
});

describe("LaserPointer", () => {
  it("ne dessine rien quand il est inactif", () => {
    expect(renderToStaticMarkup(<LaserPointer active={false} />)).toBe("");
  });

  it("dessine un point décoratif, caché des lecteurs d'écran", () => {
    expect(renderToStaticMarkup(<LaserPointer active />)).toBe(
      '<div class="laser" aria-hidden="true"></div>',
    );
  });

  // Garde-fou : un point qui reçoit les clics bloquerait toute l'interface.
  it("laisse passer les clics et passe au-dessus du tiroir", () => {
    const css = readFileSync(new URL("../src/styles/laser.css", import.meta.url), "utf8");
    const rule = /\.laser \{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(rule).toContain("pointer-events: none");
    expect(rule).toContain("position: fixed");
    const zLaser = Number(/z-index:\s*(\d+)/.exec(rule)?.[1]);
    const drawer = readFileSync(new URL("../src/styles/drawer.css", import.meta.url), "utf8");
    const zDrawer = Number(/\.drawer \{[^}]*z-index:\s*(\d+)/.exec(drawer)?.[1]);
    const ui = readFileSync(new URL("../src/styles/ui.css", import.meta.url), "utf8");
    const zExit = Number(/\.exit-presentation \{[^}]*z-index:\s*(\d+)/.exec(ui)?.[1]);
    expect(zLaser).toBeGreaterThan(zDrawer);
    expect(zLaser).toBeGreaterThan(zExit);
  });
});

describe("bouton Pointeur laser", () => {
  const spec = (() => {
    const r = parseSpecJson(DEFAULT_EXAMPLE.text);
    if (!r.ok) throw new Error("exemple invalide");
    return r.spec;
  })();
  const render = (laser: boolean) =>
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
        laser={laser}
        onToggleLaser={() => {}}
        autoplay="off"
        onTogglePlay={() => {}}
        animation="off"
        onToggleAnimation={() => {}}
        speed="normal"
        onSpeed={() => {}}
        onPrev={() => {}}
        onNext={() => {}}
        onGoTo={() => {}}
        themeLabel="Thème sombre"
        onToggleTheme={() => {}}
      />,
    );

  it("montre son état (texte et aria-pressed) et annonce son raccourci", () => {
    expect(render(false)).toMatch(
      /aria-pressed="false"[^>]*aria-keyshortcuts="L"[^>]*>Pointeur laser : non/,
    );
    expect(render(true)).toMatch(
      /aria-pressed="true"[^>]*aria-keyshortcuts="L"[^>]*>Pointeur laser : oui/,
    );
  });
});
