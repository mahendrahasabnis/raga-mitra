#!/bin/bash

# Manual deployment script for Raga-Mitra
# Use this to deploy manually while setting up CI/CD

set -e

PROJECT_ID="raga-mitra-prod"
REGION="asia-south1"
REPO_NAME="ragamitra-repo"
SERVICE_ACCOUNT="ragamitra-run-sa@$PROJECT_ID.iam.gserviceaccount.com"

echo "🚀 Manual deployment of Raga-Mitra services..."

# Build and push backend
echo "📦 Building and pushing backend..."
cd backend
gcloud builds submit --config=../cloudbuild-backend.yaml .
cd ..

# Build and push frontend
echo "📦 Building and pushing frontend..."
cd frontend
gcloud builds submit --config=../cloudbuild-frontend.yaml .
cd ..

echo "✅ Manual deployment completed!"
echo ""
echo "🔗 Your services are now deployed:"
echo "   Backend: https://ragamitra-backend-xxxxx-uc.a.run.app"
echo "   Frontend: https://ragamitra-frontend-xxxxx-uc.a.run.app"
echo ""
echo "📊 To check deployment status:"
echo "   gcloud run services list --region=$REGION"
