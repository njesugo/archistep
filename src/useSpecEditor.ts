import { useEffect, useState } from "react";
import { DEFAULT_EXAMPLE, EXAMPLES } from "./examples";
import { readSavedSpec, saveSpec } from "./specStore";
import type { SpecError } from "./spec/checkReferences";
import type { Spec } from "./spec/schema";
import { parseSpecJson } from "./spec/validate";

/** Délai entre la dernière frappe et la validation : assez court pour sembler instantané. */
export const VALIDATION_DELAY = 250;

function initialState(): { text: string; spec: Spec } {
  const saved = readSavedSpec();
  if (saved) return saved;
  const result = parseSpecJson(DEFAULT_EXAMPLE.text);
  if (!result.ok) throw new Error("L'exemple intégré est invalide.");
  return { text: DEFAULT_EXAMPLE.text, spec: result.spec };
}

/** Remet en forme un JSON lisible (fichier compact importé) ; laisse tel quel sinon. */
export function prettify(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

const sameSpec = (a: Spec, b: Spec) => JSON.stringify(a) === JSON.stringify(b);

/**
 * État de l'éditeur de spec. `text` est ce que l'utilisateur tape ; `spec` est la dernière
 * version valide, la seule qui est dessinée. Une frappe est validée après un court délai :
 * si elle est valide, elle remplace `spec` (et est sauvegardée) ; sinon `errors` la décrit
 * et l'ancienne `spec` reste affichée.
 */
export function useSpecEditor() {
  const [initial] = useState(initialState);
  const [text, setText] = useState(initial.text);
  const [spec, setSpec] = useState(initial.spec);
  const [errors, setErrors] = useState<SpecError[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const result = parseSpecJson(text);
      if (result.ok) {
        setErrors((previous) => (previous.length ? [] : previous));
        setSpec((previous) => (sameSpec(previous, result.spec) ? previous : result.spec));
        saveSpec(text);
      } else {
        setErrors(result.errors);
      }
    }, VALIDATION_DELAY);
    return () => clearTimeout(timer);
  }, [text]);

  /**
   * Remplace le texte et valide tout de suite (import de fichier, exemple).
   * Renvoie la spec chargée, ou null si le texte est invalide (il reste alors dans l'éditeur
   * pour être corrigé, et l'ancienne spec reste affichée).
   */
  function load(rawText: string): Spec | null {
    const newText = prettify(rawText);
    setText(newText);
    const result = parseSpecJson(newText);
    if (result.ok) {
      setErrors([]);
      setSpec(result.spec);
      saveSpec(newText);
      return result.spec;
    }
    setErrors(result.errors);
    return null;
  }

  function loadExample(id: string): Spec | null {
    const example = EXAMPLES.find((e) => e.id === id);
    return example ? load(example.text) : null;
  }

  return { text, setText, spec, errors, load, loadExample };
}
