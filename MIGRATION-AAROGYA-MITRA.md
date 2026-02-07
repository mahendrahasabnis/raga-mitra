# Migrate Aarogya Mitra from raga-mitra to aarogya-mitra (GCP)

This guide moves the four aarogya-mitra Cloud Run services from project **raga-mitra** to **aarogya-mitra**: deploy there, test, then remove them from raga-mitra.

## Services (in raga-mitra today)

| Name | Type |
|------|------|
| aarogya-mitra-backend | Container |
| aarogya-mitra-backend-integrated | Container |
| aarogya-mitra-frontend | Source |
| aarogya-mitra-frontend-integrated | Container |

The scripts below deploy and manage the **integrated** pair (backend + frontend). The non-integrated `aarogya-mitra-backend` and `aarogya-mitra-frontend` are only removed from raga-mitra by `delete-from-raga-mitra.sh`; they are not redeployed to aarogya-mitra unless you add your own build/deploy for them.

---

## Fix: PERMISSION_DENIED on `gcloud builds submit`

If you see:

```text
ERROR: (gcloud.builds.submit) PERMISSION_DENIED: The caller does not have permission.
```

your account does not have the right roles on the **aarogya-mitra** project. Do one of the following.

**Option A – Someone with Owner/Admin on `aarogya-mitra` runs:**

```bash
# Replace admin@neoabhro.com with the account that runs deploy (your email)
export PROJECT_ID=aarogya-mitra
export USER_EMAIL=admin@neoabhro.com

# Allow creating and viewing Cloud Builds
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="user:${USER_EMAIL}" \
  --role="roles/cloudbuild.builds.editor"

# Allow deploying and updating Cloud Run (needed for deploy script)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="user:${USER_EMAIL}" \
  --role="roles/run.admin"

# Allow pushing images (Cloud Build uses default SA; this may be needed for your account too)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="user:${USER_EMAIL}" \
  --role="roles/storage.admin"
```

**Option B – Using Console**

1. Open [IAM & Admin → IAM](https://console.cloud.google.com/iam-admin/iam) and select project **aarogya-mitra**.
2. Find (or add) **admin@neoabhro.com**.
3. Add roles: **Cloud Build Editor**, **Cloud Run Admin**, **Storage Admin** (or **Storage Object Admin** for the build bucket only).
4. Save.

After roles are updated, wait a minute and run `./deploy-to-aarogya-mitra.sh` again.

---

## Fix: Build completes but deploy step fails (APIs not enabled)

If the build **succeeds** (image builds and pushes) but the **Cloud Run deploy** step fails with something like:

```text
The following APIs are not enabled on project [aarogya-mitra]: run.googleapis.com
...
Would you like to enable and retry (y/N)? ERROR: (gcloud.run.deploy) Aborted by user.
```

then required APIs are not enabled on **aarogya-mitra**. Cloud Build runs non-interactively, so the prompt defaults to "N".

**Fix:** Enable the APIs before running the deploy script (the script now does this for you):

```bash
export PROJECT_ID=aarogya-mitra
gcloud services enable run.googleapis.com --project=$PROJECT_ID
gcloud services enable cloudbuild.googleapis.com --project=$PROJECT_ID
gcloud services enable containerregistry.googleapis.com --project=$PROJECT_ID
gcloud services enable sqladmin.googleapis.com --project=$PROJECT_ID
```

Then run `./deploy-to-aarogya-mitra.sh` again.

---

## Prerequisites

1. **GCP project `aarogya-mitra`**
   - Create in Cloud Console if needed.
   - Enable: Cloud Build, Cloud Run, Container Registry (or Artifact Registry if you switch).

2. **Cloud SQL access (shared DB)**  
   The backend uses a shared Cloud SQL instance in project **platforms-476017**:
   - Instance: `platforms-476017:asia-south1:platforms-99-sandbox`
   - So the **default Cloud Run service account** in `aarogya-mitra` must be able to connect:
     - In **platforms-476017**, grant the aarogya-mitra Cloud Run service account (e.g. `PROJECT_NUMBER-compute@developer.gserviceaccount.com`) the **Cloud SQL Client** role on this instance, **or**
     - Use a dedicated service account for Cloud Run in aarogya-mitra and grant that account Cloud SQL Client in platforms-476017.

3. **gcloud**
   - `gcloud auth login`
   - `gcloud config set project aarogya-mitra` (optional; scripts pass `--project`)

4. **Secrets / env**
   - Backend env (DB, JWT, Gemini, etc.) is set in `backend/cloudbuild-integrated.yaml`. For aarogya-mitra you may want to move secrets to Secret Manager and reference them in Cloud Run instead of inline env (recommended for production).

---

## Steps

### 1. Deploy to aarogya-mitra

From the repo root:

```bash
./deploy-to-aarogya-mitra.sh
```

This will:

- Build and deploy **aarogya-mitra-backend-integrated** to project `aarogya-mitra`.
- Read the new backend URL, then build and deploy **aarogya-mitra-frontend-integrated** with that API URL.
- Update the backend’s `CORS_ORIGINS` to the new frontend URL.

Ensure the aarogya-mitra project has Cloud Build and Cloud Run enabled and that the Cloud Run service account can access the shared Cloud SQL instance (see above).

### 2. Test

```bash
./test-aarogya-mitra.sh
```

This hits backend `/health`, backend `/api`, and the frontend page. Then open the printed frontend URL in a browser and do a quick manual check (login, one main flow).

### 3. Delete from raga-mitra (after tests pass)

When you are satisfied with aarogya-mitra:

```bash
./delete-from-raga-mitra.sh
```

You must type `yes` when prompted. This deletes all four services from **raga-mitra**:

- aarogya-mitra-backend  
- aarogya-mitra-backend-integrated  
- aarogya-mitra-frontend  
- aarogya-mitra-frontend-integrated  

---

## Summary

| Step | Command |
|------|--------|
| Deploy to aarogya-mitra | `./deploy-to-aarogya-mitra.sh` |
| Test | `./test-aarogya-mitra.sh` |
| Delete from raga-mitra | `./delete-from-raga-mitra.sh` |

---

## Continuing to use raga-mitra for deploy

The existing `deploy-all.sh` still targets **raga-mitra**. The frontend Cloud Build was updated to use a substitution `_BACKEND_URL`; if you don’t pass it, the default (current raga-mitra backend URL) is used, so `deploy-all.sh` remains valid for raga-mitra until you remove those services.

After migration, you can change `deploy-all.sh` to use `PROJECT_ID="aarogya-mitra"` and pass the backend URL for the frontend build (or derive it from the same script) so that future deploys go only to aarogya-mitra.

---

## Fix: Login returns 500 (Internal Server Error)

The backend connects to Cloud SQL in project **platforms-476017** (instance `platforms-476017:asia-south1:platforms-99-sandbox`). If login returns 500, the usual cause is that the **Cloud Run service account of aarogya-mitra** cannot connect to that instance.

**1. Check backend logs for the real error**

```bash
gcloud run services logs read aarogya-mitra-backend-integrated \
  --region=asia-south1 --project=aarogya-mitra --limit=50
```

Look for `[LOGIN-EARLY]` lines (e.g. connection refused, authentication failed, ECONNREFUSED).

**2. Grant Cloud SQL Client to aarogya-mitra’s Cloud Run identity**

In project **platforms-476017** (where the DB lives), grant the aarogya-mitra Cloud Run service account access:

```bash
# Get aarogya-mitra project number
AAROGYA_PROJECT_NUM=$(gcloud projects describe aarogya-mitra --format="value(projectNumber)")
# Default Cloud Run SA (used when no custom SA is set)
CLOUD_RUN_SA="${AAROGYA_PROJECT_NUM}-compute@developer.gserviceaccount.com"

# In platforms-476017, grant that SA the Cloud SQL Client role
gcloud projects add-iam-policy-binding platforms-476017 \
  --member="serviceAccount:${CLOUD_RUN_SA}" \
  --role="roles/cloudsql.client"
```

**3. Redeploy the backend** after code or IAM changes:

```bash
gcloud builds submit --config=backend/cloudbuild-integrated.yaml --project=aarogya-mitra
```
