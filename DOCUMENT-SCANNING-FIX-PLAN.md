# Document Scanning Fix Plan

## Issues to Fix

1. ❌ Prescription upload requires `appointment_id` - users want to scan first
2. ❌ Test result upload requires `appointment_id` - users want to scan first  
3. ❌ Document uploads don't support base64 (only file_url)
4. ❌ Need extract-only endpoints for prescriptions and test results

## Solution

1. ✅ Add base64 extraction functions for prescription and test results
2. ✅ Create extract-only endpoints (similar to receipt extraction)
3. ✅ Update document upload controllers to accept base64
4. ✅ Ensure all use correct Gemini model (gemini-2.5-flash)

## Changes Needed

### Backend Services (geminiAIService.ts)
- [x] Add `extractPrescriptionDataFromBase64()` - DONE
- [ ] Add `extractTestResultDataFromBase64()`
- [x] Update all to use gemini-2.5-flash - DONE

### Backend Controllers
- [ ] Create `extractPrescriptionDataOnly()` controller
- [ ] Create `extractTestResultDataOnly()` controller  
- [ ] Update `uploadPrescription()` to accept base64
- [ ] Update `uploadTestResult()` to accept base64

### Backend Routes
- [ ] Add `/past-visits/extract-prescription` route
- [ ] Add `/past-visits/extract-test-result` route

