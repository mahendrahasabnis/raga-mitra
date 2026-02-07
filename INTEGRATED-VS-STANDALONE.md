# Integrated vs non-integrated (aarogya-mitra-backend / aarogya-mitra-frontend)

## Difference

| | **Integrated** (-integrated) | **Non-integrated** (no suffix) |
|---|-----------------------------|-------------------------------|
| **Backend** | `aarogya-mitra-backend-integrated` | `aarogya-mitra-backend` |
| **Frontend** | `aarogya-mitra-frontend-integrated` | `aarogya-mitra-frontend` |
| **Backend entry** | `index-integrated.ts` | In this repo: **same code** (no separate standalone entry) |
| **Database** | **Dual:** `platforms_99` (shared users/auth) + `aarogya_mitra` (app data) | Standalone would use **single** DB (aarogya_mitra only); this repo only has integrated DB config |
| **Auth** | 99platforms shared auth, `platform_privileges`, user proxy to platforms backend | Standalone would use local/auth-only; not implemented in this repo |
| **Cloud Build** | `backend/cloudbuild-integrated.yaml`, `frontend/cloudbuild-integrated.yaml` | No dedicated config in repo; added below for **same app, second service names** |

**Summary:** The codebase only has the **integrated** path (shared 99platforms auth + dual DB). The names `aarogya-mitra-backend` and `aarogya-mitra-frontend` (without `-integrated`) had no separate build in this repo; they were either from an older pipeline or a different codebase. To have all four services in the aarogya-mitra project, you can deploy the **same integrated app** again under the non-integrated service names (duplicate URLs, same behavior).

## Deploying the non-integrated service names (same app)

To create `aarogya-mitra-backend` and `aarogya-mitra-frontend` in aarogya-mitra **using the same integrated app** (same code, same DB, different Cloud Run service names):

1. **Backend** (same image as integrated, different service name):
   ```bash
   gcloud builds submit --config=backend/cloudbuild-standalone.yaml --project=aarogya-mitra
   ```
2. **Frontend** (same image, points to the new backend URL):
   ```bash
   BACKEND_URL=$(gcloud run services describe aarogya-mitra-backend --region=asia-south1 --project=aarogya-mitra --format="get(status.url)" | sed 's|/$||')
   gcloud builds submit --config=frontend/cloudbuild-standalone.yaml --project=aarogya-mitra --substitutions="_BACKEND_URL=$BACKEND_URL"
   ```
3. **Allow public access** (if needed):
   ```bash
   gcloud run services add-iam-policy-binding aarogya-mitra-backend --region=asia-south1 --project=aarogya-mitra --member="allUsers" --role="roles/run.invoker" --quiet
   gcloud run services add-iam-policy-binding aarogya-mitra-frontend --region=asia-south1 --project=aarogya-mitra --member="allUsers" --role="roles/run.invoker" --quiet
   ```

Or run the script: `./deploy-standalone-to-aarogya-mitra.sh`
