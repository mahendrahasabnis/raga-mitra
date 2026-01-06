# Vital Trends & Receipt Scanning Implementation Plan

## 🎯 Feature Overview

1. **Receipt Scanning to Create Past Visit**: Scan consultation receipt to auto-extract and create past visit
2. **Vital Trends Dashboard**: Track health parameters with graphs and multi-parameter comparison
3. **Parameter Extraction from Reports**: Auto-extract parameters when scanning test results

## 📋 Implementation Tasks

### Phase 1: Database Models ✅ (In Progress)
- [x] Create `VitalParameter` model
- [x] Create `VitalParameterDefinition` model
- [ ] Add models to database config
- [ ] Create seed data for common parameters

### Phase 2: Receipt Scanning Enhancement
- [ ] Enhance receipt extraction to get: clinic name, doctor name, date, city, pincode, consultation fee
- [ ] Create endpoint to scan receipt and auto-create past visit
- [ ] Update frontend to add "Scan Receipt" option in Medical History

### Phase 3: Parameter Extraction from Reports
- [ ] Enhance test result extraction to capture individual parameters
- [ ] Store parameters in VitalParameter table with dates
- [ ] Link parameters to test result documents

### Phase 4: Vital Trends Backend API
- [ ] Create controller for vital parameters (CRUD)
- [ ] Create routes for vital trends
- [ ] Add endpoints for:
  - Get parameters by date range
  - Get parameters by category
  - Get parameter definitions
  - Add/update parameter manually
  - Get graph data for multiple parameters

### Phase 5: Vital Trends Frontend
- [ ] Create Vital Trends component
- [ ] Add date range selector
- [ ] Integrate graph library (Chart.js or Recharts)
- [ ] Add multi-parameter comparison (up to 5 params)
- [ ] Add parameter categorization (general, disease-specific)
- [ ] Show normal/high/low ranges on graphs
- [ ] Add individual graph views

### Phase 6: Integration
- [ ] Add "Vital Trends" tab/section in Patient Dashboard
- [ ] Link parameter extraction from test result uploads
- [ ] Add manual parameter entry form
- [ ] Test end-to-end flow

## 🗄️ Database Schema

### VitalParameter Table
- `id` (UUID, PK)
- `patient_id` (UUID, FK to Patient)
- `parameter_name` (string) - e.g., "Weight", "HbA1c"
- `value` (decimal) - numeric value
- `unit` (string) - e.g., "kg", "%", "mg/dL"
- `recorded_date` (date, indexed)
- `recorded_time` (time, optional)
- `normal_range_min` (decimal)
- `normal_range_max` (decimal)
- `category` (string) - 'general', 'diabetes', etc.
- `subcategory` (string)
- `is_abnormal` (boolean)
- `source` (string) - 'manual_entry', 'test_report', etc.
- `test_result_id` (UUID, optional)
- `appointment_id` (UUID, optional)
- `notes` (text)
- `recorded_by` (UUID)
- `is_active` (boolean)
- `created_at`, `updated_at`

### VitalParameterDefinition Table
- `id` (UUID, PK)
- `parameter_name` (string, unique)
- `display_name` (string)
- `unit` (string)
- `category` (string)
- `subcategory` (string)
- `default_normal_range_min` (decimal)
- `default_normal_range_max` (decimal)
- `parameter_type` (string)
- `description` (text)
- `related_parameters` (JSON array)
- `sort_order` (integer)
- `is_active` (boolean)

## 📊 Common Parameters

### General Parameters
- Weight (kg)
- Height (cm)
- BMI
- Blood Pressure (Systolic/Diastolic)
- Pulse Rate (bpm)
- Temperature (°C)

### Diabetes Parameters
- Fasting Blood Sugar (mg/dL)
- Post-Prandial Blood Sugar (mg/dL)
- HbA1c (%)
- Random Blood Sugar (mg/dL)

### Cardiac Parameters
- Cholesterol (mg/dL)
- HDL (mg/dL)
- LDL (mg/dL)
- Triglycerides (mg/dL)

### Other
- Hemoglobin (g/dL)
- Creatinine (mg/dL)
- etc.

## 🔄 API Endpoints

### Vital Parameters
- `POST /api/vital-parameters` - Add parameter
- `GET /api/vital-parameters` - Get parameters (with filters)
- `GET /api/vital-parameters/:id` - Get single parameter
- `PUT /api/vital-parameters/:id` - Update parameter
- `DELETE /api/vital-parameters/:id` - Delete parameter
- `GET /api/vital-parameters/graph-data` - Get data for graph (multiple params)
- `GET /api/vital-parameters/categories` - Get parameters by category
- `GET /api/vital-parameters/definitions` - Get parameter definitions

### Receipt Scanning
- `POST /api/past-visits/scan-receipt` - Scan receipt and create past visit

## 📱 Frontend Components

1. **VitalTrendsDashboard**
   - Date range selector
   - Parameter category tabs
   - Graph view (with normal ranges)
   - Multi-parameter comparison

2. **ParameterGraph**
   - Individual parameter graph
   - Normal/high/low range indicators
   - Tooltip with details

3. **MultiParameterGraph**
   - Up to 5 parameters on single graph
   - Color-coded lines
   - Legend

4. **ScanReceiptModal**
   - Upload receipt image
   - Show extracted data
   - Auto-create past visit

5. **AddParameterModal**
   - Manual parameter entry
   - Select from definitions
   - Date/time picker

## 🎨 UI/UX Considerations

- Default date range: Last 1 year
- Max date range: Up to current date/time
- Graph colors: Use colorblind-friendly palette
- Normal range: Show as shaded area
- Abnormal values: Highlight in red
- Responsive design for mobile

