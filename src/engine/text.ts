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

// Mesures partagées par le placement (qui réserve la place) et le rendu (qui dessine).

/** Marge intérieure d'un nœud, de chaque côté du texte. */
export const NODE_TEXT_PAD = 10;
/** Taille du sous-titre d'un nœud. */
export const SUB_SIZE = 12;
/** Titre de groupe : 14 px, mono, majuscules, espacement 0,1 em. */
export const GROUP_TITLE = { size: 14, style: { ...MONO_STYLE, letterSpacing: 0.1 } };
/** Position du titre d'un groupe sans logo, et du logo d'un groupe, depuis son bord gauche. */
export const GROUP_TITLE_LEFT = 22;
export const GROUP_ICON_LEFT = 20;
/** Largeur maximale du logo d'un groupe, et espace entre le logo et le titre. */
export const GROUP_ICON_MAX_W = 56;
export const GROUP_ICON_GAP = 10;
/** Marge à droite du titre d'un groupe. */
export const GROUP_TITLE_RIGHT = 16;
/** Étiquette d'un lien : 13 px, mono ; au-delà de `maxWidth`, elle passe sur deux lignes. */
export const EDGE_LABEL = { size: 13, style: MONO_STYLE, maxWidth: 130, lineHeight: 16, pad: 6 };

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

/**
 * Texte réparti sur une ou deux lignes de `maxWidth` au plus : une seule s'il tient, sinon coupé
 * sur une espace près du milieu, et tronqué avec « … » si cela ne suffit pas.
 */
export function wrapText(text: string, maxWidth: number, size: number, style: TextStyle): string[] {
  if (textWidth(text, size, style) <= maxWidth) return [text];
  const halves = splitInTwo(text);
  if (!halves) return [truncate(text, maxWidth, size, style)];
  return halves.map((half) => truncate(half, maxWidth, size, style));
}

/** Dimensions de l'étiquette d'un lien (texte et marge), et ses lignes. */
export function edgeLabelBox(label: string): { lines: string[]; width: number; height: number } {
  const { size, style, maxWidth, lineHeight, pad } = EDGE_LABEL;
  const lines = wrapText(label, maxWidth, size, style);
  const widest = Math.max(...lines.map((line) => textWidth(line, size, style)));
  return {
    lines,
    width: Math.ceil(widest) + 2 * pad,
    height: lines.length * lineHeight + pad,
  };
}
