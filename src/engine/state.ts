import { parentMap } from "./layout";
import type { Beat, Spec, Step } from "../spec/schema";

/** Ramène un indice d'étape dans [0, count - 1]. */
export function clampStep(index: number, count: number): number {
  return Math.min(Math.max(index, 0), Math.max(count - 1, 0));
}

function ancestorsOf(id: string, parents: Map<string, string>): string[] {
  const out: string[] = [];
  for (let p = parents.get(id); p !== undefined; p = parents.get(p)) out.push(p);
  return out;
}

/**
 * Ids mis en valeur à une étape : ceux de `focus`, plus les groupes ancêtres de chacun
 * (un lien n'a pas de parent : on prend les groupes qui contiennent ses deux extrémités).
 * Pendant une sous-étape, son `focus` (s'il existe) remplace celui de l'étape.
 * Renvoie null quand le focus est vide : rien n'est atténué (c'est la vue d'ensemble).
 */
export function litIds(spec: Spec, step: Step, beat?: Beat): Set<string> | null {
  const focus = beat?.focus ?? step.focus;
  if (focus.length === 0) return null;
  const parents = parentMap(spec);
  const edges = new Map(spec.edges.map((e) => [e.id, e]));
  const lit = new Set<string>();

  for (const id of focus) {
    lit.add(id);
    const edge = edges.get(id);
    if (edge) {
      // Un lien n'a pas de parent : on garde les groupes qui contiennent ses deux extrémités.
      const fromGroups = new Set(ancestorsOf(edge.from, parents));
      for (const a of ancestorsOf(edge.to, parents)) if (fromGroups.has(a)) lit.add(a);
    } else {
      for (const a of ancestorsOf(id, parents)) lit.add(a);
    }
  }
  return lit;
}

export type ShortcutAction = "next" | "prev" | "first" | "present" | "exit" | "laser";

/**
 * Raccourcis clavier (cahier, section 8) : flèche droite ou Espace = suivant, flèche gauche =
 * précédent, 0 ou Début = première étape, P = mode présentation, Échap = quitter,
 * L = pointeur laser.
 * Sur un bouton, Espace le déclenche déjà lui-même : on ne l'intercepte pas, sinon l'étape
 * avancerait deux fois.
 */
export function keyAction(key: string, onButton: boolean): ShortcutAction | null {
  switch (key) {
    case "ArrowRight":
      return "next";
    case " ":
      return onButton ? null : "next";
    case "ArrowLeft":
      return "prev";
    case "Home":
    case "0":
      return "first";
    case "p":
    case "P":
      return "present";
    case "l":
    case "L":
      return "laser";
    case "Escape":
      return "exit";
    default:
      return null;
  }
}

/** Un état affichable : une étape, et une sous-étape de cette étape (0 si elle n'en a pas). */
export type Position = { step: number; beat: number };

/** Tous les états dans l'ordre : Suivant et Précédent parcourent cette liste. */
export function positions(spec: Spec): Position[] {
  return spec.steps.flatMap((step, s) =>
    Array.from({ length: Math.max(step.beats?.length ?? 0, 1) }, (_, b) => ({ step: s, beat: b })),
  );
}

/** Indice du premier état d'une étape (là où mène une pastille). */
export function firstIndexOfStep(all: Position[], step: number): number {
  return Math.max(
    all.findIndex((p) => p.step === step),
    0,
  );
}

/**
 * Ids visibles en construction progressive : tout ce qu'un état antérieur ou courant a mis
 * en valeur. Renvoie null (tout est visible) hors de ce mode, et sur la vue d'ensemble.
 */
export function revealedIds(
  spec: Spec,
  all: Position[],
  index: number,
  progressive: boolean,
): Set<string> | null {
  if (!progressive) return null;
  const at = (p: Position | undefined) => {
    const step = p ? spec.steps[p.step] : undefined;
    return step && p ? litIds(spec, step, step.beats?.[p.beat]) : null;
  };
  if (at(all[index]) === null) return null;
  const revealed = new Set<string>();
  for (const p of all.slice(0, index + 1)) for (const id of at(p) ?? []) revealed.add(id);
  return revealed;
}
