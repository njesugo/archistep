# ArchiStep (nom de travail)

Outil web qui transforme une description d'architecture de données en schéma animé, présenté étape par étape. Le but est de s'en servir comme support dans des vidéos pédagogiques (YouTube, LinkedIn) enregistrées en capture d'écran.

Ce document est le cahier des charges complet. Lis-le en entier avant d'écrire du code. Travaille par jalons (section 14), un commit par jalon, et déploie après chaque jalon.

---

## 1. Objectif et usage réel

L'utilisateur (un ingénieur data qui fait des vidéos pédagogiques) ouvre le site, charge une architecture, puis clique sur **Suivant** à son rythme pendant qu'il commente à voix haute et enregistre son écran. Il n'y a donc **aucune synchronisation audio** et **aucune lecture automatique obligatoire**. Le pilotage est manuel, par clic ou par touche du clavier.

Ce que l'outil doit rendre évident pour le spectateur :
- quelles sont les briques et dans quel ordre la donnée circule ;
- ce que devient la donnée à chaque couche (aperçu de table, de code, de DAG) ;
- qui orchestre quoi (un groupe qui en englobe un autre, par exemple Airflow autour de dbt).

## 2. Principes

1. **Simple d'abord.** Pas de backend en V1. Pas de compte. Pas de base de données.
2. **La spec JSON est la source de vérité.** Le schéma, les étapes, les textes et les aperçus de données sont décrits dans un JSON validé. Le moteur dessine et anime à partir de ce JSON. Un modèle de langage ne produit jamais de coordonnées ni de SVG.
3. **Le placement est automatique.** L'utilisateur ne donne jamais de positions.
4. **Lisible en vidéo.** Grandes polices, contraste fort, zoom sur l'élément expliqué.
5. **Interface en français.** Les textes de la spec sont dans la langue de l'utilisateur.
6. **Thèmes clair et sombre**, `prefers-reduced-motion` respecté (animations réduites ou supprimées).
7. **Accessible au clavier** (focus visible, boutons natifs, noms accessibles).

## 3. Hors périmètre (ne pas faire)

- Voix off, synchronisation audio, sous-titres, génération de vidéo côté serveur.
- Lecture automatique comme fonction principale (un mode lecture simple est facultatif, voir V2).
- Comptes utilisateurs, stockage serveur, collaboration.
- Éditeur de schéma par glisser-déposer libre (le placement reste automatique).

## 4. Fonctionnalités par phase

### V1 (noyau, à livrer en premier)
- Charger une spec JSON : coller dans un éditeur, importer un fichier, ou choisir un **exemple intégré** (le pipeline YouTube Analytics, section 6).
- Validation avec messages d'erreur lisibles (champ, raison, élément concerné).
- Placement automatique, groupes imbriqués inclus.
- Rendu SVG avec **logos fournis par l'utilisateur** (secours : `simple-icons`, puis icônes génériques), couches colorées (bronze, silver, gold) et cadres de groupes.
- Navigation : **Précédent / Suivant**, flèches du clavier, pastilles numérotées, retour à la vue d'ensemble.
- **Mise en valeur par étape** : les éléments concernés sont éclairés, le reste est atténué.
- **Zoom caméra par étape** : le cadre (viewBox) se déplace en douceur vers les éléments ciblés, avec dézoom sur la vue d'ensemble.
- **Construction progressive** : option pour que les éléments n'apparaissent qu'au fil des étapes.
- **Sous-étapes (beats)** : plusieurs clics à l'intérieur d'une étape (un élément à la fois, une ligne de table surlignée).
- **Flux animés** : des paquets (points, carrés, barres) circulent le long d'une flèche pendant l'étape.
- Panneaux de données : table, code, liste, DAG avec états des tâches.
- **Mode présentation** : masque l'interface, grossit le texte, garde le pas à pas.
- Export de la spec en fichier JSON. Sauvegarde locale automatique (localStorage).
- **Prompt de génération** fourni et copiable (section 10), pour demander la spec à un assistant externe.

### V2
- Import d'un schéma en **image** : l'utilisateur colle sa clé API dans le navigateur (stockée localement, jamais envoyée ailleurs ; une fonction Netlify est une alternative, voir section 12), un modèle avec vision produit la spec, puis une **étape de relecture** permet de corriger avant l'animation.
- Génération de la spec à partir d'une description texte, même mécanisme.
- Éditeur visuel de la spec (formulaires par nœud, par étape), avec aperçu en direct.
- Lien de partage : spec compressée dans le hash de l'URL.
- Surlignage de lignes et colonnes de table, comparaison avant/après côte à côte.
- Simulation d'échec dans un DAG (tâche rouge, retry, retour au vert).
- Pointeur laser (point lumineux qui suit la souris).
- Mode lecture automatique optionnel.

### V3
- Export de chaque étape en PNG ou SVG, et PDF multi-pages (carrousel LinkedIn).
- Formats 16:9, 1:1, 9:16.
- Kit de marque (couleurs, police, logo) réutilisable.

## 5. Stack technique

- **Vite + React + TypeScript** (mode strict).
- **Rendu en SVG** React, sans bibliothèque de graphes.
- **ELK.js** (`elkjs`) pour le placement, car il gère les nœuds composés (groupes imbriqués). Ne pas utiliser Dagre.
- **Zod** pour le schéma et la validation.
- **Vitest** pour les tests, **ESLint + Prettier**.
- Animation : `requestAnimationFrame` et l'API Web Animations. Pas de bibliothèque d'animation lourde, sauf besoin justifié.
- Style : CSS modules ou un seul fichier CSS avec variables (tokens) pour les deux thèmes. Pas de framework CSS imposé.
- Icônes : voir section 9.
- Gestionnaire de paquets : npm.
- Hébergement : **Netlify**, branché sur le dépôt GitHub (section 12). Vérifications automatiques (lint, tests) avec GitHub Actions, facultatif.

Avant d'installer une dépendance, vérifie qu'elle est maintenue et que sa licence permet l'usage prévu.

## 6. Modèle de données

Définir les types avec Zod dans `src/spec/schema.ts` et en déduire les types TypeScript. Toute spec passe par ce schéma avant d'être rendue.

```ts
type Spec = {
  version: 1;
  meta: { title: string; subtitle?: string; language?: "fr" | "en"; buildMode?: "all" | "progressive" };
  nodes: Node[];
  groups: Group[];
  edges: Edge[];
  steps: Step[];
};

type Node = {
  id: string;             // unique dans toute la spec (nœuds, groupes et liens confondus)
  label: string;
  sub?: string;           // petite ligne sous le nom
  icon?: string;          // clé du registre d'icônes
  kind?: "source" | "ingestion" | "storage" | "compute" | "orchestrator" | "bi" | "queue" | "service";
  layer?: "bronze" | "silver" | "gold";
};

type Group = {
  id: string;
  label: string;
  icon?: string;
  color?: "blue" | "teal" | "orange" | "purple" | "gray";
  children: string[];     // ids de nœuds ou d'autres groupes
};

type Edge = {
  id: string;
  from: string;           // id de nœud ou de groupe
  to: string;
  style?: "data" | "trigger";   // trigger = pointillés, pour l'orchestration
  label?: string;
};

type Step = {
  id: string;
  title: string;
  text: string;           // 1 à 3 phrases
  focus: string[];        // ids à éclairer (nœuds, groupes, liens)
  zoom?: string[];        // ids à cadrer, par défaut tout le schéma
  flow?: { edge: string; shape?: "dot" | "square" | "bar"; count?: number };
  panel?: Panel;
  beats?: Beat[];         // sous-étapes
};

type Beat = {
  focus?: string[];       // ajoute ou remplace la mise en valeur
  text?: string;          // remplace le texte pendant la sous-étape
  highlight?: { rows?: number[]; cols?: number[]; lines?: number[] };
};

type Panel =
  | { type: "table"; title: string; layer?: "bronze" | "silver" | "gold"; columns: string[]; rows: string[][]; numericColumns?: number[]; note?: string }
  | { type: "code"; title: string; language: "json" | "sql" | "python" | "yaml" | "text"; content: string; note?: string }
  | { type: "list"; title: string; items: { label: string; text: string }[] }
  | { type: "dag"; title: string; tasks: { name: string; state: "ok" | "run" | "wait" | "fail" }[] };
```

### Contrôles à écrire en plus du schéma (fonction `checkReferences`)
- Tous les ids sont uniques.
- Tout id cité dans `children`, `edges`, `focus`, `zoom`, `flow.edge` existe.
- Un groupe n'est pas son propre ancêtre (pas de cycle). Un nœud a au plus un parent.
- Les indices de `rows`, `cols`, `lines` existent dans le panneau.
- Les longueurs de lignes de table correspondent au nombre de colonnes.
Les erreurs doivent dire quoi corriger, par exemple : `Étape "L'ingestion" : le lien "e9" n'existe pas (liens disponibles : e1, e2, e3, e4).`

### Exemple intégré (à mettre dans `src/examples/youtube-pipeline.json`)
Pipeline YouTube Analytics, Fivetran, Databricks en médaillon, dbt, orchestré par Airflow. Données **fictives**, cohérentes d'une couche à l'autre. Le fichier `docs/reference/prototype.html` contient une première version du rendu avec tous les textes et tables de cet exemple : reprends-en le contenu (étapes, tables Bronze/Silver/Gold, requêtes SQL, DAG).

Structure attendue (extrait) :

```json
{
  "version": 1,
  "meta": { "title": "De YouTube Analytics au tableau de bord", "language": "fr", "buildMode": "all" },
  "nodes": [
    { "id": "yt", "label": "YouTube", "sub": "Analytics · API", "icon": "youtube", "kind": "source" },
    { "id": "fv", "label": "Fivetran", "sub": "connecteur géré", "icon": "fivetran", "kind": "ingestion" },
    { "id": "br", "label": "Databricks", "sub": "BRONZE · brut", "icon": "databricks", "kind": "storage", "layer": "bronze" },
    { "id": "sv", "label": "Databricks", "sub": "SILVER · nettoyé", "icon": "databricks", "kind": "storage", "layer": "silver" },
    { "id": "gd", "label": "Databricks", "sub": "GOLD · agrégé", "icon": "databricks", "kind": "storage", "layer": "gold" }
  ],
  "groups": [
    { "id": "ing", "label": "Ingestion", "color": "blue", "children": ["yt", "fv", "br"] },
    { "id": "dbt", "label": "dbt · Transformation", "icon": "dbt", "color": "orange", "children": ["sv", "gd"] },
    { "id": "af", "label": "Apache Airflow · Orchestration", "icon": "airflow", "color": "teal", "children": ["dbt"] }
  ],
  "edges": [
    { "id": "e1", "from": "yt", "to": "fv" },
    { "id": "e2", "from": "fv", "to": "br" },
    { "id": "e3", "from": "br", "to": "sv" },
    { "id": "e4", "from": "sv", "to": "gd" },
    { "id": "t1", "from": "af", "to": "dbt", "style": "trigger", "label": "déclenche" }
  ],
  "steps": [
    {
      "id": "s2", "title": "L'ingestion",
      "text": "Fivetran interroge l'API à intervalle régulier et copie les données vers Databricks, sans code à écrire.",
      "focus": ["ing", "yt", "e1", "fv"], "zoom": ["yt", "fv"],
      "flow": { "edge": "e1", "shape": "dot", "count": 4 },
      "panel": { "type": "code", "title": "Réponse de l'API (exemple fictif)", "language": "json", "content": "{ \"channel_id\": \"UC_demo\", \"views\": 1284 }" }
    }
  ]
}
```

Les étapes complètes (vue d'ensemble, source, ingestion, Bronze, orchestration, Silver, Gold) sont dans le prototype.

## 7. Moteur de rendu

Dossier `src/engine/`. Chaque module est testable sans le navigateur quand c'est possible.

**7.1 Placement (`layout.ts`)**
- Transformer la spec en graphe ELK : nœuds feuilles de taille fixe (environ 140 × 110), groupes en nœuds composés, liens entre éléments.
- Algorithme `layered`, direction `RIGHT`, hiérarchie incluse (`hierarchyHandling: INCLUDE_CHILDREN`), routage orthogonal, marges internes suffisantes pour le titre du groupe.
- Le lien de type `trigger` entre un groupe et son enfant est un cas particulier : le dessiner comme une flèche courte du bord haut du groupe parent vers le bord haut du groupe enfant, sans qu'il influence le placement.
- Retourner des rectangles absolus pour chaque nœud et chaque groupe, et des chemins pour chaque lien. Le calcul est asynchrone (ELK) : afficher un état de chargement très court.
- Tests : aucun chevauchement entre nœuds frères, chaque enfant est contenu dans son groupe, l'exemple intégré produit un placement stable.

**7.2 Rendu SVG (`Scene.tsx`)**
- Un seul `<svg>` avec un `viewBox` piloté par l'état. Ordre de dessin : groupes (du plus extérieur au plus intérieur), liens, nœuds, paquets animés.
- Les couches ont des couleurs fixes (bronze, silver, gold). Les groupes ont une couleur choisie dans une palette limitée.
- Les textes restent lisibles à un zoom élevé. Aucune taille de police inférieure à 14 unités du viewBox pour les libellés principaux.

**7.3 États par étape**
- `focus` : les ids listés sont à pleine opacité et avec contour de couleur, les autres à environ 25 % d'opacité. Les groupes ancêtres d'un élément mis en valeur restent visibles.
- `buildMode: "progressive"` : un élément est invisible tant qu'aucune étape ne l'a mis en valeur ; il apparaît ensuite et reste. La vue d'ensemble affiche tout.

**7.4 Zoom caméra (`camera.ts`)**
- Calculer la boîte englobante des ids de `zoom` (ou de tout le schéma), ajouter une marge de 12 à 15 %, puis ajuster au rapport largeur/hauteur du conteneur.
- Animer le `viewBox` de sa valeur actuelle vers la cible en 600 à 800 ms avec une courbe d'accélération douce. Si `prefers-reduced-motion`, passer directement à la cible.
- La vue d'ensemble revient au cadre complet.

**7.5 Flux animés (`flow.ts`)**
- Faire circuler `count` paquets le long du chemin du lien (`getPointAtLength`), avec décalage régulier et boucle, tant que l'étape est affichée. Arrêter proprement au changement d'étape (aucune fuite de `requestAnimationFrame`).
- La forme dépend de la couche : points pour le brut, carrés pour le nettoyé, barres pour l'agrégé (c'est une convention du prototype, à garder).

**7.6 Sous-étapes**
- Si une étape a des `beats`, **Suivant** parcourt d'abord les sous-étapes, puis passe à l'étape suivante. **Précédent** fait l'inverse. Les pastilles de navigation désignent les étapes, pas les sous-étapes. Afficher un petit compteur « 2/3 » discret quand des sous-étapes existent.

## 8. Interface

Une page, trois zones :
1. **Scène** (schéma animé) occupant la plus grande partie de l'écran.
2. **Légende de l'étape** (compteur, titre, texte) et **panneau de données** à côté ou en dessous selon la largeur.
3. **Barre de contrôle** : Précédent, Suivant, pastilles, bouton Mode présentation, bouton Spec (ouvre le tiroir d'édition), bascule de thème.

**Tiroir Spec** : éditeur de texte pour le JSON (un `<textarea>` monospace suffit en V1), boutons Importer, Exporter, Exemples, Copier le prompt de génération, liste des erreurs de validation cliquables. Appliquer la spec uniquement si elle est valide ; sinon conserver la dernière version valide affichée.

**Mode présentation** : cache l'en-tête, le tiroir et la barre de contrôle (ne laisser qu'un bouton très discret pour quitter, et la touche Échap). Taille de police augmentée de 25 à 40 %. Le pas à pas continue de fonctionner avec les flèches et la barre d'espace.

**Raccourcis** : flèche droite ou espace = suivant, flèche gauche = précédent, `0` ou `Home` = vue d'ensemble, `P` = mode présentation, Échap = quitter.

**Responsive** : le schéma doit rester utilisable à 400 px de large (zoom sur la brique active, texte sous la scène). Aucun défilement horizontal de la page.

## 9. Logos et icônes

Les logos viennent **en priorité des fichiers fournis par l'utilisateur** (vrais logos officiels, en couleur, fond transparent). `simple-icons` ne sert que de solution de secours.

**Ordre de résolution pour une clé d'icône (`icon: "airflow"`) :**
1. un fichier fourni par l'utilisateur dans `src/assets/logos/`, nommé d'après la clé : `airflow.svg` ou `airflow.png` ;
2. à défaut, l'icône correspondante du paquet npm `simple-icons` (tracé monochrome, coloré avec la couleur de marque fournie par le paquet) ;
3. à défaut, une **icône générique** selon le `kind` du nœud (source, ingestion, stockage, calcul, orchestrateur, BI, file de messages, service).

**Fichiers fournis par l'utilisateur :**
- Formats acceptés : **SVG (recommandé)** et **PNG avec fond transparent** (au moins 256 px de côté pour rester net en zoom).
- Les charger avec `import.meta.glob("/src/assets/logos/*.{svg,png}", { eager: true, query: "?url", import: "default" })` et construire la table clé → URL à partir du nom de fichier. Aucune liste à maintenir à la main.
- **Ne jamais modifier ni recolorer** ces logos : afficher tels quels, avec leurs couleurs d'origine, dans une zone carrée au centre du nœud, en conservant les proportions.
- **Thème sombre** : un logo à texte foncé peut devenir illisible. Deux solutions, à implémenter toutes les deux : (a) variante optionnelle `airflow.dark.svg` utilisée en thème sombre si elle existe ; (b) sinon, afficher le logo sur une pastille claire arrondie en thème sombre.
- Ajouter `src/assets/logos/README.md` qui explique ces règles (nom = clé, formats, variante `.dark`).
- Un logo fourni pour un groupe (par exemple Airflow ou dbt) s'affiche dans l'en-tête du cadre du groupe, à côté du titre.

**Outils de contrôle :**
- Un script `npm run logos:check` liste, pour chaque spec d'exemple, les clés d'icônes utilisées et indique d'où chacune est résolue (fichier utilisateur, simple-icons, générique). Il signale les clés sans logo fourni.
- Dans l'application, une icône de remplacement affiche une petite pastille discrète « logo manquant » dans le tiroir Spec, pas sur le schéma présenté.

**`simple-icons` (secours) :** vérifie quelles marques sont réellement présentes avant de t'en servir ; ne suppose rien. Les logos servent à identifier les outils ; ne pas les déformer.

**V2 :** permettre d'ajouter un logo depuis l'application (glisser-déposer d'un SVG ou PNG, associé à une clé), conservé localement dans le navigateur (IndexedDB) et exportable avec la spec.

## 10. Génération de la spec (V1 sans backend)

En V1, la spec est produite en dehors de l'application : l'utilisateur colle une description (ou joint une image) dans un assistant, avec le **prompt de génération** que l'application met à disposition (bouton Copier), puis colle le JSON obtenu dans le tiroir Spec.

Créer `src/prompts/generate-spec.md` et l'afficher dans l'application. Contenu attendu :
- le rôle (concepteur de schémas d'architecture pédagogiques) ;
- le schéma complet (section 6) et ses règles de cohérence ;
- les consignes : ne jamais donner de coordonnées, ids courts et uniques, textes de 1 à 3 phrases, une étape par brique ou par groupe important, données d'exemple **clairement fictives** et cohérentes d'une couche à l'autre ;
- l'exemple intégré comme référence de style ;
- la sortie : un seul bloc JSON, sans texte autour.

En V2, le même prompt est envoyé directement à l'API avec la clé de l'utilisateur ; une relecture visible avant animation est obligatoire.

## 11. Structure du dépôt

```
archistep/
├─ .github/workflows/ci.yml     (facultatif : lint et tests)
├─ netlify.toml
├─ docs/
│  ├─ SPEC.md                    (ce document)
│  └─ reference/prototype.html   (prototype de référence)
├─ public/
├─ src/
│  ├─ spec/        schema.ts, checkReferences.ts, types
│  ├─ engine/      layout.ts, camera.ts, flow.ts, state.ts
│  ├─ components/  Scene, Stage, StepCaption, DataPanel, Controls, SpecDrawer
│  ├─ icons/       registry.ts (logo utilisateur > simple-icons > générique)
│  ├─ assets/logos/ logos fournis par l'utilisateur (svg, png), nommés par clé, + README.md
│  ├─ examples/    youtube-pipeline.json
│  ├─ prompts/     generate-spec.md
│  ├─ styles/      tokens.css (thèmes clair et sombre)
│  └─ main.tsx
├─ tests/
├─ index.html
├─ vite.config.ts
├─ package.json
└─ README.md
```

## 12. Déploiement sur Netlify

Site statique, lien du type `https://<nom-du-site>.netlify.app`. Pas de domaine personnalisé nécessaire. L'utilisateur a déjà utilisé Netlify.

1. **Dépôt GitHub**, public ou privé (les deux fonctionnent avec Netlify).
2. **Connexion du dépôt à Netlify.** Cette étape se fait dans l'interface de Netlify, par l'utilisateur : *Add new site > Import an existing project > GitHub > choisir le dépôt*. Netlify lit sa configuration dans `netlify.toml`, il n'y a rien d'autre à saisir. Tu ne peux pas la faire à sa place : prépare le dépôt, puis explique-lui exactement quoi cliquer. Le nom du site (donc l'URL) se choisit à ce moment et peut être changé ensuite dans *Site configuration > Change site name*.
3. **`netlify.toml` à la racine :**

```toml
[build]
  command = "npm test && npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "20"
```

   La commande lance les tests avant le build : si un test échoue, rien n'est publié. Le site est servi à la racine, donc `base` reste à sa valeur par défaut (`/`) dans `vite.config.ts`. L'application tient sur une seule page, sans routeur à chemins, donc aucune règle de redirection n'est nécessaire.
4. **Déploiements.** Chaque push sur `main` publie en production. Chaque branche ou pull request peut avoir son propre lien de test (*deploy preview*) ; vérifie que l'option est active dans *Site configuration > Build & deploy*. Utilise une branche par jalon et regarde son aperçu avant de fusionner.
5. **CI GitHub Actions (facultatif)** : retour rapide sur les pull requests, sans rôle dans le déploiement. Fichier `.github/workflows/ci.yml` (vérifie les versions les plus récentes des actions) :

```yaml
name: CI
on:
  push:
  pull_request:
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run build
```

6. **Fonctions Netlify (V2 uniquement, ne pas y toucher avant).** Par défaut, l'import d'image et la génération de spec en V2 utilisent la clé API de l'utilisateur, saisie dans le navigateur. Une alternative est une fonction dans `netlify/functions/` qui appelle l'API du modèle côté serveur, avec la clé stockée comme **variable d'environnement Netlify** (jamais dans le dépôt). Dans ce cas, ajouter une limitation de débit et une taille maximale d'entrée, car sinon n'importe qui peut consommer le quota. Demande l'avis de l'utilisateur avant de choisir cette option.
7. **README** : installation (`npm ci`), développement (`npm run dev`), tests, build, lien du site déployé, et les étapes de connexion à Netlify.

Alternatives équivalentes si Netlify pose problème : Cloudflare Pages, Vercel ou GitHub Pages (dans ce cas, définir `base` avec le nom du dépôt). Le code de l'application ne change pas.

## 13. Qualité

- TypeScript strict, aucune erreur de lint, aucun `any` injustifié.
- Tests Vitest : validation (cas valides et invalides), `checkReferences`, calcul de la boîte de zoom, placement de l'exemple intégré.
- Un test de bout en bout minimal (Playwright, facultatif en V1) : l'exemple se charge, Suivant parcourt les 7 états, aucune erreur dans la console.
- Accessibilité : boutons natifs, `aria-current="step"` sur la pastille active, zone de légende en `aria-live="polite"`, contrastes suffisants dans les deux thèmes, focus visible.
- Performance : le premier affichage de l'exemple en moins de 2 secondes sur un ordinateur ordinaire ; aucune fuite d'animation lors de changements d'étapes rapides.
- Les données d'exemple affichées sont toujours **marquées comme fictives**.

## 14. Jalons (ordre de travail)

Pour chaque jalon : code, tests, commit clair, déploiement fonctionnel.

- **M0. Squelette et déploiement.** Projet Vite + React + TS, ESLint, Prettier, Vitest, `netlify.toml`, CI facultative, page « Bonjour » en ligne. L'utilisateur connecte le dépôt à Netlify (section 12, étape 2) ; guide-le. Critère : le lien `netlify.app` répond et un nouveau push le met à jour.
- **M1. Spec et validation.** `schema.ts`, `checkReferences.ts`, exemple intégré, tests. Critère : l'exemple est valide ; une spec cassée donne des messages précis.
- **M2. Placement.** `layout.ts` avec ELK, tests de non-chevauchement. Critère : l'exemple est placé comme dans le prototype (ingestion à gauche, Airflow autour de dbt à droite).
- **M3. Rendu statique et logos.** `Scene` affiche nœuds, groupes, liens et logos (ordre de résolution de la section 9), en clair et en sombre, avec `npm run logos:check`. L'utilisateur dépose ses logos dans `src/assets/logos/` (youtube, fivetran, databricks, dbt, airflow) ; demande-les-lui au début du jalon et continue avec des icônes de secours s'il n'est pas prêt. Critère : ressemble au prototype, et les logos fournis apparaissent sans modification.
- **M4. Pas à pas.** Navigation, mise en valeur, légende, panneaux de données (table, code, liste, DAG). Critère : les 7 états de l'exemple fonctionnent.
- **M5. Flux animés.** Paquets le long des liens, impulsion Airflow vers dbt, arrêt propre. Critère : pas de fuite en changeant d'étape rapidement.
- **M6. Zoom caméra.** Animation du viewBox, dézoom en vue d'ensemble, réduction de mouvement. Critère : chaque étape cadre sa cible, texte lisible.
- **M7. Construction progressive et sous-étapes.** `buildMode`, `beats`, compteur de sous-étapes. Critère : l'exemple a au moins une étape avec trois sous-étapes.
- **M8. Spec en direct.** Tiroir d'édition, import et export JSON, sauvegarde locale, prompt copiable. Critère : modifier le JSON met à jour le schéma sans rechargement.
- **M9. Mode présentation et finitions.** Mode présentation, raccourcis, responsive 400 px, accessibilité, README. Critère : checklist de la section 13 respectée.

La V1 est terminée après M9. N'attaque pas la V2 sans validation de l'utilisateur.

## 15. Décisions déjà prises et questions ouvertes

**Prises :** pas de backend en V1 ; pas de synchronisation audio ; placement automatique avec ELK ; spec JSON validée avec Zod ; déploiement sur Netlify depuis GitHub ; logos réels fournis par l'utilisateur en priorité, `simple-icons` en secours ; interface en français ; données d'exemple fictives.

**À demander à l'utilisateur avant le jalon concerné :**
- Nom définitif du projet et nom du site Netlify (impact sur l'URL `nom.netlify.app`).
- Dépôt public ou privé (Netlify fonctionne dans les deux cas).
- Palette et police définitives (le prototype donne une direction : fond neutre à teinte bleutée, polices Bricolage Grotesque, IBM Plex Sans et IBM Plex Mono, couleurs de couche bronze, silver, gold).

## 16. Prototype de référence

`docs/reference/prototype.html` est une page unique, sans dépendance, qui implémente déjà : placement manuel de l'exemple, mise en valeur par étape, flux animés, panneaux de données, DAG, thèmes clair et sombre. Elle sert de référence visuelle et de source des textes. Elle **ne** contient pas le zoom caméra, la construction progressive, les sous-étapes ni le placement automatique : ce sont les ajouts de ce projet. Ne copie pas son code tel quel ; reprends ses idées dans l'architecture décrite ici.
