# Enhanced Receipt Scanning Integration Plan

## Requirements

1. ✅ Integrate receipt scanning into Add Past Visit form (not separate modal)
2. ✅ Show extracted structured data in form fields automatically
3. ✅ Searchable dropdowns for doctor/clinic/specialty with typed fallback
4. ✅ Fix backend to always return extracted data (even if visit creation fails)
5. ✅ Verify Gemini Document Intelligence API is working

## Implementation Plan

### Backend Changes
- ✅ Add `extractReceiptDataOnly` endpoint (extract without creating visit)
- ✅ Update `scanReceiptAndCreateVisit` to always return extracted data
- ✅ Verify Gemini API key is configured

### Frontend Changes
1. **AddPastVisitModal Enhancement**
   - Add receipt scan section at top of form
   - Auto-populate form fields from extracted data
   - Searchable dropdowns for doctor/clinic/specialty
   - Allow typed data if search returns no results

2. **SearchableDropdown Component**
   - Reusable component for doctor/clinic/specialty
   - Search as you type
   - Allow manual entry if no results

3. **Data Population Logic**
   - When receipt is scanned, populate all form fields
   - Allow user to edit extracted data
   - Show confidence indicator

## Next Steps

1. Update backend routes to include extract-only endpoint
2. Create enhanced AddPastVisitModal with integrated scanning
3. Create SearchableDropdown component
4. Test Gemini API extraction
5. Deploy changes

