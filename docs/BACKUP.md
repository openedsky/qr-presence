# Sauvegarde et restauration

## Périmètre

- Base MariaDB : réunions, présences, journal d'audit, jetons QR, utilisateurs, documents générés
- Stockage objet S3 : signatures et PDF (volume `storage_data` du service `storage`)
- Secrets critiques : `AUTH_SECRET`, mots de passe base et S3 (conservés dans Dokploy)

## Stratégie minimale

- Sauvegarde quotidienne
- Rétention de 30 jours
- Copie distante (hors du serveur Dokploy)
- Test de restauration trimestriel

## Base de données

Dokploy propose des sauvegardes planifiées vers S3 pour ses services MariaDB. Avec le compose, depuis le serveur :

```bash
docker exec <conteneur-mariadb> sh -c 'mariadb-dump -u"$MARIADB_USER" -p"$MARIADB_PASSWORD" "$MARIADB_DATABASE"' > sodefor-$(date +%F).sql
```

Restauration :

```bash
docker exec -i <conteneur-mariadb> sh -c 'mariadb -u"$MARIADB_USER" -p"$MARIADB_PASSWORD" "$MARIADB_DATABASE"' < sodefor-AAAA-MM-JJ.sql
```

## Signatures et PDF

Archiver le volume du service `storage` :

```bash
docker run --rm -v <projet>_storage_data:/data -v "$PWD":/backup alpine \
  tar czf /backup/storage-$(date +%F).tar.gz -C /data .
```

Restauration : arrêter le service `storage`, extraire l'archive dans le volume, puis redémarrer.

Avec un S3 externe, utiliser la réplication ou le versioning du fournisseur.
