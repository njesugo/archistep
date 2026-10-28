import type { Spec, Step } from "./schema";

export type SpecError = {
  /** Chemin dans la spec, pour que l'interface puisse désigner l'endroit fautif. */
  path: (string | number)[];
  /** Phrase complète : élément concerné, champ, raison. */
  message: string;
};

type Kind = "node" | "group" | "edge";

const KIND_LABEL: Record<Kind, string> = { node: "nœud", group: "groupe", edge: "lien" };

const list = (ids: Iterable<string>) => [...ids].join(", ") || "aucun";

const stepLabel = (step: Step) => `Étape "${step.title}"`;

/**
 * Contrôles que le schéma Zod ne peut pas exprimer : unicité des ids, références,
 * hiérarchie des groupes, indices des surlignages. À appeler sur une spec déjà
 * valide au sens du schéma.
 */
export function checkReferences(spec: Spec): SpecError[] {
  const errors: SpecError[] = [];
  const add = (path: (string | number)[], message: string) => errors.push({ path, message });

  // --- unicité des ids (nœuds, groupes et liens confondus) ---
  const kinds = new Map<string, Kind>();
  const register = (kind: Kind, collection: "nodes" | "groups" | "edges") => {
    spec[collection].forEach((el, i) => {
      const previous = kinds.get(el.id);
      if (previous) {
        add(
          [collection, i, "id"],
          `${capitalize(KIND_LABEL[kind])} "${el.id}" : l'identifiant est déjà utilisé par un ${KIND_LABEL[previous]}. Chaque id doit être unique dans toute la spec.`,
        );
      } else {
        kinds.set(el.id, kind);
      }
    });
  };
  register("node", "nodes");
  register("group", "groups");
  register("edge", "edges");

  const idsOf = (...wanted: Kind[]) =>
    [...kinds].filter(([, k]) => wanted.includes(k)).map(([id]) => id);

  const seenSteps = new Set<string>();
  spec.steps.forEach((step, i) => {
    if (seenSteps.has(step.id)) {
      add(
        ["steps", i, "id"],
        `${stepLabel(step)} : l'identifiant "${step.id}" est déjà utilisé par une autre étape.`,
      );
    }
    seenSteps.add(step.id);
  });

  // --- liens : extrémités ---
  spec.edges.forEach((edge, i) => {
    for (const end of ["from", "to"] as const) {
      const ref = edge[end];
      const kind = kinds.get(ref);
      if (kind !== "node" && kind !== "group") {
        add(
          ["edges", i, end],
          kind
            ? `Lien "${edge.id}" : "${ref}" est un lien, il faut un nœud ou un groupe (disponibles : ${list(idsOf("node", "group"))}).`
            : `Lien "${edge.id}" : l'élément "${ref}" (${end}) n'existe pas (nœuds et groupes disponibles : ${list(idsOf("node", "group"))}).`,
        );
      }
    }
    if (edge.from === edge.to) {
      add(
        ["edges", i, "to"],
        `Lien "${edge.id}" : l'origine et la destination sont identiques ("${edge.from}").`,
      );
    }
  });

  // --- groupes : enfants, parent unique, pas de cycle ---
  const parent = new Map<string, string>();
  spec.groups.forEach((group, i) => {
    group.children.forEach((child, c) => {
      const kind = kinds.get(child);
      if (kind !== "node" && kind !== "group") {
        add(
          ["groups", i, "children", c],
          kind
            ? `Groupe "${group.id}" : "${child}" est un lien, un groupe ne peut contenir que des nœuds ou des groupes.`
            : `Groupe "${group.id}" : l'enfant "${child}" n'existe pas (nœuds et groupes disponibles : ${list(idsOf("node", "group"))}).`,
        );
        return;
      }
      const existing = parent.get(child);
      if (existing !== undefined) {
        add(
          ["groups", i, "children", c],
          existing === group.id
            ? `Groupe "${group.id}" : l'enfant "${child}" est listé deux fois.`
            : `Groupe "${group.id}" : "${child}" a déjà pour parent le groupe "${existing}". Un élément n'a qu'un seul parent.`,
        );
      } else {
        parent.set(child, group.id);
      }
    });
  });

  const inCycle = new Set<string>();
  spec.groups.forEach((group, i) => {
    if (inCycle.has(group.id)) return;
    const chain = [group.id];
    let current = parent.get(group.id);
    while (current !== undefined && current !== group.id && !chain.includes(current)) {
      chain.push(current);
      current = parent.get(current);
    }
    if (current === group.id) {
      chain.forEach((g) => inCycle.add(g));
      add(
        ["groups", i, "children"],
        `Groupe "${group.id}" : cycle dans la hiérarchie (${[...chain, group.id].join(" → ")}). Un groupe ne peut pas se contenir lui-même, même indirectement.`,
      );
    }
  });

  // --- étapes ---
  const existing = () => list(kinds.keys());
  spec.steps.forEach((step, i) => {
    const label = stepLabel(step);
    const checkIds = (ids: string[] | undefined, path: (string | number)[], where: string) =>
      ids?.forEach((ref, j) => {
        if (!kinds.has(ref)) {
          add(
            [...path, j],
            `${label}${where} : l'identifiant "${ref}" n'existe pas (disponibles : ${existing()}).`,
          );
        }
      });

    checkIds(step.focus, ["steps", i, "focus"], " (focus)");
    checkIds(step.zoom, ["steps", i, "zoom"], " (zoom)");

    if (step.flow) {
      const kind = kinds.get(step.flow.edge);
      if (kind !== "edge") {
        add(
          ["steps", i, "flow", "edge"],
          kind
            ? `${label} : "${step.flow.edge}" est un ${KIND_LABEL[kind]}, flow.edge doit désigner un lien (liens disponibles : ${list(idsOf("edge"))}).`
            : `${label} : le lien "${step.flow.edge}" n'existe pas (liens disponibles : ${list(idsOf("edge"))}).`,
        );
      }
    }

    step.panels?.forEach((panel, p) => {
      if (panel.type !== "table") return;
      const name = `${label}, panneau "${panel.title}"`;
      panel.rows.forEach((row, r) => {
        if (row.length !== panel.columns.length) {
          add(
            ["steps", i, "panels", p, "rows", r],
            `${name} : la ligne ${r + 1} compte ${row.length} cellule(s) mais le tableau a ${panel.columns.length} colonne(s).`,
          );
        }
      });
      panel.numericColumns?.forEach((col, c) => {
        if (col >= panel.columns.length) {
          add(
            ["steps", i, "panels", p, "numericColumns", c],
            `${name} : la colonne numérique ${col} n'existe pas (indices 0 à ${panel.columns.length - 1}).`,
          );
        }
      });
    });

    step.beats?.forEach((beat, b) => {
      const where = `${label}, sous-étape ${b + 1}`;
      checkIds(beat.focus, ["steps", i, "beats", b, "focus"], `, sous-étape ${b + 1} (focus)`);
      const hl = beat.highlight;
      if (!hl) return;
      const panelCount = step.panels?.length ?? 0;
      const index = hl.panel ?? 0;
      const panel = step.panels?.[index];
      if (!panel) {
        add(
          ["steps", i, "beats", b, "highlight", "panel"],
          panelCount
            ? `${where} : le panneau ${index} n'existe pas (indices 0 à ${panelCount - 1}).`
            : `${where} : highlight suppose un panneau dans l'étape, or il n'y en a pas.`,
        );
        return;
      }
      const checkIndexes = (
        field: "rows" | "cols" | "lines",
        indexes: number[] | undefined,
        count: number | null,
        noun: string,
        needs: string,
      ) =>
        indexes?.forEach((n, k) => {
          const path = ["steps", i, "beats", b, "highlight", field, k];
          if (count === null) {
            add(
              path,
              `${where} : highlight.${field} suppose ${needs}, mais le panneau ${index} ("${panel.title}") est de type ${panel.type}.`,
            );
          } else if (n >= count) {
            add(
              path,
              `${where} : ${noun} ${n} n'existe pas (indices 0 à ${count - 1}, ${count} au total).`,
            );
          }
        });
      const table = panel.type === "table" ? panel : null;
      const code = panel.type === "code" ? panel : null;
      checkIndexes(
        "rows",
        hl.rows,
        table ? table.rows.length : null,
        "la ligne",
        "un panneau de type table",
      );
      checkIndexes(
        "cols",
        hl.cols,
        table ? table.columns.length : null,
        "la colonne",
        "un panneau de type table",
      );
      checkIndexes(
        "lines",
        hl.lines,
        code ? code.content.split("\n").length : null,
        "la ligne de code",
        "un panneau de type code",
      );
    });
  });

  return errors;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
