import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { EXAMPLES } from "../examples";
import { iconRows } from "../icons/report";
import type { SpecError } from "../spec/checkReferences";
import { lineOf, locatePath } from "../spec/locate";
import type { Spec } from "../spec/schema";
import { copyText } from "../clipboard";
import { buildGeneratePrompt } from "../prompt";
import { buildShareUrl, encodeSpec, LONG_LINK_CHARS } from "../share";
import "../styles/drawer.css";

type Props = {
  open: boolean;
  onClose: () => void;
  text: string;
  onTextChange: (text: string) => void;
  errors: SpecError[];
  /** Dernière spec valide : c'est elle qui est dessinée. */
  spec: Spec;
  /** La spec affichée vient d'un lien de partage et n'a pas été modifiée. */
  fromLink: boolean;
  onImport: (text: string) => void;
  onExport: () => void;
  onLoadExample: (id: string) => void;
  onGenerate: () => void;
};

const SOURCE_HINT = {
  "simple-icons": "secours simple-icons",
  generic: "icône générique",
} as const;

export function SpecDrawer({
  open,
  onClose,
  text,
  onTextChange,
  errors,
  spec,
  fromLink,
  onImport,
  onExport,
  onLoadExample,
  onGenerate,
}: Props) {
  const area = useRef<HTMLTextAreaElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState<"idle" | "ok" | "failed">("idle");
  const [shared, setShared] = useState<{ length: number } | "failed" | null>(null);
  const prompt = useMemo(() => buildGeneratePrompt(), []);

  // À l'ouverture, le curseur va dans l'éditeur ; à la fermeture, il revient au bouton Spec.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) area.current?.focus();
    else if (wasOpen.current) document.getElementById("spec-toggle")?.focus();
    wasOpen.current = open;
  }, [open]);

  function selectError(error: SpecError) {
    const el = area.current;
    if (!el) return;
    const range =
      error.offset !== undefined
        ? { start: error.offset, end: Math.min(error.offset + 1, text.length) }
        : locatePath(text, error.path);
    el.focus();
    if (!range) return;
    el.setSelectionRange(range.start, range.end);
    // Amène la ligne visée à l'écran (le défilement automatique du champ n'est pas fiable).
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 18;
    el.scrollTop = Math.max(lineOf(text, range.start) - 3, 0) * lineHeight;
  }

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0];
    event.target.value = ""; // permet de réimporter le même fichier
    if (chosen) onImport(await chosen.text());
  }

  /** Lien de partage de la dernière spec valide, copié dans le presse-papiers. */
  async function onShare() {
    try {
      const url = buildShareUrl(window.location.href, await encodeSpec(JSON.stringify(spec)));
      setShared((await copyText(url)) ? { length: url.length } : "failed");
    } catch {
      setShared("failed");
    }
  }

  async function onCopy() {
    setCopied((await copyText(prompt)) ? "ok" : "failed");
  }

  const logos = iconRows(spec);

  return (
    <aside
      id="spec-drawer"
      className="drawer"
      aria-label="Spec JSON"
      hidden={!open}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="drawer-head">
        <h2>Spec JSON</h2>
        <button type="button" onClick={onClose}>
          Fermer
        </button>
      </div>

      <div className="drawer-tools">
        <button type="button" onClick={() => file.current?.click()}>
          Importer
        </button>
        <input
          ref={file}
          type="file"
          accept=".json,application/json"
          hidden
          aria-label="Importer un fichier JSON"
          onChange={onFile}
        />
        <button type="button" onClick={onExport}>
          Exporter
        </button>
        <button type="button" onClick={onShare}>
          Copier le lien
        </button>
        <button type="button" onClick={onGenerate}>
          Générer avec l’IA
        </button>
        <select
          aria-label="Exemples"
          value=""
          onChange={(e) => e.target.value && onLoadExample(e.target.value)}
        >
          <option value="">Exemples…</option>
          {EXAMPLES.map((example) => (
            <option key={example.id} value={example.id}>
              {example.title}
            </option>
          ))}
        </select>
      </div>

      <p className="note" role="status">
        {shared === "failed" &&
          "Copie du lien impossible : utilise Exporter pour partager le fichier."}
        {shared && shared !== "failed" && (
          <>
            Lien de partage copié ({shared.length} caractères).
            {shared.length > LONG_LINK_CHARS &&
              " Il est long : certaines messageries le tronquent. Préfère alors Exporter."}
          </>
        )}
      </p>
      {fromLink && (
        <p className="note">
          Spec ouverte depuis un lien de partage : elle n’est enregistrée dans ton navigateur que si
          tu la modifies.
        </p>
      )}

      <textarea
        ref={area}
        className="drawer-editor"
        value={text}
        spellCheck={false}
        aria-label="Spec au format JSON"
        aria-invalid={errors.length > 0}
        aria-describedby="spec-status"
        onChange={(e) => onTextChange(e.target.value)}
      />

      <p id="spec-status" className={errors.length ? "status bad" : "status good"} role="status">
        {errors.length
          ? `${errors.length} erreur${errors.length > 1 ? "s" : ""} : la dernière version valide reste affichée.`
          : "Spec valide : le schéma est à jour."}
      </p>
      {errors.length > 0 && (
        <ul className="errors" aria-label="Erreurs de validation">
          {errors.map((error, i) => (
            <li key={i}>
              <button type="button" onClick={() => selectError(error)}>
                {error.message}
              </button>
            </li>
          ))}
        </ul>
      )}

      <section aria-label="Logos">
        <h3>Logos</h3>
        {logos.length === 0 ? (
          <p className="note">Aucune icône demandée dans cette spec.</p>
        ) : (
          <ul className="logos">
            {logos.map(({ key, source }) => (
              <li key={key}>
                <code>{key}</code>
                {source === "user" ? (
                  <span className="pill ok">fichier fourni</span>
                ) : (
                  <>
                    <span className="pill missing">logo manquant</span>
                    <span className="note">{SOURCE_HINT[source]}</span>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Prompt de génération">
        <h3>Prompt de génération</h3>
        <p className="note">
          Colle-le dans un assistant avec ta description (ou une image), puis colle le JSON obtenu
          ci-dessus.
        </p>
        <button type="button" onClick={onCopy}>
          Copier le prompt
        </button>
        <span className="note" role="status">
          {copied === "ok" && " Copié."}
          {copied === "failed" && " Copie impossible : sélectionne le texte ci-dessous."}
        </span>
        <details>
          <summary>Voir le prompt</summary>
          <pre className="prompt">{prompt}</pre>
        </details>
      </section>
    </aside>
  );
}
