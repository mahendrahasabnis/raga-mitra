#!/bin/bash
# Start Cloud SQL Proxy for local dev. Run this in one terminal, then npm run dev:local in another.
# Requires: gcloud auth login and Cloud SQL Admin API / access to the instance.
# Instance from backend/cloudbuild-integrated.yaml (platforms-476017:asia-south1:platforms-99-sandbox)

set -e
cd "$(dirname "$0")"

INSTANCE="platforms-476017:asia-south1:platforms-99-sandbox"
PORT="${1:-5432}"

if [ ! -x "./cloud-sql-proxy" ]; then
  echo "❌ ./cloud-sql-proxy not found or not executable."
  echo "   Download: https://cloud.google.com/sql/docs/postgres/connect-auth-proxy#install"
  echo "   e.g. curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.0/cloud-sql-proxy.darwin.arm64 && chmod +x cloud-sql-proxy"
  exit 1
fi

echo "Starting Cloud SQL Proxy: $INSTANCE on port $PORT"
echo "Keep this running. In another terminal run: npm run dev:local"
echo ""
./cloud-sql-proxy --port="$PORT" "$INSTANCE"
