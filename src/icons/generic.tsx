import type { NodeKind } from "./resolve";

// Glyphes 24 × 24 tracés au trait, un par kind. Coloré par `currentColor`.
const GLYPHS: Record<NodeKind | "default", string> = {
  source:
    "M4 7c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zm0 0v10c0 1.7 3.6 3 8 3s8-1.3 8-3V7M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3",
  ingestion: "M4 8h13m-4-4 4 4-4 4M20 16H7m4-4-4 4 4 4",
  storage: "M12 3 3 7.5 12 12l9-4.5L12 3zM3 12l9 4.5 9-4.5M3 16.5 12 21l9-4.5",
  compute: "M7 7h10v10H7zM9 3v4m6-4v4M9 17v4m6-4v4M3 9h4m10 0h4M3 15h4m10 0h4",
  orchestrator: "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm0 4v4l3 2",
  bi: "M4 20V10m6 10V4m6 16v-7m4 7H3",
  queue: "M4 6h16M4 12h16M4 18h16M8 3v6m4 0V3m4 6V3",
  service: "M12 3 4 7.5v9L12 21l8-4.5v-9L12 3zm0 9 8-4.5M12 12v9M12 12 4 7.5",
  default: "M4 4h16v16H4z",
};

export function GenericIcon({ kind }: { kind: NodeKind | undefined }) {
  return (
    <path
      d={GLYPHS[kind ?? "default"]}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}
