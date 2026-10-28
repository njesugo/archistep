// Lien de partage : la spec est compressée (deflate) puis écrite en base64url dans le fragment
// de l'URL (`#spec=z.…`). Le fragment n'est jamais envoyé au serveur : rien n'est stocké en ligne.

/** Nom du paramètre dans le fragment. */
export const SHARE_PARAM = "spec";
/** Taille maximale de la spec décompressée (garde-fou contre une archive piégée). */
export const MAX_SHARED_BYTES = 2_000_000;
/** Au-delà, certaines messageries tronquent le lien. */
export const LONG_LINK_CHARS = 8000;

export class ShareError extends Error {}

// --- base64url ---

export function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64Url(text: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(text))
    throw new ShareError("Le lien contient des caractères invalides.");
  const padded = text
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(text.length / 4) * 4, "=");
  try {
    return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
  } catch {
    throw new ShareError("Le lien est tronqué ou abîmé.");
  }
}

// --- compression ---

const hasStreams = () =>
  typeof CompressionStream === "function" && typeof DecompressionStream === "function";

async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Décompresse en s'arrêtant dès que `limit` octets sont dépassés. */
async function inflate(bytes: Uint8Array, limit: number): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > limit) {
        await reader.cancel();
        throw new ShareError("La spec du lien est trop volumineuse.");
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof ShareError) throw error;
    throw new ShareError("Le lien est tronqué ou abîmé : impossible de le décompresser.");
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

// --- encodage / décodage ---

/** `z.` + données compressées, ou `j.` + texte brut si le navigateur ne sait pas compresser. */
export async function encodeSpec(json: string): Promise<string> {
  const bytes = new TextEncoder().encode(json);
  if (!hasStreams()) return `j.${toBase64Url(bytes)}`;
  return `z.${toBase64Url(await deflate(bytes))}`;
}

/** Texte JSON d'une charge utile (`z.…` ou `j.…`). Lève `ShareError` avec un message lisible. */
export async function decodeSpec(payload: string): Promise<string> {
  const kind = payload.slice(0, 2);
  const data = payload.slice(2);
  if (kind !== "z." && kind !== "j.") {
    throw new ShareError("Le lien n'est pas reconnu (format inconnu).");
  }
  const bytes = fromBase64Url(data);
  if (kind === "j.") {
    if (bytes.length > MAX_SHARED_BYTES)
      throw new ShareError("La spec du lien est trop volumineuse.");
  }
  if (kind === "z." && !hasStreams()) {
    throw new ShareError("Ce navigateur ne sait pas ouvrir un lien compressé.");
  }
  const raw = kind === "z." ? await inflate(bytes, MAX_SHARED_BYTES) : bytes;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(raw);
  } catch {
    throw new ShareError("Le lien est abîmé : le texte n'est pas lisible.");
  }
}

// --- URL ---

/** Charge utile du paramètre `spec` dans un fragment (`#spec=…`), ou null s'il n'y en a pas. */
export function readHashPayload(hash: string): string | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const value = params.get(SHARE_PARAM);
  return value ? value : null;
}

/** URL de partage : la page courante, sans son ancien fragment, avec la spec en fragment. */
export function buildShareUrl(pageUrl: string, payload: string): string {
  const url = new URL(pageUrl);
  url.hash = `${SHARE_PARAM}=${payload}`;
  return url.toString();
}
