import { parentMap } from "./layout";
import type { Spec, Step } from "../spec/schema";

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
 * Renvoie null quand `focus` est vide : rien n'est atténué.
 */
export function litIds(spec: Spec, step: Step): Set<string> | null {
  if (step.focus.length === 0) return null;
  const parents = parentMap(spec);
  const edges = new Map(spec.edges.map((e) => [e.id, e]));
  const lit = new Set<string>();

  for (const id of step.focus) {
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

export type StepAction = "next" | "prev" | "first";

/**
 * Action déclenchée par une touche. Sur un bouton, Espace le déclenche déjà lui-même :
 * on ne l'intercepte pas, sinon l'étape avancerait deux fois.
 */
export function keyAction(key: string, onButton: boolean): StepAction | null {
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
    default:
      return null;
  }
}
