# Navigation Links Visible by Role (After Master Data Removal)

## Overview

This document shows all navigation links visible for each role **after removing the Master Data section**. The Master Data section (Clinics, Practices, Doctor Details, Services) has been removed from all roles.

---

## 🔐 Role-Based Navigation

### 1. **OWNER** Role

**Visible Navigation Links:**

#### Dashboards
- ❌ Doctor Dashboard (`/dashboard/doctor`) - **RESTRICTED: Only for doctor role**
- ✅ Reception Dashboard (`/dashboard/reception`)
- ✅ My Appointments (`/dashboard/patient`)
- ✅ Billing Dashboard (`/dashboard/billing`)

#### HCP Management (when HCP is registered)
- ✅ Healthcare Providers (`/hcp`)

#### Appointments (when HCP is registered)
- ✅ Appointments (`/appointments`)

#### Patient Management (when HCP is registered)
- ✅ Register Patient (`/patients/register`)
- ✅ All Patients (`/patients`)
- ✅ Search Patients (`/patients/search`)

#### HCP Setup (when NO HCP is registered)
- ✅ HCP Setup (`/hcp`)

---

### 2. **CLINIC_ADMIN** Role

**Visible Navigation Links:**

#### Dashboards
- ❌ Doctor Dashboard (`/dashboard/doctor`) - **RESTRICTED: Only for doctor role**
- ✅ Reception Dashboard (`/dashboard/reception`)
- ✅ My Appointments (`/dashboard/patient`)
- ✅ Billing Dashboard (`/dashboard/billing`)

#### HCP Management (when HCP is registered)
- ✅ Healthcare Providers (`/hcp`)

#### Appointments (when HCP is registered)
- ✅ Appointments (`/appointments`)

#### Patient Management (when HCP is registered)
- ✅ Register Patient (`/patients/register`)
- ✅ All Patients (`/patients`)
- ✅ Search Patients (`/patients/search`)

#### HCP Setup (when NO HCP is registered)
- ✅ HCP Setup (`/hcp`)

---

### 3. **ADMIN** / **SUPER_ADMIN** Role

**Visible Navigation Links:**

#### Dashboards
- ❌ Doctor Dashboard (`/dashboard/doctor`) - **RESTRICTED: Only for doctor role**
- ✅ Reception Dashboard (`/dashboard/reception`)
- ✅ My Appointments (`/dashboard/patient`)
- ✅ Billing Dashboard (`/dashboard/billing`)

#### HCP Management (when HCP is registered)
- ✅ Healthcare Providers (`/hcp`)

#### Appointments (when HCP is registered)
- ✅ Appointments (`/appointments`)

#### Patient Management (when HCP is registered)
- ✅ Register Patient (`/patients/register`)
- ✅ All Patients (`/patients`)
- ✅ Search Patients (`/patients/search`)

#### HCP Setup (when NO HCP is registered)
- ✅ HCP Setup (`/hcp`)

---

### 4. **DOCTOR** Role

**Visible Navigation Links:**

#### Dashboards
- ✅ Doctor Dashboard (`/dashboard/doctor`) - **EXCLUSIVE: Only doctors can access**
- ✅ My Appointments (`/dashboard/patient`)

#### Appointments (when HCP is registered)
- ✅ Appointments (`/appointments`)

**❌ NOT Visible:**
- ❌ Reception Dashboard
- ❌ Billing Dashboard
- ❌ HCP Management
- ❌ Patient Management

---

### 5. **RECEPTIONIST** / **RECEPTION** Role

**Visible Navigation Links:**

#### Dashboards
- ✅ Reception Dashboard (`/dashboard/reception`)
- ✅ My Appointments (`/dashboard/patient`)

#### Appointments (when HCP is registered)
- ✅ Appointments (`/appointments`)

#### Patient Management (when HCP is registered)
- ✅ Register Patient (`/patients/register`)
- ✅ All Patients (`/patients`)
- ✅ Search Patients (`/patients/search`)

**❌ NOT Visible:**
- ❌ Doctor Dashboard
- ❌ Billing Dashboard
- ❌ HCP Management

---

### 6. **BILLING** / **BILLING_STAFF** Role

**Visible Navigation Links:**

#### Dashboards
- ✅ Billing Dashboard (`/dashboard/billing`)
- ✅ My Appointments (`/dashboard/patient`)

#### Appointments (when HCP is registered)
- ✅ Appointments (`/appointments`)

**❌ NOT Visible:**
- ❌ Doctor Dashboard
- ❌ Reception Dashboard
- ❌ HCP Management
- ❌ Patient Management

---

### 7. **PATIENT** Role

**Visible Navigation Links:**

#### Dashboards
- ✅ My Appointments (`/dashboard/patient`)

#### Appointments (when HCP is registered)
- ✅ Appointments (`/appointments`)

**❌ NOT Visible:**
- ❌ Doctor Dashboard
- ❌ Reception Dashboard
- ❌ Billing Dashboard
- ❌ HCP Management
- ❌ Patient Management

---

### 8. **USER** / **GUEST** Role

**Visible Navigation Links:**

#### Dashboards
- ✅ My Appointments (`/dashboard/patient`)

#### Appointments (when HCP is registered)
- ✅ Appointments (`/appointments`)

**❌ NOT Visible:**
- ❌ All other dashboards
- ❌ HCP Management
- ❌ Patient Management

---

## 📊 Summary Table

| Role | Dashboards | HCP Management | Appointments | Patient Management | Total Links |
|------|-----------|----------------|--------------|-------------------|-------------|
| **Owner** | 3 (No Doctor) | ✅ (with HCP) | ✅ (with HCP) | ✅ 3 (with HCP) | **6-9** |
| **Clinic Admin** | 3 (No Doctor) | ✅ (with HCP) | ✅ (with HCP) | ✅ 3 (with HCP) | **6-9** |
| **Admin** | 3 (No Doctor) | ✅ (with HCP) | ✅ (with HCP) | ✅ 3 (with HCP) | **6-9** |
| **Doctor** | 2 (Exclusive) | ❌ | ✅ (with HCP) | ❌ | **2-3** |
| **Receptionist** | 2 | ❌ | ✅ (with HCP) | ✅ 3 (with HCP) | **2-5** |
| **Billing** | 2 | ❌ | ✅ (with HCP) | ❌ | **2-3** |
| **Patient** | 1 | ❌ | ✅ (with HCP) | ❌ | **1-2** |
| **User/Guest** | 1 | ❌ | ✅ (with HCP) | ❌ | **1-2** |

---

## 🔍 Detailed Breakdown by Scenario

### Scenario 1: Owner/Admin WITH HCP Registered

**Navigation Groups:**
1. **Dashboards** (3 items)
   - Reception Dashboard
   - My Appointments
   - Billing Dashboard
   - ❌ Doctor Dashboard (restricted - only for doctor role)

2. **HCP Management** (1 item)
   - Healthcare Providers

3. **Appointments** (1 item)
   - Appointments

4. **Patient Mgmt.** (3 items)
   - Register Patient
   - All Patients
   - Search Patients

**Total: 8 navigation links** (Doctor Dashboard removed)

---

### Scenario 2: Owner/Admin WITHOUT HCP Registered

**Navigation Groups:**
1. **HCP Setup** (1 item)
   - HCP Setup

2. **Dashboards** (3 items)
   - Reception Dashboard
   - My Appointments
   - Billing Dashboard
   - ❌ Doctor Dashboard (restricted - only for doctor role)

**Total: 4 navigation links** (Doctor Dashboard removed)

---

### Scenario 3: Doctor WITH HCP Registered

**Navigation Groups:**
1. **Dashboards** (2 items)
   - Doctor Dashboard
   - My Appointments

2. **Appointments** (1 item)
   - Appointments

**Total: 3 navigation links**

---

### Scenario 4: Receptionist WITH HCP Registered

**Navigation Groups:**
1. **Dashboards** (2 items)
   - Reception Dashboard
   - My Appointments

2. **Appointments** (1 item)
   - Appointments

3. **Patient Mgmt.** (3 items)
   - Register Patient
   - All Patients
   - Search Patients

**Total: 6 navigation links**

---

### Scenario 5: Patient WITH HCP Registered

**Navigation Groups:**
1. **Dashboards** (1 item)
   - My Appointments

2. **Appointments** (1 item)
   - Appointments

**Total: 2 navigation links**

---

### Scenario 6: Patient WITHOUT HCP Registered

**Navigation Groups:**
1. **Dashboards** (1 item)
   - My Appointments

**Total: 1 navigation link**

---

## 🗑️ Removed Links (Master Data Section)

The following links have been **removed from ALL roles**:

- ❌ **Clinics** (`/clinics`)
- ❌ **Practices** (`/practices`)
- ❌ **Doctor Details** (`/doctors`)
- ❌ **Services** (`/services`)

**Note:** These functionalities are still available through:
- HCP Management tree view (`/hcp` → Tree View)
- Direct API access (if needed)
- HCP Setup flow

---

## 📝 Notes

1. **HCP-Dependent Links**: Some links (HCP Management, Appointments, Patient Management) only appear when an HCP is registered for the user.

2. **Multi-Role Users**: Users with multiple roles see links from all their roles (union of permissions).

3. **Role Hierarchy**: Higher-level roles inherit access to lower-level dashboard views (e.g., Owner can see all dashboards).

4. **Permission Filtering**: Final navigation is filtered by both role and permission checks.

---

**Last Updated**: 2025-12-05  
**Change**: Removed Master Data section from all roles

