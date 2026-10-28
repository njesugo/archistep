# ArchiStep (nom de travail)

Outil web qui transforme une description d'architecture de données en schéma animé, présenté étape par étape, pour des vidéos pédagogiques. Cahier des charges : [docs/SPEC.md](docs/SPEC.md). Prototype de référence : [docs/reference/prototype.html](docs/reference/prototype.html).

**État : jalon M0 (squelette et déploiement).** Pour l'instant, une page d'accueil avec thèmes clair et sombre.

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
