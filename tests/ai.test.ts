import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import {
  API_KEY_STORAGE,
  cleanApiKey,
  forgetApiKey,
  looksLikeApiKey,
  maskApiKey,
  readApiKey,
  saveApiKey,
} from "../src/ai/apiKey";
import { describeApiError, GenerationError } from "../src/ai/errors";
import { extractJson } from "../src/ai/extract";
import {
  buildRequest,
  buildUserContent,
  MAX_OUTPUT_TOKENS,
  runGeneration,
  type ClientLike,
} from "../src/ai/generate";
import { fitWithin, isAcceptedImageType, MAX_IMAGE_EDGE, toBase64 } from "../src/ai/images";
import { AI_MODELS, DEFAULT_MODEL_ID, estimateCost, formatCost } from "../src/ai/models";
import { buildGeneratePrompt } from "../src/prompt";
import { parseSpecJson } from "../src/spec/validate";

const memoryStore = () => {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    data,
  };
};

describe("clé API", () => {
  const KEY = "sk-ant-api03-AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcd";

  it("l'enregistre, la relit et l'oublie", () => {
    const store = memoryStore();
    expect(readApiKey(store)).toBeNull();
    expect(saveApiKey(KEY, store)).toBe(true);
    expect(store.data.get(API_KEY_STORAGE)).toBe(KEY);
    expect(readApiKey(store)).toBe(KEY);
    forgetApiKey(store);
    expect(readApiKey(store)).toBeNull();
  });

  it("survit à un stockage indisponible", () => {
    const broken = {
      getItem: () => {
        throw new Error("bloqué");
      },
      setItem: () => {
        throw new Error("plein");
      },
      removeItem: () => {
        throw new Error("bloqué");
      },
    };
    expect(readApiKey(broken)).toBeNull();
    expect(saveApiKey(KEY, broken)).toBe(false);
    expect(() => forgetApiKey(broken)).not.toThrow();
    expect(saveApiKey(KEY, null)).toBe(false);
  });

  it("nettoie ce qu'on colle", () => {
    expect(cleanApiKey(`  ${KEY}\n`)).toBe(KEY);
    expect(cleanApiKey(`"${KEY}"`)).toBe(KEY);
    expect(cleanApiKey(`'${KEY}'`)).toBe(KEY);
  });

  it("reconnaît le format d'une clé Anthropic", () => {
    expect(looksLikeApiKey(KEY)).toBe(true);
    expect(looksLikeApiKey("sk-ant-court")).toBe(false);
    expect(looksLikeApiKey("sk-proj-" + "a".repeat(40))).toBe(false);
    expect(looksLikeApiKey(`${KEY} avec espace`)).toBe(false);
    expect(looksLikeApiKey("")).toBe(false);
  });

  it("l'affiche masquée, sans la révéler", () => {
    const masked = maskApiKey(KEY);
    expect(masked).toBe("sk-ant-…abcd");
    expect(masked).not.toContain("AbCdEf");
    expect(maskApiKey("abc")).toBe("••••");
  });
});

describe("images", () => {
  it("n'accepte que les formats de l'API", () => {
    for (const ok of ["image/png", "image/jpeg", "image/webp", "image/gif"]) {
      expect(isAcceptedImageType(ok), ok).toBe(true);
    }
    for (const bad of ["image/svg+xml", "application/pdf", "image/bmp", "", "text/plain"]) {
      expect(isAcceptedImageType(bad), bad).toBe(false);
    }
  });

  it("réduit les grandes images sans changer leurs proportions", () => {
    const small = fitWithin(3840, 1604);
    expect(Math.max(small.width, small.height)).toBe(MAX_IMAGE_EDGE);
    expect(small.width / small.height).toBeCloseTo(3840 / 1604, 2);
    expect(fitWithin(1000, 2000, 1000)).toEqual({ width: 500, height: 1000 });
  });

  it("n'agrandit jamais une image", () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(MAX_IMAGE_EDGE, 10)).toEqual({ width: MAX_IMAGE_EDGE, height: 10 });
  });

  it("garde au moins un pixel et ignore les dimensions invalides", () => {
    expect(fitWithin(10000, 1).height).toBe(1);
    expect(fitWithin(0, 0)).toEqual({ width: 0, height: 0 });
  });

  it("encode en base64 standard, sans préfixe", () => {
    expect(toBase64(new TextEncoder().encode("Bonjour"))).toBe("Qm9uam91cg==");
    const bytes = Uint8Array.from({ length: 70000 }, (_, i) => i % 256);
    expect(atob(toBase64(bytes)).length).toBe(70000);
  });
});

describe("extraction du JSON", () => {
  it("prend le contenu du bloc json", () => {
    expect(extractJson('Voici :\n```json\n{ "a": 1 }\n```\nVoilà.')).toBe('{ "a": 1 }');
    expect(extractJson('```\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it("prend le premier bloc quand il y en a plusieurs", () => {
    expect(extractJson('```json\n{"a":1}\n```\n```json\n{"b":2}\n```')).toBe('{"a":1}');
  });

  it("se rabat sur ce qui va de la première à la dernière accolade", () => {
    expect(extractJson('Réponse : {"a": {"b": 2}} fin')).toBe('{"a": {"b": 2}}');
  });

  it("renvoie null sans JSON", () => {
    expect(extractJson("Je ne peux pas faire ça.")).toBeNull();
    expect(extractJson("")).toBeNull();
    expect(extractJson("} avant {")).toBeNull();
  });

  it("ne touche pas au contenu d'une spec valide", () => {
    const spec = '{\n  "version": 1,\n  "texte": "avec ``` dedans? non"\n}';
    expect(extractJson("```json\n" + spec + "\n```")).toContain('"version": 1');
  });
});

describe("modèles et coûts", () => {
  it("propose Sonnet 5.5 par défaut, parmi des identifiants exacts", () => {
    expect(DEFAULT_MODEL_ID).toBe("claude-sonnet-5-5");
    expect(AI_MODELS.map((m) => m.id)).toEqual([
      "claude-sonnet-5-5",
      "claude-opus-5-5",
      "claude-haiku-5-5",
    ]);
    for (const m of AI_MODELS) expect(m.id).not.toMatch(/\d{8}$/); // jamais de suffixe de date
  });

  it("estime le coût d'une demande", () => {
    // 10 000 jetons en entrée, 5 000 en sortie sur Sonnet 5.5 : 0,02 + 0,05
    expect(
      estimateCost("claude-sonnet-5-5", { input_tokens: 10_000, output_tokens: 5_000 }),
    ).toBeCloseTo(0.07);
  });

  it("compte le cache : lecture à 10 %, écriture à 125 %", () => {
    const cost = estimateCost("claude-sonnet-5-5", {
      input_tokens: 0,
      output_tokens: 0,
      cache_creation_input_tokens: 1_000_000,
      cache_read_input_tokens: 1_000_000,
    });
    expect(cost).toBeCloseTo(2 * 1.25 + 2 * 0.1);
  });

  it("renvoie null pour un modèle inconnu", () => {
    expect(estimateCost("inconnu", { input_tokens: 1, output_tokens: 1 })).toBeNull();
  });

  it("formate en euros-dollars lisibles", () => {
    expect(formatCost(0.0734)).toBe("0,073 $");
    expect(formatCost(0.5)).toBe("0,50 $");
    expect(formatCost(1.234)).toBe("1,23 $");
  });
});

describe("requête envoyée à l'API", () => {
  const image = { mediaType: "image/png" as const, data: "AAAA" };
  const system = buildGeneratePrompt();

  it("met les images avant le texte, puis la description", () => {
    const content = buildUserContent({ description: "Un pipeline Kafka", images: [image, image] });
    expect(Array.isArray(content)).toBe(true);
    const blocks = content as Anthropic.ContentBlockParam[];
    expect(blocks.map((b) => b.type)).toEqual(["image", "image", "text"]);
    expect(blocks[0]).toEqual({
      type: "image",
      source: { type: "base64", media_type: "image/png", data: "AAAA" },
    });
    const text = (blocks[2] as { text: string }).text;
    expect(text).toContain("Un pipeline Kafka");
    expect(text).toMatch(/uniquement avec un bloc de code JSON/);
  });

  it("fonctionne avec une image seule ou une description seule", () => {
    const only = buildUserContent({
      description: "  ",
      images: [image],
    }) as Anthropic.ContentBlockParam[];
    expect(only.map((b) => b.type)).toEqual(["image", "text"]);
    expect((only[1] as { text: string }).text).not.toContain("Description");
    const textOnly = buildUserContent({
      description: "Un truc",
      images: [],
    }) as Anthropic.ContentBlockParam[];
    expect(textOnly.map((b) => b.type)).toEqual(["text"]);
  });

  it("construit une demande de correction avec la version fautive et ses erreurs", () => {
    const blocks = buildUserContent(
      { description: "Un truc", images: [] },
      { json: '{"cassé": true}', errors: ["Étape « x » : le lien « e9 » n'existe pas."] },
    ) as Anthropic.ContentBlockParam[];
    const text = (blocks.at(-1) as { text: string }).text;
    expect(text).toContain('{"cassé": true}');
    expect(text).toContain("- Étape « x » : le lien « e9 » n'existe pas.");
    expect(text).toContain("corrigée");
  });

  it("a la forme attendue par l'API pour ces modèles", () => {
    const params = buildRequest("claude-sonnet-5-5", system, { description: "x", images: [] });
    expect(params.model).toBe("claude-sonnet-5-5");
    expect(params.stream).toBe(true);
    expect(params.max_tokens).toBe(MAX_OUTPUT_TOKENS);
    expect(params.output_config).toEqual({ effort: "high" });
    // ces modèles refusent la température et la désactivation de la réflexion
    expect(params).not.toHaveProperty("temperature");
    expect(params).not.toHaveProperty("top_p");
    expect(params).not.toHaveProperty("thinking");
    // pas de préremplissage de la réponse (refusé par ces modèles)
    expect(params.messages).toHaveLength(1);
    expect(params.messages[0]?.role).toBe("user");
  });

  it("met le prompt de génération en message système, avec cache", () => {
    const params = buildRequest("claude-opus-5-5", system, { description: "x", images: [] });
    expect(params.system).toEqual([
      { type: "text", text: system, cache_control: { type: "ephemeral" } },
    ]);
    expect(system).toContain("# Rôle");
    expect(system).not.toContain("{{EXEMPLE}}");
  });
});

describe("exécution d'une génération", () => {
  const params = buildRequest("claude-sonnet-5-5", "système", { description: "x", images: [] });

  const message = (over: Partial<Anthropic.Message>): Anthropic.Message =>
    ({
      id: "msg_1",
      type: "message",
      role: "assistant",
      model: "claude-sonnet-5-5",
      content: [{ type: "text", text: '```json\n{"a":1}\n```' }],
      stop_reason: "end_turn",
      stop_sequence: null,
      usage: { input_tokens: 100, output_tokens: 20 },
      ...over,
    }) as Anthropic.Message;

  /** Faux client : renvoie `final` après avoir émis les morceaux de texte. */
  const fake = (final: () => Promise<Anthropic.Message>, chunks: string[] = []): ClientLike => ({
    messages: {
      stream: () => {
        const listeners: ((delta: string) => void)[] = [];
        return {
          on(_event, listener) {
            listeners.push(listener);
            return this;
          },
          async finalMessage() {
            for (const c of chunks) listeners.forEach((l) => l(c));
            return final();
          },
        };
      },
    },
  });

  it("renvoie le texte, le modèle et la consommation", async () => {
    const result = await runGeneration(
      fake(async () => message({})),
      params,
    );
    expect(result.text).toContain('{"a":1}');
    expect(result.model).toBe("claude-sonnet-5-5");
    expect(result.usage.output_tokens).toBe(20);
  });

  it("relaie le texte au fil de l'eau", async () => {
    const received: string[] = [];
    await runGeneration(
      fake(async () => message({}), ["```js", "on\n{", '"a":1}']),
      params,
      {
        onText: (d) => received.push(d),
      },
    );
    expect(received).toEqual(["```js", "on\n{", '"a":1}']);
  });

  it("ignore les blocs de réflexion et assemble les blocs de texte", async () => {
    const result = await runGeneration(
      fake(async () =>
        message({
          content: [
            { type: "thinking", thinking: "", signature: "s" } as Anthropic.ContentBlock,
            { type: "text", text: "Partie 1 " } as Anthropic.ContentBlock,
            { type: "text", text: "Partie 2" } as Anthropic.ContentBlock,
          ],
        }),
      ),
      params,
    );
    expect(result.text).toBe("Partie 1 Partie 2");
  });

  it("explique un refus du modèle", async () => {
    await expect(
      runGeneration(
        fake(async () => message({ stop_reason: "refusal" })),
        params,
      ),
    ).rejects.toMatchObject({
      kind: "refused",
      message: expect.stringMatching(/refusé de répondre/),
    });
  });

  it("explique une réponse coupée par la limite de longueur", async () => {
    await expect(
      runGeneration(
        fake(async () => message({ stop_reason: "max_tokens" })),
        params,
      ),
    ).rejects.toMatchObject({ kind: "truncated", message: expect.stringMatching(/trop longue/) });
  });

  it("refuse une réponse vide", async () => {
    await expect(
      runGeneration(
        fake(async () => message({ content: [] })),
        params,
      ),
    ).rejects.toMatchObject({ kind: "empty" });
  });

  it("traduit les erreurs de l'API", async () => {
    await expect(
      runGeneration(
        fake(async () => {
          throw Object.assign(new Error("invalid x-api-key"), { status: 401 });
        }),
        params,
      ),
    ).rejects.toMatchObject({ kind: "api", message: expect.stringMatching(/Clé API refusée/) });
  });

  it("signale une annulation", async () => {
    await expect(
      runGeneration(
        fake(async () => {
          throw Object.assign(new Error("Request was aborted."), { name: "AbortError" });
        }),
        params,
      ),
    ).rejects.toMatchObject({ kind: "cancelled" });
  });

  it("reconnaît l'annulation demandée, quelle que soit l'erreur renvoyée par le SDK", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      runGeneration(
        fake(async () => {
          // le SDK lève une erreur dont le nom ne dit pas « abort »
          throw Object.assign(new Error("Quelque chose d'inattendu"), { name: "Error" });
        }),
        params,
        { signal: controller.signal },
      ),
    ).rejects.toMatchObject({ kind: "cancelled", message: "Génération annulée." });
  });

  it("ne confond pas une vraie erreur avec une annulation", async () => {
    await expect(
      runGeneration(
        fake(async () => {
          throw Object.assign(new Error("boom"), { status: 500 });
        }),
        params,
        { signal: new AbortController().signal },
      ),
    ).rejects.toMatchObject({ kind: "api" });
  });

  it("transmet le signal d'annulation à l'API", async () => {
    let seen: AbortSignal | undefined;
    const client: ClientLike = {
      messages: {
        stream: (_params, options) => {
          seen = options?.signal;
          return { on: () => undefined, finalMessage: async () => message({}) };
        },
      },
    };
    const controller = new AbortController();
    await runGeneration(client, params, { signal: controller.signal });
    expect(seen).toBe(controller.signal);
  });
});

describe("messages d'erreur", () => {
  const cases: [Record<string, unknown>, RegExp][] = [
    [{ status: 401, message: "invalid x-api-key" }, /Clé API refusée/],
    [{ status: 403 }, /pas le droit/],
    [{ status: 404 }, /pas disponible/],
    [{ status: 413 }, /trop volumineuse/],
    [{ status: 429 }, /Trop de demandes/],
    [{ status: 500 }, /indisponible ou surchargé/],
    [{ status: 529 }, /indisponible ou surchargé/],
    [{ status: 400, message: "messages.0: bad" }, /Demande refusée par l'API : messages\.0: bad/],
    [
      { status: 400, message: "Your credit balance is too low to access the Anthropic API" },
      /Crédit insuffisant/,
    ],
    [{ message: "fetch failed" }, /Connexion impossible/],
    [{ name: "AbortError", message: "x" }, /annulée/],
    [{ name: "Error", message: "Request was aborted." }, /annulée/],
    [{ status: 418, message: "théière" }, /Erreur de l'API \(418\) : théière/],
  ];

  it.each(cases)("%j → message lisible", (error, expected) => {
    const described = describeApiError(error);
    expect(described).toBeInstanceOf(GenerationError);
    expect(described.message).toMatch(expected);
  });

  it("ne révèle jamais la clé et laisse passer une erreur déjà traduite", () => {
    const own = new GenerationError("refused", "déjà lisible");
    expect(describeApiError(own)).toBe(own);
    expect(describeApiError("sk-ant-secret").message).not.toContain("sk-ant-secret");
    expect(describeApiError(null).message).toMatch(/Connexion impossible/);
  });
});

describe("la spec produite passe par la validation habituelle", () => {
  it("une réponse bien formée est validée comme une spec collée", () => {
    const reply =
      '```json\n{"version":1,"meta":{"title":"T"},"nodes":[],"groups":[],"edges":[],"steps":[]}\n```';
    const json = extractJson(reply);
    expect(json).not.toBeNull();
    const result = parseSpecJson(json ?? "");
    expect(result.ok).toBe(false); // sans étape : refusée, avec un message
    if (!result.ok) expect(result.errors[0]?.message).toMatch(/au moins une étape/);
  });
});
