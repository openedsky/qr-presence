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
npx prisma db push
npm run db:seed
npm run dev
```

Ouvrir `http://localhost:3000`.

## Installation Docker locale

```bash
docker compose up -d --build
```

Services :

- Application : http://localhost:3000
- API S3 (SeaweedFS) : http://localhost:8333
- MariaDB : localhost:3307

## Structure utile

```
src/app            pages et API
src/lib            auth, QR, RBAC, stockage
src/server         services métier
prisma             schéma et seed
docs               documentation
```
