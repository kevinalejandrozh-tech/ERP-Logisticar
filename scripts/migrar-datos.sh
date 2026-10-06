#!/usr/bin/env bash
# Copia la BD de Neon al Postgres local (Fase 1). Uso: NEON_URL='postgres://...' ./scripts/migrar-datos.sh
set -euo pipefail
: "${NEON_URL:?Define NEON_URL con la cadena de conexión de Neon}"
cd "$(dirname "$0")/.."
ARCHIVO="neon_$(date +%F_%H%M).dump"
echo "1/3 Respaldo desde Neon..."
docker compose exec -T db pg_dump -Fc --no-owner --no-privileges "$NEON_URL" > "$ARCHIVO"
echo "2/3 Restaurando en el servidor local..."
docker compose exec -T db pg_restore -U logisticar -d logisticar --clean --if-exists --no-owner < "$ARCHIVO"
echo "3/3 Verificación (tablas / filas de usuarios):"
docker compose exec -T db psql -U logisticar -d logisticar -tc "select count(*) from information_schema.tables where table_schema='public'"
docker compose exec -T db psql -U logisticar -d logisticar -tc "select count(*) from usuarios"
echo "Listo. Respaldo guardado en $ARCHIVO"
