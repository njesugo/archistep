import { z } from "zod";

// Pas de compilation à la volée (`new Function`) : la politique de sécurité du contenu l'interdit,
// et elle ne ferait gagner que des microsecondes sur des specs de cette taille. À régler avant la
// création des schémas ci-dessous, car Zod teste `eval` à ce moment-là.
z.config({ jitless: true });

const layer = z.enum(["bronze", "silver", "gold"]);

const id = z.string().min(1, "l'identifiant ne peut pas être vide");
const text = z.string().min(1, "le texte ne peut pas être vide");

export const nodeSchema = z.strictObject({
  id,
  label: text,
  sub: z.string().optional(),
  icon: z.string().optional(),
  kind: z
    .enum(["source", "ingestion", "storage", "compute", "orchestrator", "bi", "queue", "service"])
    .optional(),
  layer: layer.optional(),
});

export const groupSchema = z.strictObject({
  id,
  label: text,
  icon: z.string().optional(),
  color: z.enum(["blue", "teal", "orange", "purple", "gray"]).optional(),
  children: z.array(id).min(1, "un groupe doit contenir au moins un élément"),
});

export const edgeSchema = z.strictObject({
  id,
  from: id,
  to: id,
  style: z.enum(["data", "trigger"]).optional(),
  label: z.string().optional(),
});

const columnIndexes = z.array(z.number().int().min(0));

/** Nombre maximal de colonnes de panneaux dans une étape. */
export const MAX_PANEL_COLUMNS = 3;
const columnCount = z.number().int().min(1).max(MAX_PANEL_COLUMNS);

// Champs communs à tous les panneaux.
const common = {
  title: text,
  /** Nombre de colonnes occupées dans la disposition de l'étape (1 par défaut). */
  span: columnCount.optional(),
};

export const panelSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("table"),
    ...common,
    layer: layer.optional(),
    columns: z.array(z.string()).min(1),
    rows: z.array(z.array(z.string())),
    numericColumns: columnIndexes.optional(),
    note: z.string().optional(),
  }),
  z.strictObject({
    type: z.literal("code"),
    ...common,
    language: z.enum(["json", "sql", "python", "yaml", "text"]),
    content: z.string(),
    note: z.string().optional(),
  }),
  z.strictObject({
    type: z.literal("list"),
    ...common,
    items: z.array(z.strictObject({ label: text, text })),
  }),
  z.strictObject({
    type: z.literal("dag"),
    ...common,
    tasks: z.array(z.strictObject({ name: text, state: z.enum(["ok", "run", "wait", "fail"]) })),
  }),
]);

export const beatSchema = z.strictObject({
  focus: z.array(id).optional(),
  text: z.string().optional(),
  highlight: z
    .strictObject({
      panel: z.number().int().min(0).optional(),
      rows: columnIndexes.optional(),
      cols: columnIndexes.optional(),
      lines: columnIndexes.optional(),
    })
    .optional(),
});

export const stepSchema = z.strictObject({
  id,
  title: text,
  text,
  focus: z.array(id),
  zoom: z.array(id).optional(),
  flow: z
    .strictObject({
      edge: id,
      shape: z.enum(["dot", "square", "bar"]).optional(),
      count: z.number().int().min(1).max(12).optional(),
    })
    .optional(),
  /** Nombre de colonnes de la zone des panneaux (1 par défaut : empilés). */
  panelColumns: columnCount.optional(),
  panels: z.array(panelSchema).optional(),
  beats: z.array(beatSchema).optional(),
});

export const specSchema = z.strictObject({
  version: z.literal(1),
  meta: z.strictObject({
    title: text,
    subtitle: z.string().optional(),
    language: z.enum(["fr", "en"]).optional(),
    buildMode: z.enum(["all", "progressive"]).optional(),
  }),
  nodes: z.array(nodeSchema),
  groups: z.array(groupSchema),
  edges: z.array(edgeSchema),
  steps: z.array(stepSchema).min(1, "il faut au moins une étape"),
});

export type Spec = z.infer<typeof specSchema>;
export type SpecNode = z.infer<typeof nodeSchema>;
export type SpecGroup = z.infer<typeof groupSchema>;
export type SpecEdge = z.infer<typeof edgeSchema>;
export type Step = z.infer<typeof stepSchema>;
export type Beat = z.infer<typeof beatSchema>;
export type Panel = z.infer<typeof panelSchema>;
