import { QueryTypes } from 'sequelize';

let ensured = false;

export const ensureHealthTables = async () => {
  if (ensured) return;
  try {
    const db = await import('../config/database-integrated');
    const appDb = db.appSequelize;
    await appDb.query(`
      -- Medicine Schedules
      CREATE TABLE IF NOT EXISTS medicine_schedules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_user_id UUID NOT NULL,
        medicine_name VARCHAR(255) NOT NULL,
        dosage VARCHAR(100),
        frequency VARCHAR(100) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE,
        timing VARCHAR(255),
        instructions TEXT,
        appointment_id VARCHAR(100),
        prescription_id UUID,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_medicine_schedules_patient ON medicine_schedules (patient_user_id);
      CREATE INDEX IF NOT EXISTS idx_medicine_schedules_appointment ON medicine_schedules (appointment_id);
      CREATE INDEX IF NOT EXISTS idx_medicine_schedules_active ON medicine_schedules (patient_user_id, is_active) WHERE is_active = TRUE;

      -- Appointments Attachments
      CREATE TABLE IF NOT EXISTS appointment_attachments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        appointment_id UUID NOT NULL,
        attachment_type VARCHAR(50) NOT NULL,
        attachment_id UUID,
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
    `);
    ensured = true;
    console.log('✅ [HEALTH] Health module tables ensured in aarogya_mitra');
  } catch (err: any) {
    console.error('⚠️ [HEALTH] ensureHealthTables failed:', err.message || err);
  }
};

export default ensureHealthTables;
