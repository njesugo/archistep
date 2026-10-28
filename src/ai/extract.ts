/**
 * Texte JSON de la réponse du modèle : le contenu du bloc ```json (ou ```), à défaut tout ce qui
 * va de la première accolade à la dernière. Renvoie null s'il n'y a rien qui y ressemble.
 */
export function extractJson(reply: string): string | null {
  const fenced = /```(?:json|JSON)?\s*\n([\s\S]*?)\n?```/.exec(reply)?.[1]?.trim();
  if (fenced) return fenced;
  const start = reply.indexOf("{");
  const end = reply.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  return reply.slice(start, end + 1).trim();
}
