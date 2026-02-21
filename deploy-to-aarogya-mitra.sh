#!/bin/bash
# Deploy aarogya-mitra backend and frontend (integrated) to GCP project aarogya-mitra.
# Run from repo root. Requires gcloud and Docker (for local build context).
# After deploy, run test-aarogya-mitra.sh to verify, then delete-from-raga-mitra.sh when ready.

set -e

TARGET_PROJECT="aarogya-mitra"
REGION="asia-south1"
BACKEND_SERVICE="aarogya-mitra-backend-integrated"
FRONTEND_SERVICE="aarogya-mitra-frontend-integrated"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

cd "$(dirname "$0")"

echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Deploy to GCP project: $TARGET_PROJECT${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
echo ""

# Prereqs: ensure project exists and we can submit builds
if ! gcloud projects describe "$TARGET_PROJECT" &>/dev/null; then
  echo -e "${RED}Project $TARGET_PROJECT not found or no access. Create it and grant yourself access.${NC}"
  exit 1
fi

# Enable APIs required for Cloud Build → Cloud Run deploy (avoids interactive prompt in build)
echo "Enabling required APIs on $TARGET_PROJECT (if needed)..."
for api in run.googleapis.com cloudbuild.googleapis.com containerregistry.googleapis.com sqladmin.googleapis.com secretmanager.googleapis.com; do
  gcloud services enable "$api" --project="$TARGET_PROJECT" 2>/dev/null || true
done

echo ""
echo "Step 1: Deploy backend to $TARGET_PROJECT..."
gcloud builds submit \
  --config=backend/cloudbuild-integrated.yaml \
  --project="$TARGET_PROJECT"

BACKEND_URL=$(gcloud run services describe "$BACKEND_SERVICE" \
  --region="$REGION" \
  --project="$TARGET_PROJECT" \
  --format="get(status.url)" 2>/dev/null | sed 's|/$||')

if [ -z "$BACKEND_URL" ]; then
  echo -e "${RED}Could not get backend URL.${NC}"
  exit 1
fi
echo -e "${GREEN}Backend URL: $BACKEND_URL${NC}"
echo ""

echo "Step 2: Deploy frontend with BACKEND_URL=$BACKEND_URL..."
gcloud builds submit \
  --config=frontend/cloudbuild-integrated.yaml \
  --project="$TARGET_PROJECT" \
  --substitutions="_BACKEND_URL=$BACKEND_URL"

FRONTEND_URL=$(gcloud run services describe "$FRONTEND_SERVICE" \
  --region="$REGION" \
  --project="$TARGET_PROJECT" \
  --format="get(status.url)" 2>/dev/null | sed 's|/$||')

if [ -z "$FRONTEND_URL" ]; then
  echo -e "${YELLOW}Could not get frontend URL.${NC}"
else
  echo -e "${GREEN}Frontend URL: $FRONTEND_URL${NC}"
  echo ""
  echo "Step 3: Set backend CORS to allow frontend and custom domain..."
  # Use ^;^ delimiter so commas in CORS_ORIGINS value are preserved
  CORS_ORIGINS="${FRONTEND_URL},https://aarogyamitra.99platforms.com,http://aarogyamitra.99platforms.com"
  gcloud run services update "$BACKEND_SERVICE" \
    --region="$REGION" \
    --project="$TARGET_PROJECT" \
    --update-env-vars="^;^CORS_ORIGINS=$CORS_ORIGINS"
fi

echo ""
echo "Step 4: Allow unauthenticated access (public invoker)..."
gcloud run services add-iam-policy-binding "$BACKEND_SERVICE" \
  --region="$REGION" --project="$TARGET_PROJECT" \
  --member="allUsers" --role="roles/run.invoker" --quiet 2>/dev/null || true
gcloud run services add-iam-policy-binding "$FRONTEND_SERVICE" \
  --region="$REGION" --project="$TARGET_PROJECT" \
  --member="allUsers" --role="roles/run.invoker" --quiet 2>/dev/null || true

echo ""
echo "Step 5: Custom domain aarogyamitra.99platforms.com"
echo -e "${YELLOW}  Cloud Run domain mapping is not supported in asia-south1.${NC}"
echo "  To map the domain, run: ./setup-custom-domain-lb.sh"
echo "  Then add the DNS A record at your DNS provider."
echo ""
echo -e "${GREEN}Deploy to $TARGET_PROJECT complete.${NC}"
echo "  Backend:  $BACKEND_URL"
echo "  Frontend: ${FRONTEND_URL:-（check console）}"
echo "  Custom:   https://aarogyamitra.99platforms.com (ensure DNS points to Cloud Run)"
echo ""
echo "If domain mapping was created, add the DNS records shown above to your DNS provider."
echo "Next: run ./test-aarogya-mitra.sh to verify."
