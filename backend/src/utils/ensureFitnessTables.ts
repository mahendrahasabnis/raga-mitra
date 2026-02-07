import { QueryTypes } from 'sequelize';

let ensured = false;

export const ensureFitnessTables = async (force = false) => {
  if (ensured && !force) return;
  try {
    let appDb;
    try {
      const db = await import('../config/database-integrated');
      appDb = db.appSequelize;
    } catch (err: any) {
      // Fallback: create direct connection if decorator issues occur
      const { Sequelize } = await import('sequelize');
      const dbSSL = process.env.DB_SSL === 'true';
      appDb = new Sequelize(
        process.env.DB_NAME || 'aarogya_mitra',
        process.env.DB_USER || 'app_user',
        process.env.DB_PASSWORD || 'app_password_2024',
        {
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '5432'),
          dialect: 'postgres',
          logging: false,
          dialectOptions: dbSSL ? {
            ssl: {
              require: true,
              rejectUnauthorized: false
            }
          } : undefined
        }
      );
    }
    await appDb.query(`
      -- Exercise Templates
      CREATE TABLE IF NOT EXISTS exercise_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(100),
        muscle_groups VARCHAR(255),
        video_url VARCHAR(500),
        image_url VARCHAR(500),
        document_url VARCHAR(500),
        instructions TEXT,
        sets_default INTEGER,
        reps_default VARCHAR(100),
        duration_default INTEGER,
        difficulty VARCHAR(50),
        set_01_rep VARCHAR(100),
        weight_01 DECIMAL(10, 2),
        set_02_rep VARCHAR(100),
        weight_02 DECIMAL(10, 2),
        set_03_rep VARCHAR(100),
        weight_03 DECIMAL(10, 2),
        created_by UUID,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      
      -- Add new columns if they don't exist (for existing tables)
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'exercise_templates' AND column_name = 'set_01_rep') THEN
          ALTER TABLE exercise_templates ADD COLUMN set_01_rep VARCHAR(100);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'exercise_templates' AND column_name = 'weight_01') THEN
          ALTER TABLE exercise_templates ADD COLUMN weight_01 DECIMAL(10, 2);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'exercise_templates' AND column_name = 'set_02_rep') THEN
          ALTER TABLE exercise_templates ADD COLUMN set_02_rep VARCHAR(100);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'exercise_templates' AND column_name = 'weight_02') THEN
          ALTER TABLE exercise_templates ADD COLUMN weight_02 DECIMAL(10, 2);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'exercise_templates' AND column_name = 'set_03_rep') THEN
          ALTER TABLE exercise_templates ADD COLUMN set_03_rep VARCHAR(100);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'exercise_templates' AND column_name = 'weight_03') THEN
          ALTER TABLE exercise_templates ADD COLUMN weight_03 DECIMAL(10, 2);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'exercise_templates' AND column_name = 'duration_default_text') THEN
          ALTER TABLE exercise_templates ADD COLUMN duration_default_text VARCHAR(255);
        END IF;
      END $$;
      CREATE INDEX IF NOT EXISTS idx_exercise_templates_category ON exercise_templates (category);
      CREATE INDEX IF NOT EXISTS idx_exercise_templates_active ON exercise_templates (is_active) WHERE is_active = TRUE;
      CREATE INDEX IF NOT EXISTS idx_exercise_templates_created_by ON exercise_templates (created_by);

      -- Weekly Templates
      CREATE TABLE IF NOT EXISTS fitness_week_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_user_id UUID NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_fitness_week_templates_patient ON fitness_week_templates (patient_user_id);
      CREATE INDEX IF NOT EXISTS idx_fitness_week_templates_active ON fitness_week_templates (patient_user_id, is_active) WHERE is_active = TRUE;

      -- Template Days
      CREATE TABLE IF NOT EXISTS fitness_template_days (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        week_template_id UUID NOT NULL,
        day_of_week INTEGER NOT NULL,
        is_rest_day BOOLEAN DEFAULT FALSE,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS ux_fitness_template_days ON fitness_template_days (week_template_id, day_of_week);
      CREATE INDEX IF NOT EXISTS idx_fitness_template_days_template ON fitness_template_days (week_template_id);

      -- Sessions
      CREATE TABLE IF NOT EXISTS fitness_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        template_day_id UUID NOT NULL,
        session_name VARCHAR(100) NOT NULL,
        session_order INTEGER DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_fitness_sessions_template_day ON fitness_sessions (template_day_id);

      -- Session Exercises
      CREATE TABLE IF NOT EXISTS fitness_session_exercises (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL,
        exercise_template_id UUID,
        exercise_name VARCHAR(255) NOT NULL,
        exercise_order INTEGER DEFAULT 0,
        sets INTEGER,
        reps VARCHAR(100),
        duration INTEGER,
        weight DECIMAL(10, 2),
        weight_unit VARCHAR(10),
        set_01_rep VARCHAR(100),
        weight_01 DECIMAL(10, 2),
        set_02_rep VARCHAR(100),
        weight_02 DECIMAL(10, 2),
        set_03_rep VARCHAR(100),
        weight_03 DECIMAL(10, 2),
        rest_seconds INTEGER,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fitness_session_exercises' AND column_name = 'weight_unit') THEN
          ALTER TABLE fitness_session_exercises ADD COLUMN weight_unit VARCHAR(10);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fitness_session_exercises' AND column_name = 'set_01_rep') THEN
          ALTER TABLE fitness_session_exercises ADD COLUMN set_01_rep VARCHAR(100);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fitness_session_exercises' AND column_name = 'weight_01') THEN
          ALTER TABLE fitness_session_exercises ADD COLUMN weight_01 DECIMAL(10, 2);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fitness_session_exercises' AND column_name = 'set_02_rep') THEN
          ALTER TABLE fitness_session_exercises ADD COLUMN set_02_rep VARCHAR(100);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fitness_session_exercises' AND column_name = 'weight_02') THEN
          ALTER TABLE fitness_session_exercises ADD COLUMN weight_02 DECIMAL(10, 2);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fitness_session_exercises' AND column_name = 'set_03_rep') THEN
          ALTER TABLE fitness_session_exercises ADD COLUMN set_03_rep VARCHAR(100);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fitness_session_exercises' AND column_name = 'weight_03') THEN
          ALTER TABLE fitness_session_exercises ADD COLUMN weight_03 DECIMAL(10, 2);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fitness_session_exercises' AND column_name = 'duration_text') THEN
          ALTER TABLE fitness_session_exercises ADD COLUMN duration_text VARCHAR(255);
        END IF;
      END $$;
      CREATE INDEX IF NOT EXISTS idx_fitness_session_exercises_session ON fitness_session_exercises (session_id);
      CREATE INDEX IF NOT EXISTS idx_fitness_session_exercises_template ON fitness_session_exercises (exercise_template_id);

      -- Calendar Entries
      CREATE TABLE IF NOT EXISTS fitness_calendar_entries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_user_id UUID NOT NULL,
        date DATE NOT NULL,
        week_template_id UUID,
        template_day_id UUID,
        is_override BOOLEAN DEFAULT FALSE,
        is_rest_day BOOLEAN DEFAULT FALSE,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS ux_fitness_calendar_entries ON fitness_calendar_entries (patient_user_id, date);
      CREATE INDEX IF NOT EXISTS idx_fitness_calendar_entries_patient_date ON fitness_calendar_entries (patient_user_id, date);

      -- Calendar Sessions
      CREATE TABLE IF NOT EXISTS fitness_calendar_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        calendar_entry_id UUID NOT NULL,
        session_name VARCHAR(100) NOT NULL,
        session_order INTEGER DEFAULT 0,
        notes TEXT,
        week_template_id UUID REFERENCES fitness_week_templates(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_fitness_calendar_sessions_entry ON fitness_calendar_sessions (calendar_entry_id);
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fitness_calendar_sessions' AND column_name = 'week_template_id') THEN
          ALTER TABLE fitness_calendar_sessions ADD COLUMN week_template_id UUID REFERENCES fitness_week_templates(id) ON DELETE SET NULL;
          CREATE INDEX IF NOT EXISTS idx_fitness_calendar_sessions_week_template ON fitness_calendar_sessions (week_template_id);
        END IF;
      END $$;

      -- Calendar Session Exercises
      CREATE TABLE IF NOT EXISTS fitness_calendar_session_exercises (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        calendar_session_id UUID NOT NULL,
        exercise_template_id UUID,
        exercise_name VARCHAR(255) NOT NULL,
        exercise_order INTEGER DEFAULT 0,
        sets INTEGER,
        reps VARCHAR(100),
        duration INTEGER,
        weight DECIMAL(10, 2),
        weight_unit VARCHAR(10),
        set_01_rep VARCHAR(100),
        weight_01 DECIMAL(10, 2),
        set_02_rep VARCHAR(100),
        weight_02 DECIMAL(10, 2),
        set_03_rep VARCHAR(100),
        weight_03 DECIMAL(10, 2),
        rest_seconds INTEGER,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fitness_calendar_session_exercises' AND column_name = 'weight_unit') THEN
          ALTER TABLE fitness_calendar_session_exercises ADD COLUMN weight_unit VARCHAR(10);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fitness_calendar_session_exercises' AND column_name = 'set_01_rep') THEN
          ALTER TABLE fitness_calendar_session_exercises ADD COLUMN set_01_rep VARCHAR(100);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fitness_calendar_session_exercises' AND column_name = 'weight_01') THEN
          ALTER TABLE fitness_calendar_session_exercises ADD COLUMN weight_01 DECIMAL(10, 2);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fitness_calendar_session_exercises' AND column_name = 'set_02_rep') THEN
          ALTER TABLE fitness_calendar_session_exercises ADD COLUMN set_02_rep VARCHAR(100);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fitness_calendar_session_exercises' AND column_name = 'weight_02') THEN
          ALTER TABLE fitness_calendar_session_exercises ADD COLUMN weight_02 DECIMAL(10, 2);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fitness_calendar_session_exercises' AND column_name = 'set_03_rep') THEN
          ALTER TABLE fitness_calendar_session_exercises ADD COLUMN set_03_rep VARCHAR(100);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fitness_calendar_session_exercises' AND column_name = 'weight_03') THEN
          ALTER TABLE fitness_calendar_session_exercises ADD COLUMN weight_03 DECIMAL(10, 2);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fitness_calendar_session_exercises' AND column_name = 'duration_text') THEN
          ALTER TABLE fitness_calendar_session_exercises ADD COLUMN duration_text VARCHAR(255);
        END IF;
      END $$;
      CREATE INDEX IF NOT EXISTS idx_fitness_calendar_session_exercises_session ON fitness_calendar_session_exercises (calendar_session_id);

      -- Tracking
      CREATE TABLE IF NOT EXISTS fitness_tracking (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_user_id UUID NOT NULL,
        calendar_entry_id UUID,
        calendar_session_id UUID,
        calendar_exercise_id UUID,
        tracked_date DATE NOT NULL,
        tracked_at TIMESTAMPTZ DEFAULT NOW(),
        completion_status VARCHAR(50) DEFAULT 'pending',
        completed_sets INTEGER,
        completed_reps VARCHAR(100),
        completed_duration INTEGER,
        completed_weight DECIMAL(10, 2),
        completed_sets_detail JSONB,
        notes TEXT,
        pictures TEXT[],
        rating INTEGER,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fitness_tracking' AND column_name = 'completed_sets_detail') THEN
          ALTER TABLE fitness_tracking ADD COLUMN completed_sets_detail JSONB;
        END IF;
      END $$;
      CREATE INDEX IF NOT EXISTS idx_fitness_tracking_patient_date ON fitness_tracking (patient_user_id, tracked_date);
      CREATE INDEX IF NOT EXISTS idx_fitness_tracking_entry ON fitness_tracking (calendar_entry_id);
      CREATE INDEX IF NOT EXISTS idx_fitness_tracking_session ON fitness_tracking (calendar_session_id);
    `);
    ensured = true;
    console.log('✅ [FITNESS] Fitness module tables ensured in aarogya_mitra');
  } catch (err: any) {
    console.error('⚠️ [FITNESS] ensureFitnessTables failed:', err.message || err);
  }
};

export default ensureFitnessTables;
