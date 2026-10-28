// Préparation des images envoyées à l'IA : formats acceptés, réduction, base64.

export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
export type ImageMediaType = (typeof ACCEPTED_IMAGE_TYPES)[number];

/** Nombre maximal d'images par demande. */
export const MAX_IMAGES = 4;
/** Plus grand côté envoyé : au-delà, l'API réduit elle-même l'image, pour le même coût. */
export const MAX_IMAGE_EDGE = 1568;
/** Au-delà de cette taille, un PNG est ré-encodé en JPEG (limite de l'API : 5 Mo par image). */
export const MAX_PNG_BYTES = 3_500_000;

export function isAcceptedImageType(type: string): type is ImageMediaType {
  return (ACCEPTED_IMAGE_TYPES as readonly string[]).includes(type);
}

/** Dimensions réduites pour que le plus grand côté ne dépasse pas `maxEdge` (jamais agrandies). */
export function fitWithin(
  width: number,
  height: number,
  maxEdge: number = MAX_IMAGE_EDGE,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge || longest <= 0) return { width, height };
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

export type PreparedImage = {
  id: string;
  name: string;
  mediaType: ImageMediaType;
  /** Contenu en base64 (sans préfixe). */
  data: string;
  width: number;
  height: number;
  /** Adresse locale pour la vignette. */
  previewUrl: string;
};

export class ImageError extends Error {}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new ImageError("Image illisible."))),
      type,
      quality,
    ),
  );
}

/** Lit une image (fichier ou collage), la réduit si besoin et la met en base64. */
export async function prepareImage(file: File): Promise<PreparedImage> {
  if (!isAcceptedImageType(file.type)) {
    throw new ImageError(
      `« ${file.name || "image"} » : format non pris en charge (PNG, JPEG, WebP ou GIF).`,
    );
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new ImageError(`« ${file.name || "image"} » : impossible de lire cette image.`);
  }
  const { width, height } = fitWithin(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new ImageError("Le navigateur ne permet pas de préparer l'image.");
  // Fond blanc : un PNG transparent deviendrait noir une fois en JPEG.
  context.fillStyle = "#fff";
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  let blob = await canvasToBlob(canvas, "image/png");
  let mediaType: ImageMediaType = "image/png";
  if (blob.size > MAX_PNG_BYTES) {
    blob = await canvasToBlob(canvas, "image/jpeg", 0.85);
    mediaType = "image/jpeg";
  }
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: file.name || "image collée",
    mediaType,
    data: toBase64(new Uint8Array(await blob.arrayBuffer())),
    width,
    height,
    previewUrl: URL.createObjectURL(blob),
  };
}
