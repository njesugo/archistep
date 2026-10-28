// Logique pure de résolution des icônes (sans API Vite), partagée avec scripts/logos-check.ts.
// Ordre : logo fourni par l'utilisateur > simple-icons > icône générique selon le kind.

export type NodeKind =
  "source" | "ingestion" | "storage" | "compute" | "orchestrator" | "bi" | "queue" | "service";

export type LogoEntry = { url: string; darkUrl?: string };
export type LogoTable = Map<string, LogoEntry>;

/** Clés d'icône dont le nom diffère de celui de simple-icons. */
export const SIMPLE_ICONS_ALIASES: Record<string, string> = {
  airflow: "apacheairflow",
};

/** « airflow.dark.svg » → { key: "airflow", dark: true }. Renvoie null si ce n'est pas un logo. */
export function parseLogoFilename(file: string): { key: string; dark: boolean } | null {
  const name = file.split("/").pop() ?? file;
  const match = /^(.+?)(\.dark)?\.(svg|png)$/i.exec(name);
  if (!match?.[1]) return null;
  return { key: match[1].toLowerCase(), dark: match[2] !== undefined };
}

/** Construit la table clé → URL à partir de { chemin de fichier: URL }. */
export function buildLogoTable(files: Record<string, string>): LogoTable {
  const table: LogoTable = new Map();
  for (const [file, url] of Object.entries(files)) {
    const parsed = parseLogoFilename(file);
    if (!parsed) continue;
    const entry = table.get(parsed.key) ?? { url: "" };
    if (parsed.dark) entry.darkUrl = url;
    else entry.url = url;
    table.set(parsed.key, entry);
  }
  // Une variante .dark sans logo clair ne sert à rien seule.
  for (const [key, entry] of table) if (!entry.url) table.delete(key);
  return table;
}

export function simpleIconsSlug(key: string): string {
  const k = key.toLowerCase();
  return SIMPLE_ICONS_ALIASES[k] ?? k.replace(/[^a-z0-9]/g, "");
}

export type IconSource = "user" | "simple-icons" | "generic";

/** Source qui fournira l'icône, d'après les logos fournis et les slugs simple-icons connus. */
export function iconSource(
  key: string | undefined,
  userLogos: LogoTable,
  simpleIconSlugs: ReadonlySet<string>,
): IconSource {
  if (!key) return "generic";
  if (userLogos.has(key.toLowerCase())) return "user";
  if (simpleIconSlugs.has(simpleIconsSlug(key))) return "simple-icons";
  return "generic";
}
