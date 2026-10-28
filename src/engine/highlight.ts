import type { Beat } from "../spec/schema";

export type Highlight = NonNullable<Beat["highlight"]>;

const some = (list: number[] | undefined): list is number[] =>
  list !== undefined && list.length > 0;

/**
 * Une cellule est surlignée par `rows` seul (ligne entière), `cols` seul (colonne entière),
 * ou par les deux (seulement leur intersection).
 */
export function cellHighlighted(hl: Highlight | undefined, row: number, col: number): boolean {
  if (!hl) return false;
  const rowHit = some(hl.rows) ? hl.rows.includes(row) : null;
  const colHit = some(hl.cols) ? hl.cols.includes(col) : null;
  if (rowHit === null && colHit === null) return false;
  return (rowHit ?? true) && (colHit ?? true);
}

export function lineHighlighted(hl: Highlight | undefined, line: number): boolean {
  return some(hl?.lines) && hl.lines.includes(line);
}

export function hasTableHighlight(hl: Highlight | undefined): boolean {
  return some(hl?.rows) || some(hl?.cols);
}

export function hasCodeHighlight(hl: Highlight | undefined): boolean {
  return some(hl?.lines);
}
