import { describe, expect, it } from "vitest";
import { fitLogo } from "../src/icons/logoSize";

describe("taille des logos", () => {
  it("garde un logo carré carré, à la hauteur maximale", () => {
    expect(fitLogo(1, 108, 40)).toEqual({ width: 40, height: 40 });
  });

  it("étale un logo large (symbole + nom) en conservant ses proportions", () => {
    const box = fitLogo(1812 / 700, 108, 40); // Airflow
    expect(box.height).toBe(40);
    expect(box.width).toBeCloseTo(103.5, 0);
    expect(box.width / box.height).toBeCloseTo(1812 / 700);
  });

  it("réduit un logo très large pour qu'il tienne dans la largeur", () => {
    const box = fitLogo(800 / 223, 108, 40); // Fivetran
    expect(box.width).toBeCloseTo(108);
    expect(box.height).toBeCloseTo(108 / (800 / 223));
    expect(box.height).toBeLessThan(40);
  });

  it("gère un logo haut", () => {
    expect(fitLogo(0.5, 108, 40)).toEqual({ width: 20, height: 40 });
  });

  it("ne dépasse jamais le cadre, quel que soit le rapport", () => {
    for (const aspect of [0.2, 0.5, 1, 1.43, 2.4, 3.6, 10, 50]) {
      const box = fitLogo(aspect, 108, 40);
      expect(box.width, String(aspect)).toBeLessThanOrEqual(108 + 1e-9);
      expect(box.height, String(aspect)).toBeLessThanOrEqual(40 + 1e-9);
    }
  });

  it("retombe sur un carré si le rapport est inconnu ou invalide", () => {
    for (const bad of [0, -2, NaN, Infinity])
      expect(fitLogo(bad, 108, 40)).toEqual({ width: 40, height: 40 });
  });
});
