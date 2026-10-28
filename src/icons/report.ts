import type { Spec } from "../spec/schema";
import { iconSourceFor } from "./registry";

/** Clés d'icônes demandées par la spec, avec d'où chacune est résolue. */
export function iconRows(spec: Spec) {
  const keys = [...spec.nodes, ...spec.groups].flatMap((e) => (e.icon ? [e.icon] : []));
  return [...new Set(keys)].sort().map((key) => ({ key, source: iconSourceFor(key) }));
}
