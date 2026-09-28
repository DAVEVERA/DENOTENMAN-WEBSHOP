# Helpers for Cloud Build steps that must reach Cloud SQL (bash; source this file).
#
# Production DATABASE_URL for Cloud Run uses the Cloud SQL unix socket:
#   postgresql://webshop:<pw>@localhost/neondb?host=/cloudsql/<instance>&connection_limit=3
# Cloud Build steps and `docker build` cannot use that socket. They reach Cloud SQL
# through a Cloud SQL Auth Proxy container named `cloudsql-proxy` on the
# `cloudbuild` network, so the URL is rewritten to TCP on that proxy.
# While DATABASE_URL still points at Neon, nothing here changes behaviour.

CLOUDSQL_PROXY_IMAGE="gcr.io/cloud-sql-connectors/cloud-sql-proxy:2.14.0"
CLOUDSQL_PROXY_HOST="cloudsql-proxy"

is_cloudsql_url() {
  [[ "$1" == *"host=/cloudsql/"* ]]
}

# Prints the instance connection name from a socket URL.
cloudsql_instance() {
  local url="${1%%[[:space:]]*}" query="" param
  [[ "$url" == *'?'* ]] && query="${url#*'?'}"
  local IFS='&'
  for param in $query; do
    case "$param" in
      host=/cloudsql/*) printf '%s' "${param#host=/cloudsql/}"; return 0 ;;
    esac
  done
  return 1
}

# Prints the URL with the socket host replaced by the proxy (TCP) and, when a
# second argument is given, with a different database name.
cloudsql_tcp_url() {
  local url="${1%%[[:space:]]*}" database="${2:-}"
  local base="${url%%'?'*}" query="" param kept=()
  [[ "$url" == *'?'* ]] && query="${url#*'?'}"
  local IFS='&'
  for param in $query; do
    case "$param" in
      host=*|"") ;;
      *) kept+=("$param") ;;
    esac
  done
  base="${base/"@localhost/"/"@${CLOUDSQL_PROXY_HOST}:5432/"}"
  if [[ -n "$database" ]]; then
    base="${base%/*}/${database}"
  fi
  local joined="${kept[*]}"
  printf '%s' "${base}${joined:+?${joined}}"
}

# Prints the URL with only libpq-compatible query parameters (pg_dump, psql and
# pg_restore reject Prisma options such as connection_limit and pool_timeout).
# Neon pooled hosts are switched to their direct endpoint.
libpq_url() {
  # Secret values may end in a newline; URLs never contain whitespace.
  local url="${1%%[[:space:]]*}"
  url="${url/"-pooler."/"."}"
  local base="${url%%'?'*}" query="" param kept=()
  [[ "$url" == *'?'* ]] && query="${url#*'?'}"
  local IFS='&'
  for param in $query; do
    case "$param" in
      sslmode=*|channel_binding=*|connect_timeout=*|application_name=*|options=*) kept+=("$param") ;;
    esac
  done
  local joined="${kept[*]}"
  printf '%s' "${base}${joined:+?${joined}}"
}

# Starts the proxy container on the Cloud Build network and waits until ready.
start_cloudsql_proxy() {
  local instance="$1"
  docker rm -f "$CLOUDSQL_PROXY_HOST" >/dev/null 2>&1 || true
  docker run -d --name "$CLOUDSQL_PROXY_HOST" --network cloudbuild \
    "$CLOUDSQL_PROXY_IMAGE" --address 0.0.0.0 --port 5432 "$instance" >/dev/null
  local attempt
  for attempt in $(seq 1 30); do
    if docker logs "$CLOUDSQL_PROXY_HOST" 2>&1 | grep -q "ready for new connections"; then
      echo "Cloud SQL Auth Proxy gereed voor ${instance}"
      return 0
    fi
    sleep 2
  done
  docker logs "$CLOUDSQL_PROXY_HOST" 2>&1 | tail -n 20
  echo "Cloud SQL Auth Proxy startte niet"
  return 1
}
