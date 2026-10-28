import { resolveFlow, type ResolvedFlow } from "./flow";
import type { Layout } from "./layout";
import type { Spec } from "../spec/schema";

/** Durée d'une étape du parcours, avant le facteur de vitesse : de quoi voir le flux passer. */
export const TOUR_STEP_MS = 4000;

/**
 * Étapes parcourues par l'animation continue : celles qui éclairent quelque chose. Une étape au
 * `focus` vide est une vue d'ensemble, qui n'a rien de plus à montrer qu'un schéma déjà complet.
 * Renvoie des indices dans `spec.steps`, dans l'ordre.
 */
export function tourSteps(spec: Spec): number[] {
  return spec.steps.flatMap((step, i) => (step.focus.length > 0 ? [i] : []));
}

/** Étape suivante du parcours, en boucle : la dernière enchaîne sur la première. */
export function nextTourIndex(current: number, count: number): number {
  return count <= 0 ? 0 : (current + 1) % count;
}

export function tourDwellMs(factor: number): number {
  return Math.round(TOUR_STEP_MS * factor);
}

/**
 * Flux en mouvement pendant une étape du parcours : celui de cette étape, et lui seul. Les autres
 * liens restent immobiles, pour qu'un seul flux attire l'œil à la fois. Vide si l'étape n'en a pas.
 */
export function tourFlows(
  spec: Spec,
  stepIndex: number | undefined,
  layout: Layout,
): ResolvedFlow[] {
  const step = stepIndex === undefined ? undefined : spec.steps[stepIndex];
  const flow = step ? resolveFlow(spec, step, layout) : null;
  return flow ? [flow] : [];
}
