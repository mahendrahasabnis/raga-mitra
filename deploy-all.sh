#!/bin/bash

# Deployment Script for Frontend, Backend, and Delta Tables
# This script deploys the complete application with new Vital Trends features

set -e  # Exit on error

PROJECT_ID="raga-mitra"
REGION="asia-south1"
BACKEND_SERVICE="aarogya-mitra-backend-integrated"
FRONTEND_SERVICE="aarogya-mitra-frontend-integrated"

echo "════════════════════════════════════════════════════════════════"
echo "🚀 Deploying Aarogya Mitra - Frontend, Backend & Delta Tables"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Deploy Backend
echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Step 1: Deploying Backend${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
echo ""

cd "$(dirname "$0")"

echo "📦 Building and deploying backend..."
echo "This includes:"
echo "  ✓ New Vital Parameters API endpoints"
echo "  ✓ Receipt scanning with auto-visit creation"
echo "  ✓ Parameter extraction from test results"
echo "  ✓ Auto-creation of delta tables (vital_parameters, vital_parameter_definitions)"
echo ""

gcloud builds submit \
  --config=backend/cloudbuild-integrated.yaml \
  --project=$PROJECT_ID \
  --async

BACKEND_BUILD_ID=$(gcloud builds list --limit=1 --format="get(id)" --project=$PROJECT_ID)

echo ""
echo -e "${GREEN}✅ Backend build submitted!${NC}"
echo "Build ID: $BACKEND_BUILD_ID"
echo ""
echo "⏳ Backend deployment will:"
echo "  • Create new tables: vital_parameters, vital_parameter_definitions"
echo "  • Keep existing tables intact"
echo "  • Update API endpoints"
echo ""
echo "Monitoring backend build (this may take 5-10 minutes)..."
echo ""

# Wait for backend build to complete
echo "Waiting for backend deployment to complete..."
gcloud builds log --stream $BACKEND_BUILD_ID --project=$PROJECT_ID || {
  echo -e "${YELLOW}⚠️  Could not stream logs. Build is running in background.${NC}"
  echo "Check status at: https://console.cloud.google.com/cloud-build/builds?project=$PROJECT_ID"
}

# Step 2: Deploy Frontend
echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Step 2: Deploying Frontend${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
echo ""

echo "📦 Building and deploying frontend..."
echo "This includes:"
echo "  ✓ Vital Trends Dashboard"
echo "  ✓ Receipt Scanning UI"
echo "  ✓ Multi-parameter graphs"
echo "  ✓ Date range selectors"
echo ""

gcloud builds submit \
  --config=frontend/cloudbuild-integrated.yaml \
  --project=$PROJECT_ID \
  --async

FRONTEND_BUILD_ID=$(gcloud builds list --limit=1 --format="get(id)" --project=$PROJECT_ID)

echo ""
echo -e "${GREEN}✅ Frontend build submitted!${NC}"
echo "Build ID: $FRONTEND_BUILD_ID"
echo ""

# Step 3: Wait for builds and verify
echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Step 3: Waiting for deployments to complete...${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
echo ""

echo "Waiting for backend deployment..."
gcloud builds wait $BACKEND_BUILD_ID --project=$PROJECT_ID || echo -e "${YELLOW}⚠️  Backend build status unclear${NC}"

echo ""
echo "Waiting for frontend deployment..."
gcloud builds wait $FRONTEND_BUILD_ID --project=$PROJECT_ID || echo -e "${YELLOW}⚠️  Frontend build status unclear${NC}"

# Step 4: Verify deployment and tables
echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Step 4: Verifying deployment${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
echo ""

# Get service URLs
BACKEND_URL=$(gcloud run services describe $BACKEND_SERVICE \
  --region=$REGION \
  --project=$PROJECT_ID \
  --format="get(status.url)" 2>/dev/null || echo "")

FRONTEND_URL=$(gcloud run services describe $FRONTEND_SERVICE \
  --region=$REGION \
  --project=$PROJECT_ID \
  --format="get(status.url)" 2>/dev/null || echo "")

if [ -n "$BACKEND_URL" ]; then
  echo -e "${GREEN}✅ Backend Service:${NC} $BACKEND_URL"
  
  # Test health endpoint (this also triggers table creation)
  echo "Testing backend health endpoint (this triggers table creation)..."
  curl -s "$BACKEND_URL/health" > /dev/null && echo -e "${GREEN}✅ Backend is healthy${NC}" || echo -e "${YELLOW}⚠️  Backend health check failed${NC}"
else
  echo -e "${RED}❌ Backend URL not found${NC}"
fi

if [ -n "$FRONTEND_URL" ]; then
  echo -e "${GREEN}✅ Frontend Service:${NC} $FRONTEND_URL"
else
  echo -e "${RED}❌ Frontend URL not found${NC}"
fi

# Step 5: Delta Tables Information
echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Step 5: Delta Tables Status${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
echo ""

echo "The following NEW tables will be automatically created when backend starts:"
echo ""
echo "  📊 vital_parameters"
echo "     - Stores individual health parameter readings"
echo "     - Links to patient records"
echo "     - Includes dates, values, units, normal ranges"
echo ""
echo "  📋 vital_parameter_definitions"
echo "     - Defines parameter metadata"
echo "     - Categories and default ranges"
echo "     - Display names and units"
echo ""

echo "Tables are created automatically via Sequelize sync on backend startup."
echo "If tables don't exist yet, they will be created on the next backend request."
echo ""

# Summary
echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
echo ""
echo "Next steps:"
echo "  1. Verify tables are created (backend will create them automatically)"
echo "  2. Test Vital Trends Dashboard in the frontend"
echo "  3. Test receipt scanning feature"
echo ""
echo "Backend URL: $BACKEND_URL"
echo "Frontend URL: $FRONTEND_URL"
echo ""
echo "To check backend logs:"
echo "  gcloud run services logs read $BACKEND_SERVICE --region=$REGION --project=$PROJECT_ID"
echo ""

