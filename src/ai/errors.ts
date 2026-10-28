/** Erreur de génération dont le message est déjà lisible par l'utilisateur. */
export class GenerationError extends Error {
  readonly kind: "cancelled" | "refused" | "truncated" | "api" | "empty";
  constructor(kind: GenerationError["kind"], message: string) {
    super(message);
    this.kind = kind;
  }
}

type ApiErrorLike = { status?: number; message?: string; name?: string };

/** Message en français pour une erreur de l'API (ou du réseau). */
export function describeApiError(error: unknown): GenerationError {
  if (error instanceof GenerationError) return error;
  const e = (typeof error === "object" && error !== null ? error : {}) as ApiErrorLike;
  const text = String(e.message ?? "");

  if (e.name === "AbortError" || /abort/i.test(e.name ?? "") || /request was aborted/i.test(text)) {
    return new GenerationError("cancelled", "Génération annulée.");
  }
  if (/credit balance|insufficient.*(credit|fund)|billing/i.test(text)) {
    return new GenerationError(
      "api",
      "Crédit insuffisant sur ton compte Anthropic : ajoute du crédit sur console.anthropic.com (Plans & Billing).",
    );
  }
  switch (e.status) {
    case 401:
      return new GenerationError(
        "api",
        "Clé API refusée : vérifie qu'elle est complète et toujours active.",
      );
    case 403:
      return new GenerationError(
        "api",
        "Cette clé n'a pas le droit d'utiliser ce modèle ou cette fonction.",
      );
    case 404:
      return new GenerationError(
        "api",
        "Ce modèle n'est pas disponible pour ta clé : choisis-en un autre.",
      );
    case 413:
      return new GenerationError(
        "api",
        "La demande est trop volumineuse : retire une image ou réduis la description.",
      );
    case 429:
      return new GenerationError(
        "api",
        "Trop de demandes en peu de temps : attends un moment puis réessaie.",
      );
    case 400:
      return new GenerationError(
        "api",
        `Demande refusée par l'API : ${text || "requête invalide"}`,
      );
  }
  if (typeof e.status === "number" && e.status >= 500) {
    return new GenerationError(
      "api",
      "Le service Anthropic est indisponible ou surchargé : réessaie dans un instant.",
    );
  }
  if (e.status === undefined) {
    return new GenerationError(
      "api",
      "Connexion impossible : vérifie ta connexion Internet et que rien (bloqueur, pare-feu) n'empêche d'atteindre api.anthropic.com.",
    );
  }
  return new GenerationError("api", `Erreur de l'API (${e.status}) : ${text}`);
}
