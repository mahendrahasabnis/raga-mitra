# Patient Medical History Feature - Implementation Plan

## 📋 Overview

Comprehensive feature for patients to add and manage their past medical visits, prescriptions, receipts, test results, and related documents with AI-powered document intelligence.

---

## 🗄️ Database Schema

### New Tables Created:

1. **`past_visits`** - Past doctor visits/consultations
   - Links all related documents via `appointment_id`
   - Can reference platform doctors or unverified doctors

2. **`unverified_doctors`** - Custom doctors added by patients
   - Shared across all patients (community repository)
   - Can be verified by admins later

3. **`past_prescriptions`** - Prescription records
   - Linked to past visits via `appointment_id`
   - Supports AI-extracted metadata

4. **`receipts`** - Receipt documents (consultation, medicine, test)
   - Type: consultation, medicine, test, other
   - Links to pharmacy (for medicine) or diagnostics center (for test)

5. **`past_test_results`** - Test result records
   - Linked to past visits via `appointment_id`
   - Supports AI-extracted test parameters

6. **`pharmacies`** - Pharmacy repository
   - Auto-populated from medicine receipts
   - Shared across all patients

7. **`diagnostics_centers`** - Diagnostics center repository
   - Auto-populated from test receipts
   - Shared across all patients

8. **`medicine_purchases`** - Medicine purchase records
   - Links prescriptions to purchases
   - Includes itemized medicine list

---

## 🔑 Key Features

### 1. **Past Visit Management**
- Add past doctor visits
- Choose from platform doctors OR create custom unverified doctor
- Link all documents via appointment_id

### 2. **Document Upload**
- Upload prescriptions (images/PDFs)
- Upload receipts (consultation, medicine, test)
- Upload test results/reports (images/PDFs)
- All documents linked via appointment_id

### 3. **AI Document Intelligence**
- **Gemini AI** integration for document parsing
- Extract metadata from:
  - Prescriptions → medications, dosage, diagnosis
  - Receipts → amounts, items, pharmacy/diagnostics center info
  - Test results → parameters, values, normal ranges
- Store extraction confidence scores and raw text

### 4. **Repository Management**
- **Unverified Doctors**: Community repository, shared across patients
- **Pharmacies**: Auto-extracted from medicine receipts, shared repository
- **Diagnostics Centers**: Auto-extracted from test receipts, shared repository

### 5. **Data Extraction & Storage**
- AI extracts and stores structured data
- Manual review/correction available
- Metadata preserved for audit

---

## 📊 Data Flow

```
Patient Uploads Document
    ↓
Gemini AI Extracts Data
    ↓
Store in Respective Tables:
  - PastPrescription (if prescription)
  - Receipt (if receipt)
  - PastTestResult (if test result)
  - MedicinePurchase (if medicine purchase)
    ↓
Extract Repository Data:
  - Pharmacy (from medicine receipt)
  - DiagnosticsCenter (from test receipt)
  - UnverifiedDoctor (if custom doctor)
    ↓
All Linked via appointment_id
```

---

## 🤖 Gemini AI Integration

### Document Types & Extraction:

1. **Prescription Documents**
   - Extract: Doctor name, medications, dosages, diagnosis, follow-up date
   - Store in: `past_prescriptions` table

2. **Consultation Receipts**
   - Extract: Doctor name, clinic, consultation fee, date
   - Store in: `receipts` table (type: consultation)

3. **Medicine Receipts**
   - Extract: Pharmacy info, medicines, quantities, prices
   - Store in: `receipts` table + `medicine_purchases` table
   - Create/update: `pharmacies` repository

4. **Test Receipts**
   - Extract: Diagnostics center info, test names, amounts
   - Store in: `receipts` table (type: test)
   - Create/update: `diagnostics_centers` repository

5. **Test Result Reports**
   - Extract: Test parameters, values, normal ranges
   - Store in: `past_test_results` table

---

## 🔌 API Endpoints Needed

### Past Visits
- `POST /api/past-visits` - Create past visit
- `GET /api/past-visits` - Get patient's past visits
- `GET /api/past-visits/:id` - Get visit details with all documents
- `PUT /api/past-visits/:id` - Update visit
- `DELETE /api/past-visits/:id` - Delete visit

### Documents
- `POST /api/past-visits/:appointmentId/prescription` - Upload prescription
- `POST /api/past-visits/:appointmentId/receipt` - Upload receipt
- `POST /api/past-visits/:appointmentId/test-result` - Upload test result
- `POST /api/documents/parse` - Parse document with AI

### Repositories
- `GET /api/unverified-doctors` - Search unverified doctors
- `POST /api/unverified-doctors` - Create unverified doctor
- `GET /api/pharmacies` - Search pharmacies
- `GET /api/diagnostics-centers` - Search diagnostics centers

### Medical History
- `GET /api/medical-history` - Get complete medical history
- `GET /api/medical-history/prescriptions` - Get all prescriptions
- `GET /api/medical-history/test-results` - Get all test results

---

## 🎨 Frontend Components Needed

1. **Add Past Visit Form**
   - Doctor selection (platform or custom)
   - Visit details (date, complaint, diagnosis)
   - Link documents

2. **Document Upload UI**
   - Drag & drop file upload
   - Document type selection
   - AI extraction progress indicator
   - Review/edit extracted data

3. **Medical History View**
   - Timeline view of visits
   - Filter by date, doctor, type
   - View all related documents

4. **Repository Selectors**
   - Doctor search/select
   - Pharmacy search/select
   - Diagnostics center search/select

---

## 🔧 Implementation Steps

### Phase 1: Database & Models ✅
- [x] Create all Sequelize models
- [x] Update models index
- [ ] Create database migrations

### Phase 2: Gemini AI Service
- [ ] Install Gemini AI SDK
- [ ] Create document parsing service
- [ ] Implement extraction for each document type
- [ ] Add error handling and fallbacks

### Phase 3: Backend API
- [ ] Past visits controller
- [ ] Document upload controller
- [ ] Repository controllers
- [ ] Medical history controller

### Phase 4: Routes & Middleware
- [ ] Create routes for all endpoints
- [ ] Add authentication middleware
- [ ] Add validation

### Phase 5: Frontend Components
- [ ] Past visit form
- [ ] Document upload component
- [ ] Medical history view
- [ ] Repository selectors

### Phase 6: Integration & Testing
- [ ] Test AI extraction accuracy
- [ ] Test document upload flow
- [ ] Test repository creation
- [ ] End-to-end testing

---

## 🔐 Security & Validation

- Patient can only access their own data
- File upload size limits
- File type validation (images, PDFs only)
- Sanitize AI-extracted data
- Rate limiting on AI API calls

---

## 📝 Next Steps

1. **Set up Gemini AI API Key** in environment variables
2. **Create Gemini AI service** for document parsing
3. **Implement backend controllers** for past visits and documents
4. **Create frontend components** for user interaction
5. **Test AI extraction** with sample documents
6. **Deploy and monitor** AI extraction accuracy

---

**Status**: ✅ Database models created  
**Next**: Gemini AI service implementation

