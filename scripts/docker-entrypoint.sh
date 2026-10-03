#!/bin/sh
set -eu

PRISMA="node /app/node_modules/prisma/build/index.js"
TSX="node /app/node_modules/tsx/dist/cli.mjs"

if [ -z "${AUTH_SECRET:-}" ] || [ "${#AUTH_SECRET}" -lt 32 ]; then
  echo "[sodefor] ERREUR : AUTH_SECRET doit être défini (32 caractères minimum, ex. openssl rand -base64 32)." >&2
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

# État de la base : "migrated" (historique Prisma présent), "legacy" (créée par db push), "empty".
DB_STATE=$(node -e "
const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();
(async()=>{const rows=await p.\$queryRawUnsafe(\"SELECT TABLE_NAME AS t FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('_prisma_migrations','User')\");
const names=rows.map(r=>r.t);console.log(names.includes('_prisma_migrations')?'migrated':names.includes('User')?'legacy':'empty');await p.\$disconnect();})()
.catch(e=>{console.error(e.message);process.exit(1)})")

if [ "$DB_STATE" = "legacy" ]; then
  echo "[sodefor] base existante sans historique de migrations : mise à niveau puis référence 0_init"
  $PRISMA db execute --file prisma/pre-push.sql --schema prisma/schema.prisma
  if [ "${PRISMA_ACCEPT_DATA_LOSS:-0}" = "1" ]; then
    $PRISMA db push --skip-generate --accept-data-loss
  else
    $PRISMA db push --skip-generate
  fi
  # db push a déjà aligné le schéma complet : toutes les migrations existantes sont marquées comme appliquées.
  for dir in prisma/migrations/*/; do
    $PRISMA migrate resolve --applied "$(basename "$dir")" --schema prisma/schema.prisma
  done
fi

echo "[sodefor] migrations Prisma"
MIGRATE_OUT=$($PRISMA migrate deploy --schema prisma/schema.prisma 2>&1) || { echo "$MIGRATE_OUT" >&2; exit 1; }
echo "$MIGRATE_OUT"

# Idempotent : crée le premier super administrateur s'il n'y en a aucun, et le référentiel initial.
# Comptes et réunion de démonstration seulement avec SEED_DEMO=1.
# SEED_ON_BOOT=auto : seulement sur une base neuve ou mise à niveau (nouvelle migration), ou avec SEED_DEMO=1 ;
# 1 : à chaque démarrage ; 0 : jamais.
SEED_MODE="${SEED_ON_BOOT:-auto}"
RUN_SEED=0
if [ "$SEED_MODE" = "1" ]; then
  RUN_SEED=1
elif [ "$SEED_MODE" = "auto" ]; then
  if [ "$DB_STATE" != "migrated" ] || [ "${SEED_DEMO:-0}" = "1" ] || ! echo "$MIGRATE_OUT" | grep -q "No pending migrations"; then
    RUN_SEED=1
  fi
fi
if [ "$RUN_SEED" = "1" ]; then
  echo "[sodefor] initialisation des données"
  $TSX prisma/seed.ts
fi

echo "[sodefor] démarrage Next.js sur le port ${PORT:-3000}"
exec "$@"
