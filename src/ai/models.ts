// Modèles proposés pour la génération, avec leurs tarifs publics (dollars par million de jetons,
// relevés dans la documentation Anthropic le 2026-10-06 : à vérifier sur console.anthropic.com).

export type AiModel = {
  id: string;
  label: string;
  hint: string;
  /** Dollars par million de jetons d'entrée / de sortie. */
  inputPerM: number;
  outputPerM: number;
};

export const AI_MODELS: AiModel[] = [
  {
    id: "claude-sonnet-5-5",
    label: "Claude Sonnet 5.5 (recommandé)",
    hint: "bon compromis entre qualité et coût",
    inputPerM: 2,
    outputPerM: 10,
  },
  {
    id: "claude-opus-5-5",
    label: "Claude Opus 5.5",
    hint: "le plus précis sur un schéma complexe ou une image difficile à lire",
    inputPerM: 4,
    outputPerM: 20,
  },
  {
    id: "claude-haiku-5-5",
    label: "Claude Haiku 5.5",
    hint: "rapide et très économique, pour un schéma simple",
    inputPerM: 0.1,
    outputPerM: 0.5,
  },
];

export const DEFAULT_MODEL_ID = "claude-sonnet-5-5";

export type Usage = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
};

/** Coût estimé en dollars (lecture du cache à 10 % de l'entrée, écriture à 125 %), ou null. */
export function estimateCost(modelId: string, usage: Usage): number | null {
  const model = AI_MODELS.find((m) => m.id === modelId);
  if (!model) return null;
  const input =
    usage.input_tokens +
    (usage.cache_creation_input_tokens ?? 0) * 1.25 +
    (usage.cache_read_input_tokens ?? 0) * 0.1;
  return (input * model.inputPerM + usage.output_tokens * model.outputPerM) / 1_000_000;
}

/** « 0,04 $ » (deux chiffres significatifs pour les petits montants). */
export function formatCost(dollars: number): string {
  const digits = dollars < 0.1 ? 3 : 2;
  return `${dollars.toFixed(digits).replace(".", ",")} $`;
}
