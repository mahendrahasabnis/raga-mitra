#!/bin/bash

# Quick script to create domain mapping after domain verification
# Run this AFTER completing domain verification in Google Search Console

set -e

PROJECT_ID="raga-mitra"
DOMAIN="raga.99platforms.com"
SERVICE_NAME="ragamitra-frontend-dev"
REGION="asia-south1"

echo "🌐 Creating domain mapping for: $DOMAIN"
echo ""

# Set the active project
echo "🔧 Setting active project..."
gcloud config set project $PROJECT_ID

# Create the domain mapping
echo "🚀 Creating domain mapping..."
gcloud beta run domain-mappings create \
  --service=$SERVICE_NAME \
  --domain=$DOMAIN \
  --region=$REGION

echo ""
echo "✅ Domain mapping created successfully!"
echo ""

# Get DNS configuration
echo "📝 Getting DNS configuration..."
echo "================================"
gcloud beta run domain-mappings describe \
  --domain=$DOMAIN \
  --region=$REGION

echo ""
echo "📋 Next Steps:"
echo "=============="
echo "1. Add the DNS records shown above to your 99platforms.com domain"
echo "2. Wait 5-30 minutes for DNS propagation"
echo "3. Test: https://$DOMAIN"
echo ""
echo "🔍 Check DNS propagation: https://dnschecker.org/"
