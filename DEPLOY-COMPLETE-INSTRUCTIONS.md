# Deployment and Sample Data Instructions

## ✅ Completed

1. ✅ Backend Cloud Build config updated with GEMINI_API_KEY
2. ✅ Frontend Cloud Build config fixed (using BUILD_ID)
3. ✅ Sample data script created for user +919881255701
4. 🔄 Backend deployment in progress (check status below)

## 📋 Deployment Steps

### 1. Monitor Backend Deployment

```bash
# Check build logs
tail -f /tmp/backend-deploy.log

# Or check Cloud Build console
# https://console.cloud.google.com/cloud-build/builds?project=raga-mitra
```

### 2. Deploy Frontend

Once backend deployment completes, deploy frontend:

```bash
cd frontend
gcloud builds submit --config=cloudbuild-integrated.yaml --project=raga-mitra
```

### 3. Verify Backend Deployment

```bash
# Get backend URL
gcloud run services describe aarogya-mitra-backend-integrated \
  --region=asia-south1 \
  --project=raga-mitra \
  --format="get(status.url)"

# Test health endpoint
curl https://aarogya-mitra-backend-integrated-bnbuvw3hkq-el.a.run.app/health
```

### 4. Database Tables Auto-Creation

The backend automatically creates tables when it starts using `sequelize.sync()`.

New tables that will be created:
- ✅ `past_visits`
- ✅ `unverified_doctors`
- ✅ `past_prescriptions`
- ✅ `receipts`
- ✅ `past_test_results`
- ✅ `pharmacies`
- ✅ `diagnostics_centers`
- ✅ `medicine_purchases`

**No manual migration needed** - tables are created automatically on backend startup.

### 5. Add Sample Data for User +919881255701

After backend is deployed and running:

```bash
cd backend

# Ensure .env.integrated has database credentials
# Then run:
npm run db:sample:past-visits
```

This will create:
- 2 past visits (3 months ago and 1 month ago)
- 2 prescriptions
- 3 receipts (1 consultation, 1 medicine, 1 test)
- 1 test result
- 2 unverified doctors
- 2 pharmacies
- 1 diagnostics center

## 🔍 Verify Sample Data

After running the script, verify data was added:

```bash
# Query past visits (requires authentication)
curl -X GET \
  "https://aarogya-mitra-backend-integrated-bnbuvw3hkq-el.a.run.app/api/past-visits?patient_id=<PATIENT_ID>" \
  -H "Authorization: Bearer <TOKEN>"
```

## 📊 API Endpoints Available

Once deployed, these endpoints will be available:

- `POST /api/past-visits` - Create past visit
- `GET /api/past-visits` - Get all past visits
- `GET /api/past-visits/:appointment_id` - Get visit details
- `POST /api/past-visits/:appointment_id/prescription` - Upload prescription
- `POST /api/past-visits/:appointment_id/receipt` - Upload receipt
- `POST /api/past-visits/:appointment_id/test-result` - Upload test result
- `GET /api/repositories/unverified-doctors` - Search doctors
- `GET /api/repositories/pharmacies` - Search pharmacies
- `GET /api/repositories/diagnostics-centers` - Search diagnostics centers
- `GET /api/medical-history` - Get complete medical history

## 🐛 Troubleshooting

### Backend Build Fails
- Check Cloud Build logs in GCP Console
- Verify Dockerfile.integrated exists in backend/
- Ensure all dependencies are in package.json

### Tables Not Created
- Check backend logs: `gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=aarogya-mitra-backend-integrated" --limit=50`
- Verify database connection in backend logs
- Check Cloud SQL connection is configured correctly

### Sample Data Script Fails
- Ensure user +919881255701 exists in platforms_99 database
- Verify database connection in .env.integrated
- Check user has patient role assigned

## 📝 Notes

- All deployments use Cloud Run with automatic scaling
- Database tables are created via Sequelize sync (no migrations needed)
- Gemini API key is configured for AI document extraction
- Sample data includes realistic medical records

