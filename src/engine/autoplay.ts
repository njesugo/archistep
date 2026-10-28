import type { Beat, Step } from "../spec/schema";

export type PlaybackSpeed = { id: "slow" | "normal" | "fast"; label: string; factor: number };

/** Vitesses de la lecture automatique : le facteur multiplie la durée de chaque état. */
export const PLAYBACK_SPEEDS: PlaybackSpeed[] = [
  { id: "slow", label: "Lente", factor: 1.5 },
  { id: "normal", label: "Normale", factor: 1 },
  { id: "fast", label: "Rapide", factor: 0.65 },
];

export const DEFAULT_SPEED: PlaybackSpeed["id"] = "normal";

/** Temps pour repérer ce qui est éclairé avant de lire, et pour parcourir un tableau ou du code. */
const ORIENTATION_MS = 2500;
const PANEL_MS = 2500;
/** Lecture d'un texte français : environ 200 mots par minute, soit 55 ms par caractère. */
const READING_MS_PER_CHAR = 55;
const MIN_DWELL_MS = 3000;
const MAX_DWELL_MS = 40_000;

export function speedFactor(id: string): number {
  return PLAYBACK_SPEEDS.find((s) => s.id === id)?.factor ?? 1;
}

/**
 * Durée d'affichage d'un état (étape ou sous-étape) en lecture automatique : le temps de lire
 * son texte, plus de quoi regarder le schéma et ses panneaux, multiplié par la vitesse choisie.
 * Toujours assez longue pour que le glissement de caméra (700 ms) soit terminé.
 */
export function dwellMs(step: Step, beat: Beat | undefined, factor: number): number {
  const text = beat?.text ?? step.text;
  const base =
    ORIENTATION_MS + text.length * READING_MS_PER_CHAR + (step.panels?.length ? PANEL_MS : 0);
  return Math.min(Math.max(Math.round(base * factor), MIN_DWELL_MS), MAX_DWELL_MS);
}
