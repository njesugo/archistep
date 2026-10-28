import type { Point } from "./layout";

export function pathFromPoints(points: Point[]): string {
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" ");
}

/**
 * Où poser l'étiquette d'un lien : au-dessus du plus long segment s'il est horizontal ;
 * à gauche s'il est vertical (le côté droit est libre pour le titre du groupe voisin),
 * près de la pointe quand il est court.
 */
export function edgeLabelAnchor(points: Point[]): {
  x: number;
  y: number;
  anchor: "start" | "middle" | "end";
} {
  let best = { length: -1, a: points[0] ?? { x: 0, y: 0 }, b: points[0] ?? { x: 0, y: 0 } };
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const length = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
    if (length > best.length) best = { length, a, b };
  }
  const mx = (best.a.x + best.b.x) / 2;
  const my = (best.a.y + best.b.y) / 2;
  if (best.a.x !== best.b.x) return { x: mx, y: my - 10, anchor: "middle" };
  const y = best.length >= 80 ? my + 4 : Math.max(best.a.y, best.b.y) - 12;
  return { x: mx - 12, y, anchor: "end" };
}
