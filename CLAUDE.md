# Principes du projet

- L'outil est GÉNÉRIQUE. Il doit marcher pour n'importe quelle architecture décrite par une spec JSON. Le pipeline YouTube (src/examples/youtube-pipeline.json) n'est qu'un exemple de test.
- Quand le schéma ou le moteur ne peut pas exprimer l'exemple, généralise le schéma. Ne réduis jamais l'exemple, et n'ajoute aucun cas particulier lié à cet exemple dans le code du moteur.
- Les décisions sur le CONTENU de l'exemple (quelle étape détailler, quels textes, quelles données) sont les tiennes : décide seul et indique-le dans ton résumé.
- Ne me pose une question que pour une décision qui change le schéma général, le comportement du moteur ou l'interface, ou quand le cahier des charges est contradictoire.
- Pose-moi au plus une question à la fois, avec ta recommandation.