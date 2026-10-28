import { useEffect, useState } from "react";
import { fitLogo, type Box } from "./logoSize";
import type { ResolvedIcon } from "./registry";

// Rapport largeur / hauteur des logos fournis, mesuré une fois par fichier.
const aspects = new Map<string, number>();
const pending = new Map<string, Promise<number>>();

function loadAspect(url: string): Promise<number> {
  let promise = pending.get(url);
  if (!promise) {
    promise = new Promise<number>((resolve) => {
      const image = new Image();
      image.onload = () =>
        resolve(image.naturalHeight ? image.naturalWidth / image.naturalHeight : 1);
      image.onerror = () => resolve(1);
      image.src = url;
    }).then((aspect) => {
      aspects.set(url, aspect);
      return aspect;
    });
    pending.set(url, promise);
  }
  return promise;
}

/**
 * Boîte occupée par une icône dans un cadre `maxW` × `maxH`. Un logo fourni garde ses
 * proportions (sa taille se précise dès que le fichier est lu, d'abord carré) ;
 * les autres icônes sont carrées.
 */
export function useIconBox(icon: ResolvedIcon, maxW: number, maxH: number): Box {
  const url = icon.source === "user" ? icon.url : undefined;
  const [, refresh] = useState(0);

  useEffect(() => {
    if (!url || aspects.has(url)) return;
    let cancelled = false;
    void loadAspect(url).then(() => {
      if (!cancelled) refresh((n) => n + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return url ? fitLogo(aspects.get(url) ?? 1, maxW, maxH) : { width: maxH, height: maxH };
}
