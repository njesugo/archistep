import { z } from "zod";
import { checkReferences, type SpecError } from "./checkReferences";
import { specSchema, type Spec } from "./schema";

z.config(z.locales.fr());

export type ValidationResult = { ok: true; spec: Spec } | { ok: false; errors: SpecError[] };

type Path = (string | number)[];

const TYPE_NAMES: Record<string, string> = {
  string: "un texte",
  number: "un nombre",
  boolean: "un booléen",
  object: "un objet",
  array: "une liste",
  null: "null",
  undefined: "rien",
};

function typeName(value: unknown): string {
  if (value === null) return TYPE_NAMES["null"]!;
  if (Array.isArray(value)) return TYPE_NAMES["array"]!;
  return TYPE_NAMES[typeof value] ?? typeof value;
}

function at(root: unknown, path: Path): unknown {
  let current = root;
  for (const key of path) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string | number, unknown>)[key];
  }
  return current;
}

/** Désigne l'élément concerné : « Étape "L'ingestion" », « Nœud "yt" »… */
function subject(raw: unknown, path: Path): { label: string; rest: Path } {
  const [section, index, ...rest] = path;
  if (typeof section === "string" && typeof index === "number") {
    const el = at(raw, [section, index]) as { id?: unknown; title?: unknown } | undefined;
    const name = String(
      section === "steps" ? (el?.title ?? el?.id ?? index + 1) : (el?.id ?? index + 1),
    );
    const label = { steps: "Étape", nodes: "Nœud", groups: "Groupe", edges: "Lien" }[section];
    if (label) return { label: `${label} "${name}"`, rest };
  }
  if (section === "meta") return { label: "Titre et options", rest: path.slice(1) };
  return { label: "Spec", rest: path };
}

function formatField(path: Path): string {
  return path.reduce<string>(
    (acc, key) => (typeof key === "number" ? `${acc}[${key + 1}]` : acc ? `${acc}.${key}` : key),
    "",
  );
}

function describe(issue: z.core.$ZodIssue, raw: unknown, path: Path): string {
  const value = at(raw, path);
  switch (issue.code) {
    case "invalid_type":
      return value === undefined
        ? "champ obligatoire manquant."
        : `attendu : ${TYPE_NAMES[issue.expected] ?? issue.expected}, reçu : ${typeName(value)}.`;
    case "unrecognized_keys":
      return `clé inconnue : ${issue.keys.map((k) => `"${k}"`).join(", ")}. Vérifie l'orthographe.`;
    case "invalid_value": {
      const allowed = issue.values.map((v) => JSON.stringify(v)).join(", ");
      return `valeur ${JSON.stringify(value)} non autorisée (valeurs possibles : ${allowed}).`;
    }
    case "invalid_union":
      return 'type de panneau inconnu ou manquant (types possibles : "table", "code", "list", "dag").';
    default:
      return `${issue.message}.`;
  }
}

function formatIssue(issue: z.core.$ZodIssue, raw: unknown): SpecError {
  // Pour une clé inconnue, le chemin désigne l'objet qui la contient.
  const path = issue.path.filter((k): k is string | number => typeof k !== "symbol");
  const { label, rest } = subject(raw, path);
  const field = formatField(rest);
  const reason = describe(issue, raw, path);
  const isMissingOrKey = issue.code === "unrecognized_keys";
  const where = field && !isMissingOrKey ? ` : champ "${field}"` : "";
  const keyWhere = field && isMissingOrKey ? ` (dans "${field}")` : "";
  return { path, message: `${label}${keyWhere}${where} : ${reason}` };
}

/** Valide une spec déjà parsée : schéma Zod, puis références croisées. */
export function validateSpec(input: unknown): ValidationResult {
  const parsed = specSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((i) => formatIssue(i, input)) };
  }
  const errors = checkReferences(parsed.data);
  return errors.length ? { ok: false, errors } : { ok: true, spec: parsed.data };
}

/** Même chose à partir du texte JSON brut (éditeur, import de fichier). */
export function parseSpecJson(text: string): ValidationResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    return { ok: false, errors: [{ path: [], message: `JSON invalide : ${reason}` }] };
  }
  return validateSpec(data);
}
