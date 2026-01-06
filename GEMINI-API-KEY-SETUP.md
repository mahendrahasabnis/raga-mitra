# Gemini API Key Configuration

## ✅ Local Development Setup

The Gemini API key has been added to `.env.integrated`:

```env
GEMINI_API_KEY=AIzaSyAXyFZy83Xe2i3pJjP2sK444xmQ4uwkjZg
```

The backend will automatically load this from `.env.integrated` when running in development mode.

## 🚀 Cloud Run Deployment Setup

To add the Gemini API key to your Cloud Run service, run:

```bash
./add-gemini-to-cloud-run.sh
```

Or manually:

```bash
gcloud run services update aarogya-mitra-backend-integrated \
  --region=asia-south1 \
  --project=raga-mitra \
  --update-env-vars GEMINI_API_KEY=AIzaSyAXyFZy83Xe2i3pJjP2sK444xmQ4uwkjZg
```

## 🔍 Verification

To verify the API key is working, test the document extraction endpoint:

```bash
# Test prescription extraction (example)
curl -X POST http://localhost:3002/api/past-visits/APP-123/prescription \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "file_url": "https://example.com/prescription.jpg",
    "use_ai_extraction": true
  }'
```

## 📝 Notes

- The Gemini API key is used for document intelligence (prescription, receipt, test result extraction)
- Key is stored in `.env.integrated` for local development
- For production, add to Cloud Run environment variables
- The service will fail gracefully if the key is not set (returns empty extraction results)

