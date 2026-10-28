import { easeInOut } from "./animation";
import type { Layout, Point, Rect } from "./layout";
import { parentMap } from "./layout";
import type { Spec, Step } from "../spec/schema";

export type PacketShape = "dot" | "square" | "bar";

/** Flux prêt à dessiner pour l'étape courante. */
export type ResolvedFlow = {
  edgeId: string;
  points: Point[];
  shape: PacketShape;
  count: number;
  /** Nom d'une variable CSS de couleur, par exemple "--bronze". */
  color: string;
  /** Une impulsion est dessinée autour de la destination (lien de déclenchement). */
  pulse: Rect | null;
};

const DEFAULT_COUNT = 4;
const LAYER_SHAPE: Record<string, PacketShape> = { bronze: "dot", silver: "square", gold: "bar" };

/**
 * Forme, couleur et impulsion d'un flux. Convention du prototype, sans cas particulier :
 * la forme suit la couche de la destination (brut = points, nettoyé = carrés, agrégé = barres) ;
 * la couleur est celle de cette couche, à défaut celle du plus petit groupe qui contient les
 * deux extrémités ; un lien de déclenchement a la couleur des liens de déclenchement
 * et fait pulser sa destination.
 */
export function resolveFlow(spec: Spec, step: Step, layout: Layout): ResolvedFlow | null {
  if (!step.flow) return null;
  const edge = spec.edges.find((e) => e.id === step.flow?.edge);
  const points = edge ? layout.edges[edge.id] : undefined;
  if (!edge || !points) return null;

  const layerOf = (id: string) => spec.nodes.find((n) => n.id === id)?.layer;
  const toLayer = layerOf(edge.to);
  const trigger = edge.style === "trigger";

  const parents = parentMap(spec);
  const chain = (id: string) => {
    const out: string[] = [];
    for (let p = parents.get(id); p !== undefined; p = parents.get(p)) out.push(p);
    return out;
  };
  const fromChain = new Set(chain(edge.from));
  const commonGroup = chain(edge.to).find((g) => fromChain.has(g));
  const groupColor = spec.groups.find((g) => g.id === commonGroup)?.color;
  const layer = toLayer ?? layerOf(edge.from);

  return {
    edgeId: edge.id,
    points,
    shape: step.flow.shape ?? (toLayer ? LAYER_SHAPE[toLayer] : undefined) ?? "dot",
    count: step.flow.count ?? DEFAULT_COUNT,
    color: trigger ? "--g-teal" : layer ? `--${layer}` : groupColor ? `--g-${groupColor}` : "--fg",
    pulse: trigger ? (layout.nodes[edge.to] ?? layout.groups[edge.to] ?? null) : null,
  };
}

/**
 * Tous les flux de la spec, un par lien (le premier trouvé l'emporte) : l'animation continue les
 * fait tourner ensemble, sans attendre l'étape qui les met en scène.
 */
export function resolveAllFlows(spec: Spec, layout: Layout): ResolvedFlow[] {
  const flows = new Map<string, ResolvedFlow>();
  for (const step of spec.steps) {
    const flow = resolveFlow(spec, step, layout);
    if (flow && !flows.has(flow.edgeId)) flows.set(flow.edgeId, flow);
  }
  return [...flows.values()];
}

// --- géométrie du tracé (polyligne) ---

export function polylineLength(points: Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y);
  }
  return total;
}

/** Point situé à `distance` du début de la polyligne (borné aux extrémités). */
export function pointAt(points: Point[], distance: number): Point {
  const first = points[0];
  if (!first) return { x: 0, y: 0 };
  let remaining = Math.max(distance, 0);
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const segment = Math.hypot(b.x - a.x, b.y - a.y);
    if (remaining <= segment) {
      const t = segment === 0 ? 0 : remaining / segment;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    remaining -= segment;
  }
  return points[points.length - 1] ?? first;
}

// --- temps ---

const SPEED = 0.08; // px par ms
const MIN_DURATION = 1200;
const MAX_DURATION = 3200;
const PAUSE = 700;
export const PACKET_GAP = 260;

/** Durée d'un trajet : proportionnelle à la longueur, bornée. */
export function travelDuration(length: number): number {
  return Math.min(Math.max(length / SPEED, MIN_DURATION), MAX_DURATION);
}

export type PacketFrame =
  { visible: false } | { visible: true; x: number; y: number; opacity: number };

/** État du paquet `index` à l'instant `elapsed` (ms depuis le début de l'étape). */
export function packetFrame(
  points: Point[],
  count: number,
  index: number,
  elapsed: number,
): PacketFrame {
  const length = polylineLength(points);
  const duration = travelDuration(length);
  const cycle = duration + PAUSE + count * PACKET_GAP;
  const local = elapsed - index * PACKET_GAP;
  if (local < 0) return { visible: false };
  const m = local % cycle;
  if (m > duration) return { visible: false };
  const t = m / duration;
  const p = pointAt(points, length * easeInOut(t));
  return { visible: true, x: p.x, y: p.y, opacity: Math.min(1, t * 8, (1 - t) * 8) };
}
