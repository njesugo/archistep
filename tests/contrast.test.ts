import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Contrastes WCAG des couleurs de texte, dans les deux thèmes (cahier, section 13).
const css = readFileSync(new URL("../src/styles/tokens.css", import.meta.url), "utf8");

function tokens(block: string): Record<string, string> {
  return Object.fromEntries(
    [...block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1]!, m[2]!]),
  );
}
const light = tokens(css.split("@media")[0]!);
const dark = tokens(css.split(':root[data-theme="dark"]')[1]!);

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!);
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

// [couleur du texte, fond] : là où chaque couleur sert à écrire du petit texte.
const TEXT_PAIRS: [string, string][] = [
  ["fg", "bg"],
  ["fg", "card"],
  ["fg", "soft"],
  ["muted", "bg"],
  ["muted", "card"],
  ["muted", "soft"],
  // sous-titres de nœuds (fond des nœuds) et pastilles de couche (panneaux)
  ...["bronze", "silver", "gold"].flatMap((c): [string, string][] => [
    [c, "bg"],
    [c, "card"],
  ]),
  // titres de groupes et étiquettes de liens, sur le fond de la scène
  ...["g-blue", "g-teal", "g-orange", "g-purple", "g-gray"].map((c): [string, string] => [
    c,
    "card",
  ]),
  // états des tâches du DAG et statut du tiroir
  ["ok", "card"],
  ["warn", "card"],
  ["fail", "card"],
];

describe.each([
  ["clair", light],
  ["sombre", dark],
])("contrastes, thème %s", (_, theme) => {
  it.each(TEXT_PAIRS)("%s sur %s atteint 4,5:1 (AA)", (text, background) => {
    expect(theme[text], text).toBeDefined();
    expect(theme[background], background).toBeDefined();
    expect(contrast(theme[text]!, theme[background]!)).toBeGreaterThanOrEqual(4.5);
  });

  it("l'anneau de focus se distingue des fonds (3:1)", () => {
    expect(contrast(theme.accent!, theme.card!)).toBeGreaterThanOrEqual(3);
    expect(contrast(theme.accent!, theme.bg!)).toBeGreaterThanOrEqual(3);
  });
});
