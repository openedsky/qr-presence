# Guide de déploiement Dokploy

```
Dépôt Git → Dokploy (build Docker) → conteneurs → HTTPS (Traefik / Let's Encrypt)
```

L'image est un Next.js `standalone` qui écoute sur le port **3000**, avec un healthcheck sur `/api/health`.
Au démarrage, le conteneur attend la base, applique les migrations Prisma (`migrate deploy`), exécute l'initialisation
idempotente (premier super administrateur s'il n'en existe aucun, référentiel initial), puis lance le serveur.
Le serveur lance aussi deux tâches planifiées : clôture automatique des réunions dont la fenêtre d'émargement est
dépassée (toutes les 5 minutes, liste officielle générée) et anonymisation des présences au-delà de la durée de
conservation paramétrée (toutes les 6 heures).

## Option recommandée : Compose complet

Cette option déploie en une fois l'application, MariaDB, Redis (avec mot de passe), un stockage objet S3 privé
(SeaweedFS, version figée, identité limitée au bucket) et un service de sauvegarde quotidienne de la base.
Base, cache et stockage sont sur un réseau interne sans accès extérieur.

> MinIO ne publie plus d'images Docker publiques. Le service `storage` utilise donc SeaweedFS, compatible S3. Pour utiliser AWS S3 ou une instance MinIO existante, renseigner `S3_ENDPOINT`, `S3_ACCESS_KEY` et `S3_SECRET_KEY`, puis supprimer le service `storage` du compose.

1. Pousser le dépôt sur Git (GitHub, GitLab, Gitea…).
2. Dans Dokploy : **Create Service → Compose**.
3. Source : le dépôt Git, branche `main`.
4. **Compose Path** : `./docker-compose.dokploy.yml`.
5. Onglet **Environment** : coller le contenu de `.env.dokploy.example` et renseigner les secrets :
   - `APP_URL=https://presence.sodefor.ci` (adresse des QR codes et des liens de vérification)
   - `AUTH_SECRET`, `DB_PASSWORD`, `DB_ROOT_PASSWORD`, `REDIS_PASSWORD`, `S3_SECRET_KEY` (générer chacun avec `openssl rand -hex 32`)
   - `INITIAL_ADMIN_EMAIL` (et facultativement `INITIAL_ADMIN_PASSWORD`)
6. Onglet **Domains** : ajouter `presence.sodefor.ci`, service `nextjs`, port `3000`, HTTPS activé avec Let's Encrypt.
7. **Deploy**.

Aucun port n'est publié sur l'hôte : seul Traefik expose l'application.

Une variable obligatoire manquante fait échouer le déploiement avec un message explicite (par exemple `AUTH_SECRET requis`).

## Option alternative : Application Dockerfile et services séparés

1. Créer MariaDB et Redis comme services de base de données Dokploy, et prévoir un stockage S3 (service SeaweedFS séparé ou S3 externe).
2. **Create Service → Application**, source Git, Build Type **Dockerfile**, chemin `Dockerfile`.
3. Build argument : `NEXT_PUBLIC_APP_URL=https://presence.sodefor.ci`.
4. Variables d'environnement (voir `.env.example`) :

```
APP_URL=https://presence.sodefor.ci
AUTH_URL=https://presence.sodefor.ci
AUTH_SECRET=<secret>
AUTH_TRUST_HOST=true
DATABASE_URL=mysql://USER:PASS@<hôte-interne-mariadb>:3306/sodefor_presences
REDIS_URL=redis://default:PASS@<hôte-interne-redis>:6379
STORAGE_DRIVER=s3
S3_ENDPOINT=http://<hôte-stockage-s3>:8333
S3_BUCKET=sodefor-presences
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
S3_FORCE_PATH_STYLE=true
TRUSTED_PROXY_HOPS=1
INITIAL_ADMIN_EMAIL=admin@sodefor.ci
```

5. Domaine sur le port `3000`, HTTPS activé.
6. Monter un volume sur `/data/storage` si `STORAGE_DRIVER=local`.
7. **Proxy inverse obligatoire** : `TRUSTED_PROXY_HOPS` indique combien de proxys (Traefik de Dokploy, Nginx…)
   ajoutent leur entrée à `X-Forwarded-For`. L'application ne doit jamais être exposée directement sur Internet
   (port 3000 publié sans proxy) : un client pourrait alors forger cet en-tête, contourner les limites anti-abus par
   adresse IP et fausser les adresses du journal d'audit. Avec deux proxys en cascade (CDN + Traefik), mettre `2`.
8. Sauvegardes : renseigner `BACKUP_PASSPHRASE` et une copie hors site (voir `docs/BACKUP.md`).

## Après le premier déploiement

1. Vérifier que `https://presence.sodefor.ci/api/health` renvoie `{"status":"ok"}`.
2. Lire le mot de passe provisoire du super administrateur (sauf si `INITIAL_ADMIN_PASSWORD` a été fourni) : il
   n'apparaît pas dans les journaux, il est écrit dans le fichier `/data/storage/.secrets/admin-temporary-password.txt`
   du volume (droits 0600), par ex. `docker compose exec nextjs cat /data/storage/.secrets/admin-temporary-password.txt`.
   Se connecter sous 7 jours (au-delà, le mot de passe provisoire expire), le changement est imposé, puis supprimer le fichier.
3. Créer les comptes nominatifs depuis **Utilisateurs** : chaque compte reçoit un mot de passe provisoire à changer.
4. Lancer le test de fumée depuis un poste :
   `BASE_URL=https://presence.sodefor.ci ADMIN_EMAIL=… ADMIN_PASSWORD=… npm run test:smoke`.
5. Tester le parcours QR sur Android et sur iPhone.
6. Externaliser les sauvegardes (voir `docs/BACKUP.md`).

### Mise à jour d'une installation existante

Une base créée par une version antérieure (sans historique de migrations) est détectée au démarrage : le schéma est mis
à niveau sans perte, puis la migration de référence `0_init` est marquée comme appliquée. En production (hors
`SEED_DEMO=1`), les comptes qui ont encore un mot de passe publié dans l'ancienne documentation sont neutralisés :
le super administrateur reçoit un mot de passe provisoire (écrit dans `/data/storage/.secrets/admin-temporary-password.txt`), les autres comptes
sont désactivés, et l'ancien QR de démonstration est révoqué.

## Évolutions de schéma

Les évolutions passent par des migrations versionnées (`npm run db:migrate` en développement, fichiers dans
`prisma/migrations`), appliquées au démarrage par `prisma migrate deploy`. Une migration qui échoue arrête le conteneur
avec une erreur explicite ; la base n'est jamais modifiée silencieusement.

Avec `SEED_ON_BOOT=auto` (par défaut), l'initialisation (premier administrateur, référentiel) ne tourne que sur une base
neuve ou après l'application d'une nouvelle migration ; `1` la force à chaque démarrage, `0` la désactive.

## Pool de connexions

Fixer la taille du pool Prisma dans `DATABASE_URL`, par ex. `mysql://…/sodefor_presences?connection_limit=10&pool_timeout=10`
(10 connexions par instance ; `max_connections` de MariaDB doit couvrir le nombre d'instances × `connection_limit`).

## Contraintes d'exploitation

- **Plusieurs instances possibles** du service `nextjs` : le suivi temps réel (SSE) passe par le pub/sub Redis, chaque instance relaie les événements à ses propres connexions (sans Redis, la diffusion reste limitée à l'instance qui a reçu l'émargement). Les tâches planifiées sont protégées par un verrou Redis. Chaque compte est limité à 12 flux temps réel simultanés par instance.
- Le proxy Traefik de Dokploy ne bufferise pas les SSE (en-tête `X-Accel-Buffering: no` envoyé).
- `AUTH_TRUST_HOST=true` est nécessaire derrière le proxy.
- Limites de ressources et rotation des journaux (json-file) sont définies dans le compose.

## Supervision minimale

- Disponibilité : `/api/health` renvoie seulement l'état global. Le détail (MariaDB, Redis) est disponible avec
  `/api/health?details=1` et l'en-tête `Authorization: Bearer <HEALTH_TOKEN>`.
- Journaux applicatifs au format JSON (connexions, verrouillages, tâches planifiées, erreurs serveur).
- Monitoring Dokploy : CPU, RAM, disque
- Logs des conteneurs `nextjs`, `mariadb`, `redis`, `storage`, `backup`
