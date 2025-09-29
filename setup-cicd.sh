#!/bin/bash

# Raga-Mitra CI/CD Setup Script
# This script sets up Cloud Build triggers and Cloud Run services

set -e

PROJECT_ID="raga-mitra-prod"
REGION="asia-south1"
REPO_NAME="ragamitra-repo"

echo "🚀 Setting up CI/CD pipeline for Raga-Mitra..."

# Enable required APIs
echo "📡 Enabling required APIs..."
gcloud services enable artifactregistry.googleapis.com cloudbuild.googleapis.com run.googleapis.com

# Configure Docker authentication for Artifact Registry
echo "🔐 Configuring Docker authentication..."
gcloud auth configure-docker asia-south1-docker.pkg.dev

# Create Cloud Build triggers (these will need to be connected to your Git repository)
echo "⚙️  Creating Cloud Build triggers..."

# Backend trigger
gcloud builds triggers create github \
  --repo-name="ragamitra" \
  --repo-owner="YOUR_GITHUB_USERNAME" \
  --branch-pattern="main" \
  --build-config="cloudbuild-backend.yaml" \
  --name="ragamitra-backend-trigger" \
  --description="Build and deploy Raga-Mitra backend" \
  --substitutions="_SERVICE_NAME=ragamitra-backend" || echo "⚠️  Backend trigger creation failed - you'll need to connect GitHub repository first"

# Frontend trigger
gcloud builds triggers create github \
  --repo-name="ragamitra" \
  --repo-owner="YOUR_GITHUB_USERNAME" \
  --branch-pattern="main" \
  --build-config="cloudbuild-frontend.yaml" \
  --name="ragamitra-frontend-trigger" \
  --description="Build and deploy Raga-Mitra frontend" \
  --substitutions="_SERVICE_NAME=ragamitra-frontend" || echo "⚠️  Frontend trigger creation failed - you'll need to connect GitHub repository first"

echo "✅ CI/CD setup completed!"
echo ""
echo "📋 Next steps:"
echo "1. Connect your GitHub repository to Cloud Build:"
echo "   - Go to: https://console.cloud.google.com/cloud-build/triggers?project=$PROJECT_ID"
echo "   - Click 'Connect Repository'"
echo "   - Select your GitHub repository"
echo ""
echo "2. Update the trigger configurations with your actual GitHub username"
echo ""
echo "3. Test the deployment by pushing to your main branch"
echo ""
echo "🔗 Service URLs will be available after first deployment:"
echo "   Backend: https://ragamitra-backend-xxxxx-uc.a.run.app"
echo "   Frontend: https://ragamitra-frontend-xxxxx-uc.a.run.app"
