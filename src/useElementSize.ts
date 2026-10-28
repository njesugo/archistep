import { useEffect, useState } from "react";

export type Size = { width: number; height: number };

/**
 * Taille affichée d'un élément, suivie en direct (redimensionnement, tiroir ouvert, plein écran…).
 * S'utilise avec la référence renvoyée : `<div ref={ref}>` ; renvoie aussi l'élément lui-même.
 * Vaut 0 × 0 tant qu'elle n'est pas mesurée.
 */
export function useElementSize<T extends HTMLElement>() {
  const [element, setElement] = useState<T | null>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });

  useEffect(() => {
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const width = Math.round(entry.contentRect.width);
      const height = Math.round(entry.contentRect.height);
      setSize((previous) =>
        previous.width === width && previous.height === height ? previous : { width, height },
      );
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);

  return [setElement, size, element] as const;
}
