#!/bin/bash
# Deploy backend, frontend and add sample data

set -e

PROJECT_ID="raga-mitra"
REGION="asia-south1"

echo "═══════════════════════════════════════════════════════════"
echo "🚀 Deploying Aarogya Mitra - Backend & Frontend"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Deploy Backend
echo "📦 Building and deploying backend..."
cd backend
gcloud builds submit --config=cloudbuild-integrated.yaml --project=$PROJECT_ID
echo "✅ Backend deployment complete"
echo ""

# Deploy Frontend
echo "📦 Building and deploying frontend..."
cd ../frontend
gcloud builds submit --config=cloudbuild-integrated.yaml --project=$PROJECT_ID
echo "✅ Frontend deployment complete"
echo ""

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Get backend URL
BACKEND_URL=$(gcloud run services describe aarogya-mitra-backend-integrated \
  --region=$REGION \
  --project=$PROJECT_ID \
  --format="value(status.url)")

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "✅ Deployment Complete!"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "📋 Service URLs:"
echo "   Backend:  $BACKEND_URL"
echo ""
echo "📝 To add sample data, run:"
echo "   cd backend"
echo "   npm run db:sample:past-visits"
echo ""
echo "═══════════════════════════════════════════════════════════"

