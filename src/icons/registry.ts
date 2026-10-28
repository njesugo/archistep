import { useEffect, useState } from "react";
import { buildLogoTable, simpleIconsSlug, type LogoEntry, type NodeKind } from "./resolve";

// Logos fournis par l'utilisateur : la table se construit seule d'après les noms de fichier.
const userFiles = import.meta.glob("/src/assets/logos/*.{svg,png}", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

export const userLogos = buildLogoTable(userFiles);

// Secours : chaque icône simple-icons est un petit module chargé à la demande.
const simpleIconFiles = import.meta.glob("/node_modules/simple-icons/icons/*.svg", {
  query: "?raw",
  import: "default",
}) as Record<string, () => Promise<string>>;

const simpleIconLoaders = new Map<string, () => Promise<string>>();
for (const [file, load] of Object.entries(simpleIconFiles)) {
  const slug = /\/([^/]+)\.svg$/.exec(file)?.[1];
  if (slug) simpleIconLoaders.set(slug, load);
}

export type ResolvedIcon =
  | ({ source: "user" } & LogoEntry)
  | { source: "simple-icons"; path: string; hex: string }
  | { source: "generic"; kind: NodeKind | undefined };

type SimpleIcon = { path: string; hex: string };
const simpleIconCache = new Map<string, Promise<SimpleIcon | null>>();

async function loadSimpleIcon(slug: string): Promise<SimpleIcon | null> {
  const load = simpleIconLoaders.get(slug);
  if (!load) return null;
  const [svg, meta] = await Promise.all([load(), import("simple-icons/icons.json")]);
  const path = /<path d="([^"]+)"/.exec(svg)?.[1];
  const hex = meta.default.find((i) => i.slug === slug)?.hex;
  return path && hex ? { path, hex } : null;
}

function cachedSimpleIcon(slug: string): Promise<SimpleIcon | null> {
  let promise = simpleIconCache.get(slug);
  if (!promise) {
    promise = loadSimpleIcon(slug).catch(() => null);
    simpleIconCache.set(slug, promise);
  }
  return promise;
}

/**
 * Icône d'un nœud ou d'un groupe. Le logo fourni et l'icône générique sont immédiats ;
 * l'icône simple-icons arrive un instant plus tard (le générique s'affiche d'ici là).
 */
export function useIcon(key: string | undefined, kind?: NodeKind): ResolvedIcon {
  const user = key ? userLogos.get(key.toLowerCase()) : undefined;
  const slug = key && !user ? simpleIconsSlug(key) : undefined;
  const wanted = slug && simpleIconLoaders.has(slug) ? slug : undefined;
  const [loaded, setLoaded] = useState<{ slug: string; icon: SimpleIcon | null } | null>(null);

  useEffect(() => {
    if (!wanted) return;
    let cancelled = false;
    void cachedSimpleIcon(wanted).then((icon) => {
      if (!cancelled) setLoaded({ slug: wanted, icon });
    });
    return () => {
      cancelled = true;
    };
  }, [wanted]);

  if (user) return { source: "user", ...user };
  if (wanted && loaded?.slug === wanted && loaded.icon)
    return { source: "simple-icons", ...loaded.icon };
  return { source: "generic", kind };
}

/** Un logo (fourni ou simple-icons) existe-t-il pour cette clé ? Réponse immédiate, sans chargement. */
export function hasLogo(key: string | undefined): boolean {
  if (!key) return false;
  return userLogos.has(key.toLowerCase()) || simpleIconLoaders.has(simpleIconsSlug(key));
}
