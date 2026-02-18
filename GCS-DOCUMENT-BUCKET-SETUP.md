# GCS document bucket setup (aarogya-mitra)

Scanned documents (prescriptions, receipts, test results) are stored in a Google Cloud Storage bucket in the **aarogya-mitra** project.

## 1. Create the bucket (one-time)

From the repo root, with `gcloud` CLI installed and logged in:

```bash
./create-gcs-document-bucket.sh
```

Or with a different project:

```bash
./create-gcs-document-bucket.sh --project=aarogya-mitra
```

This will:

- Create bucket `gs://aarogya-documents` in region `asia-south1`
- Grant the Cloud Run default service account **Storage Object Admin** on the bucket (so the deployed backend can read/write)

## 2. Local development

- **GCS_BUCKET** is already set to `aarogya-documents` in `.env` and `.env.integrated`.

- **Authentication** – signed URLs require a **service account** (user credentials from `gcloud auth application-default login` cannot sign URLs and will error with "Cannot sign data without client_email"). Use **Option B** for local uploads:

  - **Option B – Service account key (required for uploads)**  
    1. In [Cloud Console → IAM → Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts?project=aarogya-mitra), create a service account (e.g. `aarogya-mitra-gcs-dev`).  
    2. Grant it **Storage Object Admin** on the bucket `gs://aarogya-documents` (or **Storage Admin** on the project).  
    3. Create a JSON key (Keys → Add key → JSON), then set in `.env` or `.env.integrated`:
       ```bash
       GCP_SERVICE_ACCOUNT_JSON='{"type":"service_account","client_email":"...",...}'
       ```
       (Paste the full JSON; this codebase expects the JSON string.)

  - Without `GCP_SERVICE_ACCOUNT_JSON`, the backend returns 503 for signed-url and the app **saves appointment + extracted data without attaching the file** (you’ll see “Data saved. Document file could not be uploaded…”).

Restart the backend after setting `GCP_SERVICE_ACCOUNT_JSON`. Document upload from the app should then work locally.

## 3. Cloud Run (production)

- **GCS_BUCKET** is already added to `backend/cloudbuild-integrated.yaml` for the integrated backend.
- The script grants the default Cloud Run service account (`PROJECT_NUMBER-compute@developer.gserviceaccount.com`) **Storage Object Admin** on the bucket, so no extra IAM is needed for deploy.
- Redeploy the backend so the new env var is applied:
  ```bash
  gcloud builds submit --config=backend/cloudbuild-integrated.yaml --project=aarogya-mitra
  ```

## Bucket name

- Bucket: `aarogya-documents`
- Region: `asia-south1` (same as Cloud Run)
- Objects are stored under: `appointments/<appointment_id>/<category>/<timestamp>-<filename>`
  - `category` is e.g. `prescription`, `bill`, `test_result`.
