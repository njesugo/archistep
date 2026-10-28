import { useCallback, useRef, useState } from "react";
import type { SpecError } from "../spec/checkReferences";
import type { Spec } from "../spec/schema";
import { parseSpecJson } from "../spec/validate";
import { describeApiError } from "./errors";
import { extractJson } from "./extract";
import { generateSpecText, type Correction, type GenerationInput } from "./generate";
import { estimateCost, type Usage } from "./models";

/** Résultat d'une génération, déjà passé par la validation habituelle. */
export type Outcome = {
  /** JSON extrait de la réponse, ou null si elle n'en contient pas. */
  json: string | null;
  spec: Spec | null;
  errors: SpecError[];
  model: string;
};

export type GenerationState =
  | { status: "idle" }
  | { status: "working"; received: number }
  | { status: "done"; outcome: Outcome; cost: number | null; calls: number }
  | { status: "failed"; message: string; cancelled: boolean };

function evaluate(text: string, model: string): Outcome {
  const json = extractJson(text);
  if (json === null) {
    return {
      json: null,
      spec: null,
      model,
      errors: [{ path: [], message: "La réponse du modèle ne contient pas de JSON exploitable." }],
    };
  }
  const result = parseSpecJson(json);
  return result.ok
    ? { json, spec: result.spec, errors: [], model }
    : { json, spec: null, errors: result.errors, model };
}

const addUsage = (a: Usage, b: Usage): Usage => ({
  input_tokens: a.input_tokens + b.input_tokens,
  output_tokens: a.output_tokens + b.output_tokens,
  cache_creation_input_tokens:
    (a.cache_creation_input_tokens ?? 0) + (b.cache_creation_input_tokens ?? 0),
  cache_read_input_tokens: (a.cache_read_input_tokens ?? 0) + (b.cache_read_input_tokens ?? 0),
});

/** Pilote une génération : démarrage, annulation, demande de correction, coût cumulé. */
export function useGeneration() {
  const [state, setState] = useState<GenerationState>({ status: "idle" });
  const controller = useRef<AbortController | null>(null);
  // Coût cumulé de la session de génération en cours (génération puis corrections).
  const spent = useRef<{ usage: Usage; model: string; calls: number } | null>(null);

  const run = useCallback(
    async (options: {
      apiKey: string;
      model: string;
      systemPrompt: string;
      input: GenerationInput;
      correction?: Correction;
    }) => {
      controller.current?.abort();
      const abort = new AbortController();
      controller.current = abort;
      if (!options.correction) spent.current = null;
      setState({ status: "working", received: 0 });
      let received = 0;
      try {
        const result = await generateSpecText({
          ...options,
          signal: abort.signal,
          onText: (delta) => {
            received += delta.length;
            setState({ status: "working", received });
          },
        });
        const total = spent.current
          ? addUsage(spent.current.usage, result.usage)
          : addUsage({ input_tokens: 0, output_tokens: 0 }, result.usage);
        spent.current = {
          usage: total,
          model: result.model,
          calls: (spent.current?.calls ?? 0) + 1,
        };
        setState({
          status: "done",
          outcome: evaluate(result.text, result.model),
          cost: estimateCost(result.model, total),
          calls: spent.current.calls,
        });
      } catch (error) {
        const described = describeApiError(error);
        setState({
          status: "failed",
          message: described.message,
          cancelled: described.kind === "cancelled",
        });
      } finally {
        if (controller.current === abort) controller.current = null;
      }
    },
    [],
  );

  const cancel = useCallback(() => controller.current?.abort(), []);
  const reset = useCallback(() => {
    controller.current?.abort();
    spent.current = null;
    setState({ status: "idle" });
  }, []);

  return { state, run, cancel, reset };
}
