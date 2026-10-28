import { describe, expect, it } from "vitest";
import { edgeLabelAnchor, pathFromPoints } from "../src/engine/geometry";

describe("géométrie des liens", () => {
  it("écrit un chemin SVG", () => {
    expect(
      pathFromPoints([
        { x: 1, y: 2 },
        { x: 5, y: 2 },
        { x: 5, y: 9 },
      ]),
    ).toBe("M1 2 L5 2 L5 9");
  });

  it("place l'étiquette au-dessus d'un segment horizontal", () => {
    expect(
      edgeLabelAnchor([
        { x: 0, y: 50 },
        { x: 100, y: 50 },
      ]),
    ).toEqual({ x: 50, y: 40, anchor: "middle" });
  });

  it("place l'étiquette à gauche d'un segment vertical long", () => {
    expect(
      edgeLabelAnchor([
        { x: 20, y: 0 },
        { x: 20, y: 100 },
      ]),
    ).toEqual({ x: 8, y: 54, anchor: "end" });
  });

  it("place l'étiquette près de la pointe d'un segment vertical court", () => {
    expect(
      edgeLabelAnchor([
        { x: 20, y: 0 },
        { x: 20, y: 40 },
      ]),
    ).toEqual({ x: 8, y: 28, anchor: "end" });
  });

  it("choisit le plus long segment", () => {
    const anchor = edgeLabelAnchor([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 100 },
    ]);
    expect(anchor.anchor).toBe("end");
  });
});
