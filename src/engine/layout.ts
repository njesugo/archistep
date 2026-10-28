import ELK from "elkjs/lib/elk.bundled.js";
import type { ElkExtendedEdge, ElkNode } from "elkjs/lib/elk-api";
import type { Spec, SpecGroup, SpecNode } from "../spec/schema";
import {
  edgeLabelBox,
  GROUP_ICON_GAP,
  GROUP_ICON_LEFT,
  GROUP_ICON_MAX_W,
  GROUP_TITLE,
  GROUP_TITLE_LEFT,
  GROUP_TITLE_RIGHT,
  MONO_STYLE,
  NODE_TEXT_PAD,
  SUB_SIZE,
  textWidth,
} from "./text";

export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; width: number; height: number };
export type GroupRect = Rect & {
  /** 0 pour un groupe de premier niveau, 1 pour son enfant, etc. */
  depth: number;
};
/** Place réservée par le placement à l'étiquette d'un lien, et ses lignes de texte. */
export type EdgeLabelBox = Rect & { lines: string[] };

/** Placement absolu : tout est exprimé dans le repère du schéma, origine en haut à gauche. */
export type Layout = {
  width: number;
  height: number;
  nodes: Record<string, Rect>;
  groups: Record<string, GroupRect>;
  /** Polyligne de chaque lien, de l'origine à la destination. */
  edges: Record<string, Point[]>;
  /**
   * Emplacement de l'étiquette de chaque lien routé qui en a une. Les liens conteneur → contenu
   * n'y figurent pas : leur étiquette se place le long de leur flèche courte.
   */
  edgeLabels: Record<string, EdgeLabelBox>;
};

export const NODE_WIDTH = 140;
/** Largeur maximale d'un nœud dont le sous-titre est long ; au-delà, le sous-titre est tronqué. */
export const MAX_NODE_WIDTH = 240;
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

/** Largeur d'un nœud : 140, plus si son sous-titre est long (jusqu'à MAX_NODE_WIDTH). */
export function nodeWidth(node: Pick<SpecNode, "sub">): number {
  if (!node.sub) return NODE_WIDTH;
  const needed = Math.ceil(textWidth(node.sub, SUB_SIZE, MONO_STYLE)) + 2 * NODE_TEXT_PAD;
  return Math.min(Math.max(needed, NODE_WIDTH), MAX_NODE_WIDTH);
}

/**
 * Largeur minimale d'un groupe pour que son titre tienne en entier : marge, logo éventuel
 * (à sa largeur maximale), titre, marge à droite, et de la place pour la flèche qui part de son
 * bord haut vers un groupe qu'il contient.
 */
export function groupMinWidth(group: Pick<SpecGroup, "label" | "icon">, hasArrow: boolean): number {
  const left = group.icon ? GROUP_ICON_LEFT + GROUP_ICON_MAX_W + GROUP_ICON_GAP : GROUP_TITLE_LEFT;
  const title = textWidth(group.label.toUpperCase(), GROUP_TITLE.size, GROUP_TITLE.style);
  return Math.ceil(left + title + GROUP_TITLE_RIGHT + (hasArrow ? 70 : 0));
}

export function buildElkGraph(spec: Spec): ElkNode {
  const parents = parentMap(spec);
  const elements = new Map<string, ElkNode>();

  // Groupes qui contiennent la destination (ou l'origine) d'un lien conteneur → contenu.
  const withArrow = new Set<string>();
  for (const edge of spec.edges) {
    if (!isContainmentEdge(edge, parents)) continue;
    withArrow.add(isAncestor(edge.from, edge.to, parents) ? edge.from : edge.to);
  }

  for (const node of spec.nodes) {
    elements.set(node.id, { id: node.id, width: nodeWidth(node), height: NODE_HEIGHT });
  }
  for (const group of spec.groups) {
    elements.set(group.id, {
      id: group.id,
      children: [],
      layoutOptions: {
        ...GROUP_OPTIONS,
        "elk.nodeSize.constraints": "MINIMUM_SIZE",
        "elk.nodeSize.minimum": `(${groupMinWidth(group, withArrow.has(group.id))}, 0)`,
      },
    });
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
    .map((edge): ElkExtendedEdge => {
      const elkEdge: ElkExtendedEdge = { id: edge.id, sources: [edge.from], targets: [edge.to] };
      if (edge.label) {
        // ELK réserve la place de l'étiquette (entre les colonnes) et la positionne.
        const { width, height } = edgeLabelBox(edge.label);
        elkEdge.labels = [
          {
            text: edge.label,
            width,
            height,
            layoutOptions: { "elk.edgeLabels.placement": "CENTER" },
          },
        ];
      }
      return elkEdge;
    });
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
  const edgeLabels: Layout["edgeLabels"] = {};
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
    const laidEdge = laid.edges?.find((e) => e.id === edge.id);
    const placed = laidEdge?.labels?.[0];
    if (edge.label && placed) {
      edgeLabels[edge.id] = {
        x: Math.round(placed.x ?? 0),
        y: Math.round(placed.y ?? 0),
        width: Math.round(placed.width ?? 0),
        height: Math.round(placed.height ?? 0),
        lines: edgeLabelBox(edge.label).lines,
      };
    }
    const section = laidEdge?.sections?.[0];
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
    edgeLabels,
  };
}
