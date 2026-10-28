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
| `L`             | Pointeur laser (bascule)                           |
| `A`             | Lecture automatique (bascule)                      |
| `C`             | Animation continue (bascule)                       |
| `F`             | Schéma en plein écran (bascule)                    |
| `Échap`         | Quitter le mode présentation, ou fermer le tiroir  |

Les raccourcis sont ignorés pendant la saisie dans l'éditeur.

### Mode présentation

L'en-tête, le tiroir et la barre de contrôle disparaissent ; la scène s'élargit et la légende grossit de 32 %. Seul un bouton très discret « Quitter le mode présentation » reste en haut à droite (il devient lisible au survol). Aucun anneau de focus n'est visible à l'entrée dans le mode.

### Lecture automatique

Le bouton **Lecture auto** (ou la touche `A`, qui marche aussi en mode présentation) fait défiler les étapes et leurs sous-étapes toutes seules, pour laisser tourner une présentation sans y toucher.

- **Durée de chaque état** : le temps de lire son texte (environ 200 mots par minute), plus 2,5 s pour repérer ce qui est éclairé, plus 2,5 s s'il a des tableaux ou du code à regarder. Avec l'exemple, comptez de 11 à 16 s par état en vitesse normale.
- **Vitesse** (liste à côté du bouton) : lente (×1,5), normale ou rapide (×0,65).
- **Arrêt** : à la fin (un nouvel appui repart du début), ou dès que tu navigues à la main (Précédent, Suivant, flèches, pastille, `0`) : on reprend la main. La lecture est suspendue (« en pause ») tant que le tiroir Spec ou la fenêtre de génération sont ouverts, puis reprend.
- **Code** : `src/engine/autoplay.ts` (durées), `src/useAutoAdvance.ts` (un seul minuteur, annulé dès qu'on change d'état ou qu'on arrête : aucune fuite).

### Animation continue et plein écran

**Animation continue** (bouton ou touche `C`) montre le schéma entier, **sans zoom**, et le fait vivre en boucle : les étapes s'éclairent à tour de rôle (celles qui éclairent quelque chose ; la vue d'ensemble est sautée), la dernière enchaînant sur la première, et **un seul flux est en mouvement à la fois** : celui de l'étape éclairée, en boucle pendant ses 4 s ; les autres liens restent immobiles, et une étape sans flux n'en anime aucun. Chaque étape dure 4 s, multipliées par la vitesse choisie (la même liste que pour la lecture auto). La légende et les panneaux restent ceux de l'étape 1, et la construction progressive est ignorée : toutes les briques restent visibles. Elle est exclusive avec la lecture auto, suspendue tant que le tiroir ou la fenêtre de génération sont ouverts, et coupée par toute navigation à la main. Avec `prefers-reduced-motion`, les étapes s'éclairent toujours mais sans paquets ni impulsions.

Le bouton **plein écran** (coin haut droit du schéma, ou touche `F`) affiche **le schéma global seul** à la taille de l'écran : aucune légende ni barre de contrôle, sans zoom, tout le schéma ajusté à l'écran. En plein écran, le schéma est neutre et fixe, sauf si l'animation continue tourne (elle fonctionne aussi). Le pointeur laser y reste visible ; `Échap` ou le bouton de sortie (discret) quitte le plein écran. Le bouton se cache en mode présentation (la touche `F` y marche toujours) et là où le navigateur n'a pas de plein écran (iPhone, par exemple).

### Pointeur laser

Le bouton **Pointeur laser** (ou la touche `L`, qui marche aussi en mode présentation) fait suivre la souris par un point rouge lumineux, pour montrer un endroit du schéma, d'un tableau ou d'un texte pendant l'enregistrement. Il remplace le curseur (les boutons et les champs gardent le leur), il est dessiné au-dessus de tout, tiroir compris, et il laisse passer les clics. Il disparaît quand la souris quitte la page ; au doigt, il n'existe que pendant le contact. Il n'est pas mémorisé d'une visite à l'autre.

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
- **Générer avec l'IA :** **Générer avec l'IA** (dans le tiroir Spec) produit une spec à partir d'une description et/ou d'une image, avec ta propre clé API (voir [Génération par IA](#génération-par-ia)).
- **Partager :** **Copier le lien** (dans le tiroir Spec) copie une adresse qui contient toute la spec ; la personne qui l'ouvre voit le même schéma, sans fichier ni compte (voir [Lien de partage](#lien-de-partage)).

### Écarts avec le cahier des charges

Le schéma a été généralisé quand il ne pouvait pas exprimer l'exemple, sans cas particulier dans le moteur :

- une étape a une liste `panels` (et non un seul `panel`) ; `highlight.panel` choisit le panneau visé (0 par défaut) ;
- les panneaux d'une étape peuvent être disposés en colonnes (`panelColumns`, `span`), voir « Panneaux en colonnes » ;
- une étape dont le `focus` est vide est une **vue d'ensemble** : rien n'est atténué et, en construction progressive, tout est affiché ;
- le `focus` d'une sous-étape **remplace** celui de l'étape (le cahier disait « ajoute ou remplace ») ;
- `highlight` : `rows` seul = lignes entières, `cols` seul = colonnes entières, les deux = leur intersection ;
- tout lien entre un groupe et l'un de ses descendants (pas seulement `trigger`) est dessiné comme une flèche courte au-dessus du groupe contenu ; un tel lien de style `trigger` avec un `flow` fait pulser sa destination ;
- sans `shape` ni couleur, un flux suit la couche de sa destination (points, carrés, barres) ;
- un bouton « Construction progressive » remplace `meta.buildMode` le temps de la session ;
- hébergement sur Vercel et non Netlify (voir « Déploiement ») ; Node 22 au lieu de 20 (Node 20 n'est plus maintenu) ; six couleurs du thème clair ont été légèrement assombries pour atteindre le contraste AA.

## Génération par IA

**Générer avec l'IA** (tiroir Spec) ouvre une fenêtre où tu décris ton architecture et/ou colles une image (`Ctrl+V`, glisser-déposer ou fichier ; PNG, JPEG, WebP ou GIF, 4 au plus). L'application envoie le prompt de génération et ton contenu à l'API Claude, puis te montre une **relecture** : la spec proposée, son aperçu et ses erreurs de validation. **Rien n'est appliqué avant ton clic sur « Utiliser cette spec »** ; si elle est invalide, « Corriger avec l'IA » renvoie la version fautive avec ses erreurs, et « Ouvrir dans l'éditeur » permet de corriger à la main. Le résultat passe ensuite par la validation et l'éditeur habituels.

- **Clé API** : à créer sur [console.anthropic.com](https://console.anthropic.com/settings/keys) (compte avec du crédit ; elle est distincte d'un abonnement à Claude). Elle est enregistrée **uniquement dans ton navigateur** (`localStorage`, au choix) et n'est envoyée qu'à `api.anthropic.com`. « Oublier la clé » la supprime. À n'utiliser que sur un ordinateur qui t'appartient.
- **Modèles** (liste déroulante) : Claude Sonnet 5.5 par défaut, Claude Opus 5.5 (plus précis), Claude Haiku 5.5 (économique). Chaque génération est facturée sur ta clé ; la fenêtre affiche le **coût estimé** (tarifs de `src/ai/models.ts`, à vérifier dans ta console). Le prompt de génération est envoyé comme message système mis en cache : une deuxième demande dans les minutes qui suivent coûte moins cher.
- **Images** : réduites dans le navigateur à 1568 px au plus avant l'envoi (au-delà, l'API les réduit elle-même, pour le même coût).
- **Erreurs** : clé refusée, crédit insuffisant, trop de demandes, service indisponible, réseau coupé, refus du modèle, réponse coupée ou sans JSON sont expliqués en français. « Annuler » interrompt la génération.
- **Sans nouveau serveur** : l'appel part du navigateur (SDK officiel `@anthropic-ai/sdk`, chargé seulement à la première génération). Pas de repli automatique vers un autre modèle en cas de refus : tu choisis un autre modèle toi-même.
- **Code** : `src/ai/` (requête, images, extraction du JSON, erreurs, coûts), `src/components/GenerateDialog.tsx`.

### Sécurité

Comme la clé vit dans le navigateur, la page porte une **politique de sécurité du contenu** (`csp.ts`, injectée dans la page construite) : elle ne peut contacter que son propre site et `api.anthropic.com`, et ne charge de scripts que de son propre site. Un script injecté ne pourrait donc pas envoyer la clé ailleurs. La CSP n'est pas active avec `npm run dev`. Un test automatique vérifie ses directives ; Zod est réglé en `jitless` parce qu'elle interdit `eval`.

## Lien de partage

**Copier le lien** (tiroir Spec) copie l'adresse de la page suivie de `#spec=z.…` : la dernière spec valide, compressée (deflate natif du navigateur, sans dépendance) puis écrite en base64url dans le **fragment** de l'URL. Le fragment n'est jamais envoyé au serveur : rien n'est stocké en ligne. Le lien de l'exemple complet fait environ 3 900 caractères. Au-delà de 8 000 caractères, le tiroir prévient que certaines messageries tronquent les liens : il faut alors partager le fichier avec **Exporter**.

- **Ouverture** : le schéma de la spec s'affiche directement (sans passer par l'exemple). Une spec ouverte depuis un lien n'est **pas enregistrée** dans le navigateur tant qu'on ne la modifie pas : ouvrir le lien de quelqu'un n'écrase pas sa propre spec sauvegardée. Dès qu'on la modifie, ou qu'on importe un fichier ou un exemple, elle devient la spec de la personne et le lien disparaît de la barre d'adresse. Coller un autre lien dans la même page l'ouvre aussi.
- **Lien illisible** (coupé, abîmé, format inconnu, spec invalide) : le tiroir s'ouvre avec une explication en français, et la spec précédente reste affichée.
- **Protection** : la décompression s'arrête à 2 Mo (une archive piégée qui se gonflerait en gigaoctets est refusée). La spec du lien passe par la même validation qu'une spec collée ; elle n'exécute rien.
- **À savoir** : le lien contient **tout le contenu** de la spec, compressé mais **pas chiffré** : n'y mets rien de confidentiel. Les logos ne voyagent pas dans le lien : ils viennent des fichiers de l'application, donc un logo que tu as ajouté chez toi n'apparaîtra pas chez les autres tant qu'il n'est pas dans le dépôt.

## Panneaux en colonnes

Par défaut, les panneaux d'une étape sont empilés dans la colonne de droite. Pour les placer côte à côte (comparer deux tables, deux extraits de code, une liste et un tableau…), l'étape déclare `"panelColumns": 2` (ou 3) : la légende passe alors au-dessus et les panneaux occupent toute la largeur, dans une grille, dans l'ordre de `panels`. Un panneau peut occuper plusieurs colonnes avec `"span"` (par exemple une requête ou un DAG large : `"span": 2`). `span` ne peut pas dépasser `panelColumns` (la validation l'explique). Sur petit écran (moins de 820 px), tout s'empile. Les surlignages des sous-étapes visent toujours un panneau par son indice dans `panels`.

## Logos

Dépose les vrais logos (SVG, ou PNG transparent d'au moins 256 px) dans [src/assets/logos/](src/assets/logos/), nommés d'après la clé d'icône (`airflow.svg` pour `"icon": "airflow"`) ; variante optionnelle `airflow.dark.svg` pour le thème sombre. Ils ne sont jamais modifiés, et un logo large (symbole + nom) garde ses proportions : la zone d'un nœud s'adapte (40 de haut, jusqu'à 108 de large). À défaut, l'icône vient de `simple-icons`, puis d'une icône générique selon le `kind`. Règles détaillées : [src/assets/logos/README.md](src/assets/logos/README.md).

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
  - **Rien ne se chevauche** : la taille de chaque étiquette de lien est donnée à ELK, qui lui réserve une place entre les colonnes ; elle passe sur deux lignes au-delà de 130 px, est dessinée au-dessus des nœuds et des cadres avec un halo, et une étiquette longue élargit donc le schéma (mieux vaut des étiquettes courtes). Un groupe est au moins assez large pour son titre en entier (logo et flèche vers un groupe contenu compris). Un nœud s'élargit de 140 à 240 au plus pour son sous-titre, au-delà tronqué (texte complet en infobulle). Les mesures sont estimées d'après la taille de la police (`src/engine/text.ts`), sans lire le DOM. Les tests contrôlent l'absence de chevauchement sur l'exemple et sur une architecture plus complexe (`tests/fixtures/azure.json`).
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
