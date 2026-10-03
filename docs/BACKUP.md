# Sauvegarde et restauration

## Périmètre

- Base MariaDB : réunions, présences, journal d'audit, jetons QR, utilisateurs, documents générés
- Stockage objet S3 : signatures et PDF (volume `storage_data` du service `storage`)
- Secrets critiques : `AUTH_SECRET`, mots de passe base, Redis et S3 (conservés dans Dokploy, à recopier dans un
  coffre-fort de mots de passe : sans `AUTH_SECRET` les sessions sont perdues, sans les mots de passe la restauration
  est impossible)

## Stratégie

- Sauvegarde quotidienne automatique : service `backup` de `docker-compose.dokploy.yml` (`scripts/backup.sh`).
  Il produit dans le volume `db_backups` la base (`db-AAAAMMJJ-HHMMSS.sql.gz`) et le stockage objet
  (`files-AAAAMMJJ-HHMMSS.tar.gz`, volume `storage_data` monté en lecture seule), avec une rotation
  `BACKUP_RETENTION_DAYS` (14 jours par défaut). Les échecs apparaissent dans les journaux du service.
- **Chiffrement** : renseigner `BACKUP_PASSPHRASE` (`openssl rand -base64 32`). Les archives portent alors
  l'extension `.enc` (AES-256-CBC, PBKDF2 200 000 itérations). Conserver la phrase dans un coffre-fort **hors du
  serveur** : sans elle, aucune restauration n'est possible. Sans phrase, le service avertit au démarrage.
- **Copie distante obligatoire** : un volume Docker reste sur le même serveur. Soit `BACKUP_REMOTE_CMD` (appelée
  pour chaque archive, `{}` = chemin ; l'outil utilisé, par exemple `rclone`, doit être présent dans l'image ou
  monté dans le conteneur), soit une synchronisation programmée sur l'hôte (`rclone sync` du volume
  `db_backups` vers un S3 externe, un NAS ou un autre site).
- Test de restauration trimestriel sur un environnement de recette, consigné.

## Base de données

Liste des sauvegardes :

```bash
docker run --rm -v <projet>_db_backups:/backups alpine ls -lh /backups
```

Déchiffrement d'une archive `.enc` (la phrase est lue depuis la variable d'environnement) :

```bash
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_PASSPHRASE \
  -in db-AAAAMMJJ-HHMMSS.sql.gz.enc -out db-AAAAMMJJ-HHMMSS.sql.gz
```

Restauration (après arrêt du service `nextjs`) :

```bash
docker run --rm -v <projet>_db_backups:/backups alpine cat /backups/db-AAAAMMJJ-HHMMSS.sql.gz \
  | gunzip | docker exec -i <conteneur-mariadb> sh -c 'mariadb -u"$MARIADB_USER" -p"$MARIADB_PASSWORD" "$MARIADB_DATABASE"'
```

Sauvegarde ponctuelle manuelle :

```bash
docker exec <conteneur-mariadb> sh -c 'mariadb-dump --single-transaction -u"$MARIADB_USER" -p"$MARIADB_PASSWORD" "$MARIADB_DATABASE"' | gzip > sodefor-$(date +%F).sql.gz
```

## Signatures et PDF

Le service `backup` les archive automatiquement (`files-*.tar.gz[.enc]`). Archive ponctuelle manuelle :

```bash
docker run --rm -v <projet>_storage_data:/data -v "$PWD":/backup alpine \
  tar czf /backup/storage-$(date +%F).tar.gz -C /data .
```

Restauration : arrêter le service `storage`, extraire l'archive dans le volume, puis redémarrer.

Avec un S3 externe, utiliser la réplication ou le versioning du fournisseur.

## Conservation et anonymisation

Les sauvegardes contiennent des données personnelles : leur rotation doit rester cohérente avec la durée de
conservation paramétrée dans l'application (les présences anonymisées par la purge automatique restent présentes
dans les sauvegardes antérieures jusqu'à leur expiration).
