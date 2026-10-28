# ArchiStep (nom de travail)

Outil web qui transforme une description d'architecture de données en schéma animé, présenté étape par étape, pour servir de support à des vidéos pédagogiques enregistrées en capture d'écran.

- **Site :** <https://archistep-six.vercel.app/>
- **Cahier des charges :** [docs/SPEC.md](docs/SPEC.md) · **Prototype de référence :** [docs/reference/prototype.html](docs/reference/prototype.html)
- **État :** V1 terminée (jalons M0 à M9). La V2 n'est pas commencée.

## Utilisation

1. Ouvre le site : l'exemple intégré (pipeline YouTube Analytics, données fictives) s'affiche.
2. Pour ta propre architecture, clique sur **Spec** : colle ou importe une spec JSON (voir [Écrire une spec](#écrire-une-spec)). Le schéma se met à jour pendant que tu tapes.
3. Passe en **Mode présentation** (touche `P`) et lance ton enregistrement d'écran. Avance avec la flèche droite ou Espace, à ton rythme, en commentant.

### Raccourcis clavier

| Touche          | Action                                             |
| --------------- | -------------------------------------------------- |
| `→` ou `Espace` | Suivant (sous-étape suivante, puis étape suivante) |
| `←`             | Précédent                                          |
| `0` ou `Début`  | Première étape (vue d'ensemble)                    |
| `P`             | Mode présentation (bascule)                        |
| `Échap`         | Quitter le mode présentation, ou fermer le tiroir  |

Les raccourcis sont ignorés pendant la saisie dans l'éditeur.

### Mode présentation

L'en-tête, le tiroir et la barre de contrôle disparaissent ; la scène s'élargit et la légende grossit de 32 %. Seul un bouton très discret « Quitter le mode présentation » reste en haut à droite (il devient lisible au survol). Aucun anneau de focus n'est visible à l'entrée dans le mode.

### Thèmes, mouvement, petits écrans

- Thèmes clair et sombre : le réglage du système, puis le bouton (mémorisé dans le navigateur).
- `prefers-reduced-motion` : ni paquets animés, ni impulsion, ni glissement de caméra (le cadre change directement).
- À 400 px de large, la page ne défile pas horizontalement : la scène devient plus haute, la caméra cadre la brique active et la légende passe sous le schéma.

## Écrire une spec

La spec JSON est la source de vérité : nœuds, groupes, liens, étapes, textes et panneaux de données. Le placement, les couleurs et les animations sont calculés ; on ne donne jamais de coordonnées.

- **Format :** décrit dans [docs/SPEC.md](docs/SPEC.md), section 6, et, dans sa version exacte, dans le prompt de génération [src/prompts/generate-spec.md](src/prompts/generate-spec.md). Le schéma Zod qui fait foi est [src/spec/schema.ts](src/spec/schema.ts).
- **Générer une spec avec un assistant :** dans le tiroir Spec, **Copier le prompt**, colle-le dans un assistant avec ta description (ou une image du schéma), puis colle le JSON obtenu dans l'éditeur.
- **Validation :** une spec invalide n'est jamais dessinée ; la dernière version valide reste à l'écran. Les erreurs disent quoi corriger (élément, champ, raison) et un clic sur une erreur sélectionne l'endroit fautif dans l'éditeur.
- **Sauvegarde :** chaque version valide est enregistrée dans le navigateur. **Exporter** télécharge la spec en `.json` ; **Importer** recharge un fichier.
- **Partager :** **Copier le lien** (dans le tiroir Spec) copie une adresse qui contient toute la spec ; la personne qui l'ouvre voit le même schéma, sans fichier ni compte (voir [Lien de partage](#lien-de-partage)).

### Écarts avec le cahier des charges

Le schéma a été généralisé quand il ne pouvait pas exprimer l'exemple, sans cas particulier dans le moteur :

- une étape a une liste `panels` (et non un seul `panel`) ; `highlight.panel` choisit le panneau visé (0 par défaut) ;
- une étape dont le `focus` est vide est une **vue d'ensemble** : rien n'est atténué et, en construction progressive, tout est affiché ;
- le `focus` d'une sous-étape **remplace** celui de l'étape (le cahier disait « ajoute ou remplace ») ;
- `highlight` : `rows` seul = lignes entières, `cols` seul = colonnes entières, les deux = leur intersection ;
- tout lien entre un groupe et l'un de ses descendants (pas seulement `trigger`) est dessiné comme une flèche courte au-dessus du groupe contenu ; un tel lien de style `trigger` avec un `flow` fait pulser sa destination ;
- sans `shape` ni couleur, un flux suit la couche de sa destination (points, carrés, barres) ;
- un bouton « Construction progressive » remplace `meta.buildMode` le temps de la session ;
- hébergement sur Vercel et non Netlify (voir « Déploiement ») ; Node 22 au lieu de 20 (Node 20 n'est plus maintenu) ; six couleurs du thème clair ont été légèrement assombries pour atteindre le contraste AA.

## Logos

Dépose les vrais logos (SVG, ou PNG transparent d'au moins 256 px) dans [src/assets/logos/](src/assets/logos/), nommés d'après la clé d'icône (`airflow.svg` pour `"icon": "airflow"`) ; variante optionnelle `airflow.dark.svg` pour le thème sombre. Ils ne sont jamais modifiés. À défaut, l'icône vient de `simple-icons`, puis d'une icône générique selon le `kind`. Règles détaillées : [src/assets/logos/README.md](src/assets/logos/README.md).

`npm run logos:check` liste, pour chaque exemple, d'où vient chaque icône. Le tiroir Spec signale aussi les logos manquants (jamais sur le schéma présenté).

## Développement

Prérequis : Node.js 22 ou plus récent (`.nvmrc` ; avec nvm : `nvm use`) et npm.

```bash
npm ci               # installation
npm run dev          # serveur local avec rechargement à chaud
npm test             # tests Vitest (une exécution) ; npm run test:watch en continu
npm run lint         # ESLint
npm run format       # Prettier (écrit) ; npm run format:check pour vérifier
npm run build        # vérification des types puis build dans dist/
npm run preview      # sert dist/ en local
npm run logos:check  # d'où vient chaque logo des exemples
```

### Organisation du code

| Dossier           | Contenu                                                                                                        |
| ----------------- | -------------------------------------------------------------------------------------------------------------- |
| `src/spec/`       | schéma Zod, `checkReferences`, validation et messages d'erreur, localisation d'une erreur dans le texte        |
| `src/engine/`     | logique sans navigateur : placement (ELK), caméra, flux, états et sous-étapes, surlignage, ajustement du texte |
| `src/components/` | `Scene` (SVG), `Stage`, `StepCaption`, `DataPanel`, `Controls`, `SpecDrawer`, `FlowPackets`                    |
| `src/icons/`      | résolution des logos (fichier fourni, simple-icons, générique)                                                 |
| `src/examples/`   | exemples intégrés (`index.ts` pour en ajouter)                                                                 |
| `src/prompts/`    | prompt de génération de spec                                                                                   |
| `src/styles/`     | `tokens.css` (couleurs des deux thèmes) et feuilles par zone                                                   |
| `tests/`          | tests Vitest                                                                                                   |

### Fonctionnement du moteur

- **Placement** (`engine/layout.ts`) : ELK, algorithme `layered`, de gauche à droite, routage orthogonal, groupes imbriqués ; nœuds de 140 × 110. Un instantané du placement de l'exemple est testé (`npx vitest -u` le régénère après un changement volontaire).
- **Rendu** (`components/Scene.tsx`) : groupes du plus extérieur au plus intérieur, liens, nœuds, puis paquets. Un nom long est réduit (jamais sous 14), passé sur deux lignes, puis tronqué ; le texte complet reste en infobulle.
- **Pas à pas** (`engine/state.ts`) : les ids de `focus` et leurs groupes ancêtres sont éclairés, le reste est atténué à 25 %. Les sous-étapes sont parcourues avant l'étape suivante ; les pastilles désignent les étapes.
- **Flux** (`engine/flow.ts`) : position des paquets calculée en fonction du temps sur le tracé du lien, une seule demande `requestAnimationFrame` en attente, arrêt au changement d'étape.
- **Caméra** (`engine/camera.ts`) : le `viewBox` glisse en 700 ms vers la boîte des ids de `zoom` (avec une marge de 14 % et le titre du groupe parent), ajustée au rapport de la scène et recalée dans le schéma. Le zoom est plafonné à 1,8 pixel d'écran par unité, quelle que soit la largeur de la scène.

## Qualité (cahier, section 13)

| Exigence                                                          | État                                                                                     |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| TypeScript strict, aucune erreur de lint, pas de `any` injustifié | oui (un seul `any`, dans un test, pour injecter des erreurs dans l'exemple)              |
| Tests : validation, `checkReferences`, boîte de zoom, placement   | oui, plus flux, sous-étapes, surlignage, éditeur, prompt, contrastes                     |
| Test de bout en bout (Playwright, facultatif)                     | non automatisé dans le dépôt ; vérifié à la main dans Chrome à chaque jalon              |
| Boutons natifs, `aria-current="step"`, légende `aria-live`        | oui                                                                                      |
| Contrastes suffisants dans les deux thèmes, focus visible         | oui, contrastes vérifiés par un test (AA, 4,5:1 pour le texte)                           |
| Premier affichage de l'exemple en moins de 2 s                    | oui : 0,6 s, et 1,5 s avec un processeur ralenti 4× (mesuré dans Chrome)                 |
| Aucune fuite d'animation lors de changements d'étapes rapides     | oui (tests de la boucle d'animation, et mesure dans Chrome après 80 changements rapides) |
| Données d'exemple marquées comme fictives                         | oui                                                                                      |

## Déploiement

Site statique hébergé sur **Vercel** (plan Hobby, gratuit), branché sur le dépôt GitHub. Les réglages sont dans [vercel.json](vercel.json) : framework Vite, commande `npm test && npm run build` (si un test échoue, rien n'est publié), dossier publié `dist`. La version de Node (22.x) se règle dans les paramètres du projet Vercel (_Settings > General > Node.js Version_).

- **Production** : chaque push ou fusion sur `main` publie sur <https://archistep-six.vercel.app/>.
- **Aperçus** : chaque autre branche et chaque pull request a son adresse de test, que Vercel indique dans la pull request. On travaille sur une branche par jalon ou par changement, on regarde son aperçu, puis on fusionne.
- **Limites du plan Hobby** : 100 déploiements par jour, aperçus compris, et usage personnel non commercial.

Connexion du dépôt (déjà faite, une seule fois) : vercel.com > connexion avec GitHub (autoriser seulement le dépôt `archistep`) > **Add New… > Project** > importer le dépôt ; vérifier Framework Preset `Vite`, Output Directory `dist`, Build Command `npm test && npm run build` ; **Deploy** ; puis régler Node.js Version sur `22.x` et vérifier que la branche de production est `main` (_Settings > Git_).

### Historique : pourquoi pas Netlify

Le projet a d'abord été déployé sur Netlify (comme le prévoit `docs/SPEC.md`, section 12). Le plan gratuit de Netlify est à crédits (300 par mois, 15 par mise en production) : les crédits ont été épuisés par les mises en production des jalons et les déploiements se sont arrêtés. Le site est donc passé sur Vercel et l'ancien site Netlify est arrêté. Ne pas remettre de `netlify.toml`.

La CI GitHub Actions ([.github/workflows/ci.yml](.github/workflows/ci.yml)) lance lint, format, tests et build sur chaque push et pull request. Elle ne sert que de retour rapide et n'intervient pas dans le déploiement.

`dist/` contient environ 3 400 petits fichiers : un par icône `simple-icons`, chargés à la demande. C'est voulu : n'importe quelle clé d'icône reste utilisable sans alourdir le chargement initial. Vercel les publie sans difficulté.
