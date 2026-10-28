# ArchiStep (nom de travail)

Outil web qui transforme une description d'architecture de données en schéma animé, présenté étape par étape, pour des vidéos pédagogiques. Cahier des charges : [docs/SPEC.md](docs/SPEC.md). Prototype de référence : [docs/reference/prototype.html](docs/reference/prototype.html).

**État : jalon M3 (rendu statique et logos).** La spec JSON est validée, placée avec ELK et dessinée en SVG (groupes, liens, nœuds, logos), en thème clair et sombre. Pas encore de navigation pas à pas.

**Site déployé :** <https://archistep.netlify.app/>

## Prérequis

Node.js 22 ou plus récent (voir `.nvmrc` ; avec nvm : `nvm use`) et npm.

## Installation

```bash
npm ci
```

## Développement

```bash
npm run dev      # serveur local avec rechargement à chaud
npm run lint     # ESLint
npm run format   # Prettier (écrit) ; format:check pour vérifier seulement
```

## Tests

```bash
npm test             # Vitest, une exécution
npm run test:watch   # Vitest en continu
```

## Build

```bash
npm run build     # vérification des types puis build dans dist/
npm run preview   # sert dist/ en local
```

## Déploiement (Netlify)

Site statique. Netlify lit [netlify.toml](netlify.toml) : commande `npm test && npm run build`, dossier publié `dist`. Si un test échoue, rien n'est publié. Chaque push sur `main` publie en production ; les autres branches et pull requests obtiennent un lien de test (_deploy preview_).

Connexion du dépôt (une seule fois) :

1. Netlify > **Add new site** > **Import an existing project** > **GitHub** > choisir le dépôt.
2. Vérifier les champs (préremplis depuis `netlify.toml`) : branche de production `main`, build command `npm test && npm run build`, publish directory `dist`, base directory vide.
3. **Deploy**. Le nom du site se change ensuite dans _Site configuration > Change site name_.

## CI

[.github/workflows/ci.yml](.github/workflows/ci.yml) lance lint, contrôle du format, tests et build sur chaque push et pull request. Elle n'intervient pas dans le déploiement.

## Spec JSON

- `src/spec/schema.ts` : schéma Zod, types déduits.
- `src/spec/checkReferences.ts` : contrôles croisés (ids uniques, références, hiérarchie, indices de surlignage).
- `src/spec/validate.ts` : `validateSpec(objet)` et `parseSpecJson(texte)` renvoient la spec ou une liste d'erreurs lisibles (élément, champ, raison).
- Écart avec le cahier des charges : une étape a `panels` (liste) et non `panel`, et `highlight` accepte un indice `panel` (0 par défaut). Voir `docs/SPEC.md`, section 6.

## Placement

`computeLayout(spec)` (`src/engine/layout.ts`) renvoie, de façon asynchrone, un rectangle absolu par nœud et par groupe (avec la profondeur du groupe) et une polyligne par lien. Le calcul utilise ELK (`elkjs`, algorithme `layered`, direction droite, routage orthogonal, groupes imbriqués). Un lien entre un groupe et l'un de ses descendants (par exemple Airflow vers dbt) est dessiné à part, du bord haut du conteneur au bord haut du contenu. Les tests vérifient l'absence de chevauchement, l'inclusion des enfants et un instantané du placement de l'exemple (`npx vitest -u` pour le régénérer après un changement volontaire).

## Rendu et logos

`Scene` (`src/components/Scene.tsx`) dessine un `<svg>` : groupes (du plus extérieur au plus intérieur), liens, nœuds. Les couleurs viennent de `src/styles/tokens.css`.

Les logos se résolvent dans cet ordre : fichier fourni dans `src/assets/logos/` (voir le README de ce dossier), puis `simple-icons`, puis une icône générique selon le `kind`. Un logo fourni n'est jamais modifié ; en thème sombre, il utilise sa variante `.dark` si elle existe, sinon une pastille claire.

`npm run logos:check` indique, pour chaque exemple, d'où vient chaque icône. Dans simple-icons, `youtube`, `databricks` et `airflow` (alias de `apacheairflow`) existent ; `fivetran` et `dbt` n'y sont pas.

Remarque : chaque icône simple-icons est un petit fichier chargé à la demande, ce qui ajoute environ 3 400 fichiers à `dist/`. C'est voulu : n'importe quelle clé reste utilisable sans alourdir le chargement initial.
