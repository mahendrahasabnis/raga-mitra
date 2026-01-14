-- Health Module Tables for aarogya_mitra database

-- Medicine Schedules (for tracking medication schedules)
CREATE TABLE IF NOT EXISTS medicine_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_user_id UUID NOT NULL,
  medicine_name VARCHAR(255) NOT NULL,
  dosage VARCHAR(100),
  frequency VARCHAR(100) NOT NULL, -- e.g., "Twice daily", "1-0-1", "After meals"
  start_date DATE NOT NULL,
  end_date DATE,
  timing VARCHAR(255), -- e.g., "Before meals", "After meals", "Morning", "Evening"
  instructions TEXT,
  appointment_id VARCHAR(100), -- Links to appointment if from prescription
  prescription_id UUID, -- Links to past_prescriptions if from prescription
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_medicine_schedules_patient ON medicine_schedules (patient_user_id);
CREATE INDEX IF NOT EXISTS idx_medicine_schedules_appointment ON medicine_schedules (appointment_id);
CREATE INDEX IF NOT EXISTS idx_medicine_schedules_active ON medicine_schedules (patient_user_id, is_active) WHERE is_active = TRUE;

-- Appointments Attachments (links attachments to appointments)
CREATE TABLE IF NOT EXISTS appointment_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL,
  attachment_type VARCHAR(50) NOT NULL, -- 'receipt', 'prescription', 'diagnostic', 'invoice', 'other'
  attachment_id UUID, -- ID of the related record (receipt_id, prescription_id, test_result_id, etc.)
  file_url VARCHAR(500),
  file_name VARCHAR(255),
  file_type VARCHAR(50),
  file_size INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appointment_attachments_appointment ON appointment_attachments (appointment_id);
CREATE INDEX IF NOT EXISTS idx_appointment_attachments_type ON appointment_attachments (appointment_id, attachment_type);

-- Diagnostics (enhanced test results tracking)
-- Note: past_test_results table already exists, but we'll create a view/wrapper for the health module
