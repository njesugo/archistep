import { easeInOut, runAnimation, type Scheduler } from "./animation";
import type { Layout, Point, Rect } from "./layout";

/** Cadre de la caméra : le `viewBox` du schéma. */
export type Frame = Rect;

/** Marge ajoutée autour des éléments cadrés, en part de leur plus grande dimension. */
export const FRAME_MARGIN = 0.14;
/** Largeur minimale d'un cadre, pour qu'un seul nœud ne remplisse pas tout l'écran. */
export const MIN_FRAME_WIDTH = 600;
/** Rapport largeur/hauteur maximal de la scène : plus haut, un zoom a la place de respirer. */
export const MAX_STAGE_ASPECT = 2.4;
/** Sur une scène étroite (téléphone), elle est plus haute pour que la brique cadrée soit lisible. */
export const NARROW_STAGE_WIDTH = 640;
export const NARROW_STAGE_ASPECT = 1.6;
/** Zoom maximal : pixels d'écran par unité du schéma. Les libellés (17) restent sous ~31 px. */
export const MAX_ZOOM = 1.8;
export const CAMERA_DURATION = 700;

/**
 * Rapport largeur/hauteur de la scène : celui du schéma complet, plafonné
 * (plus bas sur une scène étroite). `stageWidth` : largeur affichée, en pixels.
 */
export function stageAspect(layout: Layout, stageWidth?: number): number {
  const max =
    stageWidth !== undefined && stageWidth < NARROW_STAGE_WIDTH
      ? NARROW_STAGE_ASPECT
      : MAX_STAGE_ASPECT;
  return Math.min(layout.width / Math.max(layout.height, 1), max);
}

/** Largeur minimale d'un cadre pour ne pas dépasser MAX_ZOOM sur une scène de cette largeur. */
export function minFrameWidth(stageWidth?: number): number {
  return stageWidth ? stageWidth / MAX_ZOOM : MIN_FRAME_WIDTH;
}

function pointsBox(points: Point[]): Rect | null {
  if (points.length === 0) return null;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

/** Boîte englobante des éléments (nœuds, groupes ou liens). Les ids inconnus sont ignorés. */
export function boundingBox(ids: string[], layout: Layout): Rect | null {
  const rects: Rect[] = [];
  for (const id of ids) {
    const rect = layout.nodes[id] ?? layout.groups[id] ?? pointsBox(layout.edges[id] ?? []);
    if (rect) rects.push(rect);
  }
  if (rects.length === 0) return null;
  const x = Math.min(...rects.map((r) => r.x));
  const y = Math.min(...rects.map((r) => r.y));
  const right = Math.max(...rects.map((r) => r.x + r.width));
  const bottom = Math.max(...rects.map((r) => r.y + r.height));
  return { x, y, width: right - x, height: bottom - y };
}

/** Agrandit le cadre au rapport voulu, sans le déplacer (même centre). */
export function fitAspect(frame: Frame, aspect: number): Frame {
  const cx = frame.x + frame.width / 2;
  const cy = frame.y + frame.height / 2;
  let { width, height } = frame;
  if (width / height < aspect) width = height * aspect;
  else height = width / aspect;
  return { x: cx - width / 2, y: cy - height / 2, width, height };
}

/**
 * Cadre à viser pour une étape. Sans `zoom` (ou sans id connu) : le schéma complet, au moins
 * aussi large que `minWidth` (une petite spec n'est pas agrandie à l'excès).
 * Sinon : la boîte des éléments, étendue vers le haut jusqu'au bord de leur groupe parent
 * (pour garder son titre à l'image), plus une marge, pas plus étroite que `minWidth`,
 * ajustée au rapport de la scène, puis recalée dans le schéma si elle y tient. `parentOf` : id d'un élément → id de son groupe parent.
 */
export function frameFor(
  layout: Layout,
  zoom: string[] | undefined,
  aspect: number,
  parentOf?: ReadonlyMap<string, string>,
  minWidth: number = MIN_FRAME_WIDTH,
): Frame {
  const found = zoom?.length ? boundingBox(zoom, layout) : null;
  if (!found) {
    // Vue d'ensemble : tout le schéma, sans l'agrandir au-delà du zoom maximal (petite spec).
    const width = Math.max(layout.width, minWidth);
    const full = { x: (layout.width - width) / 2, y: 0, width, height: layout.height };
    return fitAspect(full, aspect);
  }

  let box = found;
  for (const id of zoom ?? []) {
    const parent = layout.groups[parentOf?.get(id) ?? ""];
    if (parent && parent.y < box.y) {
      box = { ...box, y: parent.y, height: box.height + (box.y - parent.y) };
    }
  }

  const pad = FRAME_MARGIN * Math.max(box.width, box.height);
  const padded = {
    x: box.x - pad,
    y: box.y - pad,
    width: box.width + 2 * pad,
    height: box.height + 2 * pad,
  };
  const floor = Math.min(minWidth, layout.width);
  if (padded.width < floor) {
    const extra = floor - padded.width;
    padded.x -= extra / 2;
    padded.width = floor;
  }
  const frame = fitAspect(padded, aspect);
  // Recaler dans le schéma quand le cadre y tient, plutôt que de montrer du vide autour.
  const clamp = (v: number, size: number, limit: number) =>
    size <= limit ? Math.min(Math.max(v, 0), limit - size) : v;
  return {
    ...frame,
    x: clamp(frame.x, frame.width, layout.width),
    y: clamp(frame.y, frame.height, layout.height),
  };
}

/** Zoom maximal de l'utilisateur en plein écran, par rapport à la vue d'ensemble. Pas de minimum. */
export const MAX_USER_ZOOM = 4;
/** Garde-fou numérique seulement : on peut s'éloigner du schéma d'un facteur 10⁶. */
const MAX_FRAME_FACTOR = 1e6;

/**
 * Zoome d'un `factor` (> 1 : on s'approche) en gardant `point` (coordonnées du schéma) fixe à
 * l'écran. Le rapport du cadre est conservé. Le zoom avant s'arrête à MAX_USER_ZOOM fois la vue
 * d'ensemble `whole` ; le zoom arrière n'a pas de limite utile.
 */
export function zoomAt(frame: Frame, point: Point, factor: number, whole: Frame): Frame {
  const minWidth = whole.width / MAX_USER_ZOOM;
  const maxWidth = whole.width * MAX_FRAME_FACTOR;
  const width = Math.min(Math.max(frame.width / factor, minWidth), maxWidth);
  const scale = width / frame.width;
  return {
    x: point.x - (point.x - frame.x) * scale,
    y: point.y - (point.y - frame.y) * scale,
    width,
    height: frame.height * scale,
  };
}

/** Déplace le cadre de (dx, dy), en unités du schéma. */
export function panFrame(frame: Frame, dx: number, dy: number): Frame {
  return { ...frame, x: frame.x + dx, y: frame.y + dy };
}

/** Relit un `viewBox` ; null s'il est absent ou illisible. */
export function parseViewBox(value: string | null): Frame | null {
  if (!value) return null;
  const [x, y, width, height] = value.split(/[\s,]+/).map(Number);
  if ([x, y, width, height].some((n) => n === undefined || !Number.isFinite(n))) return null;
  if (!width || !height || width <= 0 || height <= 0) return null;
  return { x: x!, y: y!, width, height };
}

export function lerpFrame(from: Frame, to: Frame, t: number): Frame {
  const mix = (a: number, b: number) => a + (b - a) * t;
  return {
    x: mix(from.x, to.x),
    y: mix(from.y, to.y),
    width: mix(from.width, to.width),
    height: mix(from.height, to.height),
  };
}

export const frameToViewBox = (f: Frame) => `${f.x} ${f.y} ${f.width} ${f.height}`;

/**
 * Déplace la caméra de `from` vers `to` en `duration` ms, avec accélération douce.
 * `apply` reçoit chaque cadre ; le dernier est exactement `to`, puis la boucle s'arrête seule.
 * Renvoie une fonction d'arrêt (à appeler si une autre cible arrive avant la fin).
 */
export function animateCamera(
  from: Frame,
  to: Frame,
  apply: (frame: Frame) => void,
  scheduler: Scheduler,
  now: () => number,
  duration = CAMERA_DURATION,
): () => void {
  const stop = runAnimation(
    (elapsed) => {
      if (elapsed >= duration) {
        apply(to);
        stop();
        return;
      }
      apply(lerpFrame(from, to, easeInOut(elapsed / duration)));
    },
    scheduler,
    now,
  );
  return stop;
}
