import { useEffect, useState } from "react";

/**
 * Largeur affichée d'un élément, suivie en direct (redimensionnement, tiroir ouvert…).
 * S'utilise avec la référence renvoyée : `<div ref={ref}>`. Vaut 0 tant qu'elle n'est pas mesurée.
 */
export function useElementWidth<T extends HTMLElement>() {
  const [element, setElement] = useState<T | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.round(entry.contentRect.width));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);

  return [setElement, width] as const;
}
