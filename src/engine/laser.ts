export type Point = { x: number; y: number };

/** Style du point lumineux : à la position de la souris, ou invisible sans position. */
export function laserStyle(point: Point | null): { transform: string; opacity: string } {
  if (!point) return { transform: "translate3d(-100px, -100px, 0)", opacity: "0" };
  return { transform: `translate3d(${point.x}px, ${point.y}px, 0)`, opacity: "1" };
}
