#!/bin/bash
# Delete the four aarogya-mitra Cloud Run services from GCP project raga-mitra.
# Run only after you have deployed and tested in aarogya-mitra and no longer need raga-mitra.

set -e

SOURCE_PROJECT="raga-mitra"
REGION="asia-south1"

# All four services from the console list
SERVICES=(
  "aarogya-mitra-backend"
  "aarogya-mitra-backend-integrated"
  "aarogya-mitra-frontend"
  "aarogya-mitra-frontend-integrated"
)

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${YELLOW}This will DELETE the following Cloud Run services from project: $SOURCE_PROJECT${NC}"
for s in "${SERVICES[@]}"; do echo "  - $s"; done
echo ""
read -p "Type 'yes' to confirm: " confirm
if [ "$confirm" != "yes" ]; then
  echo "Aborted."
  exit 0
fi

for SERVICE in "${SERVICES[@]}"; do
  if gcloud run services describe "$SERVICE" --region="$REGION" --project="$SOURCE_PROJECT" &>/dev/null; then
    echo "Deleting $SERVICE..."
    gcloud run services delete "$SERVICE" --region="$REGION" --project="$SOURCE_PROJECT" --quiet
    echo -e "${GREEN}Deleted $SERVICE${NC}"
  else
    echo "Skip $SERVICE (not found)."
  fi
done

echo ""
echo -e "${GREEN}Done. All listed services have been removed from $SOURCE_PROJECT.${NC}"
