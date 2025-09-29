# Raga-Mitra CI/CD Setup Guide

This guide will help you set up a complete CI/CD pipeline for the Raga-Mitra application using Google Cloud Build, Artifact Registry, and Cloud Run.

## 🏗️ Architecture Overview

```
GitHub Repository
       ↓
Cloud Build Triggers (Frontend + Backend)
       ↓
Artifact Registry (Docker Images)
       ↓
Cloud Run Services (Frontend + Backend)
```

## 📋 Prerequisites

- Google Cloud Project with billing enabled
- gcloud CLI installed and authenticated
- Docker installed locally
- GitHub repository with your code

## 🚀 Setup Steps

### 1. Enable Required APIs

```bash
gcloud services enable \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  sourcerepo.googleapis.com
```

### 2. Configure Docker Authentication

```bash
gcloud auth configure-docker asia-south1-docker.pkg.dev
```

### 3. Connect GitHub Repository to Cloud Build

1. Go to [Cloud Build Triggers](https://console.cloud.google.com/cloud-build/triggers)
2. Click "Connect Repository"
3. Select "GitHub (Cloud Build GitHub App)"
4. Authenticate and select your repository
5. Choose "ragamitra" as the repository name

### 4. Create Cloud Build Triggers

#### Backend Trigger
```bash
gcloud builds triggers create github \
  --repo-name="ragamitra" \
  --repo-owner="YOUR_GITHUB_USERNAME" \
  --branch-pattern="main" \
  --build-config="cloudbuild-backend.yaml" \
  --name="ragamitra-backend-trigger" \
  --description="Build and deploy Raga-Mitra backend"
```

#### Frontend Trigger
```bash
gcloud builds triggers create github \
  --repo-name="ragamitra" \
  --repo-owner="YOUR_GITHUB_USERNAME" \
  --branch-pattern="main" \
  --build-config="cloudbuild-frontend.yaml" \
  --name="ragamitra-frontend-trigger" \
  --description="Build and deploy Raga-Mitra frontend"
```

### 5. Manual Deployment (Alternative)

If you prefer to deploy manually:

```bash
chmod +x deploy-manual.sh
./deploy-manual.sh
```

## 🔧 Configuration Files

### Cloud Build Configurations

- `cloudbuild-backend.yaml` - Backend build and deployment
- `cloudbuild-frontend.yaml` - Frontend build and deployment

### Docker Configurations

- `backend/Dockerfile` - Backend container configuration
- `frontend/Dockerfile` - Frontend container configuration
- `frontend/nginx.conf` - Nginx configuration for frontend

### Service Account

- **Name**: `ragamitra-run-sa`
- **Permissions**: 
  - `roles/cloudsql.client` (for database access)
  - Minimal permissions for Cloud Run execution

## 🌐 Service URLs

After deployment, your services will be available at:

- **Backend**: `https://ragamitra-backend-xxxxx-uc.a.run.app`
- **Frontend**: `https://ragamitra-frontend-xxxxx-uc.a.run.app`

## 📊 Monitoring and Management

### Check Deployment Status
```bash
gcloud run services list --region=asia-south1
```

### View Build History
```bash
gcloud builds list --limit=10
```

### View Service Logs
```bash
gcloud run services logs read ragamitra-backend --region=asia-south1
gcloud run services logs read ragamitra-frontend --region=asia-south1
```

## 🔒 Security Features

- **Service Account**: Minimal permissions principle
- **Security Headers**: Implemented in nginx configuration
- **Health Checks**: Built-in health monitoring
- **Resource Limits**: CPU and memory constraints

## 🚨 Troubleshooting

### Common Issues

1. **Permission Denied**: Ensure your account has the necessary IAM roles
2. **Build Failures**: Check the Cloud Build logs for detailed error messages
3. **Service Unavailable**: Verify that all required APIs are enabled

### Useful Commands

```bash
# Check project configuration
gcloud config list

# View IAM permissions
gcloud projects get-iam-policy raga-mitra-prod

# Test Docker builds locally
docker build -t test-backend ./backend
docker build -t test-frontend ./frontend
```

## 📈 Scaling Configuration

### Backend Service
- **Memory**: 1Gi
- **CPU**: 1 vCPU
- **Min Instances**: 0 (cold start)
- **Max Instances**: 10

### Frontend Service
- **Memory**: 512Mi
- **CPU**: 1 vCPU
- **Min Instances**: 0 (cold start)
- **Max Instances**: 10

## 🔄 Continuous Deployment

The pipeline automatically triggers on:
- Push to `main` branch
- Pull request merges (optional)

Each deployment creates:
- New Docker images with commit SHA tags
- Updated Cloud Run services
- Rollback capability through previous image versions

## 📝 Next Steps

1. Set up monitoring and alerting
2. Configure custom domains
3. Implement staging environments
4. Set up automated testing in the pipeline
5. Configure backup and disaster recovery

## 🆘 Support

For issues or questions:
1. Check the [Google Cloud Build documentation](https://cloud.google.com/build/docs)
2. Review the [Cloud Run documentation](https://cloud.google.com/run/docs)
3. Check build logs in the Cloud Console
