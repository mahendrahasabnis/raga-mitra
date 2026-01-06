# Aarogya-Mitra Web App - Complete Functionality & Roles Guide

## 📋 Table of Contents
1. [Overview](#overview)
2. [All Roles in the System](#all-roles-in-the-system)
3. [Complete Feature List](#complete-feature-list)
4. [Role-Based Privileges & Functions](#role-based-privileges--functions)
5. [Organizational Hierarchy](#organizational-hierarchy)

---

## 🎯 Overview

**Aarogya-Mitra** is a comprehensive healthcare management platform that provides role-based access to various healthcare management functions. The system supports a hierarchical organizational structure: **Healthcare Providers (HCP) → Clinics → Practices → Doctors/Receptionists**, with multi-tenant architecture and cross-platform authentication.

---

## 👥 All Roles in the System

The system supports the following roles (defined in priority order for auto-routing):

1. **owner** - Platform owner with full access
2. **super-admin** - System super administrator
3. **admin** - Platform-level administrator
4. **clinic_admin** - Clinic administrator with full HCP management
5. **doctor** - Healthcare provider/physician
6. **reception** / **receptionist** - Front desk/reception staff
7. **billing** / **billing-staff** - Billing department staff
8. **nurse** - Nursing staff
9. **lab-technician** - Laboratory technician
10. **patient** - Patient/end user (default role)
11. **user** - General user role
12. **guest** - Guest access

---

## 🎨 Complete Feature List

### 1. **Authentication & User Management**
- ✅ Phone number + PIN login
- ✅ User registration with OTP verification
- ✅ PIN reset via SMS OTP (Firebase)
- ✅ Multi-platform authentication (shared with Raga-Mitra)
- ✅ Role-based automatic dashboard routing
- ✅ JWT token-based authentication
- ✅ Session management with 7-day token expiry
- ✅ Account lockout after failed attempts

### 2. **Healthcare Provider (HCP) Management**
- ✅ Create and manage HCP organizations
- ✅ Tree view visualization of organizational structure
- ✅ Edit HCP details (name, address, contact, licenses)
- ✅ View all HCPs in the system
- ✅ HCP hierarchy management

### 3. **Clinic Management**
- ✅ Create and manage clinics under HCPs
- ✅ Define clinic locations and addresses
- ✅ Multi-slot operating hours (up to 3 slots per day)
- ✅ Operating hours with notes per day
- ✅ Edit/delete clinic information
- ✅ View clinic statistics and analytics

### 4. **Practice Management**
- ✅ Create medical practices within clinics
- ✅ Define practice specializations
- ✅ Link practices to clinics
- ✅ Manage practice-specific settings
- ✅ Tree view of practices

### 5. **Doctor Management**
- ✅ Onboard new doctors
- ✅ Create doctor profiles with specializations
- ✅ Assign doctors to clinics and practices
- ✅ Manage doctor schedules (multi-slot availability)
- ✅ Set consultation fees and slot configurations
- ✅ View doctor availability and utilization
- ✅ Search and filter doctors by specialty
- ✅ Edit/delete doctor profiles
- ✅ Manage doctor schedules and time slots

### 6. **Receptionist Management**
- ✅ Add receptionists to the system
- ✅ Assign receptionists to clinics (main reception) or practices
- ✅ Flexible assignment (clinic-wide or practice-specific)
- ✅ Manage receptionist schedules (multi-slot shifts)
- ✅ Control front-desk access and permissions
- ✅ Edit/delete receptionist assignments

### 7. **Patient Management**
- ✅ Patient registration (auto-create user account with 4-digit PIN)
- ✅ Patient search by phone number
- ✅ Auto-populate phone from logged-in user
- ✅ Family member management
- ✅ Patient profile management
- ✅ Patient list view with filtering
- ✅ Role-based patient access (staff: all patients, patients: family only)
- ✅ Patient medical history tracking

### 8. **Appointment Management**
- ✅ **Smart Search**: Search across HCPs, clinics, doctors, and specialties
- ✅ **Appointment Booking**: Book appointments with patient selection
- ✅ **6-Stage Workflow Tracking**:
  1. REQUESTED (patient books)
  2. CONFIRMED (auto for staff, manual for patients)
  3. CHECKED_IN (patient arrives)
  4. CONSULTING (in consultation room)
  5. PAYMENT_PENDING (consultation done, payment due)
  6. COMPLETED (payment done)
- ✅ **Auto-Status**: Staff bookings auto-confirm, patient bookings require confirmation
- ✅ **QR Code Generation**: Automatic QR codes for patient check-in
- ✅ **Auto-Generated IDs**: Appointment IDs in format APT-2025-001234
- ✅ **Workflow Indicator**: Shows as "2/6" format (current stage/total)
- ✅ **Slot Management**: Real-time availability checking
- ✅ **Weekly Calendar View**: Days as columns, sessions as rows
- ✅ **10-Minute Slot Generation**: Automatic slot generation from schedules
- ✅ **Cancel Appointments**: With cancellation reason tracking
- ✅ **Delete Appointments**: Soft delete (staff only)
- ✅ **Appointment Details**: Full appointment information with medical history
- ✅ **Appointment History**: View past and upcoming appointments
- ✅ **Status Updates**: Manual status progression
- ✅ **Role-Based Filtering**: Patients see all, staff see their HCP only

### 9. **Prescription Management**
- ✅ Create prescriptions (doctor only)
- ✅ Auto-generated prescription IDs (RX-2025-001234)
- ✅ Medication items with dosage, frequency, duration
- ✅ Lab test recommendations
- ✅ Follow-up scheduling
- ✅ Update prescriptions
- ✅ View patient prescriptions
- ✅ Prescription history tracking

### 10. **Medical Reports Management**
- ✅ Upload medical reports (doctor/patient)
- ✅ Auto-generated report IDs (RPT-2025-001234)
- ✅ Support for multiple file types (PDF, images)
- ✅ Report categorization (Lab Test, X-Ray, MRI, CT Scan, etc.)
- ✅ View patient reports
- ✅ Link reports to appointments
- ✅ Report summary and notes
- ✅ File upload tracking

### 11. **Test Results & Analytics**
- ✅ Add/update test results
- ✅ Parameter tracking with graphing capability
- ✅ Test history for graphing
- ✅ View test results over time
- ✅ Medical parameter visualization

### 12. **Billing & Payments** (Infrastructure Ready)
- ✅ Billing dashboard (UI ready)
- ✅ Encrypted billing data support (AES-256-GCM)
- ✅ Invoice management (placeholder)
- ✅ Payment tracking (placeholder)
- ✅ Billing reports (placeholder)

### 13. **Dashboards**

#### **Doctor Dashboard** (`/dashboard/doctor`)
- ✅ 3-column layout
- ✅ Appointments grouped by Clinic → Practice
- ✅ Expandable tree structure
- ✅ Status badges (color-coded)
- ✅ Action buttons per appointment (View, Cancel, Delete)
- ✅ Current appointment details
- ✅ Patient information display
- ✅ Workflow status tracker
- ✅ Past appointments list
- ✅ Prescriptions section
- ✅ Test results with graphs

#### **Receptionist Dashboard** (`/dashboard/reception`)
- ✅ Appointment scheduling interface
- ✅ Patient registration
- ✅ Daily statistics (confirmed, pending, new patients)
- ✅ Search and filter capabilities
- ✅ Quick actions (new patient, book appointment)
- ✅ Appointment management tools
- ✅ Patient lookup

#### **Patient Dashboard** (`/dashboard/patient`)
- ✅ Personal medical history
- ✅ Upcoming appointments
- ✅ Past appointments
- ✅ Prescription tracking
- ✅ Health records access
- ✅ Appointment booking
- ✅ QR code display for check-in
- ✅ Medical report downloads

#### **Billing Dashboard** (`/dashboard/billing`)
- ✅ Billing overview (UI ready)
- ✅ Payment tracking interface
- ✅ Invoice management interface

### 14. **Navigation & UI**
- ✅ Role-based navigation menu
- ✅ Hierarchical navigation structure
- ✅ Responsive design (mobile-first)
- ✅ Healthcare-themed color scheme
- ✅ Loading states and spinners
- ✅ Error handling and notifications
- ✅ Protected routes with role checking

### 15. **Analytics & Reporting**
- ✅ Clinic performance metrics
- ✅ Appointment statistics
- ✅ Doctor utilization tracking
- ✅ Patient flow monitoring
- ✅ View analytics dashboard (clinic admin only)

### 16. **Schedule Management**
- ✅ Multi-slot schedule configuration (up to 3 slots/day)
- ✅ Morning and evening session support
- ✅ Time range display
- ✅ Slot availability indicators
- ✅ Schedule notes per day
- ✅ Manage doctor availability
- ✅ Manage receptionist shifts

---

## 🔐 Role-Based Privileges & Functions

### 1. **PATIENT** (Default Role)

**Priority**: Lowest (auto-redirected to `/dashboard/patient`)

**Permissions**:
- `view_own_data` - View own profile and medical records
- `edit_own_profile` - Edit own profile information
- `book_appointment` - Book medical appointments
- `view_appointments` - View own appointment history
- `cancel_appointment` - Cancel own appointments
- `view_doctors` - Browse doctor profiles
- `view_clinics` - View clinic information

**Functions**:
- ✅ Register as patient (auto-assigned patient role)
- ✅ View personal dashboard
- ✅ Book appointments for self
- ✅ View own appointment history
- ✅ Cancel own appointments
- ✅ View prescriptions
- ✅ View medical reports
- ✅ View test results
- ✅ Download medical records
- ✅ View QR codes for appointments
- ✅ Search doctors and clinics (across all HCPs)
- ✅ Manage family members (if implemented)

**Restrictions**:
- ❌ Cannot manage appointments for others
- ❌ Cannot view other patients' data
- ❌ Cannot access staff dashboards
- ❌ Cannot manage HCP/clinic structure

---

### 2. **RECEPTIONIST** / **RECEPTION**

**Priority**: Highest (auto-redirected to `/dashboard/reception`)

**Permissions**:
- All patient permissions, plus:
- `manage_appointments` - Manage all appointments
- `view_patient_list` - View patient lists
- `view_appointments` - View all appointments (in their HCP)

**Functions**:
- ✅ Access reception dashboard
- ✅ View all appointments for assigned clinics/practices
- ✅ Book appointments for patients (auto-confirmed)
- ✅ Confirm patient-requested appointments
- ✅ Check in patients
- ✅ Update appointment status
- ✅ Cancel appointments
- ✅ Delete appointments (soft delete)
- ✅ Register new patients
- ✅ Search patients by phone
- ✅ View patient lists
- ✅ Manage patient profiles
- ✅ View daily statistics
- ✅ Generate reports

**Restrictions**:
- ❌ Cannot create/edit HCPs, clinics, or practices
- ❌ Cannot manage doctor schedules
- ❌ Cannot write prescriptions
- ❌ Cannot update medical records (view only)
- ❌ Only see appointments for their assigned HCP

**Special Features**:
- ✅ Can be assigned to entire clinic (main reception)
- ✅ Can be assigned to specific practice(s)
- ✅ Flexible multi-slot schedule management

---

### 3. **DOCTOR**

**Priority**: High (auto-redirected to `/dashboard/doctor`)

**Permissions**:
- Basic profile permissions, plus:
- `view_patient_records` - View patient medical records
- `update_patient_records` - Update medical records
- `view_appointments` - View assigned appointments
- `manage_own_schedule` - Manage own availability

**Functions**:
- ✅ Access doctor dashboard
- ✅ View appointments assigned to them
- ✅ View appointments grouped by clinic → practice
- ✅ Update appointment workflow status
- ✅ Check in patients
- ✅ Start/end consultations
- ✅ Book appointments for patients (auto-confirmed)
- ✅ Cancel appointments
- ✅ Delete appointments (soft delete)
- ✅ View patient medical history
- ✅ Write prescriptions
- ✅ Update prescriptions
- ✅ Upload medical reports
- ✅ Add test results
- ✅ View test result graphs
- ✅ Manage own schedule and availability
- ✅ Set consultation fees
- ✅ Configure time slots

**Restrictions**:
- ❌ Cannot create/edit HCPs or clinics (unless also clinic_admin)
- ❌ Cannot manage other doctors
- ❌ Cannot manage receptionists
- ❌ Only see appointments for their assigned HCP

**Special Features**:
- ✅ Multi-slot schedule configuration
- ✅ Automatic appointment ID generation
- ✅ QR code generation for appointments
- ✅ Prescription management with auto-generated IDs

---

### 4. **CLINIC_ADMIN**

**Priority**: Medium-High (auto-redirected to `/dashboard/doctor`)

**Permissions**:
- All doctor and receptionist permissions, plus:
- `manage_doctors` - Add/edit doctor profiles
- `manage_clinics` - Manage clinic information
- `manage_hcp` - **Manage healthcare provider organizations**
- `manage_receptionists` - **Manage receptionist profiles and assignments**
- `manage_practices` - **Manage medical practices and specializations**
- `view_analytics` - View clinic analytics and reports

**Functions**:
- ✅ All doctor and receptionist functions, plus:
- ✅ **HCP Management**:
  - Create and register new HCP organizations
  - Update HCP information (licenses, certifications, contact)
  - View all HCPs they manage
- ✅ **Clinic Management**:
  - Create new clinics under HCPs
  - Define clinic locations, services, operating hours
  - Manage clinic-specific settings
  - Edit/delete clinics
- ✅ **Practice Management**:
  - Set up medical practices within clinics
  - Define specializations and services
  - Assign resources to practices
  - Edit/delete practices
- ✅ **Doctor Management**:
  - Onboard new doctors
  - Assign doctors to clinics and practices
  - Manage doctor schedules and availability
  - Set consultation fees and slot configurations
  - Edit/delete doctor profiles
- ✅ **Receptionist Management**:
  - Add receptionists to the system
  - Assign receptionists to specific clinics or practices
  - Manage receptionist schedules and duties
  - Control front-desk access
- ✅ **Analytics & Reporting**:
  - View clinic performance metrics
  - Access appointment statistics
  - Monitor doctor utilization
  - Track patient flow

**Restrictions**:
- ❌ Cannot access platform-level admin functions
- ❌ Limited to their assigned HCP(s)

**Special Features**:
- ✅ Full organizational tree management
- ✅ Tree view visualization
- ✅ Complete HCP hierarchy control
- ✅ Bulk management capabilities

---

### 5. **OWNER**

**Priority**: Medium (auto-redirected to `/dashboard/doctor`)

**Permissions**:
- All clinic_admin permissions, plus:
- `view_doctor_dashboard`
- `view_reception_dashboard`
- `view_patient_dashboard`
- `view_billing_dashboard`
- `view_clinics`
- `view_practices`
- `view_doctors`
- `view_services`
- `view_invoices`
- `manage_payments`
- `view_billing_reports`
- `manage_users`
- `manage_system`

**Functions**:
- ✅ All clinic_admin functions, plus:
- ✅ Access all dashboards
- ✅ Manage system-wide settings
- ✅ User management
- ✅ Billing management
- ✅ Full platform access
- ✅ System configuration

**Restrictions**:
- ❌ None (full platform access)

---

### 6. **ADMIN** / **SUPER_ADMIN**

**Priority**: Medium (auto-redirected to `/dashboard/doctor`)

**Permissions**:
- Platform-level administrative permissions
- Full access to all features
- User role assignment
- System configuration
- Cross-platform management

**Functions**:
- ✅ All owner functions
- ✅ Assign roles to users
- ✅ Manage platform settings
- ✅ Access audit logs
- ✅ System monitoring
- ✅ User management across platforms

**Restrictions**:
- ❌ None (full platform access)

---

### 7. **BILLING** / **BILLING_STAFF**

**Priority**: Low (no auto-redirect, manual navigation)

**Permissions**:
- `view_invoices` - View billing invoices
- `manage_payments` - Process payments
- `view_billing_reports` - Generate billing reports

**Functions**:
- ✅ Access billing dashboard
- ✅ View invoices
- ✅ Process payments
- ✅ Generate billing reports
- ✅ Track payment status
- ✅ Manage billing records

**Restrictions**:
- ❌ Cannot manage appointments
- ❌ Cannot view medical records
- ❌ Cannot manage HCP structure

---

### 8. **NURSE**

**Priority**: Low (no auto-redirect)

**Permissions**:
- View assigned patients
- Update patient vitals
- View appointments (read-only)
- Access patient basic information

**Functions**:
- ✅ View patient information
- ✅ Record patient vitals
- ✅ View assigned appointments
- ✅ Assist with patient check-in

**Restrictions**:
- ❌ Cannot write prescriptions
- ❌ Cannot manage appointments
- ❌ Limited patient data access

---

### 9. **LAB_TECHNICIAN**

**Priority**: Low (no auto-redirect)

**Permissions**:
- Upload test results
- View test orders
- Update test status
- Manage lab reports

**Functions**:
- ✅ Upload medical reports
- ✅ Add test results
- ✅ Update test status
- ✅ View test orders
- ✅ Manage lab reports

**Restrictions**:
- ❌ Cannot write prescriptions
- ❌ Cannot view full patient records
- ❌ Limited to lab-related functions

---

### 10. **USER** / **GUEST**

**Priority**: Low

**Permissions**:
- `view_own_data` - Basic profile viewing
- Limited platform access

**Functions**:
- ✅ Basic platform access
- ✅ View limited information

**Restrictions**:
- ❌ Most features restricted
- ❌ Cannot book appointments (unless upgraded to patient role)

---

## 🏗️ Organizational Hierarchy

The system supports a hierarchical structure:

```
Platform Level (Multi-Tenant)
    │
    └── Healthcare Provider (HCP)
            │
            ├── Clinic 1
            │   ├── Main Reception
            │   │   └── Receptionist(s)
            │   │
            │   ├── Practice 1 (e.g., General Medicine)
            │   │   ├── Doctor(s)
            │   │   └── Receptionist(s) [optional]
            │   │
            │   └── Practice 2 (e.g., Pediatrics)
            │       ├── Doctor(s)
            │       └── Receptionist(s) [optional]
            │
            └── Clinic 2
                └── Practice 3 (e.g., Cardiology)
                    ├── Doctor(s)
                    └── Receptionist(s) [optional]
```

### Key Features:
- ✅ One Owner can manage multiple HCPs
- ✅ One HCP can have multiple Clinics
- ✅ One Clinic can have multiple Practices
- ✅ One Practice can have multiple Doctors
- ✅ Receptionists can be assigned at Clinic level (main reception) or Practice level
- ✅ Tree view visualization of entire structure
- ✅ Flexible assignment of staff to locations

---

## 📊 Multi-Role Support

The system supports users with multiple roles. When a user has multiple roles:

**Priority Order for Auto-Redirect**:
1. `receptionist` → `/dashboard/reception`
2. `doctor` → `/dashboard/doctor`
3. `owner` → `/dashboard/doctor`
4. `patient` → `/dashboard/patient`

**Example**: A user with `receptionist` + `patient` roles:
- Auto-redirected to Reception Dashboard (work role)
- Still has access to "My Appointments" (personal patient view)
- Can switch between work and personal views

---

## 🔒 Security Features

- ✅ Role-based access control (RBAC)
- ✅ Permission-based API authorization
- ✅ JWT token authentication
- ✅ PIN hashing with BCrypt
- ✅ Account lockout after failed attempts
- ✅ Encrypted billing data (AES-256-GCM)
- ✅ Audit logging
- ✅ CORS protection
- ✅ Rate limiting
- ✅ SQL injection protection (using ORM)
- ✅ Platform-scoped permissions

---

## 📱 API Endpoints Summary

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/verify` - Token verification
- `POST /api/auth/reset-pin` - PIN reset via OTP

### Appointments (8 endpoints)
- `GET /api/appointments/search` - Smart search
- `GET /api/appointments/slots` - Get available slots
- `POST /api/appointments` - Book appointment
- `PUT /api/appointments/:id/status` - Update status
- `GET /api/appointments/doctor/:doctorId` - Doctor appointments
- `GET /api/appointments/patient/:patientId` - Patient appointments
- `GET /api/appointments/:id` - Appointment details
- `PUT /api/appointments/:id/cancel` - Cancel appointment
- `DELETE /api/appointments/:id` - Delete appointment

### Prescriptions (4 endpoints)
- `POST /api/prescriptions` - Create prescription
- `PUT /api/prescriptions/:id` - Update prescription
- `GET /api/prescriptions/patient/:patientId` - Patient prescriptions
- `GET /api/prescriptions/:id` - Prescription details

### Medical Reports (8 endpoints)
- `POST /api/reports/upload` - Upload report
- `GET /api/reports/patient/:patientId` - Patient reports
- `POST /api/reports/:id/results` - Add test results
- `PUT /api/reports/:id/results` - Update test results
- `GET /api/reports/:id/results/history` - Test history

### HCP Management
- `GET /api/hcp` - List HCPs
- `POST /api/hcp` - Create HCP
- `PUT /api/hcp/:id` - Update HCP
- `DELETE /api/hcp/:id` - Delete HCP

### Clinics, Practices, Doctors, Patients
- Similar CRUD endpoints for each entity
- Role-based filtering applied

---

## 🎯 Summary

**Aarogya-Mitra** is a comprehensive healthcare management platform with:

- ✅ **12 distinct roles** with specific privileges
- ✅ **16 major feature categories** covering all aspects of healthcare management
- ✅ **Hierarchical organizational structure** (HCP → Clinic → Practice → Staff)
- ✅ **Complete appointment workflow** (6-stage tracking)
- ✅ **Medical record management** (prescriptions, reports, test results)
- ✅ **Multi-role support** with intelligent auto-routing
- ✅ **Role-based access control** with granular permissions
- ✅ **Production-ready** architecture with security features

The system is designed to handle everything from patient registration to appointment booking, consultation management, prescription tracking, and organizational administration, all with appropriate role-based access control.

---

**Last Updated**: 2025-01-XX
**Status**: Production Ready ✅

