// Briques communes aux animations (flux, caméra).

export const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

// --- boucle d'animation ---

export type Scheduler = {
  request: (cb: (now: number) => void) => number;
  cancel: (handle: number) => void;
};

/**
 * Appelle `frame(elapsed)` à chaque image jusqu'à l'appel de la fonction renvoyée.
 * Une seule demande d'image est en attente à tout moment ; l'arrêt l'annule.
 */
export function runAnimation(
  frame: (elapsed: number) => void,
  scheduler: Scheduler,
  now: () => number,
): () => void {
  const start = now();
  let handle = 0;
  let stopped = false;
  const tick = () => {
    if (stopped) return;
    frame(now() - start);
    // `frame` a pu demander l'arrêt : ne pas replanifier dans ce cas.
    if (stopped) return;
    handle = scheduler.request(tick);
  };
  handle = scheduler.request(tick);
  return () => {
    stopped = true;
    scheduler.cancel(handle);
  };
}
