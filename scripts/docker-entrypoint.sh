#!/bin/sh
set -eu

PRISMA="node /app/node_modules/prisma/build/index.js"
TSX="node /app/node_modules/tsx/dist/cli.mjs"

if [ -z "${AUTH_SECRET:-}" ]; then
  echo "[sodefor] ERREUR : AUTH_SECRET doit être défini." >&2
  exit 1
fi

echo "[sodefor] attente de la base de données…"
i=0
until node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.\$queryRawUnsafe('SELECT 1').then(()=>p.\$disconnect()).then(()=>process.exit(0)).catch(()=>process.exit(1))"; do
  i=$((i+1))
  if [ "$i" -gt 60 ]; then
    echo "[sodefor] base de données injoignable après 3 minutes" >&2
    exit 1
  fi
  sleep 3
done

echo "[sodefor] synchronisation du schéma Prisma"
if [ "${PRISMA_ACCEPT_DATA_LOSS:-0}" = "1" ]; then
  $PRISMA db push --skip-generate --accept-data-loss
else
  $PRISMA db push --skip-generate
fi

if [ "${SEED_ON_BOOT:-0}" = "1" ]; then
  echo "[sodefor] jeu de données de démonstration"
  $TSX prisma/seed.ts || echo "[sodefor] seed ignoré (déjà présent ou erreur non bloquante)"
fi

echo "[sodefor] démarrage Next.js sur le port ${PORT:-3000}"
exec "$@"
