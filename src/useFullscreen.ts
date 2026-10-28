import { useCallback, useEffect, useState } from "react";

/**
 * Plein écran d'un élément (l'API du navigateur). `supported` est faux là où elle n'existe pas
 * (iPhone, par exemple) ; `active` suit l'état réel, y compris quand on sort avec Échap.
 */
export function useFullscreen(element: HTMLElement | null) {
  const [active, setActive] = useState(false);
  const supported = typeof document !== "undefined" && document.fullscreenEnabled === true;

  useEffect(() => {
    const onChange = () => setActive(element !== null && document.fullscreenElement === element);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [element]);

  const toggle = useCallback(() => {
    if (!element || !supported) return;
    const result =
      document.fullscreenElement === element
        ? document.exitFullscreen()
        : element.requestFullscreen();
    // Refus du navigateur (geste utilisateur manquant, politique) : sans conséquence.
    result.catch(() => undefined);
  }, [element, supported]);

  return { supported, active, toggle };
}
