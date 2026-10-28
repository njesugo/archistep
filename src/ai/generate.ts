import type Anthropic from "@anthropic-ai/sdk";
import { GenerationError, describeApiError } from "./errors";
import type { PreparedImage } from "./images";
import { DEFAULT_MODEL_ID, type Usage } from "./models";

/** Les réponses (spec complète, parfois plusieurs milliers de lignes) sont longues : streaming. */
export const MAX_OUTPUT_TOKENS = 32000;

export type GenerationInput = {
  description: string;
  images: Pick<PreparedImage, "mediaType" | "data">[];
};

/** Version à corriger et erreurs de validation, pour une demande de correction. */
export type Correction = { json: string; errors: string[] };

export type GenerationResult = {
  /** Texte complet de la réponse du modèle. */
  text: string;
  model: string;
  usage: Usage;
};

const INSTRUCTION =
  "Produis la spec JSON de l'architecture décrite ou montrée ci-dessus. " +
  "Réponds uniquement avec un bloc de code JSON, sans texte autour.";

/** Contenu du message utilisateur : images d'abord, puis le texte (recommandation de l'API). */
export function buildUserContent(
  input: GenerationInput,
  correction?: Correction,
): Anthropic.MessageParam["content"] {
  const blocks: Anthropic.ContentBlockParam[] = input.images.map((image) => ({
    type: "image",
    source: { type: "base64", media_type: image.mediaType, data: image.data },
  }));
  const description = input.description.trim();
  const parts = [description ? `Description :\n${description}` : "", INSTRUCTION];
  if (correction) {
    parts.push(
      "Une première version de la spec a été produite, mais elle est invalide.",
      `Version à corriger :\n\`\`\`json\n${correction.json}\n\`\`\``,
      `Erreurs relevées par la validation :\n${correction.errors.map((e) => `- ${e}`).join("\n")}`,
      "Renvoie la spec complète corrigée, en gardant ce qui était juste.",
    );
  }
  blocks.push({ type: "text", text: parts.filter(Boolean).join("\n\n") });
  return blocks;
}

/**
 * Requête complète. Le prompt de génération (schéma, règles, exemple) est le message système,
 * marqué pour le cache : une deuxième demande dans les minutes qui suivent le paie dix fois moins.
 * Pas de `thinking` (le modèle raisonne de lui-même) ni de température : ces modèles les refusent.
 */
export function buildRequest(
  model: string,
  systemPrompt: string,
  input: GenerationInput,
  correction?: Correction,
): Anthropic.MessageCreateParamsStreaming {
  return {
    model,
    max_tokens: MAX_OUTPUT_TOKENS,
    stream: true,
    system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
    output_config: { effort: "high" },
    messages: [{ role: "user", content: buildUserContent(input, correction) }],
  };
}

/** Ce que `runGeneration` attend du client : le flux de l'API, tel que le fournit le SDK. */
export type MessageStreamLike = {
  on(event: "text", listener: (delta: string) => void): unknown;
  finalMessage(): Promise<Anthropic.Message>;
};
export type ClientLike = {
  messages: {
    stream(
      params: Anthropic.MessageCreateParamsStreaming,
      options?: { signal?: AbortSignal },
    ): MessageStreamLike;
  };
};

export async function runGeneration(
  client: ClientLike,
  params: Anthropic.MessageCreateParamsStreaming,
  options: { signal?: AbortSignal; onText?: (delta: string) => void } = {},
): Promise<GenerationResult> {
  let message: Anthropic.Message;
  try {
    const stream = client.messages.stream(params, { signal: options.signal });
    if (options.onText) stream.on("text", options.onText);
    message = await stream.finalMessage();
  } catch (error) {
    // Annulation demandée par l'utilisateur : quelle que soit la forme de l'erreur du SDK.
    if (options.signal?.aborted) throw new GenerationError("cancelled", "Génération annulée.");
    throw describeApiError(error);
  }

  if (message.stop_reason === "refusal") {
    throw new GenerationError(
      "refused",
      "Le modèle a refusé de répondre à cette demande. Reformule la description ou change d'image, ou essaie un autre modèle.",
    );
  }
  if (message.stop_reason === "max_tokens") {
    throw new GenerationError(
      "truncated",
      "La réponse a été coupée parce que la spec est trop longue. Demande moins d'étapes ou une description plus courte.",
    );
  }
  const text = message.content
    .flatMap((block) => (block.type === "text" ? [block.text] : []))
    .join("");
  if (!text.trim()) throw new GenerationError("empty", "Le modèle n'a rien répondu : réessaie.");
  return { text, model: message.model, usage: message.usage };
}

/** Appelle l'API depuis le navigateur avec la clé de l'utilisateur (SDK chargé à la demande). */
export async function generateSpecText(options: {
  apiKey: string;
  model?: string;
  systemPrompt: string;
  input: GenerationInput;
  correction?: Correction;
  signal?: AbortSignal;
  onText?: (delta: string) => void;
}): Promise<GenerationResult> {
  const { default: AnthropicClient } = await import("@anthropic-ai/sdk");
  // La clé reste dans ce navigateur et ne part que vers api.anthropic.com.
  const client = new AnthropicClient({ apiKey: options.apiKey, dangerouslyAllowBrowser: true });
  return runGeneration(
    client as unknown as ClientLike,
    buildRequest(
      options.model ?? DEFAULT_MODEL_ID,
      options.systemPrompt,
      options.input,
      options.correction,
    ),
    { signal: options.signal, onText: options.onText },
  );
}
