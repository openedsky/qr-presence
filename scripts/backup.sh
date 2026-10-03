#!/bin/sh
# Sauvegarde quotidienne (service "backup" de docker-compose.dokploy.yml) : base MariaDB + fichiers
# (signatures, listes officielles), chiffrés, avec rotation et copie hors site facultative.
# Variables :
#   DB_HOST, DB_NAME, DB_USER, DB_PASSWORD
#   BACKUP_RETENTION_DAYS (14 par défaut), BACKUP_INTERVAL (86400 s)
#   BACKUP_PASSPHRASE   : phrase de chiffrement AES-256 (fortement recommandée ; sans elle, archives en clair)
#   BACKUP_FILES_DIR    : répertoire des fichiers à archiver (monté en lecture seule, ex. /files)
#   BACKUP_REMOTE_CMD   : commande de copie hors site appelée avec le chemin de chaque archive, ex.
#                         "rclone copy --config /config/rclone.conf {} distant:sodefor-backups"
set -eu

DEST=/backups
RETENTION="${BACKUP_RETENTION_DAYS:-14}"
INTERVAL="${BACKUP_INTERVAL:-86400}"
FILES_DIR="${BACKUP_FILES_DIR:-}"
mkdir -p "$DEST"
umask 077

if [ -z "${BACKUP_PASSPHRASE:-}" ]; then
  echo "[backup] ATTENTION : BACKUP_PASSPHRASE absent, les sauvegardes contiennent des données personnelles en clair." >&2
elif ! command -v openssl >/dev/null 2>&1; then
  echo "[backup] openssl introuvable : chiffrement impossible, arrêt pour ne pas produire d'archives en clair." >&2
  exit 1
fi

# Chiffre (si une phrase est fournie) puis publie l'archive de façon atomique.
finalize() {
  src="$1"
  out="$2"
  if [ -n "${BACKUP_PASSPHRASE:-}" ]; then
    out="$out.enc"
    openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:BACKUP_PASSPHRASE -in "$src" -out "$out.tmp"
    rm -f "$src"
  else
    mv "$src" "$out.tmp"
  fi
  mv "$out.tmp" "$out"
  echo "[backup] $out ($(du -h "$out" | cut -f1))"
  if [ -n "${BACKUP_REMOTE_CMD:-}" ]; then
    cmd=$(printf '%s' "$BACKUP_REMOTE_CMD" | sed "s#{}#$out#g")
    sh -c "$cmd" || echo "[backup] ÉCHEC de la copie hors site de $out" >&2
  fi
}

while true; do
  STAMP=$(date -u +%Y%m%d-%H%M%S)
  DB_FILE="$DEST/db-$STAMP.sql.gz"
  if MYSQL_PWD="$DB_PASSWORD" mariadb-dump --host="${DB_HOST:-mariadb}" --user="$DB_USER" \
    --single-transaction --routines --triggers --default-character-set=utf8mb4 "$DB_NAME" | gzip -9 > "$DB_FILE.part"; then
    finalize "$DB_FILE.part" "$DB_FILE"
  else
    rm -f "$DB_FILE.part"
    echo "[backup] ÉCHEC de la sauvegarde de la base $STAMP" >&2
  fi

  if [ -n "$FILES_DIR" ] && [ -d "$FILES_DIR" ]; then
    FILES_FILE="$DEST/files-$STAMP.tar.gz"
    if tar -czf "$FILES_FILE.part" -C "$FILES_DIR" --exclude='./.secrets' .; then
      finalize "$FILES_FILE.part" "$FILES_FILE"
    else
      rm -f "$FILES_FILE.part"
      echo "[backup] ÉCHEC de l'archive des fichiers $STAMP" >&2
    fi
  fi

  find "$DEST" \( -name 'db-*' -o -name 'files-*' \) -mtime +"$RETENTION" -delete
  sleep "$INTERVAL"
done
