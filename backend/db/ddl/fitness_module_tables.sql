-- Fitness Module Tables for aarogya_mitra database

-- Exercise Templates (library of exercises with media references)
CREATE TABLE IF NOT EXISTS exercise_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100), -- e.g., "Cardio", "Strength", "Flexibility"
  muscle_groups VARCHAR(255), -- e.g., "Chest, Shoulders", "Legs"
  video_url VARCHAR(500),
  image_url VARCHAR(500),
  document_url VARCHAR(500),
  instructions TEXT,
  sets_default INTEGER,
  reps_default VARCHAR(100), -- e.g., "10", "10-12", "AMRAP"
  duration_default INTEGER, -- in seconds
  difficulty VARCHAR(50), -- "Beginner", "Intermediate", "Advanced"
  created_by UUID,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exercise_templates_category ON exercise_templates (category);
CREATE INDEX IF NOT EXISTS idx_exercise_templates_active ON exercise_templates (is_active) WHERE is_active = TRUE;

-- Weekly Templates (base template structure)
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

-- Template Days (Mon-Sun in a weekly template)
CREATE TABLE IF NOT EXISTS fitness_template_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_template_id UUID NOT NULL REFERENCES fitness_week_templates(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL, -- 0=Monday, 1=Tuesday, ..., 6=Sunday
  is_rest_day BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(week_template_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_fitness_template_days_template ON fitness_template_days (week_template_id);

-- Sessions (Morning, Evening, etc. within a day)
CREATE TABLE IF NOT EXISTS fitness_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_day_id UUID NOT NULL REFERENCES fitness_template_days(id) ON DELETE CASCADE,
  session_name VARCHAR(100) NOT NULL, -- e.g., "Morning", "Evening", "Workout"
  session_order INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fitness_sessions_template_day ON fitness_sessions (template_day_id);

-- Session Exercises (exercises within a session)
CREATE TABLE IF NOT EXISTS fitness_session_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES fitness_sessions(id) ON DELETE CASCADE,
  exercise_template_id UUID REFERENCES exercise_templates(id) ON DELETE SET NULL,
  exercise_name VARCHAR(255) NOT NULL, -- Can be custom or from template
  exercise_order INTEGER DEFAULT 0,
  sets INTEGER,
  reps VARCHAR(100),
  duration INTEGER, -- in seconds
  weight DECIMAL(10, 2),
  rest_seconds INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fitness_session_exercises_session ON fitness_session_exercises (session_id);
CREATE INDEX IF NOT EXISTS idx_fitness_session_exercises_template ON fitness_session_exercises (exercise_template_id);

-- Calendar Entries (derived from templates, can override)
CREATE TABLE IF NOT EXISTS fitness_calendar_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_user_id UUID NOT NULL,
  date DATE NOT NULL,
  week_template_id UUID REFERENCES fitness_week_templates(id) ON DELETE SET NULL,
  template_day_id UUID REFERENCES fitness_template_days(id) ON DELETE SET NULL,
  is_override BOOLEAN DEFAULT FALSE, -- If true, this overrides template
  is_rest_day BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(patient_user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_fitness_calendar_entries_patient_date ON fitness_calendar_entries (patient_user_id, date);
CREATE INDEX IF NOT EXISTS idx_fitness_calendar_entries_date ON fitness_calendar_entries (date);

-- Calendar Sessions (sessions for a specific calendar date)
CREATE TABLE IF NOT EXISTS fitness_calendar_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_entry_id UUID NOT NULL REFERENCES fitness_calendar_entries(id) ON DELETE CASCADE,
  session_name VARCHAR(100) NOT NULL,
  session_order INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fitness_calendar_sessions_entry ON fitness_calendar_sessions (calendar_entry_id);

-- Calendar Session Exercises (exercises for calendar sessions)
CREATE TABLE IF NOT EXISTS fitness_calendar_session_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_session_id UUID NOT NULL REFERENCES fitness_calendar_sessions(id) ON DELETE CASCADE,
  exercise_template_id UUID REFERENCES exercise_templates(id) ON DELETE SET NULL,
  exercise_name VARCHAR(255) NOT NULL,
  exercise_order INTEGER DEFAULT 0,
  sets INTEGER,
  reps VARCHAR(100),
  duration INTEGER,
  weight DECIMAL(10, 2),
  rest_seconds INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fitness_calendar_session_exercises_session ON fitness_calendar_session_exercises (calendar_session_id);

-- Tracking (completion, notes, pictures per session/exercise)
CREATE TABLE IF NOT EXISTS fitness_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_user_id UUID NOT NULL,
  calendar_entry_id UUID REFERENCES fitness_calendar_entries(id) ON DELETE CASCADE,
  calendar_session_id UUID REFERENCES fitness_calendar_sessions(id) ON DELETE CASCADE,
  calendar_exercise_id UUID REFERENCES fitness_calendar_session_exercises(id) ON DELETE CASCADE,
  tracked_date DATE NOT NULL,
  tracked_at TIMESTAMPTZ DEFAULT NOW(),
  completion_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'completed', 'skipped', 'partial'
  completed_sets INTEGER,
  completed_reps VARCHAR(100),
  completed_duration INTEGER,
  completed_weight DECIMAL(10, 2),
  notes TEXT,
  pictures TEXT[], -- Array of picture URLs
  rating INTEGER, -- 1-5 scale
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fitness_tracking_patient_date ON fitness_tracking (patient_user_id, tracked_date);
CREATE INDEX IF NOT EXISTS idx_fitness_tracking_entry ON fitness_tracking (calendar_entry_id);
CREATE INDEX IF NOT EXISTS idx_fitness_tracking_session ON fitness_tracking (calendar_session_id);
CREATE INDEX IF NOT EXISTS idx_fitness_tracking_exercise ON fitness_tracking (calendar_exercise_id);
