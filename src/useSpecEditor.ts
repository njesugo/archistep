import { useEffect, useState } from "react";
import { DEFAULT_EXAMPLE, EXAMPLES } from "./examples";
import { decodeSpec, readHashPayload } from "./share";
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

/** Retire le lien de partage de la barre d'adresse (la spec n'est plus celle du lien). */
function clearShareHash(): void {
  try {
    if (readHashPayload(window.location.hash) !== null) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  } catch {
    // contexte sans historique : sans importance
  }
}

type Options = {
  /** Un lien de partage ne s'ouvre pas (illisible, tronqué, spec invalide) : on le signale. */
  onLinkError?: () => void;
};

/**
 * État de l'éditeur de spec. `text` est ce que l'utilisateur tape ; `spec` est la dernière
 * version valide, la seule qui est dessinée. Une frappe est validée après un court délai :
 * si elle est valide, elle remplace `spec` (et est sauvegardée) ; sinon `errors` la décrit
 * et l'ancienne `spec` reste affichée.
 *
 * Une spec ouverte depuis un lien de partage (`#spec=…`) n'est pas sauvegardée tant qu'on ne la
 * modifie pas : ouvrir le lien de quelqu'un ne doit pas écraser sa propre spec enregistrée.
 */
export function useSpecEditor({ onLinkError }: Options = {}) {
  const [initial] = useState(initialState);
  const [text, setText] = useState(initial.text);
  const [spec, setSpec] = useState(initial.spec);
  const [errors, setErrors] = useState<SpecError[]>([]);
  // Erreurs d'un lien qui ne s'ouvre pas : conservées jusqu'à la prochaine modification, car la
  // validation différée du texte courant (valide) viderait sinon la liste.
  const [linkErrors, setLinkErrors] = useState<SpecError[] | null>(null);
  const [fromLink, setFromLink] = useState(false);
  const [payload, setPayload] = useState(() => readHashPayload(window.location.hash));
  const [opening, setOpening] = useState(payload !== null);

  // Coller un autre lien dans la même page : le fragment change sans recharger.
  useEffect(() => {
    const onHashChange = () => {
      const next = readHashPayload(window.location.hash);
      if (next === null) return;
      setPayload(next);
      setOpening(true);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    if (payload === null) return;
    let cancelled = false;
    const failed = (list: SpecError[]) => {
      setErrors(list);
      setLinkErrors(list);
      setFromLink(false);
      setOpening(false);
      setPayload(null);
      onLinkError?.();
    };
    decodeSpec(payload).then(
      (json) => {
        if (cancelled) return;
        const pretty = prettify(json);
        const result = parseSpecJson(pretty);
        if (!result.ok) {
          // La spec du lien est invalide : elle va dans l'éditeur pour être corrigée.
          setText(pretty);
          failed(result.errors);
          return;
        }
        setText(pretty);
        setSpec(result.spec);
        setErrors([]);
        setLinkErrors(null);
        setFromLink(true);
        setOpening(false);
        setPayload(null);
      },
      (error: unknown) => {
        if (cancelled) return;
        const reason = error instanceof Error ? error.message : String(error);
        failed([{ path: [], message: `Lien de partage : ${reason}` }]);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [payload, onLinkError]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const result = parseSpecJson(text);
      if (result.ok) {
        setErrors((previous) => (previous.length ? [] : previous));
        setSpec((previous) => (sameSpec(previous, result.spec) ? previous : result.spec));
        if (!fromLink) saveSpec(text);
      } else {
        setErrors(result.errors);
      }
    }, VALIDATION_DELAY);
    return () => clearTimeout(timer);
  }, [text, fromLink]);

  /** Modification à la main : la spec devient celle de l'utilisateur (et sera sauvegardée). */
  function edit(newText: string): void {
    setLinkErrors(null);
    setFromLink(false);
    clearShareHash();
    setText(newText);
  }

  /**
   * Remplace le texte et valide tout de suite (import de fichier, exemple).
   * Renvoie la spec chargée, ou null si le texte est invalide (il reste alors dans l'éditeur
   * pour être corrigé, et l'ancienne spec reste affichée).
   */
  function load(rawText: string): Spec | null {
    const newText = prettify(rawText);
    setLinkErrors(null);
    setFromLink(false);
    clearShareHash();
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

  return {
    text,
    setText: edit,
    spec,
    errors: linkErrors ?? errors,
    load,
    loadExample,
    fromLink,
    opening,
  };
}
