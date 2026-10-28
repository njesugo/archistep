import { useEffect, useRef, type CSSProperties } from "react";
import { packetFrame, runAnimation, type ResolvedFlow } from "../engine/flow";

const DOT_RADII = [5, 7, 4, 6];

function Packet({ shape, index }: { shape: ResolvedFlow["shape"]; index: number }) {
  if (shape === "dot") return <circle r={DOT_RADII[index % DOT_RADII.length]} />;
  const [w, h, rx] = shape === "square" ? [11, 11, 2.5] : [22, 9, 4];
  return <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={rx} />;
}

/** Paquets qui circulent le long du lien, en boucle, tant que le composant est monté. */
export function FlowPackets({ flow }: { flow: ResolvedFlow }) {
  const refs = useRef<(SVGGElement | null)[]>([]);

  useEffect(() => {
    return runAnimation(
      (elapsed) => {
        for (let i = 0; i < flow.count; i++) {
          const el = refs.current[i];
          if (!el) continue;
          const frame = packetFrame(flow.points, flow.count, i, elapsed);
          if (!frame.visible) {
            el.style.opacity = "0";
            continue;
          }
          el.setAttribute("transform", `translate(${frame.x} ${frame.y})`);
          el.style.opacity = String(frame.opacity);
        }
      },
      { request: (cb) => requestAnimationFrame(cb), cancel: (h) => cancelAnimationFrame(h) },
      () => performance.now(),
    );
  }, [flow]);

  const style = { "--c": `var(${flow.color})` } as CSSProperties;
  return (
    <g className="packets" style={style} aria-hidden="true">
      {Array.from({ length: flow.count }, (_, i) => (
        <g
          key={i}
          className="packet"
          style={{ opacity: 0 }}
          ref={(el) => {
            refs.current[i] = el;
          }}
        >
          <Packet shape={flow.shape} index={i} />
        </g>
      ))}
    </g>
  );
}
