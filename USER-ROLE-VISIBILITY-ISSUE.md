# User Role Visibility Issue - +919881255701

## 🔍 Investigation Results

### Database Query Results

**User Status**: ❌ **User not found in database**

**Query Executed:**
```sql
SELECT u.id, u.phone, u.name, pp.platform_name, pp.roles, pp.permissions 
FROM users u 
LEFT JOIN platform_privileges pp ON u.id = pp.user_id 
WHERE u.phone LIKE '%9881255701%';
```

**Result**: 0 rows found

---

## 📊 Current Database State

### Users in Database:
1. **+1234567890** (Test User)
   - Has NO aarogya-mitra platform privileges
   - Active: true

### Users with aarogya-mitra Privileges:
- **None found** (0 users with aarogya-mitra platform privileges)

---

## 🔍 Why Patient Role Might Not Be Visible

### Scenario 1: User Not Registered
- ❌ User `+919881255701` doesn't exist in `platforms_99` database
- ❌ No platform privileges exist for this user
- ✅ **Solution**: User needs to register via the app first

### Scenario 2: User Exists but Roles Not Set
- If user exists but platform privileges are missing
- ❌ No `platform_privileges` record for `aarogya-mitra`
- ✅ **Solution**: Create platform privilege with `patient` role

### Scenario 3: Navigation Logic Issue
- Even if user has `patient` role, navigation might not show it
- Check navigation visibility logic in `frontend/src/config/navigation.ts`

---

## ✅ Solution Steps

### Step 1: Register User (if not registered)
User needs to:
1. Go to login page
2. Click "Register" or "Sign Up"
3. Enter phone: `+919881255701` or `9881255701`
4. Complete OTP verification
5. Set PIN
6. Registration will automatically create:
   - User in `platforms_99.users` table
   - Platform privilege in `platforms_99.platform_privileges` with roles: `['guest', 'patient']`

### Step 2: Verify Roles After Registration

**Check database:**
```sql
SELECT u.phone, u.name, pp.roles, pp.permissions 
FROM users u 
JOIN platform_privileges pp ON u.id = pp.user_id 
WHERE u.phone = '+919881255701' 
  AND pp.platform_name = 'aarogya-mitra';
```

**Expected Result:**
- roles: `['guest', 'patient']` or `['patient']`
- permissions: `['view_own_data']` (minimum)

### Step 3: Fix Roles if Needed

If user exists but missing patient role:
```sql
-- Update existing privilege
UPDATE platform_privileges 
SET roles = array_append(roles, 'patient')
WHERE user_id = (SELECT id FROM users WHERE phone = '+919881255701')
  AND platform_name = 'aarogya-mitra'
  AND NOT 'patient' = ANY(roles);
```

Or use the script:
```bash
node check-user-roles.js
```

---

## 🔧 Automatic Fix Script

**Script Created**: `check-user-roles.js`

**What it does:**
1. ✅ Checks if user exists in database
2. ✅ Creates platform privilege if missing
3. ✅ Adds `patient` role if not present
4. ✅ Adds required patient permissions
5. ✅ Verifies final configuration

**Usage:**
```bash
node check-user-roles.js
```

---

## 📋 Patient Role Requirements

### Required Roles:
- `patient` (minimum)
- `guest` (optional, auto-added during registration)

### Required Permissions:
- `view_own_data` (minimum)
- `edit_own_profile` (recommended)
- `book_appointment` (recommended)
- `view_appointments` (recommended)
- `view_medical_records` (recommended)

---

## 🎯 Navigation Visibility Logic

### Patient Dashboard Visibility:
**File**: `frontend/src/config/navigation.ts`

**Patient Dashboard Item:**
```typescript
{
  id: 'patient-dashboard',
  label: 'My Appointments',
  icon: 'User',
  path: '/dashboard/patient',
  requiredRoles: ['patient', 'user', 'owner', 'clinic_admin', 'admin', 'doctor', 'reception', 'receptionist'],
  requiredPermissions: []
}
```

**Visibility Check:**
- ✅ User must have `patient` role in `privileges[].roles[]`
- ✅ Role check happens in `hasAccess()` function
- ✅ Navigation filters items based on user roles

---

## 🔍 Debug Steps

### 1. Check Browser Console
After login, check browser console for:
```
🔍 [NAVIGATION] User: +919881255701
🔍 [NAVIGATION] Base role: user
🔍 [NAVIGATION] Privilege roles: [...]
🔍 [NAVIGATION] All roles: [...]
```

### 2. Check localStorage
```javascript
// In browser console
const user = JSON.parse(localStorage.getItem('user'));
console.log('User:', user);
console.log('Privileges:', user.privileges);
console.log('Roles:', user.privileges?.find(p => p.platform === 'aarogya-mitra')?.roles);
```

### 3. Check Network Tab
- Login request response should include `privileges` array
- Verify `privileges[0].roles` contains `'patient'`

---

## 🚨 Common Issues

### Issue 1: User Registered but No Privileges
**Symptom**: User exists but no platform_privileges record
**Fix**: Run `check-user-roles.js` script

### Issue 2: Patient Role Exists but Not Visible
**Symptom**: Database has `patient` role but navigation doesn't show
**Fix**: 
1. Check navigation console logs
2. Verify `hasAccess()` function logic
3. Clear browser cache and re-login

### Issue 3: Wrong Phone Format
**Symptom**: User can't be found
**Check**: Phone might be stored as `+919881255701` or `919881255701` or `9881255701`
**Fix**: Query with LIKE `'%9881255701%'`

---

## 📝 Summary

**Current Status**: 
- ❌ User `+919881255701` does NOT exist in database
- ❌ No platform privileges configured
- ✅ User needs to register first

**Next Steps**:
1. User should register via frontend app
2. After registration, verify roles in database
3. If role still not visible, check navigation logic
4. Use `check-user-roles.js` script to fix any issues

**Expected After Registration**:
- User will have `patient` role
- Patient dashboard should be visible in navigation
- User can access `/dashboard/patient` route

---

**Last Updated**: 2025-12-06  
**Investigation Date**: 2025-12-06

