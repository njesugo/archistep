import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
} from "react";
import {
  cleanApiKey,
  forgetApiKey,
  looksLikeApiKey,
  maskApiKey,
  readApiKey,
  saveApiKey,
} from "../ai/apiKey";
import { ImageError, MAX_IMAGES, prepareImage, type PreparedImage } from "../ai/images";
import { AI_MODELS, DEFAULT_MODEL_ID, formatCost } from "../ai/models";
import { useGeneration, type Outcome } from "../ai/useGeneration";
import { buildGeneratePrompt } from "../prompt";
import type { Spec } from "../spec/schema";
import { useLayout } from "../useLayout";
import { Scene } from "./Scene";
import "../styles/generate.css";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Reprend le JSON dans l'éditeur (spec valide ou à corriger à la main). */
  onUse: (json: string) => void;
};

/** Aperçu du schéma proposé : le même rendu que la page, sans animation de caméra. */
function SpecPreview({ spec }: { spec: Spec }) {
  const layout = useLayout(spec);
  return (
    <div className="gen-preview" role="img" aria-label={`Aperçu : ${spec.meta.title}`}>
      {layout.status === "ready" ? (
        <Scene spec={layout.spec} layout={layout.layout} animateCamera={false} />
      ) : (
        <p className="note">Calcul de l’aperçu…</p>
      )}
    </div>
  );
}

function Result({
  outcome,
  cost,
  calls,
  onUse,
  onCorrect,
  onRestart,
}: {
  outcome: Outcome;
  cost: number | null;
  calls: number;
  onUse: () => void;
  onCorrect: () => void;
  onRestart: () => void;
}) {
  const { spec, errors } = outcome;
  return (
    <section aria-label="Résultat à relire" className="gen-result">
      <h3>Relecture</h3>
      {spec ? (
        <>
          <p className="status good" role="status">
            Spec valide : « {spec.meta.title} » ({spec.nodes.length} nœuds, {spec.groups.length}{" "}
            groupes, {spec.edges.length} liens, {spec.steps.length} étapes).
          </p>
          <SpecPreview spec={spec} />
          <p className="note">
            Vérifie le schéma et les textes avant de l’utiliser : un modèle peut oublier une brique
            ou inventer un lien. Rien n’est appliqué tant que tu ne cliques pas sur « Utiliser ».
          </p>
        </>
      ) : (
        <>
          <p className="status bad" role="status">
            La spec produite est invalide ({errors.length} erreur{errors.length > 1 ? "s" : ""}). Ta
            spec actuelle n’est pas modifiée.
          </p>
          <ul className="errors" aria-label="Erreurs de validation">
            {errors.map((error, i) => (
              <li key={i} className="gen-error">
                {error.message}
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="note">
        {outcome.model}
        {cost !== null && <> · coût estimé {formatCost(cost)}</>}
        {calls > 1 && <> ({calls} appels)</>}
      </p>
      <div className="gen-actions">
        {spec ? (
          <button type="button" className="primary" onClick={onUse}>
            Utiliser cette spec
          </button>
        ) : (
          <>
            {outcome.json && (
              <button type="button" className="primary" onClick={onCorrect}>
                Corriger avec l’IA
              </button>
            )}
            {outcome.json && (
              <button type="button" onClick={onUse}>
                Ouvrir dans l’éditeur
              </button>
            )}
          </>
        )}
        <button type="button" onClick={onRestart}>
          Recommencer
        </button>
      </div>
    </section>
  );
}

export default function GenerateDialog({ open, onClose, onUse }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const systemPrompt = useMemo(() => buildGeneratePrompt(), []);
  const generation = useGeneration();

  const [apiKey, setApiKey] = useState<string | null>(() => readApiKey());
  const [keyInput, setKeyInput] = useState("");
  const [remember, setRemember] = useState(true);
  const [keyError, setKeyError] = useState<string | null>(null);

  const [description, setDescription] = useState("");
  const [images, setImages] = useState<PreparedImage[]>([]);
  const [imageNotice, setImageNotice] = useState<string | null>(null);
  const [model, setModel] = useState(DEFAULT_MODEL_ID);

  // <dialog> natif : modal, focus piégé et Échap gérés par le navigateur.
  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  // Les adresses locales des vignettes sont libérées à la fermeture.
  const imagesRef = useRef(images);
  useEffect(() => {
    imagesRef.current = images;
  }, [images]);
  useEffect(
    () => () => imagesRef.current.forEach((image) => URL.revokeObjectURL(image.previewUrl)),
    [],
  );

  const working = generation.state.status === "working";
  const canGenerate =
    apiKey !== null && !working && (description.trim() !== "" || images.length > 0);

  async function addFiles(files: File[]) {
    const wanted = files.filter((f) => f.type.startsWith("image/") || f.type === "");
    if (wanted.length === 0) return;
    const room = MAX_IMAGES - images.length;
    const notices: string[] = [];
    if (wanted.length > room)
      notices.push(`Au plus ${MAX_IMAGES} images : les suivantes sont ignorées.`);
    const added: PreparedImage[] = [];
    for (const file of wanted.slice(0, Math.max(room, 0))) {
      try {
        added.push(await prepareImage(file));
      } catch (error) {
        notices.push(error instanceof ImageError ? error.message : "Image illisible.");
      }
    }
    setImages((current) => [...current, ...added]);
    setImageNotice(notices.length ? notices.join(" ") : null);
  }

  function onPaste(event: ClipboardEvent) {
    const files = [...event.clipboardData.files].filter((f) => f.type.startsWith("image/"));
    if (files.length === 0) return; // du texte : le collage se fait normalement
    event.preventDefault();
    void addFiles(files);
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    void addFiles([...event.dataTransfer.files]);
  }

  function removeImage(id: string) {
    setImages((current) => {
      const gone = current.find((i) => i.id === id);
      if (gone) URL.revokeObjectURL(gone.previewUrl);
      return current.filter((i) => i.id !== id);
    });
  }

  function onSaveKey() {
    const key = cleanApiKey(keyInput);
    if (!looksLikeApiKey(key)) {
      setKeyError(
        "Cette clé n’a pas le format attendu : elle commence par « sk-ant- » et ne contient pas d’espace.",
      );
      return;
    }
    if (remember && !saveApiKey(key)) {
      setKeyError(
        "Ce navigateur ne permet pas d’enregistrer la clé : elle ne sera gardée que pour cette session.",
      );
    } else {
      setKeyError(null);
    }
    setApiKey(key);
    setKeyInput("");
  }

  function onForgetKey() {
    forgetApiKey();
    setApiKey(null);
    generation.reset();
  }

  function generate(correction?: { json: string; errors: string[] }) {
    if (!apiKey) return;
    void generation.run({
      apiKey,
      model,
      systemPrompt,
      input: { description, images },
      correction,
    });
  }

  function close() {
    generation.cancel();
    onClose();
  }

  const state = generation.state;
  return (
    <dialog
      ref={dialog}
      className="gen-dialog"
      aria-labelledby="gen-title"
      onClose={close}
      onPaste={onPaste}
    >
      <div className="gen-head">
        <h2 id="gen-title">Générer une spec avec l’IA</h2>
        <button type="button" onClick={close}>
          Fermer
        </button>
      </div>

      <p className="note">
        Ta description et tes images sont envoyées à Anthropic, avec ta clé, pour produire la spec.
        Rien d’autre n’est envoyé, et rien n’est appliqué sans ta relecture.
      </p>

      <section aria-label="Clé API" className="gen-section">
        <h3>Clé API</h3>
        {apiKey ? (
          <p>
            Clé enregistrée dans ce navigateur : <code>{maskApiKey(apiKey)}</code>{" "}
            <button type="button" onClick={onForgetKey}>
              Oublier la clé
            </button>
          </p>
        ) : (
          <>
            <p className="note">
              Crée une clé sur{" "}
              <a
                href="https://console.anthropic.com/settings/keys"
                target="_blank"
                rel="noreferrer"
              >
                console.anthropic.com
              </a>{" "}
              (il faut y avoir ajouté un peu de crédit). Elle reste dans ce navigateur : n’utilise
              cette fonction que sur un ordinateur qui t’appartient.
            </p>
            <div className="gen-row">
              <input
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder="sk-ant-…"
                aria-label="Clé API Anthropic"
                value={keyInput}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setKeyInput(e.target.value)}
              />
              <button type="button" onClick={onSaveKey} disabled={keyInput.trim() === ""}>
                Enregistrer la clé
              </button>
            </div>
            <label className="gen-check">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />{" "}
              La mémoriser dans ce navigateur (sinon, seulement jusqu’à la fermeture de la page)
            </label>
            {keyError && (
              <p className="status bad" role="alert">
                {keyError}
              </p>
            )}
          </>
        )}
      </section>

      <section aria-label="Ce que l'IA doit lire" className="gen-section">
        <h3>Ton schéma</h3>
        <label htmlFor="gen-description">Description (facultative si tu ajoutes une image)</label>
        <textarea
          id="gen-description"
          rows={5}
          value={description}
          placeholder="Ex. : des événements Kafka lus par Spark, stockés en bronze puis silver sur Delta Lake, orchestrés par Airflow…"
          onChange={(e) => setDescription(e.target.value)}
        />
        <div
          className="gen-drop"
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          role="group"
          aria-label="Images"
        >
          <p>
            Colle une image (<kbd>Ctrl</kbd>+<kbd>V</kbd>), dépose-la ici, ou{" "}
            <button type="button" onClick={() => fileInput.current?.click()}>
              choisis un fichier
            </button>
            . PNG, JPEG, WebP ou GIF, {MAX_IMAGES} au plus.
          </p>
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            multiple
            hidden
            aria-label="Ajouter des images"
            onChange={(e) => {
              void addFiles([...(e.target.files ?? [])]);
              e.target.value = "";
            }}
          />
          {images.length > 0 && (
            <ul className="gen-thumbs">
              {images.map((image) => (
                <li key={image.id}>
                  <img src={image.previewUrl} alt={image.name} />
                  <button
                    type="button"
                    aria-label={`Retirer ${image.name}`}
                    onClick={() => removeImage(image.id)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          {imageNotice && (
            <p className="status bad" role="status">
              {imageNotice}
            </p>
          )}
        </div>
        <div className="gen-row">
          <label htmlFor="gen-model">Modèle</label>
          <select id="gen-model" value={model} onChange={(e) => setModel(e.target.value)}>
            {AI_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label} : {m.hint}
              </option>
            ))}
          </select>
        </div>
        <div className="gen-actions">
          <button
            type="button"
            className="primary"
            disabled={!canGenerate}
            onClick={() => generate()}
          >
            Générer
          </button>
          {working && (
            <button type="button" onClick={generation.cancel}>
              Annuler
            </button>
          )}
        </div>
      </section>

      <div aria-live="polite">
        {state.status === "working" && (
          <p className="note" role="status">
            Génération en cours… {state.received.toLocaleString("fr-FR")} caractères reçus.
          </p>
        )}
        {state.status === "failed" && (
          <p className={state.cancelled ? "note" : "status bad"} role="alert">
            {state.message}
          </p>
        )}
      </div>

      {state.status === "done" && (
        <Result
          outcome={state.outcome}
          cost={state.cost}
          calls={state.calls}
          onUse={() => {
            if (state.outcome.json) onUse(state.outcome.json);
            generation.reset();
            onClose();
          }}
          onCorrect={() => {
            if (!state.outcome.json) return;
            generate({
              json: state.outcome.json,
              errors: state.outcome.errors.map((e) => e.message),
            });
          }}
          onRestart={generation.reset}
        />
      )}
    </dialog>
  );
}
