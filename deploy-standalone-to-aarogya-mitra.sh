#!/bin/bash
# Deploy aarogya-mitra-backend and aarogya-mitra-frontend (same app as integrated, different service names).
# Run from repo root.

set -e

TARGET_PROJECT="aarogya-mitra"
REGION="asia-south1"
BACKEND_SERVICE="aarogya-mitra-backend"
FRONTEND_SERVICE="aarogya-mitra-frontend"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

cd "$(dirname "$0")"

echo -e "${BLUE}Deploying standalone service names to $TARGET_PROJECT: $BACKEND_SERVICE, $FRONTEND_SERVICE${NC}"
echo ""

echo "Step 1: Deploy backend ($BACKEND_SERVICE)..."
gcloud builds submit \
  --config=backend/cloudbuild-standalone.yaml \
  --project="$TARGET_PROJECT"

BACKEND_URL=$(gcloud run services describe "$BACKEND_SERVICE" \
  --region="$REGION" \
  --project="$TARGET_PROJECT" \
  --format="get(status.url)" 2>/dev/null | sed 's|/$||')

if [ -z "$BACKEND_URL" ]; then
  echo "Could not get backend URL."
  exit 1
fi
echo -e "${GREEN}Backend URL: $BACKEND_URL${NC}"
echo ""

echo "Step 2: Deploy frontend ($FRONTEND_SERVICE) with BACKEND_URL=$BACKEND_URL..."
gcloud builds submit \
  --config=frontend/cloudbuild-standalone.yaml \
  --project="$TARGET_PROJECT" \
  --substitutions="_BACKEND_URL=$BACKEND_URL"

FRONTEND_URL=$(gcloud run services describe "$FRONTEND_SERVICE" \
  --region="$REGION" \
  --project="$TARGET_PROJECT" \
  --format="get(status.url)" 2>/dev/null | sed 's|/$||')

if [ -n "$FRONTEND_URL" ]; then
  echo -e "${GREEN}Frontend URL: $FRONTEND_URL${NC}"
  echo "Updating backend CORS to allow standalone frontend..."
  gcloud run services update "$BACKEND_SERVICE" \
    --region="$REGION" \
    --project="$TARGET_PROJECT" \
    --update-env-vars="CORS_ORIGINS=$FRONTEND_URL" 2>/dev/null || true
fi

echo ""
echo "Step 3: Allow unauthenticated access..."
gcloud run services add-iam-policy-binding "$BACKEND_SERVICE" \
  --region="$REGION" --project="$TARGET_PROJECT" \
  --member="allUsers" --role="roles/run.invoker" --quiet 2>/dev/null || true
gcloud run services add-iam-policy-binding "$FRONTEND_SERVICE" \
  --region="$REGION" --project="$TARGET_PROJECT" \
  --member="allUsers" --role="roles/run.invoker" --quiet 2>/dev/null || true

echo ""
echo -e "${GREEN}Done. $BACKEND_SERVICE: $BACKEND_URL${NC}"
echo -e "${GREEN}      $FRONTEND_SERVICE: ${FRONTEND_URL:-（check console）}${NC}"
