// npm run logos:check : pour chaque spec d'exemple, d'où vient l'icône de chaque clé ?
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildLogoTable,
  iconSource,
  simpleIconsSlug,
  type IconSource,
} from "../src/icons/resolve.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const logosDir = join(root, "src/assets/logos");
const examplesDir = join(root, "src/examples");
const simpleDir = join(root, "node_modules/simple-icons/icons");

const logoFiles = existsSync(logosDir) ? readdirSync(logosDir) : [];
const userLogos = buildLogoTable(Object.fromEntries(logoFiles.map((f) => [f, f])));
const simpleSlugs = new Set(
  existsSync(simpleDir) ? readdirSync(simpleDir).map((f) => f.replace(/\.svg$/, "")) : [],
);

const LABEL: Record<IconSource, string> = {
  user: "fichier fourni",
  "simple-icons": "simple-icons (secours)",
  generic: "icône générique",
};

let missing = 0;
for (const file of readdirSync(examplesDir)
  .filter((f) => f.endsWith(".json"))
  .sort()) {
  const spec = JSON.parse(readFileSync(join(examplesDir, file), "utf8")) as {
    nodes?: { icon?: string }[];
    groups?: { icon?: string }[];
  };
  const keys = [
    ...new Set(
      [...(spec.nodes ?? []), ...(spec.groups ?? [])].flatMap((e) => (e.icon ? [e.icon] : [])),
    ),
  ];
  console.log(`\n${file}`);
  for (const key of keys.sort()) {
    const source = iconSource(key, userLogos, simpleSlugs);
    const dark = userLogos.get(key.toLowerCase())?.darkUrl ? " + variante .dark" : "";
    const detail = source === "simple-icons" ? ` (${simpleIconsSlug(key)})` : "";
    const flag = source === "user" ? "  ok  " : "  !!  ";
    if (source !== "user") missing++;
    console.log(`${flag}${key.padEnd(14)} ${LABEL[source]}${detail}${dark}`);
  }
}
console.log(
  missing
    ? `\n${missing} clé(s) sans logo fourni : dépose-les dans src/assets/logos/ (voir le README de ce dossier).`
    : "\nTous les logos sont fournis.",
);
