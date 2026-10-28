# Principes du projet

- L'outil est GÉNÉRIQUE. Il doit marcher pour n'importe quelle architecture décrite par une spec JSON. Le pipeline YouTube (src/examples/youtube-pipeline.json) n'est qu'un exemple de test.
- Quand le schéma ou le moteur ne peut pas exprimer l'exemple, généralise le schéma. Ne réduis jamais l'exemple, et n'ajoute aucun cas particulier lié à cet exemple dans le code du moteur.
- Les décisions sur le CONTENU de l'exemple (quelle étape détailler, quels textes, quelles données) sont les tiennes : décide seul et indique-le dans ton résumé.
- Ne me pose une question que pour une décision qui change le schéma général, le comportement du moteur ou l'interface, ou quand le cahier des charges est contradictoire.
- Pose-moi au plus une question à la fois, avec ta recommandation.
# Déploiement (crédits Netlify)

- Le plan gratuit de Netlify donne 300 crédits par mois. Chaque déploiement de production (chaque push ou fusion sur `main`) en coûte 15. Les aperçus de branche (deploy previews) sont gratuits. Une fois les crédits épuisés, plus aucune mise en production jusqu'au mois suivant.
- Travaille toujours sur une branche (une par jalon ou par changement). Ne pousse jamais directement sur `main`.
- Pour vérifier en ligne, utilise l'aperçu Netlify de la branche, ou le build local (`npm run build && npm run preview`), jamais la production.
- Ne propose pas de fusionner dans `main` à chaque jalon. C'est moi qui décide quand publier en production, en regroupant plusieurs changements. Dans tes résumés, indique la branche et son aperçu à vérifier.
- Avant toute action qui déclencherait un déploiement de production, rappelle son coût en crédits.
