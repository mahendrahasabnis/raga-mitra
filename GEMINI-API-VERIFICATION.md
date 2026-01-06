# 🔍 Step-by-Step Gemini API Verification Guide

## Overview
This guide walks through verifying that the Google Gemini AI service is correctly configured for document information extraction.

## Prerequisites
1. Gemini API Key: `AIzaSyAXyFZy83Xe2i3pJjP2sK444xmQ4uwkjZg`
2. Package: `@google/generative-ai` v0.24.1 (✅ installed)
3. Model: `gemini-1.5-pro`

---

## Step 1: Verify API Key Configuration

### Backend Configuration
**File:** `backend/cloudbuild-integrated.yaml`
```yaml
GEMINI_API_KEY=AIzaSyAXyFZy83Xe2i3pJjP2sK444xmQ4uwkjZg
```

**Code:** `backend/src/services/geminiAIService.ts`
```typescript
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
```

✅ API Key is configured in Cloud Build
⚠️ **Check:** Ensure environment variable is being read correctly at runtime

---

## Step 2: Verify Package Installation

### Check package.json
```json
"@google/generative-ai": "^0.24.1"
```

✅ Package is listed in dependencies

### Verify Installation
```bash
cd backend
npm list @google/generative-ai
# OR
ls node_modules/@google/generative-ai
```

---

## Step 3: Verify API Connection

### Test Basic Connection
```javascript
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

const result = await model.generateContent('Say hello');
console.log(result.response.text());
```

---

## Step 4: Verify Document Parsing Function

### Function: `parseDocumentFromBase64()`
**Location:** `backend/src/services/geminiAIService.ts:139`

**Key Points:**
1. ✅ Checks if `GEMINI_API_KEY` exists
2. ✅ Creates model: `gemini-1.5-pro`
3. ✅ Uses `inlineData` format for base64
4. ✅ Handles JSON parsing with markdown stripping

**Potential Issues:**
- ❓ API key not being read from environment
- ❓ Base64 data format incorrect
- ❓ MIME type not matching file type
- ❓ Prompt structure not optimal

---

## Step 5: Verify Base64 Encoding

### Frontend: `ReceiptScanSection.tsx`
```typescript
reader.readAsDataURL(selectedFile);
const base64Data = result.split(',')[1]; // Removes data:image/jpeg;base64, prefix
```

**Check:**
- ✅ File is read as data URL
- ✅ Base64 prefix is removed
- ✅ Pure base64 string is sent

---

## Step 6: Verify Request Flow

### Frontend → Backend
1. User uploads file
2. File read as base64: `FileReader.readAsDataURL()`
3. Base64 extracted (removes prefix)
4. Sent to backend: `file_base64` field

### Backend → Gemini API
1. Receives `file_base64` from request
2. Calls `extractReceiptDataFromBase64()`
3. Uses `parseDocumentFromBase64()`
4. Sends to Gemini with:
   ```javascript
   {
     inlineData: {
       mimeType: 'image/jpeg', // or 'application/pdf'
       data: base64Data
     }
   }
   ```

---

## Step 7: Common Issues & Solutions

### Issue 1: "GEMINI_API_KEY not configured"
**Solution:**
- Check environment variable is set in Cloud Run
- Verify `.env` file has the key (for local dev)
- Check cloudbuild-integrated.yaml has the key

### Issue 2: "Confidence 0" or Empty Response
**Possible Causes:**
1. API key invalid or expired
2. Base64 data corrupted or incomplete
3. MIME type mismatch
4. File too large
5. API quota exceeded
6. Network issues

**Debug Steps:**
```javascript
// Check base64 length
console.log('Base64 length:', base64Data.length);

// Check MIME type
console.log('MIME type:', fileType);

// Check API response
console.log('Gemini response:', text);
```

### Issue 3: JSON Parsing Errors
**Solution:**
- Gemini sometimes returns markdown-wrapped JSON
- Code already handles this, but check logs for raw response

### Issue 4: Base64 Format Issues
**Check:**
- Base64 string should be pure (no prefix)
- Should be valid base64 characters only
- Length should match file size

---

## Step 8: Testing Steps

### Manual Test Script
Run: `node backend/test-gemini-api.js`

This will test:
1. ✅ API key configuration
2. ✅ Basic connection
3. ✅ Text parsing
4. ✅ Base64 image parsing

### End-to-End Test
1. Upload receipt image in frontend
2. Check browser console for errors
3. Check backend logs for Gemini API calls
4. Verify extracted data in response

---

## Step 9: Backend Logs to Check

### Expected Log Messages
```
🤖 [GEMINI AI] Starting document parsing with base64 data...
📄 [GEMINI AI] Raw response received: ...
✅ [GEMINI AI] Successfully parsed JSON response
```

### Error Logs to Watch For
```
❌ [GEMINI AI] Error parsing document: ...
❌ [GEMINI AI] Error downloading file: ...
⚠️ [GEMINI AI] Response is not valid JSON
```

---

## Step 10: Verify in Cloud Run

### Check Environment Variables
```bash
gcloud run services describe aarogya-mitra-backend-integrated \
  --region=asia-south1 \
  --project=raga-mitra \
  --format="get(spec.template.spec.containers[0].env)"
```

### Check Recent Logs
```bash
gcloud run services logs read aarogya-mitra-backend-integrated \
  --region=asia-south1 \
  --project=raga-mitra \
  --limit=50 \
  | grep -i "gemini\|receipt\|extract"
```

---

## Quick Verification Checklist

- [ ] API key is configured in Cloud Build
- [ ] API key is set in Cloud Run environment variables
- [ ] `@google/generative-ai` package is installed
- [ ] Base64 encoding is working (no prefix)
- [ ] MIME type matches file type
- [ ] Gemini API connection successful
- [ ] JSON parsing handles markdown wrapping
- [ ] Error logging is comprehensive
- [ ] Backend logs show API calls
- [ ] Response contains extracted data

---

## Next Steps

1. Run the verification script: `node backend/test-gemini-api.js`
2. Check Cloud Run logs for errors
3. Test with a real receipt image
4. Verify extracted data format
5. Check API quota/limits if issues persist

