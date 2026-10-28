export type Theme = "light" | "dark";

export const THEME_KEY = "archistep:theme";

export function parseTheme(value: string | null): Theme | null {
  return value === "light" || value === "dark" ? value : null;
}

/** Thème explicite s'il est enregistré, sinon celui du système. */
export function resolveTheme(stored: string | null, systemPrefersDark: boolean): Theme {
  return parseTheme(stored) ?? (systemPrefersDark ? "dark" : "light");
}

export function toggleTheme(current: Theme): Theme {
  return current === "dark" ? "light" : "dark";
}
