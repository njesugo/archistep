import template from "./prompts/generate-spec.md?raw";
import { DEFAULT_EXAMPLE } from "./examples";

/** Prompt de génération : le modèle de texte, avec l'exemple intégré inséré comme référence. */
export function buildGeneratePrompt(exampleJson: string = DEFAULT_EXAMPLE.text): string {
  return template.replace("{{EXEMPLE}}", exampleJson);
}
