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

## Signatures

L'intranet ne conserve en base que le nom du fichier image (`presence.signature`, ex. `6aaa71748a390.png`) ; les
images sont dans le dossier d'upload de l'intranet. Un second passage, non destructif et rejouable, les copie dans le
stockage de l'application et les rattache aux présences migrées :

```bash
SIGNATURES_DIR="/chemin/vers/uploads/signatures" DRY_RUN=1 npm run db:migrate:legacy-signatures   # bilan
SIGNATURES_DIR="/chemin/vers/uploads/signatures" npm run db:migrate:legacy-signatures             # import
```

Les variables `DATABASE_URL`, `LEGACY_DATABASE_URL` et celles du stockage (`STORAGE_DRIVER`, `S3_*`) doivent viser
les mêmes services que l'application. Les réunions complétées voient leur liste officielle régénérée à la prochaine
consultation.
