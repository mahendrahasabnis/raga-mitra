#!/bin/bash

# Script to set up custom domain raga.99platforms.com for RagaMitra frontend
# This script helps configure the custom domain mapping in Google Cloud Run

set -e

PROJECT_ID="raga-mitra"
DOMAIN="raga.99platforms.com"
SERVICE_NAME="ragamitra-frontend-dev"
REGION="asia-south1"

echo "🌐 Setting up custom domain: $DOMAIN"
echo "📋 Project: $PROJECT_ID"
echo "🚀 Service: $SERVICE_NAME"
echo "📍 Region: $REGION"
echo ""

# Set the active project
echo "🔧 Setting active project..."
gcloud config set project $PROJECT_ID

# Enable required APIs
echo "🔌 Enabling required APIs..."
gcloud services enable run.googleapis.com
gcloud services enable websecurityscanner.googleapis.com
gcloud services enable searchconsole.googleapis.com

echo ""
echo "📋 DOMAIN VERIFICATION STEPS:"
echo "=============================="
echo ""
echo "1. 🌐 Go to Google Search Console:"
echo "   https://search.google.com/search-console/welcome"
echo ""
echo "2. ➕ Add Property:"
echo "   - Enter: $DOMAIN"
echo "   - Choose: Domain (recommended)"
echo ""
echo "3. 🔐 Verify Domain Ownership:"
echo "   - Choose 'HTML file' or 'DNS record' method"
echo "   - Follow the verification instructions"
echo ""
echo "4. ⏱️  Wait for verification (may take a few minutes)"
echo ""
echo "5. 🔄 After verification, run this command:"
echo "   gcloud beta run domain-mappings create --service=$SERVICE_NAME --domain=$DOMAIN --region=$REGION"
echo ""
echo "6. 📝 Get DNS records:"
echo "   gcloud beta run domain-mappings describe --domain=$DOMAIN --region=$REGION"
echo ""
echo "7. 🌍 Add DNS records to your domain provider (99platforms.com):"
echo "   - Add the CNAME record provided by Google Cloud"
echo "   - Point raga.99platforms.com to the target URL"
echo ""
echo "8. ⏳ Wait for DNS propagation (5-30 minutes)"
echo ""
echo "9. ✅ Test the custom domain:"
echo "   https://$DOMAIN"
echo ""

echo "🔍 Current Cloud Run Service URL:"
gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(status.url)"

echo ""
echo "📚 For more details, visit:"
echo "https://cloud.google.com/run/docs/mapping-custom-domains"
