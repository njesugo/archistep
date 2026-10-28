# Logos fournis

Dépose ici les vrais logos des outils (officiels, en couleur, fond transparent). L'application les trouve toute seule : il n'y a aucune liste à maintenir.

- **Le nom du fichier est la clé d'icône** de la spec : `airflow.svg` sert à `"icon": "airflow"`. Minuscules recommandées.
- **Formats** : SVG (recommandé) ou PNG à fond transparent, 256 px de côté au minimum pour rester net en zoom.
- **Thème sombre** : si le logo a un texte foncé, ajoute une variante `airflow.dark.svg` (ou `.dark.png`), utilisée en thème sombre. Sans variante, le logo s'affiche sur une pastille claire arrondie en thème sombre.
- Les logos ne sont **jamais modifiés ni recolorés** : ils s'affichent tels quels, proportions conservées.
- Un logo fourni pour un groupe (Airflow, dbt…) s'affiche dans l'en-tête du cadre, à côté du titre.

Ordre de résolution d'une clé : fichier ici, puis l'icône du paquet `simple-icons` (secours monochrome), puis une icône générique selon le `kind` du nœud.

Contrôle : `npm run logos:check` indique, pour chaque exemple, d'où vient chaque icône et signale les clés sans logo fourni.
