# SODEFOR Présences

Application Next.js + TypeScript de gestion des réunions et des listes de présence par QR Code, fidèle au cahier des charges fonctionnel et technique SODEFOR.

**Gestion intelligente des réunions et présences**

- Organisation unique : SODEFOR
- Mobile first pour l’émargement
- QR statique ou dynamique
- Signature manuscrite stockée hors base
- Contrôle des doublons
- Listes publique / administrative / officielle
- Audit, RBAC, exports PDF / Excel / CSV
- Docker + Dokploy

## Stack

| Couche | Technologie |
| --- | --- |
| Full-stack | Next.js 16 · TypeScript · App Router · Server Actions / Route Handlers |
| UI | Tailwind CSS 4 · composants institutionnels · Lucide |
| Validation | Zod · React Hook Form compatible |
| Auth | Auth.js (NextAuth v5) · JWT · prêt SSO/OIDC |
| ORM | Prisma |
| Base | MariaDB / MySQL |
| Cache | Redis (rate limit, QR dynamique) |
| Fichiers | Stockage objet S3 privé (SeaweedFS fourni, AWS S3 ou MinIO possibles) ou disque local |
| PDF / Excel | pdf-lib · ExcelJS |
| Temps réel | Server-Sent Events |
| Tests | Vitest · Playwright |
| Run | Docker Compose · Dokploy |

## Démarrage local (XAMPP MariaDB)

1. Créer la base `sodefor_presences` dans phpMyAdmin.
2. Copier `.env.example` vers `.env`.
3. Adapter :

```
DATABASE_URL="mysql://root:@localhost:3306/sodefor_presences"
STORAGE_DRIVER=local
REDIS_URL=
AUTH_SECRET="une-chaine-longue-aleatoire"
APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
AUTH_URL=http://localhost:3000
```

4. Installer et initialiser :

```bash
npm install
npx prisma generate
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Le seed crée le premier super administrateur (`INITIAL_ADMIN_EMAIL` / `INITIAL_ADMIN_PASSWORD`, sinon un mot de passe
provisoire affiché une seule fois dans la console) ; il doit être changé à la première connexion.
Avec `SEED_DEMO=1` (environnements de test uniquement), il ajoute des comptes de démonstration — mot de passe
`DEMO_PASSWORD` ou aléatoire affiché dans la console — et une réunion de démonstration dont le lien QR est affiché.
Aucun identifiant n’est publié dans ce dépôt.

## Docker local

```bash
docker compose up -d --build
```

L’application écoute sur `http://127.0.0.1:3000` (port hôte modifiable avec `APP_PORT`). Le fichier `.env` du projet est
lu par docker compose et doit définir `AUTH_SECRET`. Ce compose est réservé au poste local (`SEED_DEMO=1`).

## Dokploy

Service **Compose** avec `docker-compose.dokploy.yml`, variables issues de `.env.dokploy.example`, domaine attaché au service `nextjs` sur le port 3000. Procédure complète : [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

Après déploiement :

```bash
BASE_URL=https://presence.sodefor.ci npm run test:smoke
```

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run db:migrate   # nouvelle migration en développement (prisma migrate dev)
npm run db:deploy    # applique les migrations
npm run db:seed
npm run typecheck
npm run db:migrate:legacy
npm test
npm run test:e2e
```

## Documentation

- [Installation](docs/INSTALLATION.md)
- [Exploitation](docs/EXPLOITATION.md)
- [Déploiement Dokploy](docs/DEPLOYMENT.md)
- [Sauvegarde / restauration](docs/BACKUP.md)
- [Migration de l’existant](docs/MIGRATION.md)
- [API OpenAPI](docs/API.md)
- [Manuel administrateur](docs/ADMIN.md)
- [Manuel organisateur](docs/ORGANIZER.md)
- [Manuel utilisateur](docs/USER.md)
- [Plan de tests](docs/TESTS.md)
