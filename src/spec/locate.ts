// Retrouve où une valeur se trouve dans le texte JSON, pour que cliquer sur une erreur
// place le curseur au bon endroit de l'éditeur.

export type TextRange = { start: number; end: number };

type Entry = { keyStart: number | null; start: number; end: number };

/** Lecteur JSON minimal qui note la position de chaque valeur, par chemin. */
function scan(text: string): Map<string, Entry> | null {
  const entries = new Map<string, Entry>();
  let i = 0;

  const skipSpace = () => {
    while (i < text.length && /\s/.test(text[i]!)) i++;
  };
  const readString = (): string | null => {
    if (text[i] !== '"') return null;
    const start = i++;
    while (i < text.length && text[i] !== '"') i += text[i] === "\\" ? 2 : 1;
    if (i >= text.length) return null;
    i++;
    try {
      return JSON.parse(text.slice(start, i)) as string;
    } catch {
      return null;
    }
  };
  const readValue = (path: string, keyStart: number | null): boolean => {
    skipSpace();
    const start = i;
    const ch = text[i];
    if (ch === "{") {
      i++;
      skipSpace();
      if (text[i] === "}") i++;
      else {
        for (;;) {
          skipSpace();
          const keyAt = i;
          const key = readString();
          if (key === null) return false;
          skipSpace();
          if (text[i++] !== ":") return false;
          if (!readValue(path ? `${path}.${key}` : key, keyAt)) return false;
          skipSpace();
          if (text[i] === ",") i++;
          else if (text[i] === "}") {
            i++;
            break;
          } else return false;
        }
      }
    } else if (ch === "[") {
      i++;
      skipSpace();
      if (text[i] === "]") i++;
      else {
        for (let n = 0; ; n++) {
          if (!readValue(path ? `${path}.${n}` : String(n), null)) return false;
          skipSpace();
          if (text[i] === ",") i++;
          else if (text[i] === "]") {
            i++;
            break;
          } else return false;
        }
      }
    } else if (ch === '"') {
      if (readString() === null) return false;
    } else {
      const m = /^(?:-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)/.exec(text.slice(i));
      if (!m) return false;
      i += m[0].length;
    }
    entries.set(path, { keyStart, start, end: i });
    return true;
  };

  return readValue("", null) ? entries : null;
}

/**
 * Position à sélectionner pour un chemin d'erreur : la clé et le début de la valeur, sur la
 * première ligne seulement. Si le champ n'existe pas (champ manquant), on remonte au parent.
 * Renvoie null si le texte n'est pas du JSON lisible.
 */
export function locatePath(text: string, path: (string | number)[]): TextRange | null {
  const entries = scan(text);
  if (!entries) return null;
  for (let n = path.length; n >= 0; n--) {
    const entry = entries.get(path.slice(0, n).join("."));
    if (!entry) continue;
    const start = entry.keyStart ?? entry.start;
    const newline = text.indexOf("\n", start);
    const lineEnd = newline === -1 ? text.length : newline;
    return { start, end: Math.max(Math.min(entry.end, lineEnd), start) };
  }
  return null;
}

/** Numéro de ligne (à partir de 0) d'une position dans le texte. */
export function lineOf(text: string, offset: number): number {
  let line = 0;
  for (let i = 0; i < offset && i < text.length; i++) if (text[i] === "\n") line++;
  return line;
}
