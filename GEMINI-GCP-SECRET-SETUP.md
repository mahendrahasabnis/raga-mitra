# Gemini API Key via GCP Secret Manager

Store `GEMINI_API_KEY` in GCP Secret Manager instead of `.env` or Cloud Build config. This avoids leaking keys in source control and uses GCP’s secret lifecycle management.

## Where the key is used

- **Backend**: `backend/src/services/geminiAIService.ts` reads `process.env.GEMINI_API_KEY`
- **Cloud Run**: Injected via `--set-secrets` in Cloud Build
- **Local dev**: From `.env.integrated` or `gcloud` (see below)

---

## 1. Create the secret in GCP

```bash
# Create a new Gemini API key at https://aistudio.google.com/app/apikey

# Create the secret (replace YOUR_NEW_GEMINI_API_KEY with the actual key)
echo -n "YOUR_NEW_GEMINI_API_KEY" | gcloud secrets create GEMINI_API_KEY \
  --data-file=- \
  --project=platforms-476017

# If the secret already exists, add a new version:
echo -n "YOUR_NEW_GEMINI_API_KEY" | gcloud secrets versions add GEMINI_API_KEY \
  --data-file=- \
  --project=platforms-476017
```

## 2. Grant Cloud Run access to the secret

The Cloud Run service account must be able to read the secret:

```bash
# Default Cloud Run SA
PROJECT_ID=platforms-476017
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
CLOUD_RUN_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:${CLOUD_RUN_SA}" \
  --role="roles/secretmanager.secretAccessor" \
  --project=$PROJECT_ID
```

## 3. Cloud Build / Cloud Run

`cloudbuild-integrated.yaml` and `cloudbuild-standalone.yaml` use `--set-secrets` instead of hardcoding the key in env vars. Cloud Run injects the secret as `GEMINI_API_KEY` at runtime.

No further Cloud Build changes are needed once the secret exists and the service account has access.

---

## 4. Local development

Choose one:

### Option A: `.env.integrated` (simplest)

Copy the example and add your key:

```bash
cp env.integrated.local.example .env.integrated
# Edit .env.integrated and set GEMINI_API_KEY=your-key
```

Do not commit `.env.integrated`; it should be in `.gitignore`.

### Option B: Fetch from Secret Manager

```bash
export GEMINI_API_KEY=$(gcloud secrets versions access latest --secret=GEMINI_API_KEY --project=platforms-476017)
npm run dev:local
```

Or add to your shell profile / a local script:

```bash
# In ~/.zshrc or a dev script
export GEMINI_API_KEY=$(gcloud secrets versions access latest --secret=GEMINI_API_KEY --project=platforms-476017)
```

---

## 5. Rotating the key

1. Create a new key at [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Add a new secret version:

   ```bash
   echo -n "NEW_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=- --project=platforms-476017
   ```

3. Redeploy Cloud Run or wait for the next deploy. Cloud Run uses `:latest` by default, so new instances pick up the new version automatically.

---

## Security notes

- Do not commit API keys to git. Old keys in `.env`, Cloud Build YAML, or docs should be revoked.
- Revoke leaked keys immediately in [Google AI Studio](https://aistudio.google.com/app/apikey).
