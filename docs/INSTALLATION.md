# Installation

## Prérequis

- Node.js 22+
- MariaDB 10.11+ / 11 ou MySQL 8
- Redis (recommandé en production)
- Stockage objet compatible S3 (recommandé en production ; SeaweedFS est fourni dans les compose)
- Docker (pour Dokploy ou le compose local)

## Installation développeur

```bash
git clone <depot>
cd qr-presence2
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Ouvrir `http://localhost:3000`. Le mot de passe provisoire du premier super administrateur est écrit par le seed dans
`storage/.secrets/admin-temporary-password.txt` (ou défini par `INITIAL_ADMIN_PASSWORD`) ; il expire après 7 jours et
doit être changé à la première connexion.

Base créée auparavant avec `prisma db push` : la marquer une fois comme à jour avec
`npx prisma migrate resolve --applied 0_init` (le conteneur Docker le fait automatiquement).

## Installation Docker locale

```bash
docker compose up -d --build
```

Services :

- Application : http://127.0.0.1:3000
- API S3 (SeaweedFS) : http://127.0.0.1:8333
- MariaDB : 127.0.0.1:3307

Ports publiés sur la boucle locale uniquement ; identifiants de service fixes : ce compose n'est pas destiné à la production.

## Structure utile

```
src/app            pages et API
src/lib            auth, QR, RBAC, stockage
src/server         services métier
prisma             schéma et seed
docs               documentation
```
