import { useRef, type CSSProperties } from "react";
import { edgeLabelAnchor, pathFromPoints } from "../engine/geometry";
import type { Frame } from "../engine/camera";
import {
  isContainmentEdge,
  parentMap,
  type GroupRect,
  type Layout,
  type Rect,
} from "../engine/layout";
import {
  EDGE_LABEL,
  fitLabel,
  GROUP_ICON_GAP,
  GROUP_ICON_LEFT,
  GROUP_ICON_MAX_W,
  GROUP_TITLE,
  GROUP_TITLE_LEFT,
  GROUP_TITLE_RIGHT,
  LABEL_STYLE,
  MONO_STYLE,
  NODE_TEXT_PAD,
  SUB_SIZE,
  truncate,
} from "../engine/text";
import { GenericIcon } from "../icons/generic";
import { FlowPackets } from "./FlowPackets";
import type { ResolvedFlow } from "../engine/flow";
import { hasLogo, useIcon, type ResolvedIcon } from "../icons/registry";
import { useIconBox } from "../icons/useIconBox";
import { useCamera } from "../useCamera";
import type { Spec, SpecGroup, SpecNode } from "../spec/schema";
import "../styles/scene.css";

/** Cadre des logos d'un nœud : un logo large (avec son nom) s'étale, un logo carré reste à 40. */
const NODE_ICON_H = 40;
const NODE_ICON_MAX_W = 108;
const GROUP_ICON_H = 26;

function IconGlyph({
  icon,
  x,
  y,
  width,
  height,
}: {
  icon: ResolvedIcon;
  /** Coin haut gauche de la boîte de l'icône. */
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  if (icon.source === "user") {
    const common = { x, y, width, height, preserveAspectRatio: "xMidYMid meet" } as const;
    return (
      <g>
        {/* Thème sombre sans variante .dark : pastille claire derrière le logo */}
        {!icon.darkUrl && (
          <rect
            className="logo-pill"
            x={x - 5}
            y={y - 5}
            width={width + 10}
            height={height + 10}
            rx={10}
          />
        )}
        <image
          className={icon.darkUrl ? "logo-light has-dark" : "logo-light"}
          href={icon.url}
          {...common}
        />
        {icon.darkUrl && <image className="logo-dark" href={icon.darkUrl} {...common} />}
      </g>
    );
  }
  if (icon.source === "simple-icons") {
    return (
      <path
        d={icon.path}
        fill={`#${icon.hex}`}
        transform={`translate(${x} ${y}) scale(${height / 24})`}
      />
    );
  }
  return (
    <g className="glyph" transform={`translate(${x} ${y}) scale(${height / 24})`}>
      <GenericIcon kind={icon.kind} />
    </g>
  );
}

function stateClass(
  base: string,
  id: string,
  lit: ReadonlySet<string> | null,
  revealed: ReadonlySet<string> | null,
): string {
  if (revealed && !revealed.has(id)) return `${base} hidden`;
  if (!lit) return base;
  return lit.has(id) ? `${base} on` : `${base} dim`;
}

function NodeView({
  node,
  rect,
  lit,
  revealed,
}: {
  node: SpecNode;
  rect: Rect;
  lit: ReadonlySet<string> | null;
  revealed: ReadonlySet<string> | null;
}) {
  const icon = useIcon(node.icon, node.kind);
  const iconBox = useIconBox(icon, NODE_ICON_MAX_W, NODE_ICON_H);
  const cx = rect.x + rect.width / 2;
  const style = node.layer ? ({ "--c": `var(--${node.layer})` } as CSSProperties) : undefined;
  // Un nom long passe à une taille plus petite, puis sur deux lignes, puis est tronqué ;
  // le texte complet reste disponible en infobulle (et pour les lecteurs d'écran).
  const textWidth = rect.width - 2 * NODE_TEXT_PAD;
  const label = fitLabel(node.label, textWidth, {
    size: 17,
    minSize: 14,
    twoLineSize: 15,
    style: LABEL_STYLE,
  });
  const twoLines = label.lines.length > 1;
  const sub = node.sub ? truncate(node.sub, textWidth, SUB_SIZE, MONO_STYLE) : undefined;
  const cut = label.truncated || (node.sub !== undefined && sub !== node.sub);
  return (
    <g className={stateClass("node", node.id, lit, revealed)} data-id={node.id} style={style}>
      <rect x={rect.x} y={rect.y} width={rect.width} height={rect.height} rx={14} />
      <IconGlyph
        icon={icon}
        x={cx - iconBox.width / 2}
        y={rect.y + 12 + (NODE_ICON_H - iconBox.height) / 2}
        width={iconBox.width}
        height={iconBox.height}
      />
      {cut && <title>{[node.label, node.sub].filter(Boolean).join(" · ")}</title>}
      <text className="nt" x={cx} y={rect.y + (twoLines ? 70 : 77)} fontSize={label.size}>
        {label.lines.map((line, i) => (
          <tspan key={i} x={cx} dy={i === 0 ? 0 : label.size + 1}>
            {line}
          </tspan>
        ))}
      </text>
      {sub && (
        <text className={node.layer ? "ns c" : "ns"} x={cx} y={rect.y + (twoLines ? 102 : 98)}>
          {sub}
        </text>
      )}
    </g>
  );
}

function GroupView({
  group,
  rect,
  lit,
  revealed,
  titleLimit,
}: {
  group: SpecGroup;
  rect: GroupRect;
  lit: ReadonlySet<string> | null;
  revealed: ReadonlySet<string> | null;
  /** Abscisse que le titre ne doit pas dépasser (flèche vers un groupe contenu). */
  titleLimit: number;
}) {
  const icon = useIcon(group.icon);
  // Pas d'icône générique pour un groupe : sans logo, le titre suffit.
  const hasIcon = hasLogo(group.icon);
  const style = { "--c": `var(--g-${group.color ?? "gray"})` } as CSSProperties;
  const iconBox = useIconBox(icon, GROUP_ICON_MAX_W, GROUP_ICON_H);
  const titleX =
    rect.x + (hasIcon ? GROUP_ICON_LEFT + iconBox.width + GROUP_ICON_GAP : GROUP_TITLE_LEFT);
  const full = group.label.toUpperCase();
  const title = truncate(
    full,
    Math.min(rect.x + rect.width - GROUP_TITLE_RIGHT, titleLimit) - titleX,
    GROUP_TITLE.size,
    GROUP_TITLE.style,
  );
  return (
    <g className={stateClass("frame", group.id, lit, revealed)} data-id={group.id} style={style}>
      <rect
        x={rect.x}
        y={rect.y}
        width={rect.width}
        height={rect.height}
        rx={rect.depth === 0 ? 20 : 16}
      />
      {hasIcon && (
        <IconGlyph
          icon={icon}
          x={rect.x + 20}
          y={rect.y + 13 + (GROUP_ICON_H - iconBox.height) / 2}
          width={iconBox.width}
          height={iconBox.height}
        />
      )}
      {title !== full && <title>{group.label}</title>}
      <text x={titleX} y={rect.y + 32}>
        {title}
      </text>
    </g>
  );
}

/**
 * `lit` : ids mis en valeur à l'étape courante ; les autres sont atténués.
 * Sans `lit` (null), tout est affiché normalement. `flows` font circuler des paquets sur leurs liens.
 */
export function Scene({
  spec,
  layout,
  lit = null,
  revealed = null,
  flows = [],
  frame,
  animateCamera = true,
  aspect,
}: {
  spec: Spec;
  layout: Layout;
  lit?: ReadonlySet<string> | null;
  /** Construction progressive : seuls ces ids sont visibles (null : tout l'est). */
  revealed?: ReadonlySet<string> | null;
  /** Flux animés ; vide quand le mouvement est réduit. */
  flows?: ResolvedFlow[];
  /** Cadre visé par la caméra (viewBox) ; par défaut, tout le schéma. */
  frame?: Frame;
  /** Faux : le cadre change sans déplacement progressif (mouvement réduit). */
  animateCamera?: boolean;
  /** Rapport largeur/hauteur de la scène (fixe, pour que la page ne saute pas). */
  aspect?: number;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const full: Frame = { x: 0, y: 0, width: layout.width, height: layout.height };
  useCamera(svg, frame ?? full, animateCamera);

  // Ordre de dessin : groupes (du plus extérieur au plus intérieur), liens, nœuds.
  const groups = spec.groups
    .flatMap((group) => {
      const rect = layout.groups[group.id];
      return rect ? [{ group, rect }] : [];
    })
    .sort((a, b) => a.rect.depth - b.rect.depth);

  // Un lien conteneur → contenu part du bord haut du conteneur : son titre doit s'arrêter avant.
  const parents = parentMap(spec);
  const titleLimits = new Map<string, number>();
  for (const edge of spec.edges) {
    const start = layout.edges[edge.id]?.[0];
    if (!start || !isContainmentEdge(edge, parents)) continue;
    const container =
      layout.groups[edge.from] && start.y === layout.groups[edge.from]!.y ? edge.from : edge.to;
    const limit = start.x - 12;
    titleLimits.set(container, Math.min(titleLimits.get(container) ?? Infinity, limit));
  }

  return (
    <svg
      ref={svg}
      className="scene"
      style={{ aspectRatio: String(aspect ?? layout.width / layout.height) }}
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      role="img"
      aria-label={spec.meta.title}
    >
      <defs>
        <marker
          id="arrowhead"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto"
        >
          <path d="M1 1 L9 5 L1 9 z" fill="context-stroke" />
        </marker>
      </defs>
      {groups.map(({ group, rect }) => (
        <GroupView
          key={group.id}
          group={group}
          rect={rect}
          lit={lit}
          revealed={revealed}
          titleLimit={titleLimits.get(group.id) ?? Infinity}
        />
      ))}
      {flows.map(
        (flow) =>
          flow.pulse && (
            <rect
              key={`pulse-${flow.edgeId}`}
              className="pulse"
              x={flow.pulse.x}
              y={flow.pulse.y}
              width={flow.pulse.width}
              height={flow.pulse.height}
              rx={16}
            />
          ),
      )}
      {spec.edges.map((edge) => {
        const points = layout.edges[edge.id];
        if (!points) return null;
        return (
          <g
            key={edge.id}
            className={stateClass("edge-g", edge.id, lit, revealed)}
            data-id={edge.id}
          >
            <path
              className={edge.style === "trigger" ? "edge trigger" : "edge"}
              d={pathFromPoints(points)}
              markerEnd="url(#arrowhead)"
            />
          </g>
        );
      })}
      {spec.nodes.map((node) => {
        const rect = layout.nodes[node.id];
        return rect ? (
          <NodeView key={node.id} node={node} rect={rect} lit={lit} revealed={revealed} />
        ) : null;
      })}
      {/* Étiquettes au-dessus des nœuds et des cadres, avec un halo : jamais cachées ni barrées. */}
      {spec.edges.map((edge) => {
        const points = layout.edges[edge.id];
        if (!edge.label || !points) return null;
        const box = layout.edgeLabels[edge.id];
        const anchor = box ? null : edgeLabelAnchor(points);
        const lines = box?.lines ?? [edge.label];
        const lineHeight = EDGE_LABEL.lineHeight;
        return (
          <g
            key={edge.id}
            className={stateClass("edge-label-g", edge.id, lit, revealed)}
            data-label-for={edge.id}
          >
            {lines.some((line) => line.endsWith("…")) && <title>{edge.label}</title>}
            <text
              className="edge-label"
              textAnchor={box ? "middle" : anchor?.anchor}
              x={box ? box.x + box.width / 2 : anchor?.x}
              y={
                box
                  ? box.y + (box.height - lines.length * lineHeight) / 2 + lineHeight - 3
                  : anchor?.y
              }
            >
              {lines.map((line, i) => (
                <tspan
                  key={i}
                  x={box ? box.x + box.width / 2 : anchor?.x}
                  dy={i === 0 ? 0 : lineHeight}
                >
                  {line}
                </tspan>
              ))}
            </text>
          </g>
        );
      })}
      {flows.map((flow) => (
        <FlowPackets key={flow.edgeId} flow={flow} />
      ))}
    </svg>
  );
}
