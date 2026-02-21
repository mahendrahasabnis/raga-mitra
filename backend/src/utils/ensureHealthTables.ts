let ensured = false;

/** Run a migration batch; log but do not throw so other batches can succeed. */
const runBatch = async (appDb: any, sql: string, label: string) => {
  try {
    await appDb.query(sql);
    return true;
  } catch (err: any) {
    console.error(`⚠️ [HEALTH] ${label} failed:`, err.message || err);
    return false;
  }
};

export const ensureHealthTables = async () => {
  if (ensured) return;
  const db = await import('../config/database-integrated');
  const appDb = db.appSequelize;

  // Run institution_admissions + monitoring_readings first (required for Live Monitoring)
  const admissionsOk = await runBatch(appDb, `
      CREATE TABLE IF NOT EXISTS institution_admissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_user_id UUID NOT NULL,
        institution_name VARCHAR(500) NOT NULL,
        mrn_number VARCHAR(100),
        bed_number VARCHAR(50),
        admission_date DATE NOT NULL,
        condition TEXT,
        consulting_doctor VARCHAR(255),
        high_limits JSONB,
        low_limits JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_institution_admissions_patient ON institution_admissions (patient_user_id);
      CREATE INDEX IF NOT EXISTS idx_institution_admissions_date ON institution_admissions (admission_date);

      CREATE TABLE IF NOT EXISTS monitoring_readings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        admission_id UUID NOT NULL REFERENCES institution_admissions(id) ON DELETE CASCADE,
        recorded_at TIMESTAMPTZ NOT NULL,
        heart_rate DECIMAL(10,2),
        breath_rate DECIMAL(10,2),
        spo2 DECIMAL(10,2),
        temperature DECIMAL(10,2),
        systolic_bp DECIMAL(10,2),
        diastolic_bp DECIMAL(10,2),
        movement SMALLINT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_monitoring_readings_admission ON monitoring_readings (admission_id);
      CREATE INDEX IF NOT EXISTS idx_monitoring_readings_recorded ON monitoring_readings (admission_id, recorded_at);

      CREATE TABLE IF NOT EXISTS admission_treatments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        admission_id UUID NOT NULL REFERENCES institution_admissions(id) ON DELETE CASCADE,
        recorded_at TIMESTAMPTZ NOT NULL,
        treatment_name VARCHAR(500) NOT NULL,
        quantity VARCHAR(100),
        notes TEXT,
        doctor_name VARCHAR(255),
        entered_by_name VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_admission_treatments_admission ON admission_treatments (admission_id);
      CREATE INDEX IF NOT EXISTS idx_admission_treatments_recorded ON admission_treatments (admission_id, recorded_at);
    `, 'institution_admissions + monitoring_readings + admission_treatments');

  // Extend enum_appointments_status with new values needed for QR check-in flow
  await runBatch(appDb, `
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_appointments_status') THEN
          BEGIN ALTER TYPE enum_appointments_status ADD VALUE IF NOT EXISTS 'waiting'; EXCEPTION WHEN duplicate_object THEN NULL; END;
          BEGIN ALTER TYPE enum_appointments_status ADD VALUE IF NOT EXISTS 'consulting'; EXCEPTION WHEN duplicate_object THEN NULL; END;
        END IF;
      END $$;
    `, 'appointments enum migration');

  // Add missing columns to appointments (old schema may have patient_id, appointment_time but not title, doctor_name, doctor_phone)
  await runBatch(appDb, `
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'appointments') THEN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'title') THEN
            ALTER TABLE appointments ADD COLUMN title VARCHAR(500);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'doctor_name') THEN
            ALTER TABLE appointments ADD COLUMN doctor_name VARCHAR(255);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'doctor_phone') THEN
            ALTER TABLE appointments ADD COLUMN doctor_phone VARCHAR(100);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'waiting_number') THEN
            ALTER TABLE appointments ADD COLUMN waiting_number INTEGER;
          END IF;
        END IF;
      END $$;
    `, 'appointments migration');

  // Other health tables (may fail if schema differs from existing DB)
  await runBatch(appDb, `
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

      -- Appointments (main list) - doctor id, name, phone stored to avoid users table lookup
      CREATE TABLE IF NOT EXISTS appointments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_user_id UUID NOT NULL,
        doctor_user_id UUID,
        doctor_name VARCHAR(255),
        doctor_phone VARCHAR(100),
        datetime TIMESTAMPTZ,
        title VARCHAR(500),
        status VARCHAR(50) DEFAULT 'planned',
        location VARCHAR(500),
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments (patient_user_id);
      CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON appointments (doctor_user_id);
      CREATE INDEX IF NOT EXISTS idx_appointments_datetime ON appointments (datetime);
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'title') THEN
          ALTER TABLE appointments ADD COLUMN title VARCHAR(500);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'doctor_name') THEN
          ALTER TABLE appointments ADD COLUMN doctor_name VARCHAR(255);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'doctor_phone') THEN
          ALTER TABLE appointments ADD COLUMN doctor_phone VARCHAR(100);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'location') THEN
          ALTER TABLE appointments ADD COLUMN location VARCHAR(500);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'notes') THEN
          ALTER TABLE appointments ADD COLUMN notes TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'waiting_number') THEN
          ALTER TABLE appointments ADD COLUMN waiting_number INTEGER;
        END IF;
      END $$;

      -- Relax NOT NULL constraints on HCP-specific columns so patient-side inserts work
      DO $$ BEGIN
        ALTER TABLE appointments ALTER COLUMN appointment_id DROP NOT NULL;
        ALTER TABLE appointments ALTER COLUMN qr_code DROP NOT NULL;
        ALTER TABLE appointments ALTER COLUMN hcp_id DROP NOT NULL;
        ALTER TABLE appointments ALTER COLUMN hcp_name DROP NOT NULL;
        ALTER TABLE appointments ALTER COLUMN clinic_id DROP NOT NULL;
        ALTER TABLE appointments ALTER COLUMN clinic_name DROP NOT NULL;
        ALTER TABLE appointments ALTER COLUMN practice_id DROP NOT NULL;
        ALTER TABLE appointments ALTER COLUMN practice_name DROP NOT NULL;
        ALTER TABLE appointments ALTER COLUMN patient_name DROP NOT NULL;
        ALTER TABLE appointments ALTER COLUMN patient_phone DROP NOT NULL;
        ALTER TABLE appointments ALTER COLUMN doctor_name DROP NOT NULL;
        ALTER TABLE appointments ALTER COLUMN appointment_date DROP NOT NULL;
        ALTER TABLE appointments ALTER COLUMN appointment_time DROP NOT NULL;
      EXCEPTION WHEN undefined_column THEN NULL;
      END $$;

      -- Drop FK constraints that block patient-side inserts (patient_id may not exist in patients table)
      DO $$ BEGIN
        ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_clinic_id_fkey;
        ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_hcp_id_fkey;
        ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_practice_id_fkey;
        ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_patient_id_fkey;
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$;

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

      -- Appointment Details
      CREATE TABLE IF NOT EXISTS appointment_details (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        appointment_id UUID NOT NULL UNIQUE,
        patient_user_id UUID NOT NULL,
        history JSONB,
        prescription JSONB,
        bills JSONB,
        audio_clips JSONB,
        created_by UUID NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_appointment_details_patient ON appointment_details (patient_user_id);

      -- Appointment Files (prescriptions, bills, audio)
      CREATE TABLE IF NOT EXISTS appointment_files (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        appointment_id UUID NOT NULL,
        patient_user_id UUID NOT NULL,
        category VARCHAR(50) NOT NULL,
        sub_type VARCHAR(50),
        file_url VARCHAR(500),
        storage_path VARCHAR(500),
        file_name VARCHAR(255),
        file_type VARCHAR(100),
        file_size INTEGER,
        created_by UUID NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_appointment_files_appointment ON appointment_files (appointment_id);
      CREATE INDEX IF NOT EXISTS idx_appointment_files_patient ON appointment_files (patient_user_id);

      -- Vital Parameters (weight, BP, etc. for Today / Add Vitals)
      CREATE TABLE IF NOT EXISTS vital_parameters (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_user_id UUID NOT NULL,
        parameter_name VARCHAR(255) NOT NULL,
        value DECIMAL(12, 4) NOT NULL,
        unit VARCHAR(50),
        recorded_date TIMESTAMPTZ DEFAULT NOW(),
        reference_range VARCHAR(255),
        source_report_id UUID,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_vital_parameters_patient ON vital_parameters (patient_user_id);
      CREATE INDEX IF NOT EXISTS idx_vital_parameters_recorded ON vital_parameters (recorded_date);
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vital_parameters' AND column_name = 'parameter_name') THEN
          ALTER TABLE vital_parameters ADD COLUMN IF NOT EXISTS parameter_name VARCHAR(255);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vital_parameters' AND column_name = 'source') THEN
          ALTER TABLE vital_parameters ADD COLUMN source VARCHAR(100);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vital_parameters' AND column_name = 'normal_range_min') THEN
          ALTER TABLE vital_parameters ADD COLUMN normal_range_min DECIMAL(12, 4);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vital_parameters' AND column_name = 'normal_range_max') THEN
          ALTER TABLE vital_parameters ADD COLUMN normal_range_max DECIMAL(12, 4);
        END IF;
      END $$;
    `, 'medicine/appointments/vitals');

  ensured = admissionsOk; // Only skip retries when admissions tables exist
  if (admissionsOk) {
    console.log('✅ [HEALTH] Health module tables ensured in aarogya_mitra');
  } else {
    console.warn('⚠️ [HEALTH] institution_admissions + monitoring_readings failed; will retry on next request.');
  }
};

export default ensureHealthTables;
