# Guide de déploiement Dokploy

```
Dépôt Git → Dokploy (build Docker) → conteneurs → HTTPS (Traefik / Let's Encrypt)
```

L'image est un Next.js `standalone` qui écoute sur le port **3000**, avec un healthcheck sur `/api/health`.
Au démarrage, le conteneur attend la base, synchronise le schéma Prisma, exécute le seed si `SEED_ON_BOOT=1`, puis lance le serveur.

## Option recommandée : Compose complet

Cette option déploie en une fois l'application, MariaDB, Redis et un stockage objet S3 privé (SeaweedFS). L'application crée elle-même son bucket au premier dépôt de fichier.

> MinIO ne publie plus d'images Docker publiques. Le service `storage` utilise donc SeaweedFS, compatible S3. Pour utiliser AWS S3 ou une instance MinIO existante, renseigner `S3_ENDPOINT`, `S3_ACCESS_KEY` et `S3_SECRET_KEY`, puis supprimer le service `storage` du compose.

1. Pousser le dépôt sur Git (GitHub, GitLab, Gitea…).
2. Dans Dokploy : **Create Service → Compose**.
3. Source : le dépôt Git, branche `main`.
4. **Compose Path** : `./docker-compose.dokploy.yml`.
5. Onglet **Environment** : coller le contenu de `.env.dokploy.example` et renseigner les secrets :
   - `APP_URL=https://presence.sodefor.ci`
   - `AUTH_SECRET`, `DB_PASSWORD`, `DB_ROOT_PASSWORD`, `S3_SECRET_KEY` (générer chacun avec `openssl rand -base64 32`)
   - `SEED_ON_BOOT=1` pour le premier déploiement uniquement
6. Onglet **Domains** : ajouter `presence.sodefor.ci`, service `nextjs`, port `3000`, HTTPS activé avec Let's Encrypt.
7. **Deploy**.

Aucun port n'est publié sur l'hôte : seul Traefik expose l'application. MariaDB, Redis et le stockage restent sur le réseau interne du compose.

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
SEED_ON_BOOT=0
```

5. Domaine sur le port `3000`, HTTPS activé.
6. Monter un volume sur `/data/storage` si `STORAGE_DRIVER=local`.

## Après le premier déploiement

1. Vérifier que `https://presence.sodefor.ci/api/health` renvoie `"status":"ok"`.
2. Se connecter avec `admin@sodefor.ci` / `Admin@Sodefor2026!`.
3. **Changer immédiatement ce mot de passe** (ou créer un vrai super administrateur et désactiver le compte de démonstration).
4. Repasser `SEED_ON_BOOT=0` puis redéployer.
5. Lancer le test de fumée depuis un poste : `BASE_URL=https://presence.sodefor.ci npm run test:smoke`.
6. Tester le parcours QR sur Android et sur iPhone.
7. Mettre en place les sauvegardes (voir `docs/BACKUP.md`).

## Évolutions de schéma

Le démarrage exécute `prisma db push` sans perte de données. Si une évolution est destructive, le conteneur s'arrête avec une erreur explicite. Après validation et sauvegarde, positionner `PRISMA_ACCEPT_DATA_LOSS=1` pour un seul déploiement, puis revenir à `0`.

## Contraintes d'exploitation

- **Une seule instance** du service `nextjs` : le suivi temps réel (SSE) est diffusé en mémoire du processus. Pour passer à plusieurs réplicas, il faudra relayer les événements via Redis pub/sub.
- Le proxy Traefik de Dokploy ne bufferise pas les SSE (en-tête `X-Accel-Buffering: no` envoyé).
- `AUTH_TRUST_HOST=true` est nécessaire derrière le proxy.

## Supervision minimale

- Disponibilité : `/api/health` (vérifie MariaDB et Redis)
- Monitoring Dokploy : CPU, RAM, disque
- Logs des conteneurs `nextjs`, `mariadb`, `redis`, `storage`
