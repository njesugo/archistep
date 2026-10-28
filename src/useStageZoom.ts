import { useCallback, useEffect, useRef, useState } from "react";
import {
  frameFor,
  panFrame,
  parseViewBox,
  zoomAt,
  MAX_USER_ZOOM,
  type Frame,
} from "./engine/camera";
import type { Layout } from "./engine/layout";

/** Un pas de zoom au clavier (+ et -). */
const KEY_STEP = 1.25;

type View = { frame: Frame; smooth: boolean };
type Stored = { view: View; layout: Layout; aspect: number };

type Options = {
  /** Le zoom libre n'existe qu'en plein écran. */
  active: boolean;
  element: HTMLElement | null;
  layout: Layout | undefined;
  /** Rapport de la scène : un cadre libre le garde, sinon le schéma serait rogné ou entouré de vide. */
  aspect: number | undefined;
  /** Vue d'ensemble : le cadre dont on part, et auquel « Tout » revient. */
  whole: Frame | undefined;
  parents: ReadonlyMap<string, string>;
};

const distance = (a: PointerEvent, b: PointerEvent) =>
  Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

/**
 * Zoom et déplacement libres du schéma en plein écran : molette ou pincement (centré sur le
 * curseur), glisser pour déplacer, double clic sur une brique ou un groupe pour s'en approcher,
 * double clic dans le vide pour tout revoir. `frame` est le cadre à donner à la caméra
 * (undefined : la vue d'ensemble) ; `smooth` dit s'il faut y glisser ou y être tout de suite.
 */
export function useStageZoom({ active, element, layout, aspect, whole, parents }: Options) {
  const [stored, setStored] = useState<Stored | null>(null);

  // Hors plein écran, la vue libre est oubliée.
  if (!active && stored) setStored(null);
  const view =
    stored && layout && stored.layout === layout && stored.aspect === aspect ? stored.view : null;

  const latest = useRef({ layout, aspect, whole, parents, target: view?.frame });
  useEffect(() => {
    latest.current = { layout, aspect, whole, parents, target: view?.frame };
  });

  const put = useCallback((frame: Frame, smooth: boolean) => {
    const { layout, aspect } = latest.current;
    if (layout && aspect) setStored({ view: { frame, smooth }, layout, aspect });
  }, []);
  const reset = useCallback(() => setStored(null), []);

  /** Cadre réellement affiché (en plein glissement de caméra, celui du moment). */
  const shown = useCallback((): Frame | null => {
    const svg = element?.querySelector("svg.scene");
    return parseViewBox(svg?.getAttribute("viewBox") ?? null);
  }, [element]);

  const zoomBy = useCallback(
    (factor: number, smooth: boolean, at?: { x: number; y: number }) => {
      // Un pas au clavier part de la cible en cours, pour que des appuis rapprochés s'additionnent.
      const frame = (smooth && latest.current.target) || shown();
      const { whole } = latest.current;
      if (!frame || !whole) return;
      const point = at ?? { x: frame.x + frame.width / 2, y: frame.y + frame.height / 2 };
      put(zoomAt(frame, point, factor, whole), smooth);
    },
    [shown, put],
  );

  useEffect(() => {
    if (!active || !element) return;
    const svg = () => element.querySelector("svg.scene");
    /** Position d'un point de l'écran dans le schéma. */
    const toScene = (clientX: number, clientY: number, frame: Frame) => {
      const rect = svg()?.getBoundingClientRect();
      if (!rect || rect.width === 0 || rect.height === 0) return null;
      return {
        x: frame.x + ((clientX - rect.left) / rect.width) * frame.width,
        y: frame.y + ((clientY - rect.top) / rect.height) * frame.height,
      };
    };

    const onWheel = (event: WheelEvent) => {
      const frame = shown();
      if (!frame) return;
      event.preventDefault();
      const point = toScene(event.clientX, event.clientY, frame);
      if (!point) return;
      // Pincement du pavé tactile (ctrl + molette) : plus sensible ; lignes → pixels.
      const unit = event.deltaMode === 1 ? 33 : event.deltaMode === 2 ? 400 : 1;
      const speed = event.ctrlKey ? 0.01 : 0.0015;
      zoomBy(Math.exp(-event.deltaY * unit * speed), false, point);
    };

    const pointers = new Map<number, PointerEvent>();
    const onDown = (event: PointerEvent) => {
      if (event.button !== 0 || (event.target as Element).closest("button")) return;
      pointers.set(event.pointerId, event);
    };
    const onMove = (event: PointerEvent) => {
      const previous = pointers.get(event.pointerId);
      if (!previous) return;
      const frame = shown();
      const rect = svg()?.getBoundingClientRect();
      if (!frame || !rect || rect.width === 0) {
        pointers.set(event.pointerId, event);
        return;
      }
      const perPixel = frame.width / rect.width;
      const others = [...pointers.values()].filter((p) => p.pointerId !== event.pointerId);
      const other = others[0];
      const { whole } = latest.current;
      if (other && whole) {
        // Pincement : le point entre les deux doigts reste sous eux, l'écart fixe le zoom.
        const before = distance(previous, other);
        const after = distance(event, other);
        const centerBefore = {
          x: (previous.clientX + other.clientX) / 2,
          y: (previous.clientY + other.clientY) / 2,
        };
        const centerAfter = {
          x: (event.clientX + other.clientX) / 2,
          y: (event.clientY + other.clientY) / 2,
        };
        const anchor = toScene(centerBefore.x, centerBefore.y, frame);
        if (anchor && before > 0 && after > 0) {
          const zoomed = zoomAt(frame, anchor, after / before, whole);
          put(
            panFrame(
              zoomed,
              -(centerAfter.x - centerBefore.x) * (zoomed.width / rect.width),
              -(centerAfter.y - centerBefore.y) * (zoomed.width / rect.width),
            ),
            false,
          );
        }
      } else {
        put(
          panFrame(
            frame,
            -(event.clientX - previous.clientX) * perPixel,
            -(event.clientY - previous.clientY) * perPixel,
          ),
          false,
        );
      }
      pointers.set(event.pointerId, event);
    };
    const onUp = (event: PointerEvent) => {
      pointers.delete(event.pointerId);
    };

    const onDoubleClick = (event: MouseEvent) => {
      const { layout, aspect, whole, parents } = latest.current;
      const target = event.target as Element;
      if ((target.closest && target.closest("button")) || !layout || !aspect || !whole) return;
      const id = target.closest?.("svg.scene [data-id]")?.getAttribute("data-id");
      if (id && (layout.nodes[id] || layout.groups[id])) {
        put(frameFor(layout, [id], aspect, parents, whole.width / MAX_USER_ZOOM), true);
      } else {
        setStored(null);
      }
    };

    element.addEventListener("wheel", onWheel, { passive: false });
    element.addEventListener("pointerdown", onDown);
    element.addEventListener("dblclick", onDoubleClick);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      element.removeEventListener("wheel", onWheel);
      element.removeEventListener("pointerdown", onDown);
      element.removeEventListener("dblclick", onDoubleClick);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [active, element, shown, zoomBy, put]);

  return {
    /** Cadre libre à donner à la caméra ; undefined : la vue d'ensemble. */
    frame: view?.frame,
    smooth: view ? view.smooth : true,
    zoomed: view !== null,
    reset,
    zoomIn: useCallback(() => zoomBy(KEY_STEP, true), [zoomBy]),
    zoomOut: useCallback(() => zoomBy(1 / KEY_STEP, true), [zoomBy]),
  };
}
