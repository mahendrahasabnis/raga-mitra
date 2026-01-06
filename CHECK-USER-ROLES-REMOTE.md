# Check User Roles - Remote Database Access

## 🔍 Issue
User `+919881255701` is getting authenticated but patient role is not visible in the frontend navigation.

## 📊 Database Investigation Results

### Local Database Check:
- ❌ User NOT found in local `platforms_99` database
- ✅ Backend is likely using a **remote/cloud database** (Cloud SQL or similar)

Since the user can authenticate, they exist in the **remote database** that the backend connects to.

---

## ✅ Solution: Check User Roles via Backend API

Since we can't directly access the remote database, we can check the user's roles by calling the backend API:

### Method 1: Check via Login Response

When user logs in, the response includes their roles. Check the browser Network tab:

1. Open browser DevTools (F12)
2. Go to Network tab
3. Login with `+919881255701`
4. Find the `/api/auth/login` request
5. Check the response JSON - it should include:
   ```json
   {
     "user": {
       "id": "...",
       "phone": "+919881255701",
       "privileges": [
         {
           "platform": "aarogya-mitra",
           "roles": [...],
           "permissions": [...]
         }
       ]
     }
   }
   ```

### Method 2: Check via Current User Endpoint

After login, call the current user endpoint:

```bash
# Get the token from localStorage or login response
TOKEN="your-jwt-token-here"

curl -X GET "https://aarogya-mitra-backend-integrated-bnbuvw3hkq-el.a.run.app/api/users/current" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

This will return the user's current roles and privileges.

### Method 3: Check Browser localStorage

1. Login as `+919881255701`
2. Open browser console (F12)
3. Run:
   ```javascript
   const user = JSON.parse(localStorage.getItem('user'));
   console.log('User:', user);
   console.log('Privileges:', user.privileges);
   const aarogyaPriv = user.privileges?.find(p => p.platform === 'aarogya-mitra');
   console.log('Aarogya Roles:', aarogyaPriv?.roles);
   console.log('Has Patient Role:', aarogyaPriv?.roles?.includes('patient'));
   ```

---

## 🔧 Fix Missing Patient Role

If the user doesn't have the `patient` role, we need to add it to the remote database. Options:

### Option 1: Update via Backend API (if endpoint exists)

Check if there's an admin endpoint to update user roles:
```bash
# Example (check if this endpoint exists)
curl -X PUT "https://backend-url/api/admin/users/{userId}/roles" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"roles": ["patient"]}'
```

### Option 2: Direct Database Access (if you have Cloud SQL access)

Connect to Cloud SQL and run:
```sql
-- Find user
SELECT id, phone, name FROM users WHERE phone = '+919881255701';

-- Check current privileges
SELECT * FROM platform_privileges 
WHERE user_id = '<user_id>' AND platform_name = 'aarogya-mitra';

-- Add patient role if missing
UPDATE platform_privileges 
SET roles = array_append(roles, 'patient')
WHERE user_id = '<user_id>' 
  AND platform_name = 'aarogya-mitra'
  AND NOT 'patient' = ANY(roles);

-- Or create privilege if doesn't exist
INSERT INTO platform_privileges 
  (id, user_id, platform_name, roles, permissions, is_active, created_at, updated_at)
VALUES 
  (gen_random_uuid(), '<user_id>', 'aarogya-mitra', 
   ARRAY['patient'], 
   ARRAY['view_own_data', 'edit_own_profile', 'book_appointment', 'view_appointments'],
   true, NOW(), NOW());
```

### Option 3: Re-register User

Have the user logout and re-register, which should automatically create the patient role.

---

## 🎯 Expected Configuration

After fixing, the user should have:

**Platform Privilege:**
- Platform: `aarogya-mitra`
- Roles: `['patient']` or `['guest', 'patient']`
- Permissions: `['view_own_data']` (minimum)
- Active: `true`

**Navigation Visibility:**
- ✅ "My Appointments" dashboard should be visible
- ✅ User can access `/dashboard/patient` route

---

## 📋 Debug Checklist

- [ ] Check browser console for navigation debug logs
- [ ] Verify user object in localStorage after login
- [ ] Check Network tab for login response
- [ ] Verify `privileges[].roles[]` contains `'patient'`
- [ ] Check if `platform_privileges.is_active = true`
- [ ] Verify navigation logic allows patient role access

---

## 🔍 Navigation Visibility Logic

The patient dashboard should be visible if:
1. User has `patient` role in `privileges[].roles[]`
2. Navigation item requires: `['patient', 'user', 'owner', ...]` roles
3. `hasAccess()` function returns `true` for patient role

Check `frontend/src/config/navigation.ts` line 277:
```typescript
requiredRoles: ['patient', 'user', 'owner', 'clinic_admin', 'admin', 'doctor', 'reception', 'receptionist']
```

Patient role should match this requirement.

---

**Next Steps:**
1. Check the backend API response when user logs in
2. Verify roles in the response
3. If patient role is missing, add it to the remote database
4. Re-login and verify navigation shows patient dashboard

