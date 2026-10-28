// Ajustement des libellés aux formes du schéma, sans mesurer le DOM : on estime la largeur
// d'un caractère en fraction de la taille de police (déterministe et testable).

export type TextStyle = {
  /** Largeur moyenne d'un caractère, en fraction de la taille de police. */
  charEm: number;
  /** Espacement entre lettres, en fraction de la taille de police. */
  letterSpacing?: number;
};

/** IBM Plex Sans semi-gras (noms des nœuds). */
export const LABEL_STYLE: TextStyle = { charEm: 0.57 };
/** IBM Plex Mono (sous-titres des nœuds, titres de groupes). */
export const MONO_STYLE: TextStyle = { charEm: 0.6 };

export function textWidth(text: string, size: number, style: TextStyle): number {
  return text.length * size * (style.charEm + (style.letterSpacing ?? 0));
}

/** Coupe avec « … » pour tenir dans `maxWidth`. */
export function truncate(text: string, maxWidth: number, size: number, style: TextStyle): string {
  if (textWidth(text, size, style) <= maxWidth) return text;
  const perChar = size * (style.charEm + (style.letterSpacing ?? 0));
  const keep = Math.max(Math.floor(maxWidth / perChar) - 1, 1);
  return `${text.slice(0, keep).trimEnd()}…`;
}

export type FittedLabel = { lines: string[]; size: number; truncated: boolean };

/** Point de coupure le plus proche du milieu, sur une espace. */
function splitInTwo(text: string): [string, string] | null {
  const middle = text.length / 2;
  let best = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === " " && (best < 0 || Math.abs(i - middle) < Math.abs(best - middle))) best = i;
  }
  return best < 0 ? null : [text.slice(0, best), text.slice(best + 1)];
}

/**
 * Nom d'un nœud : sur une ligne à la plus grande taille possible (de `size` à `minSize`),
 * sinon sur deux lignes (à `twoLineSize` au plus), sinon tronqué. Jamais sous `minSize`.
 */
export function fitLabel(
  text: string,
  maxWidth: number,
  {
    size,
    minSize,
    twoLineSize,
    style,
  }: { size: number; minSize: number; twoLineSize: number; style: TextStyle },
): FittedLabel {
  for (let s = size; s >= minSize; s--) {
    if (textWidth(text, s, style) <= maxWidth) return { lines: [text], size: s, truncated: false };
  }
  const halves = splitInTwo(text);
  if (halves) {
    for (let s = Math.min(twoLineSize, size); s >= minSize; s--) {
      if (halves.every((h) => textWidth(h, s, style) <= maxWidth)) {
        return { lines: halves, size: s, truncated: false };
      }
    }
    const lines = halves.map((h) => truncate(h, maxWidth, minSize, style));
    return { lines, size: minSize, truncated: lines.some((l, i) => l !== halves[i]) };
  }
  return { lines: [truncate(text, maxWidth, minSize, style)], size: minSize, truncated: true };
}
