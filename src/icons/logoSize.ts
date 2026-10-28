export type Box = { width: number; height: number };

/**
 * Plus grande boîte de rapport `aspect` (largeur / hauteur) qui tient dans `maxW` × `maxH`.
 * Un logo carré reste carré (côté `maxH`) ; un logo large, avec son nom, occupe plus de largeur.
 * Rapport inconnu ou invalide : carré.
 */
export function fitLogo(aspect: number, maxW: number, maxH: number): Box {
  const a = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  const height = Math.min(maxH, maxW / a);
  return { width: height * a, height };
}
