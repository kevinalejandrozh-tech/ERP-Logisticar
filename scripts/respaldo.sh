#!/usr/bin/env bash
# Respaldo diario (Fase 4). Retiene 14 días.
set -euo pipefail
DESTINO="${DESTINO:-/srv/logisticar/respaldos}"   # cambiar al HDD de 1 TB cuando esté montado
DIAS="${DIAS:-14}"
mkdir -p "$DESTINO"
cd "$(dirname "$0")/.."
ARCHIVO="$DESTINO/logisticar_$(date +%F_%H%M).dump"
docker compose exec -T db pg_dump -U logisticar -Fc logisticar > "$ARCHIVO"
[ -s "$ARCHIVO" ] || { echo "Respaldo vacío" >&2; rm -f "$ARCHIVO"; exit 1; }
find "$DESTINO" -name 'logisticar_*.dump' -mtime +"$DIAS" -delete
echo "$(date -Is) OK $ARCHIVO"
