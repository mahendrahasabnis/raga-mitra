# Test Role Buttons on Login Page

## Overview

Test role buttons have been added to the login page to facilitate quick testing of different user roles without needing actual user accounts or API calls. These buttons only appear when a specific test phone number is entered.

---

## 🎯 Features

### Test Phone Number
- **Phone**: `9999999999`
- **Visibility**: Test buttons appear **only** when this phone number is entered in the login field
- **Mode**: Login mode only (not visible in Register or Reset PIN steps)
- **Note**: Users with phone number `9881255701` can now login normally without seeing test buttons

### Available Test Roles

When phone number `9881255701` is entered, **6 test role buttons** appear:

1. **Owner** (Purple button)
   - Full system access
   - HCP management capabilities
   - All dashboards and permissions

2. **Clinic Admin** (Blue button)
   - Full HCP management
   - Clinic, practice, and doctor management
   - Analytics access

3. **Doctor** (Green button)
   - Doctor dashboard access
   - Patient records access
   - Appointment management
   - Prescription management

4. **Receptionist** (Orange button)
   - Reception dashboard
   - Appointment management
   - Patient registration and search

5. **Billing** (Indigo button)
   - Billing dashboard
   - Invoice and payment management
   - Billing reports

6. **Patient** (Teal button)
   - Patient dashboard
   - Appointment booking
   - Medical records viewing
   - Prescription viewing

---

## 🚀 How to Use

### Step 1: Navigate to Login Page
- Go to: `https://aarogya-mitra-frontend-integrated-bnbuvw3hkq-el.a.run.app/login`

### Step 2: Enter Test Phone Number
- In the **Phone Number** field, enter: `9999999999`
- Make sure you're on the **Login** tab (not Register or Reset PIN)
- **Note**: Users with phone `9881255701` can login normally without seeing test buttons

### Step 3: Test Buttons Appear
- A yellow info box appears: "🧪 Test Mode - Quick Role Login"
- **6 role buttons** appear below the info box in a 2x3 grid

### Step 4: Click Any Role Button
- Click any role button to instantly login as that role
- You'll be redirected to the appropriate dashboard:
  - **Owner/Clinic Admin** → HCP Management (or HCP Setup if no HCP)
  - **Doctor** → Doctor Dashboard
  - **Receptionist** → Reception Dashboard
  - **Billing** → Billing Dashboard
  - **Patient** → Patient Dashboard

### Step 5: Test Navigation & Features
- Navigate through the application with that role's permissions
- Test role-specific features and dashboards
- Switch roles by logging out and using a different test button

---

## 📋 Test User Details

### Mock User Structure
Each test user has:
- **ID**: `test-user-{role}`
- **Phone**: `+91 9881255701` (or selected country code + 9881255701)
- **Name**: `Test {Role}` (e.g., "Test Owner", "Test Doctor")
- **Token**: `test-token-{role}-{timestamp}`
- **Platform**: `aarogya-mitra`
- **Roles & Permissions**: Configured based on role type

### Role-Specific Permissions

#### Owner
- All clinic admin permissions
- System management
- User management
- Billing reports

#### Clinic Admin
- HCP management
- Clinic management
- Practice management
- Doctor management
- Receptionist management
- Analytics access

#### Doctor
- View appointments
- View/update patient records
- Manage own schedule
- Write prescriptions
- View medical reports

#### Receptionist
- Manage appointments
- View patient list
- Register patients
- Search patients
- View clinic information

#### Billing
- View invoices
- Process payments
- Generate billing reports
- View appointments

#### Patient
- Book appointments
- View own appointments
- View medical records
- View prescriptions
- Cancel appointments

---

## 🎨 UI Design

### Visual Indicators
- **Info Box**: Yellow background with border (appears above buttons)
- **Button Colors**:
  - Owner: Purple (`bg-purple-600`)
  - Clinic Admin: Blue (`bg-blue-600`)
  - Doctor: Green (`bg-green-600`)
  - Receptionist: Orange (`bg-orange-600`)
  - Billing: Indigo (`bg-indigo-600`)
  - Patient: Teal (`bg-teal-600`)

### Layout
- **Grid**: 2 columns × 3 rows
- **Spacing**: Consistent gaps between buttons
- **Icons**: Each button has a role-specific icon
- **Responsive**: Works on mobile and desktop

---

## 🔒 Security Notes

⚠️ **Important**: These test buttons are for **development and testing only**!

1. **Conditional Display**: Buttons only appear for the specific test phone number
2. **No API Calls**: Test login doesn't make actual API calls
3. **Mock Tokens**: Uses test tokens (not real authentication)
4. **Test Mode Protection**: API interceptor skips logout on 401 errors in test mode
5. **Limited Scope**: Should be removed or disabled in production

## 🔧 How Test Mode Works

### Test Token Detection
- Test tokens start with `test-token-`
- Test mode flag stored in `localStorage` as `test-mode: 'true'`
- API interceptor detects test mode and prevents auto-logout on 401 errors

### Dashboard Behavior
- Dashboards load normally but API calls will fail (expected)
- Errors are caught gracefully and don't trigger logout
- You can navigate and test UI features without real data
- Navigation and role-based features work correctly

### Fix Applied
- **Issue**: Dashboard opened and immediately closed due to 401 errors from API calls
- **Solution**: API interceptor now checks for test tokens/mode and skips logout
- **Result**: Test users can stay logged in and test all UI features

### Recommendation
- Add environment variable check to disable in production
- Consider adding additional restrictions (IP whitelist, etc.)
- Document that this is a testing feature only

---

## 📝 Code Location

**File**: `frontend/src/pages/LoginPage.tsx`

**Key Functions**:
- `handleTestLogin(role: string)` - Creates mock user and logs in
- `showTestButtons` - Conditional check for phone number

**Key Features**:
- Phone number validation: `phone === '9999999999'`
- Role-based user object creation
- Automatic dashboard redirection based on role
- Normal users with `9881255701` can login without test mode

---

## ✅ Testing Checklist

- [x] Test buttons appear when phone `9881255701` is entered
- [x] Test buttons hidden for other phone numbers
- [x] Each role button logs in successfully
- [x] Correct dashboard loads for each role
- [x] Navigation links are correct for each role
- [x] Permissions work correctly for each role
- [x] Can switch between roles by logging out
- [x] UI is responsive and looks good

---

## 🚀 Deployment Status

✅ **Build**: Successful  
✅ **Deployment**: Successful  
✅ **Service**: Active  
✅ **URL**: https://aarogya-mitra-frontend-integrated-bnbuvw3hkq-el.a.run.app/login

---

## 🎯 Usage Example

```
1. Navigate to login page
2. Enter phone: 9999999999
3. See test buttons appear
4. Click "Owner" button
5. Redirected to HCP Management (with owner permissions)
6. Test owner features
7. Logout
8. Enter phone: 9999999999 again
9. Click "Doctor" button
10. Redirected to Doctor Dashboard
11. Test doctor features
12. Logout
13. Enter phone: 9881255701 (normal user)
14. Login normally with PIN (no test buttons appear)
```

---

**Last Updated**: 2025-12-06  
**Status**: ✅ Deployed and Active  
**Fix Applied**: ✅ Test mode logout issue fixed - dashboards now stay open

