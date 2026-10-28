import { useRef, type CSSProperties } from "react";
import { edgeLabelAnchor, pathFromPoints } from "../engine/geometry";
import type { Frame } from "../engine/camera";
import type { GroupRect, Layout, Rect } from "../engine/layout";
import { GenericIcon } from "../icons/generic";
import { FlowPackets } from "./FlowPackets";
import type { ResolvedFlow } from "../engine/flow";
import { hasLogo, useIcon, type ResolvedIcon } from "../icons/registry";
import { useCamera } from "../useCamera";
import type { Spec, SpecGroup, SpecNode } from "../spec/schema";
import "../styles/scene.css";

const NODE_ICON = 40;
const GROUP_ICON = 26;

function IconGlyph({
  icon,
  x,
  y,
  size,
}: {
  icon: ResolvedIcon;
  x: number;
  y: number;
  size: number;
}) {
  if (icon.source === "user") {
    const common = {
      x,
      y,
      width: size,
      height: size,
      preserveAspectRatio: "xMidYMid meet",
    } as const;
    return (
      <g>
        {/* Thème sombre sans variante .dark : pastille claire derrière le logo */}
        {!icon.darkUrl && (
          <rect
            className="logo-pill"
            x={x - 5}
            y={y - 5}
            width={size + 10}
            height={size + 10}
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
        transform={`translate(${x} ${y}) scale(${size / 24})`}
      />
    );
  }
  return (
    <g className="glyph" transform={`translate(${x} ${y}) scale(${size / 24})`}>
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
  const cx = rect.x + rect.width / 2;
  const style = node.layer ? ({ "--c": `var(--${node.layer})` } as CSSProperties) : undefined;
  return (
    <g className={stateClass("node", node.id, lit, revealed)} data-id={node.id} style={style}>
      <rect x={rect.x} y={rect.y} width={rect.width} height={rect.height} rx={14} />
      <IconGlyph icon={icon} x={cx - NODE_ICON / 2} y={rect.y + 12} size={NODE_ICON} />
      <text className="nt" x={cx} y={rect.y + 77} fontSize={node.label.length > 13 ? 14 : 17}>
        {node.label}
      </text>
      {node.sub && (
        <text className={node.layer ? "ns c" : "ns"} x={cx} y={rect.y + 98}>
          {node.sub}
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
}: {
  group: SpecGroup;
  rect: GroupRect;
  lit: ReadonlySet<string> | null;
  revealed: ReadonlySet<string> | null;
}) {
  const icon = useIcon(group.icon);
  // Pas d'icône générique pour un groupe : sans logo, le titre suffit.
  const hasIcon = hasLogo(group.icon);
  const style = { "--c": `var(--g-${group.color ?? "gray"})` } as CSSProperties;
  return (
    <g className={stateClass("frame", group.id, lit, revealed)} data-id={group.id} style={style}>
      <rect
        x={rect.x}
        y={rect.y}
        width={rect.width}
        height={rect.height}
        rx={rect.depth === 0 ? 20 : 16}
      />
      {hasIcon && <IconGlyph icon={icon} x={rect.x + 20} y={rect.y + 13} size={GROUP_ICON} />}
      <text x={rect.x + (hasIcon ? 54 : 22)} y={rect.y + 32}>
        {group.label.toUpperCase()}
      </text>
    </g>
  );
}

/**
 * `lit` : ids mis en valeur à l'étape courante ; les autres sont atténués.
 * Sans `lit` (null), tout est affiché normalement. `flow` fait circuler des paquets sur un lien.
 */
export function Scene({
  spec,
  layout,
  lit = null,
  revealed = null,
  flow = null,
  frame,
  animateCamera = true,
  aspect,
}: {
  spec: Spec;
  layout: Layout;
  lit?: ReadonlySet<string> | null;
  /** Construction progressive : seuls ces ids sont visibles (null : tout l'est). */
  revealed?: ReadonlySet<string> | null;
  /** Flux animé de l'étape courante ; absent quand le mouvement est réduit. */
  flow?: ResolvedFlow | null;
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
        <GroupView key={group.id} group={group} rect={rect} lit={lit} revealed={revealed} />
      ))}
      {flow?.pulse && (
        <rect
          className="pulse"
          x={flow.pulse.x}
          y={flow.pulse.y}
          width={flow.pulse.width}
          height={flow.pulse.height}
          rx={16}
        />
      )}
      {spec.edges.map((edge) => {
        const points = layout.edges[edge.id];
        if (!points) return null;
        const label = edge.label ? edgeLabelAnchor(points) : null;
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
            {label && (
              <text className="edge-label" x={label.x} y={label.y} textAnchor={label.anchor}>
                {edge.label}
              </text>
            )}
          </g>
        );
      })}
      {spec.nodes.map((node) => {
        const rect = layout.nodes[node.id];
        return rect ? (
          <NodeView key={node.id} node={node} rect={rect} lit={lit} revealed={revealed} />
        ) : null;
      })}
      {flow && <FlowPackets flow={flow} />}
    </svg>
  );
}
