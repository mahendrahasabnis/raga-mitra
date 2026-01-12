# Resources Add Debugging

## Added Debugging Points

### Frontend (`frontend/src/pages/App/ResourcesPage.tsx`)
- Logs payload before sending
- Logs response from API
- Logs errors with detailed messages

### Frontend API (`frontend/src/services/api.ts`)
- Logs all resource API calls (list, listClients, add)
- Logs request payloads and responses
- Logs errors with response data

### Backend Controller (`backend/src/controllers-postgres/resourcesController.ts`)
- Logs function entry with user info
- Logs database connection steps
- Logs SQL queries and replacements
- Logs query results
- Logs all errors with stack traces
- Enhanced `ensurePatientResourcesTable` logging

## How to Debug

1. **Open browser console** (F12 or Cmd+Option+I)
2. **Add a resource** through the UI
3. **Check browser console** for:
   - `🟢 [FRONTEND]` logs - Frontend activity
   - `🟢 [API]` logs - API service calls
   - Any error messages

4. **Check backend logs** (Cloud Run logs or local console):
   - `🔵 [RESOURCES]` logs - Backend activity
   - `✅` - Success indicators
   - `❌` - Error indicators

5. **Query database directly** to verify:
   ```bash
   ./connect-db.sh "SELECT * FROM patient_resources ORDER BY created_at DESC LIMIT 5;"
   ```

## Common Issues to Check

1. **User ID mismatch**: Check if `req.user.id` matches what's expected
2. **Database connection**: Check if `appSequelize` connects to `aarogya_mitra`
3. **SQL errors**: Check for syntax errors or constraint violations
4. **UUID format**: Ensure UUIDs are properly formatted
5. **Silent failures**: Check if errors are being caught and ignored
