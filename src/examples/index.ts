import youtubePipeline from "./youtube-pipeline.json";

export type ExampleEntry = { id: string; title: string; text: string };

/** Exemples intégrés, proposés dans le tiroir Spec. Ajouter un fichier JSON puis une ligne ici. */
export const EXAMPLES: ExampleEntry[] = [
  {
    id: "youtube-pipeline",
    title: "Pipeline YouTube Analytics (fictif)",
    text: JSON.stringify(youtubePipeline, null, 2),
  },
];

export const DEFAULT_EXAMPLE = EXAMPLES[0]!;
