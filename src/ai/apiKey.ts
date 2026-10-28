// Clé API : enregistrée uniquement dans ce navigateur (localStorage), envoyée seulement à Anthropic.

export const API_KEY_STORAGE = "archistep:anthropic-key";

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function defaultStore(): Store | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function readApiKey(store: Store | null = defaultStore()): string | null {
  try {
    return store?.getItem(API_KEY_STORAGE) || null;
  } catch {
    return null;
  }
}

export function saveApiKey(key: string, store: Store | null = defaultStore()): boolean {
  try {
    store?.setItem(API_KEY_STORAGE, key);
    return store !== null;
  } catch {
    return false;
  }
}

export function forgetApiKey(store: Store | null = defaultStore()): void {
  try {
    store?.removeItem(API_KEY_STORAGE);
  } catch {
    // rien à faire
  }
}

/** Nettoie ce qu'on colle (espaces, retours à la ligne, guillemets). */
export function cleanApiKey(raw: string): string {
  return raw
    .trim()
    .replace(/^["']|["']$/g, "")
    .trim();
}

/** Une clé Anthropic commence par « sk-ant- » et ne contient ni espace ni saut de ligne. */
export function looksLikeApiKey(key: string): boolean {
  return /^sk-ant-[A-Za-z0-9_-]{20,}$/.test(key);
}

/** « sk-ant-…ab12 » : de quoi reconnaître la clé sans l'afficher. */
export function maskApiKey(key: string): string {
  return key.length <= 8 ? "••••" : `sk-ant-…${key.slice(-4)}`;
}
