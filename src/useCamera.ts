import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { animateCamera, frameToViewBox, type Frame } from "./engine/camera";

/**
 * Pilote le `viewBox` du <svg> vers `target`. Le cadre est écrit directement dans le DOM
 * (pas de rendu React à chaque image). Au premier affichage, ou sans animation
 * (mouvement réduit), le cadre est posé tout de suite.
 */
export function useCamera(svg: RefObject<SVGSVGElement | null>, target: Frame, animate: boolean) {
  const current = useRef<Frame | null>(null);

  const apply = (frame: Frame) => {
    current.current = frame;
    svg.current?.setAttribute("viewBox", frameToViewBox(frame));
  };

  // Premier affichage : pas de déplacement depuis un cadre qui n'existe pas encore.
  useLayoutEffect(() => {
    if (!current.current) apply(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- une seule fois, à l'affichage
  }, []);

  useEffect(() => {
    const from = current.current;
    if (!from || !animate || frameToViewBox(from) === frameToViewBox(target)) {
      apply(target);
      return;
    }
    // Départ du cadre réellement affiché : un changement d'étape en cours de route est fluide.
    return animateCamera(
      from,
      target,
      apply,
      { request: (cb) => requestAnimationFrame(cb), cancel: (h) => cancelAnimationFrame(h) },
      () => performance.now(),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `apply` ne dépend que de refs
  }, [target, animate]);
}
