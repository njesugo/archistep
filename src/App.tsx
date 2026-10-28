import { useEffect, useState } from "react";
import example from "./examples/youtube-pipeline.json";
import { Scene } from "./components/Scene";
import { validateSpec } from "./spec/validate";
import { resolveTheme, THEME_KEY, toggleTheme, type Theme } from "./theme";
import { useLayout } from "./useLayout";

function readStoredTheme(): string | null {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch {
    return null;
  }
}

// M3 : l'exemple intégré, rendu statique. Le tiroir Spec (M8) permettra d'en charger d'autres.
const parsed = validateSpec(example);
if (!parsed.ok) throw new Error(parsed.errors.map((e) => e.message).join("\n"));
const spec = parsed.spec;

export default function App() {
  const [theme, setTheme] = useState<Theme>(() =>
    resolveTheme(readStoredTheme(), window.matchMedia("(prefers-color-scheme: dark)").matches),
  );
  const layout = useLayout(spec);

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
    <main className="page">
      <header className="head">
        {spec.meta.subtitle && <p className="eyebrow">{spec.meta.subtitle}</p>}
        <h1>{spec.meta.title}</h1>
      </header>
      <section className="stage" aria-label="Schéma de l’architecture">
        <div className="scroll">
          {layout.status === "ready" && <Scene spec={spec} layout={layout.layout} />}
          {layout.status === "loading" && <p className="stage-msg">Calcul du placement…</p>}
          {layout.status === "error" && (
            <p className="stage-msg" role="alert">
              Placement impossible : {layout.message}
            </p>
          )}
        </div>
      </section>
      <button type="button" onClick={onToggle}>
        {theme === "dark" ? "Passer au thème clair" : "Passer au thème sombre"}
      </button>
    </main>
  );
}
