# Migration de l’existant publication / presence

Les réunions actuelles (`publication` où `type_publication = REUNION`) et les présences (`presence.reunion_id`) sont reprises sans perdre les identifiants historiques.

```
publication (REUNION)  →  meetings.legacyPublicationId
presence               →  attendances.legacyPresenceId
```

## Procédure

1. Déployer la nouvelle application et exécuter le seed.
2. Pointer `LEGACY_DATABASE_URL` vers l’ancienne base.
3. Lancer :

```bash
npm run db:migrate:legacy
```

4. Contrôler les effectifs réunion par réunion.
5. Régénérer un QR neuf (les anciens UUID peuvent être mappés si besoin).
6. Conserver l’ancienne base en lecture seule le temps de la recette.

Les signatures historiques Base64 doivent idéalement être extraites vers le stockage objet S3 dans un second passage (non destructif).
