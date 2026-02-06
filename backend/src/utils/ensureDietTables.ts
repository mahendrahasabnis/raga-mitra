import { QueryTypes } from 'sequelize';

const getAppSequelize = async () => {
  const db = await import('../config/database-integrated');
  return db.appSequelize;
};

export async function ensureDietTables() {
  try {
    const sequelize = await getAppSequelize();
    
    const ddl = `
-- Diet / Nutrition Module Tables
CREATE TABLE IF NOT EXISTS diet_meal_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  meal_type VARCHAR(50),
  cuisine VARCHAR(100),
  diet_type VARCHAR(50),
  serving_size VARCHAR(100),
  calories DECIMAL(10, 2),
  protein DECIMAL(10, 2),
  carbs DECIMAL(10, 2),
  fats DECIMAL(10, 2),
  fiber DECIMAL(10, 2),
  sugar DECIMAL(10, 2),
  sodium DECIMAL(10, 2),
  ingredients TEXT,
  instructions TEXT,
  image_url VARCHAR(500),
  document_url VARCHAR(500),
  created_by UUID,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_diet_meal_templates_category ON diet_meal_templates (category);
CREATE INDEX IF NOT EXISTS idx_diet_meal_templates_active ON diet_meal_templates (is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_diet_meal_templates_created_by ON diet_meal_templates (created_by);

CREATE TABLE IF NOT EXISTS diet_week_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_user_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_diet_week_templates_patient ON diet_week_templates(patient_user_id);
CREATE INDEX IF NOT EXISTS idx_diet_week_templates_active ON diet_week_templates(is_active);

CREATE TABLE IF NOT EXISTS diet_template_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_template_id UUID NOT NULL REFERENCES diet_week_templates(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  is_rest_day BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(week_template_id, day_of_week)
);
CREATE INDEX IF NOT EXISTS idx_diet_template_days_week ON diet_template_days(week_template_id);
CREATE INDEX IF NOT EXISTS idx_diet_template_days_day ON diet_template_days(day_of_week);

CREATE TABLE IF NOT EXISTS diet_meal_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_day_id UUID NOT NULL REFERENCES diet_template_days(id) ON DELETE CASCADE,
  session_name VARCHAR(100) NOT NULL,
  meal_order INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_diet_meal_sessions_day ON diet_meal_sessions(template_day_id);
CREATE INDEX IF NOT EXISTS idx_diet_meal_sessions_name ON diet_meal_sessions(session_name);

CREATE TABLE IF NOT EXISTS diet_meal_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_session_id UUID NOT NULL REFERENCES diet_meal_sessions(id) ON DELETE CASCADE,
  meal_template_id UUID REFERENCES diet_meal_templates(id) ON DELETE SET NULL,
  food_name VARCHAR(255) NOT NULL,
  quantity VARCHAR(100),
  calories DECIMAL(10, 2),
  protein DECIMAL(10, 2),
  carbs DECIMAL(10, 2),
  fats DECIMAL(10, 2),
  fiber DECIMAL(10, 2),
  sugar DECIMAL(10, 2),
  sodium DECIMAL(10, 2),
  item_order INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_diet_meal_items_session ON diet_meal_items(meal_session_id);

CREATE TABLE IF NOT EXISTS diet_calendar_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_user_id UUID NOT NULL,
  date DATE NOT NULL,
  week_template_id UUID REFERENCES diet_week_templates(id),
  template_day_id UUID REFERENCES diet_template_days(id),
  is_override BOOLEAN DEFAULT FALSE,
  is_rest_day BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(patient_user_id, date)
);
CREATE INDEX IF NOT EXISTS idx_diet_calendar_entries_patient ON diet_calendar_entries(patient_user_id);
CREATE INDEX IF NOT EXISTS idx_diet_calendar_entries_date ON diet_calendar_entries(date);

CREATE TABLE IF NOT EXISTS diet_calendar_meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_entry_id UUID NOT NULL REFERENCES diet_calendar_entries(id) ON DELETE CASCADE,
  session_name VARCHAR(100) NOT NULL,
  meal_order INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_diet_calendar_meals_entry ON diet_calendar_meals(calendar_entry_id);
CREATE INDEX IF NOT EXISTS idx_diet_calendar_meals_name ON diet_calendar_meals(session_name);

CREATE TABLE IF NOT EXISTS diet_calendar_meal_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_meal_id UUID NOT NULL REFERENCES diet_calendar_meals(id) ON DELETE CASCADE,
  meal_template_id UUID REFERENCES diet_meal_templates(id) ON DELETE SET NULL,
  food_name VARCHAR(255) NOT NULL,
  quantity VARCHAR(100),
  calories DECIMAL(10, 2),
  protein DECIMAL(10, 2),
  carbs DECIMAL(10, 2),
  fats DECIMAL(10, 2),
  fiber DECIMAL(10, 2),
  sugar DECIMAL(10, 2),
  sodium DECIMAL(10, 2),
  item_order INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_diet_calendar_meal_items_meal ON diet_calendar_meal_items(calendar_meal_id);

CREATE TABLE IF NOT EXISTS diet_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_user_id UUID NOT NULL,
  calendar_entry_id UUID REFERENCES diet_calendar_entries(id),
  calendar_meal_id UUID REFERENCES diet_calendar_meals(id),
  calendar_meal_item_id UUID REFERENCES diet_calendar_meal_items(id),
  tracked_date DATE NOT NULL,
  tracked_at TIMESTAMPTZ DEFAULT NOW(),
  completion_status VARCHAR(50) DEFAULT 'pending',
  completed_quantity VARCHAR(100),
  completed_calories DECIMAL(10, 2),
  completed_protein DECIMAL(10, 2),
  completed_carbs DECIMAL(10, 2),
  completed_fats DECIMAL(10, 2),
  completed_items_detail JSONB,
  notes TEXT,
  pictures TEXT[],
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_diet_tracking_patient ON diet_tracking(patient_user_id);
CREATE INDEX IF NOT EXISTS idx_diet_tracking_date ON diet_tracking(tracked_date);
CREATE INDEX IF NOT EXISTS idx_diet_tracking_meal ON diet_tracking(calendar_meal_id);

CREATE TABLE IF NOT EXISTS diet_ad_hoc_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_user_id UUID NOT NULL,
  entry_date DATE NOT NULL,
  entry_time TIME,
  session_name VARCHAR(100),
  meal_template_id UUID REFERENCES diet_meal_templates(id) ON DELETE SET NULL,
  food_name VARCHAR(255) NOT NULL,
  quantity VARCHAR(100),
  calories DECIMAL(10, 2),
  protein DECIMAL(10, 2),
  carbs DECIMAL(10, 2),
  fats DECIMAL(10, 2),
  fiber DECIMAL(10, 2),
  sugar DECIMAL(10, 2),
  sodium DECIMAL(10, 2),
  notes TEXT,
  pictures TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_diet_ad_hoc_patient ON diet_ad_hoc_entries(patient_user_id);
CREATE INDEX IF NOT EXISTS idx_diet_ad_hoc_date ON diet_ad_hoc_entries(entry_date);
`;

    await sequelize.query(ddl, { type: QueryTypes.RAW });
    console.log('✅ [DIET] Diet module tables ensured');
  } catch (error: any) {
    console.error('❌ [DIET] Failed to ensure diet tables:', error?.message || error);
    throw error;
  }
}
