#!/bin/bash
# Quick smoke test for aarogya-mitra services in GCP project aarogya-mitra.
# Run after deploy-to-aarogya-mitra.sh.

set -e

TARGET_PROJECT="aarogya-mitra"
REGION="asia-south1"
BACKEND_SERVICE="aarogya-mitra-backend-integrated"
FRONTEND_SERVICE="aarogya-mitra-frontend-integrated"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

cd "$(dirname "$0")"

BACKEND_URL=$(gcloud run services describe "$BACKEND_SERVICE" \
  --region="$REGION" \
  --project="$TARGET_PROJECT" \
  --format="get(status.url)" 2>/dev/null | sed 's|/$||')

FRONTEND_URL=$(gcloud run services describe "$FRONTEND_SERVICE" \
  --region="$REGION" \
  --project="$TARGET_PROJECT" \
  --format="get(status.url)" 2>/dev/null | sed 's|/$||')

if [ -z "$BACKEND_URL" ] || [ -z "$FRONTEND_URL" ]; then
  echo "Could not resolve service URLs. Deploy first with ./deploy-to-aarogya-mitra.sh"
  exit 1
fi

echo "Testing backend: $BACKEND_URL"
echo "Testing frontend: $FRONTEND_URL"
echo ""

OK=0

# Health
HEALTH_CODE=$(curl -s -o /tmp/am-health.json -w "%{http_code}" --max-time 15 "$BACKEND_URL/health" 2>/dev/null || echo "000")
if [ "$HEALTH_CODE" = "200" ]; then
  echo -e "${GREEN}✓ Backend /health OK${NC}"
  OK=$((OK + 1))
else
  echo -e "${RED}✗ Backend /health failed (HTTP $HEALTH_CODE)${NC}"
  [ -s /tmp/am-health.json ] && echo "  Response: $(head -c 200 /tmp/am-health.json)"
fi
rm -f /tmp/am-health.json

# API root (optional)
if curl -sf --max-time 15 -o /dev/null -w "%{http_code}" "$BACKEND_URL/api" | grep -qE '^([34]0[0-9]|200)$'; then
  echo -e "${GREEN}✓ Backend /api reachable${NC}"
  OK=$((OK + 1))
else
  echo -e "${YELLOW}⚠ Backend /api check skipped or non-2xx${NC}"
fi

# Frontend (200 and contains html)
curl -sL --max-time 15 -o /tmp/am-frontend-test.html -w "%{http_code}" "$FRONTEND_URL" >/tmp/am-frontend-http.txt 2>/dev/null || true
HTTP=$(cat /tmp/am-frontend-http.txt 2>/dev/null)
[ -z "$HTTP" ] && HTTP="000"
if [ "$HTTP" = "200" ] && grep -q '<html\|<!DOCTYPE' /tmp/am-frontend-test.html 2>/dev/null; then
  echo -e "${GREEN}✓ Frontend page loads (HTTP $HTTP)${NC}"
  OK=$((OK + 1))
else
  echo -e "${RED}✗ Frontend failed (HTTP $HTTP)${NC}"
fi

rm -f /tmp/am-frontend-test.html /tmp/am-frontend-http.txt

echo ""
if [ $OK -ge 2 ]; then
  echo -e "${GREEN}Smoke test passed. Open frontend in browser: $FRONTEND_URL${NC}"
  exit 0
else
  echo -e "${RED}Some checks failed. Inspect logs: gcloud run services logs read $BACKEND_SERVICE --region=$REGION --project=$TARGET_PROJECT${NC}"
  exit 1
fi
