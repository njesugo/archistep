// Sauvegarde locale de la spec (localStorage). Tout est optionnel : si le stockage est
// indisponible ou contient autre chose qu'une spec valide, on retombe sur l'exemple.
import { parseSpecJson } from "./spec/validate";
import type { Spec } from "./spec/schema";

export const SPEC_KEY = "archistep:spec";

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function defaultStore(): Store | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** Texte et spec sauvegardés, ou null si rien de valide n'est enregistré. */
export function readSavedSpec(
  store: Store | null = defaultStore(),
): { text: string; spec: Spec } | null {
  try {
    const text = store?.getItem(SPEC_KEY);
    if (!text) return null;
    const result = parseSpecJson(text);
    return result.ok ? { text, spec: result.spec } : null;
  } catch {
    return null;
  }
}

export function saveSpec(text: string, store: Store | null = defaultStore()): void {
  try {
    store?.setItem(SPEC_KEY, text);
  } catch {
    // quota dépassé ou stockage bloqué : la spec reste en mémoire pour la session
  }
}

export function clearSavedSpec(store: Store | null = defaultStore()): void {
  try {
    store?.removeItem(SPEC_KEY);
  } catch {
    // rien à faire
  }
}
