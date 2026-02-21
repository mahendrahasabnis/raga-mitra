#!/bin/bash
# Map aarogyamitra.99platforms.com to aarogya-mitra-frontend-integrated Cloud Run
# Cloud Run domain mapping is NOT supported in asia-south1, so we use a Global Load Balancer.
# Run from repo root. Requires gcloud.

set -e

PROJECT_ID="aarogya-mitra"
REGION="asia-south1"
SERVICE="aarogya-mitra-frontend-integrated"
DOMAIN="aarogyamitra.99platforms.com"
LB_NAME="aarogya-mitra-lb"
NEG_NAME="aarogya-mitra-frontend-neg"
BACKEND_NAME="aarogya-mitra-frontend-backend"
URL_MAP_NAME="aarogya-mitra-url-map"
HTTPS_PROXY_NAME="aarogya-mitra-https-proxy"
HTTP_PROXY_NAME="aarogya-mitra-http-proxy"
CERT_NAME="aarogya-mitra-cert"
IP_NAME="aarogya-mitra-ip"
FW_RULE_HTTPS="aarogya-mitra-https-forward"
FW_RULE_HTTP="aarogya-mitra-http-forward"

echo "=== Setting up Load Balancer for $DOMAIN ==="
echo "Project: $PROJECT_ID, Region: $REGION, Service: $SERVICE"
echo ""

# 1. Reserve static IP (skip if exists)
if ! gcloud compute addresses describe "$IP_NAME" --global --project="$PROJECT_ID" &>/dev/null; then
  echo "Step 1: Reserving static IP..."
  gcloud compute addresses create "$IP_NAME" \
    --network-tier=PREMIUM \
    --ip-version=IPV4 \
    --global \
    --project="$PROJECT_ID"
else
  echo "Step 1: Static IP already exists."
fi

IP=$(gcloud compute addresses describe "$IP_NAME" --format="get(address)" --global --project="$PROJECT_ID")
echo "  IP address: $IP"
echo "  Add DNS A record: $DOMAIN -> $IP"
echo ""

# 2. Create Serverless NEG
echo "Step 2: Creating Serverless NEG..."
gcloud compute network-endpoint-groups create "$NEG_NAME" \
  --region="$REGION" \
  --network-endpoint-type=serverless \
  --cloud-run-service="$SERVICE" \
  --project="$PROJECT_ID" 2>/dev/null || echo "  NEG may already exist."

# 3. Create Backend Service
echo "Step 3: Creating Backend Service..."
gcloud compute backend-services create "$BACKEND_NAME" \
  --global \
  --load-balancing-scheme=EXTERNAL_MANAGED \
  --project="$PROJECT_ID" 2>/dev/null || echo "  Backend may already exist."

# Add NEG to backend
gcloud compute backend-services add-backend "$BACKEND_NAME" \
  --global \
  --network-endpoint-group="$NEG_NAME" \
  --network-endpoint-group-region="$REGION" \
  --project="$PROJECT_ID" 2>/dev/null || echo "  Backend already has NEG."

# 4. Create Google-managed SSL certificate
echo "Step 4: Creating SSL certificate for $DOMAIN..."
gcloud compute ssl-certificates create "$CERT_NAME" \
  --domains="$DOMAIN" \
  --global \
  --project="$PROJECT_ID" 2>/dev/null || echo "  Certificate may already exist."
echo "  Note: Certificate will provision after DNS points $DOMAIN to $IP"
echo ""

# 5. Create URL map
echo "Step 5: Creating URL map..."
gcloud compute url-maps create "$URL_MAP_NAME" \
  --default-service="$BACKEND_NAME" \
  --project="$PROJECT_ID" 2>/dev/null || echo "  URL map may already exist."

# 6. Create HTTPS proxy
echo "Step 6: Creating HTTPS proxy..."
gcloud compute target-https-proxies create "$HTTPS_PROXY_NAME" \
  --url-map="$URL_MAP_NAME" \
  --ssl-certificates="$CERT_NAME" \
  --project="$PROJECT_ID" 2>/dev/null || echo "  HTTPS proxy may already exist."

# 7. Create forwarding rules
echo "Step 7: Creating forwarding rules..."
gcloud compute forwarding-rules create "$FW_RULE_HTTPS" \
  --global \
  --target-https-proxy="$HTTPS_PROXY_NAME" \
  --address="$IP_NAME" \
  --ports=443 \
  --project="$PROJECT_ID" 2>/dev/null || echo "  HTTPS forwarding rule may already exist."

# 8. HTTP -> HTTPS redirect (so http:// and https:// both work)
echo "Step 8: Creating HTTP to HTTPS redirect..."
cat << YAML | gcloud compute url-maps import aarogya-mitra-http-redirect --global --project="$PROJECT_ID" --source=/dev/stdin 2>/dev/null || echo "  HTTP redirect URL map may already exist."
name: aarogya-mitra-http-redirect
defaultUrlRedirect:
  redirectResponseCode: MOVED_PERMANENTLY_DEFAULT
  httpsRedirect: true
YAML
gcloud compute target-http-proxies create "$HTTP_PROXY_NAME" \
  --url-map=aarogya-mitra-http-redirect \
  --global \
  --project="$PROJECT_ID" 2>/dev/null || echo "  HTTP proxy may already exist."
gcloud compute forwarding-rules create "$FW_RULE_HTTP" \
  --global \
  --target-http-proxy="$HTTP_PROXY_NAME" \
  --address="$IP_NAME" \
  --ports=80 \
  --project="$PROJECT_ID" 2>/dev/null || echo "  HTTP forwarding rule may already exist."

echo ""
echo "=== Setup complete ==="
echo ""
echo "DNS configuration:"
echo "  Add an A record:  $DOMAIN  ->  $IP"
echo ""
echo "After DNS propagates (can take up to 48h, usually minutes):"
echo "  - HTTP:  http://$DOMAIN  (redirects to HTTPS)"
echo "  - HTTPS: https://$DOMAIN"
echo "  - SSL certificate will auto-provision (may take up to 60 min)"
echo ""
echo "Verify: gcloud compute ssl-certificates describe $CERT_NAME --global --project=$PROJECT_ID"
echo "  Status should change from PROVISIONING to ACTIVE once DNS and cert are ready."
