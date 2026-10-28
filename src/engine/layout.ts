import ELK from "elkjs/lib/elk.bundled.js";
import type { ElkExtendedEdge, ElkNode } from "elkjs/lib/elk-api";
import type { Spec } from "../spec/schema";

export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; width: number; height: number };
export type GroupRect = Rect & {
  /** 0 pour un groupe de premier niveau, 1 pour son enfant, etc. */
  depth: number;
};

/** Placement absolu : tout est exprimé dans le repère du schéma, origine en haut à gauche. */
export type Layout = {
  width: number;
  height: number;
  nodes: Record<string, Rect>;
  groups: Record<string, GroupRect>;
  /** Polyligne de chaque lien, de l'origine à la destination. */
  edges: Record<string, Point[]>;
};

export const NODE_WIDTH = 140;
export const NODE_HEIGHT = 110;
/** Espace réservé en haut d'un groupe pour son titre (et pour la flèche vers un groupe enfant). */
export const GROUP_HEADER = 60;
export const GROUP_PADDING = 24;
const ROOT_ID = "__root__";

const SPACING_OPTIONS = {
  "elk.spacing.nodeNode": "40",
  "elk.layered.spacing.nodeNodeBetweenLayers": "70",
  "elk.layered.spacing.edgeNodeBetweenLayers": "30",
};

const ROOT_OPTIONS = {
  "elk.algorithm": "layered",
  "elk.direction": "RIGHT",
  "elk.hierarchyHandling": "INCLUDE_CHILDREN",
  "elk.edgeRouting": "ORTHOGONAL",
  "elk.padding": "[top=24,left=24,bottom=24,right=24]",
  "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
  // Coordonnées absolues pour les formes comme pour les liens.
  "elk.json.shapeCoords": "ROOT",
  "elk.json.edgeCoords": "ROOT",
  ...SPACING_OPTIONS,
};

// Les espacements se lisent sur chaque conteneur : il faut les répéter sur les groupes.
const GROUP_OPTIONS = {
  "elk.padding": `[top=${GROUP_HEADER},left=${GROUP_PADDING},bottom=${GROUP_PADDING},right=${GROUP_PADDING}]`,
  ...SPACING_OPTIONS,
};

/** id de l'enfant → id du groupe parent. */
export function parentMap(spec: Spec): Map<string, string> {
  const parents = new Map<string, string>();
  for (const group of spec.groups) {
    for (const child of group.children) parents.set(child, group.id);
  }
  return parents;
}

function isAncestor(ancestor: string, id: string, parents: Map<string, string>): boolean {
  for (let p = parents.get(id); p !== undefined; p = parents.get(p)) {
    if (p === ancestor) return true;
  }
  return false;
}

/**
 * Un lien entre un groupe et l'un de ses descendants ne peut pas être routé par ELK
 * (il traverse la frontière du groupe) : il est dessiné à part, voir `containmentPath`.
 */
export function isContainmentEdge(
  edge: { from: string; to: string },
  parents: Map<string, string>,
): boolean {
  return isAncestor(edge.from, edge.to, parents) || isAncestor(edge.to, edge.from, parents);
}

/**
 * Flèche courte, du bord haut du conteneur vers le bord haut de l'élément contenu.
 * Elle part près du coin droit, loin du titre du groupe qui est à gauche.
 */
export function containmentPath(container: Rect, inner: Rect): Point[] {
  const x = Math.round(inner.x + inner.width - GROUP_PADDING - 10);
  return [
    { x, y: container.y },
    { x, y: inner.y },
  ];
}

export function buildElkGraph(spec: Spec): ElkNode {
  const parents = parentMap(spec);
  const elements = new Map<string, ElkNode>();

  for (const node of spec.nodes) {
    elements.set(node.id, { id: node.id, width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const group of spec.groups) {
    elements.set(group.id, { id: group.id, children: [], layoutOptions: GROUP_OPTIONS });
  }

  const root: ElkNode = { id: ROOT_ID, layoutOptions: ROOT_OPTIONS, children: [], edges: [] };
  // Ordre du modèle : on suit l'ordre de déclaration des nœuds puis des groupes.
  for (const [id, element] of elements) {
    const parent = parents.get(id);
    const container = parent === undefined ? root : elements.get(parent);
    container?.children?.push(element);
  }

  root.edges = spec.edges
    .filter((edge) => !isContainmentEdge(edge, parents))
    .map((edge): ElkExtendedEdge => ({ id: edge.id, sources: [edge.from], targets: [edge.to] }));
  return root;
}

const elk = new ELK();

export async function computeLayout(spec: Spec): Promise<Layout> {
  const laid = await elk.layout(buildElkGraph(spec));
  const parents = parentMap(spec);

  const nodes: Layout["nodes"] = {};
  const groups: Layout["groups"] = {};
  const isGroup = new Set(spec.groups.map((g) => g.id));

  const walk = (el: ElkNode) => {
    for (const child of el.children ?? []) {
      const rect = {
        x: Math.round(child.x ?? 0),
        y: Math.round(child.y ?? 0),
        width: Math.round(child.width ?? 0),
        height: Math.round(child.height ?? 0),
      };
      if (isGroup.has(child.id)) {
        let depth = 0;
        for (let p = parents.get(child.id); p !== undefined; p = parents.get(p)) depth++;
        groups[child.id] = { ...rect, depth };
      } else {
        nodes[child.id] = rect;
      }
      walk(child);
    }
  };
  walk(laid);

  const rectOf = (id: string) => nodes[id] ?? groups[id];
  const edges: Layout["edges"] = {};
  for (const edge of spec.edges) {
    if (isContainmentEdge(edge, parents)) {
      const a = rectOf(edge.from);
      const b = rectOf(edge.to);
      if (!a || !b) throw new Error(`Lien "${edge.id}" : élément introuvable dans le placement.`);
      // Le conteneur est celui qui est l'ancêtre de l'autre.
      edges[edge.id] = isAncestor(edge.from, edge.to, parents)
        ? containmentPath(a, b)
        : containmentPath(b, a);
      continue;
    }
    const section = laid.edges?.find((e) => e.id === edge.id)?.sections?.[0];
    if (!section) throw new Error(`Lien "${edge.id}" : ELK n'a pas produit de tracé.`);
    edges[edge.id] = [section.startPoint, ...(section.bendPoints ?? []), section.endPoint].map(
      (p) => ({ x: Math.round(p.x), y: Math.round(p.y) }),
    );
  }

  return {
    width: Math.round(laid.width ?? 0),
    height: Math.round(laid.height ?? 0),
    nodes,
    groups,
    edges,
  };
}
