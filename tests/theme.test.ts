import { describe, expect, it } from "vitest";
import { parseTheme, resolveTheme, toggleTheme } from "../src/theme";

describe("thème", () => {
  it("accepte uniquement clair et sombre", () => {
    expect(parseTheme("dark")).toBe("dark");
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("sepia")).toBeNull();
    expect(parseTheme(null)).toBeNull();
  });

  it("préfère le choix enregistré au réglage système", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("suit le système à défaut de choix valide", () => {
    expect(resolveTheme(null, true)).toBe("dark");
    expect(resolveTheme("n'importe quoi", false)).toBe("light");
  });

  it("bascule d'un thème à l'autre", () => {
    expect(toggleTheme("dark")).toBe("light");
    expect(toggleTheme("light")).toBe("dark");
  });
});
