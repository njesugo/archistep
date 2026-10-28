# Principes du projet

- L'outil est GÉNÉRIQUE. Il doit marcher pour n'importe quelle architecture décrite par une spec JSON. Le pipeline YouTube (src/examples/youtube-pipeline.json) n'est qu'un exemple de test.
- Quand le schéma ou le moteur ne peut pas exprimer l'exemple, généralise le schéma. Ne réduis jamais l'exemple, et n'ajoute aucun cas particulier lié à cet exemple dans le code du moteur.
- Les décisions sur le CONTENU de l'exemple (quelle étape détailler, quels textes, quelles données) sont les tiennes : décide seul et indique-le dans ton résumé.
- Ne me pose une question que pour une décision qui change le schéma général, le comportement du moteur ou l'interface, ou quand le cahier des charges est contradictoire.
- Pose-moi au plus une question à la fois, avec ta recommandation.
# Déploiement (Vercel)

- Le site est hébergé sur Vercel (plan Hobby, gratuit), branché sur le dépôt GitHub : https://archistep-six.vercel.app/. Chaque push sur `main` publie en production ; chaque autre branche et chaque pull request a son aperçu (adresse indiquée dans la pull request). Réglages dans `vercel.json` ; la version de Node (22.x) se règle dans les paramètres du projet Vercel.
- Limites du plan Hobby : 100 déploiements par jour (aperçus compris) et usage personnel non commercial. Pas de crédits à compter, mais ne pousse pas en rafale.
- L'ancien site Netlify (archistep.netlify.app) est arrêté (builds en mode « Stopped builds », dépôt toujours relié) : ne le réactive pas, ne remets pas de `netlify.toml`. Netlify facturait chaque mise en production en crédits (300 par mois sur le plan gratuit), ce qui a bloqué le projet.
- Travaille toujours sur une branche (une par jalon ou par changement). Ne pousse jamais directement sur `main`.
- Pour vérifier en ligne, utilise l'aperçu de la branche, ou le build local (`npm run build && npm run preview`).
- C'est moi qui décide quand fusionner dans `main` (donc publier). Dans tes résumés, indique la branche à pousser et rappelle que la fusion publie en production.
- Si tu proposes une fonction serveur pour la V2 (clé API), ce sera une fonction Vercel et non Netlify ; demande-moi avant, comme le cahier le prévoit.
