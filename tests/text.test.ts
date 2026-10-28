import { describe, expect, it } from "vitest";
import { fitLabel, LABEL_STYLE, MONO_STYLE, textWidth, truncate } from "../src/engine/text";

const node = { size: 17, minSize: 14, twoLineSize: 15, style: LABEL_STYLE };
const WIDTH = 120; // nœud de 140, 10 de marge de chaque côté

describe("libellés des nœuds", () => {
  it("garde un nom court sur une ligne, à la taille normale", () => {
    expect(fitLabel("Databricks", WIDTH, node)).toEqual({
      lines: ["Databricks"],
      size: 17,
      truncated: false,
    });
  });

  it("réduit la police avant de couper", () => {
    const fitted = fitLabel("Apache Kafka X", WIDTH, node);
    expect(fitted.lines).toHaveLength(1);
    expect(fitted.size).toBeLessThan(17);
    expect(fitted.size).toBeGreaterThanOrEqual(14);
  });

  it("passe sur deux lignes, coupées au plus près du milieu", () => {
    const fitted = fitLabel("Fivetran EN DIRECT", WIDTH, node);
    expect(fitted).toEqual({ lines: ["Fivetran", "EN DIRECT"], size: 15, truncated: false });
  });

  it("tronque un mot trop long, sans descendre sous la taille minimale", () => {
    const fitted = fitLabel("Supercalifragilisticexpialidocious", WIDTH, node);
    expect(fitted.size).toBe(14);
    expect(fitted.truncated).toBe(true);
    expect(fitted.lines[0]!.endsWith("…")).toBe(true);
    expect(textWidth(fitted.lines[0]!, 14, LABEL_STYLE)).toBeLessThanOrEqual(WIDTH);
  });

  it("tronque chaque ligne si deux lignes ne suffisent pas", () => {
    const fitted = fitLabel("Ingestion incrémentale quotidienne multi-sources", WIDTH, node);
    expect(fitted.lines).toHaveLength(2);
    expect(fitted.truncated).toBe(true);
    for (const line of fitted.lines)
      expect(textWidth(line, 14, LABEL_STYLE)).toBeLessThanOrEqual(WIDTH);
  });

  it("tient toujours dans la largeur, quel que soit le texte", () => {
    const samples = [
      "a",
      "Kafka",
      "Amazon Kinesis Data Firehose",
      "x".repeat(80),
      "un deux trois quatre cinq",
    ];
    for (const text of samples) {
      const fitted = fitLabel(text, WIDTH, node);
      for (const line of fitted.lines) {
        expect(textWidth(line, fitted.size, LABEL_STYLE), text).toBeLessThanOrEqual(WIDTH);
      }
      expect(fitted.size).toBeGreaterThanOrEqual(14);
    }
  });
});

describe("troncature", () => {
  it("ne touche pas un texte qui tient", () => {
    expect(truncate("SILVER · nettoyé", WIDTH, 12, MONO_STYLE)).toBe("SILVER · nettoyé");
  });

  it("ajoute « … » et tient dans la largeur", () => {
    const style = { ...MONO_STYLE, letterSpacing: 0.1 };
    const out = truncate("APACHE AIRFLOW · ORCHESTRATION DES TÂCHES", 200, 14, style);
    expect(out.endsWith("…")).toBe(true);
    expect(textWidth(out, 14, style)).toBeLessThanOrEqual(200);
  });
});
