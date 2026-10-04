#!/bin/sh
# Sauvegarde quotidienne (service "backup" de docker-compose.dokploy.yml) : base MariaDB + fichiers
# (signatures, listes officielles), chiffrés, avec rotation et copie hors site facultative.
# Variables :
#   DB_HOST, DB_NAME, DB_USER, DB_PASSWORD
#   BACKUP_RETENTION_DAYS (14 par défaut)
#   BACKUP_HOUR          : heure (0-23, heure du conteneur) de la sauvegarde quotidienne, 2 par défaut.
#                          Une première sauvegarde est faite au démarrage du service.
#   BACKUP_PASSPHRASE    : phrase de chiffrement AES-256, obligatoire (sauf BACKUP_ALLOW_PLAINTEXT=1)
#   BACKUP_FILES_DIR     : répertoire des fichiers à archiver (monté en lecture seule, ex. /files)
#   BACKUP_REMOTE_CMD    : commande de copie hors site appelée avec le chemin de chaque archive, ex.
#                          "rclone copy --config /config/rclone.conf {} distant:sodefor-backups"
#   BACKUP_DUMP_TIMEOUT  : durée maximale du dump en secondes (3600 par défaut)
# Le fichier $DEST/.last-success est mis à jour après chaque sauvegarde complète réussie (healthcheck).
set -eu

DEST=/backups
RETENTION="${BACKUP_RETENTION_DAYS:-14}"
HOUR="${BACKUP_HOUR:-2}"
FILES_DIR="${BACKUP_FILES_DIR:-}"
DUMP_TIMEOUT="${BACKUP_DUMP_TIMEOUT:-3600}"
mkdir -p "$DEST"
umask 077

if [ -z "${BACKUP_PASSPHRASE:-}" ]; then
  if [ "${BACKUP_ALLOW_PLAINTEXT:-0}" != "1" ]; then
    echo "[backup] BACKUP_PASSPHRASE absent : arrêt (les archives contiennent des données personnelles). BACKUP_ALLOW_PLAINTEXT=1 pour forcer." >&2
    exit 1
  fi
  echo "[backup] ATTENTION : archives en clair (BACKUP_ALLOW_PLAINTEXT=1)." >&2
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
    if ! openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:BACKUP_PASSPHRASE -in "$src" -out "$out.tmp"; then
      rm -f "$src" "$out.tmp"
      echo "[backup] ÉCHEC du chiffrement de $out" >&2
      return 1
    fi
    rm -f "$src"
  else
    mv "$src" "$out.tmp" || return 1
  fi
  mv "$out.tmp" "$out" || return 1
  echo "[backup] $out ($(du -h "$out" | cut -f1))"
  if [ -n "${BACKUP_REMOTE_CMD:-}" ]; then
    cmd=$(printf '%s' "$BACKUP_REMOTE_CMD" | sed "s#{}#$out#g")
    if ! sh -c "$cmd"; then
      echo "[backup] ÉCHEC de la copie hors site de $out" >&2
      return 1
    fi
  fi
}

# Dump dans un fichier puis compression : sans pipefail (sh), un échec de mariadb-dump serait masqué par gzip.
backup_db() {
  sql="$DEST/db-$STAMP.sql"
  if ! MYSQL_PWD="$DB_PASSWORD" timeout "$DUMP_TIMEOUT" mariadb-dump --host="${DB_HOST:-mariadb}" --user="$DB_USER" \
    --single-transaction --routines --triggers --default-character-set=utf8mb4 "$DB_NAME" > "$sql.part"; then
    rm -f "$sql.part"
    echo "[backup] ÉCHEC du dump de la base $STAMP" >&2
    return 1
  fi
  if ! tail -n 1 "$sql.part" | grep -q -- "-- Dump completed"; then
    rm -f "$sql.part"
    echo "[backup] Dump incomplet (marqueur de fin absent) $STAMP" >&2
    return 1
  fi
  if ! { gzip -9 -c "$sql.part" > "$sql.gz.part" && gzip -t "$sql.gz.part"; }; then
    rm -f "$sql.part" "$sql.gz.part"
    echo "[backup] ÉCHEC de la compression du dump $STAMP" >&2
    return 1
  fi
  rm -f "$sql.part"
  finalize "$sql.gz.part" "$sql.gz"
}

backup_files() {
  [ -n "$FILES_DIR" ] && [ -d "$FILES_DIR" ] || return 0
  out="$DEST/files-$STAMP.tar.gz"
  # GNU tar renvoie 1 si un fichier change pendant la lecture (stockage actif) : archive conservée, avertissement.
  status=0
  tar -czf "$out.part" -C "$FILES_DIR" --exclude='./.secrets' . || status=$?
  if [ "$status" -gt 1 ] || ! gzip -t "$out.part"; then
    rm -f "$out.part"
    echo "[backup] ÉCHEC de l'archive des fichiers $STAMP" >&2
    return 1
  fi
  [ "$status" -eq 1 ] && echo "[backup] Fichiers modifiés pendant l'archive $STAMP (archive conservée)" >&2
  finalize "$out.part" "$out"
}

seconds_until_next_run() {
  now=$(date +%s)
  next=$(date -d "today $HOUR:00" +%s)
  [ "$next" -le "$now" ] && next=$(date -d "tomorrow $HOUR:00" +%s)
  echo $((next - now))
}

while true; do
  STAMP=$(date -u +%Y%m%d-%H%M%S)
  ok=1
  backup_db || ok=0
  backup_files || ok=0
  if [ "$ok" -eq 1 ]; then
    date -u +%Y-%m-%dT%H:%M:%SZ > "$DEST/.last-success"
  else
    echo "[backup] Sauvegarde $STAMP incomplète" >&2
  fi
  find "$DEST" \( -name 'db-*' -o -name 'files-*' \) -mtime +"$RETENTION" -delete
  sleep "$(seconds_until_next_run)"
done
