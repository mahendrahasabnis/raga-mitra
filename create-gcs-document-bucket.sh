#!/usr/bin/env bash
# Create a Google Cloud Storage bucket in the aarogya-mitra project for document uploads
# (scanned prescriptions, receipts, test results). Run once per project.
#
# Prerequisites:
#   - gcloud CLI installed and authenticated
#   - Permissions: storage.buckets.create, storage.buckets.getIamPolicy, storage.buckets.setIamPolicy
#
# Usage:
#   ./create-gcs-document-bucket.sh
#   # Or with explicit project:
#   ./create-gcs-document-bucket.sh --project=aarogya-mitra

set -e
PROJECT_ID="aarogya-mitra"
for arg in "$@"; do
  if [[ "$arg" == --project=* ]]; then
    PROJECT_ID="${arg#--project=}"
    break
  fi
done
BUCKET_NAME="aarogya-documents"
REGION="asia-south1"

echo "Project: $PROJECT_ID"
echo "Bucket:  $BUCKET_NAME"
echo "Region:  $REGION"
echo ""

# Create bucket (idempotent: ignore error if already exists)
if gcloud storage buckets describe "gs://${BUCKET_NAME}" --project="$PROJECT_ID" &>/dev/null; then
  echo "Bucket gs://${BUCKET_NAME} already exists."
else
  echo "Creating bucket gs://${BUCKET_NAME}..."
  gcloud storage buckets create "gs://${BUCKET_NAME}" \
    --project="$PROJECT_ID" \
    --location="$REGION" \
    --uniform-bucket-level-access
  echo "Bucket created."
fi

# Grant Cloud Run's default service account access to the bucket
# (Cloud Run uses PROJECT_NUMBER-compute@developer.gserviceaccount.com by default)
PROJECT_NUM=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
SA_EMAIL="${PROJECT_NUM}-compute@developer.gserviceaccount.com"
echo ""
echo "Granting Cloud Run service account ($SA_EMAIL) Storage Object Admin on bucket..."
gcloud storage buckets add-iam-policy-binding "gs://${BUCKET_NAME}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/storage.objectAdmin" \
  --project="$PROJECT_ID"
echo "Done."

echo ""
echo "Next steps:"
echo "1. Local dev: GCS_BUCKET=${BUCKET_NAME} is already in .env / .env.integrated."
echo "   To authenticate: run  gcloud auth application-default login  (use a Google account that has"
echo "   Storage Admin or Object Admin on this project), or create a service account key, grant it"
echo "   roles/storage.objectAdmin on the bucket, and set GCP_SERVICE_ACCOUNT_JSON to its JSON."
echo "2. Cloud Run: GCS_BUCKET is already in cloudbuild-integrated.yaml. Redeploy the backend so"
echo "   the new env is picked up. The default Cloud Run identity has objectAdmin on this bucket."
echo ""
