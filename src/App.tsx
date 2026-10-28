import { useEffect, useState } from "react";
import { resolveTheme, THEME_KEY, toggleTheme, type Theme } from "./theme";

function readStoredTheme(): string | null {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch {
    return null;
  }
}

export default function App() {
  const [theme, setTheme] = useState<Theme>(() =>
    resolveTheme(readStoredTheme(), window.matchMedia("(prefers-color-scheme: dark)").matches),
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  function onToggle() {
    const next = toggleTheme(theme);
    setTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // stockage indisponible : le choix vaut pour la session seulement
    }
  }

  return (
    <main className="home">
      <p className="eyebrow">Squelette · jalon M0</p>
      <h1>Bonjour, ArchiStep</h1>
      <p className="lede">
        Cet outil transformera bientôt une description d’architecture de données en schéma animé,
        présenté étape par étape.
      </p>
      <button type="button" onClick={onToggle}>
        {theme === "dark" ? "Passer au thème clair" : "Passer au thème sombre"}
      </button>
    </main>
  );
}
