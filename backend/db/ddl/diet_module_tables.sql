-- Diet / Nutrition Module Tables
-- Auto-created by backend on startup

-- Weekly Diet Templates
CREATE TABLE IF NOT EXISTS diet_week_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_user_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_diet_week_templates_patient ON diet_week_templates(patient_user_id);
CREATE INDEX IF NOT EXISTS idx_diet_week_templates_active ON diet_week_templates(is_active);

-- Template Days (Mon-Sun, 0-6)
CREATE TABLE IF NOT EXISTS diet_template_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_template_id UUID NOT NULL REFERENCES diet_week_templates(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(week_template_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_diet_template_days_week ON diet_template_days(week_template_id);
CREATE INDEX IF NOT EXISTS idx_diet_template_days_day ON diet_template_days(day_of_week);

-- Meal Sessions (Breakfast, Lunch, Dinner, Snacks)
CREATE TABLE IF NOT EXISTS diet_meal_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_day_id UUID NOT NULL REFERENCES diet_template_days(id) ON DELETE CASCADE,
  meal_type VARCHAR(50) NOT NULL, -- 'breakfast', 'lunch', 'dinner', 'snacks'
  meal_order INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_diet_meal_sessions_day ON diet_meal_sessions(template_day_id);
CREATE INDEX IF NOT EXISTS idx_diet_meal_sessions_type ON diet_meal_sessions(meal_type);

-- Meal Items (food entries in a meal session)
CREATE TABLE IF NOT EXISTS diet_meal_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_session_id UUID NOT NULL REFERENCES diet_meal_sessions(id) ON DELETE CASCADE,
  food_name VARCHAR(255) NOT NULL,
  quantity VARCHAR(100), -- e.g., "1 cup", "200g", "2 slices"
  calories DECIMAL(10, 2),
  protein DECIMAL(10, 2), -- grams
  carbs DECIMAL(10, 2), -- grams
  fats DECIMAL(10, 2), -- grams
  fiber DECIMAL(10, 2), -- grams (optional)
  item_order INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_diet_meal_items_session ON diet_meal_items(meal_session_id);

-- Calendar Entries (actual diet plan for specific dates)
CREATE TABLE IF NOT EXISTS diet_calendar_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_user_id VARCHAR(255) NOT NULL,
  date DATE NOT NULL,
  week_template_id UUID REFERENCES diet_week_templates(id),
  template_day_id UUID REFERENCES diet_template_days(id),
  is_override BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(patient_user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_diet_calendar_entries_patient ON diet_calendar_entries(patient_user_id);
CREATE INDEX IF NOT EXISTS idx_diet_calendar_entries_date ON diet_calendar_entries(date);

-- Calendar Meals (meals for a specific calendar date)
CREATE TABLE IF NOT EXISTS diet_calendar_meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_entry_id UUID NOT NULL REFERENCES diet_calendar_entries(id) ON DELETE CASCADE,
  meal_type VARCHAR(50) NOT NULL,
  meal_order INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_diet_calendar_meals_entry ON diet_calendar_meals(calendar_entry_id);
CREATE INDEX IF NOT EXISTS idx_diet_calendar_meals_type ON diet_calendar_meals(meal_type);

-- Calendar Meal Items (items in a calendar meal)
CREATE TABLE IF NOT EXISTS diet_calendar_meal_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_meal_id UUID NOT NULL REFERENCES diet_calendar_meals(id) ON DELETE CASCADE,
  food_name VARCHAR(255) NOT NULL,
  quantity VARCHAR(100),
  calories DECIMAL(10, 2),
  protein DECIMAL(10, 2),
  carbs DECIMAL(10, 2),
  fats DECIMAL(10, 2),
  fiber DECIMAL(10, 2),
  item_order INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_diet_calendar_meal_items_meal ON diet_calendar_meal_items(calendar_meal_id);

-- Tracking (completion tracking for meals)
CREATE TABLE IF NOT EXISTS diet_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_user_id VARCHAR(255) NOT NULL,
  calendar_entry_id UUID REFERENCES diet_calendar_entries(id),
  calendar_meal_id UUID REFERENCES diet_calendar_meals(id),
  calendar_meal_item_id UUID REFERENCES diet_calendar_meal_items(id),
  tracked_date DATE NOT NULL,
  tracked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completion_status VARCHAR(50) DEFAULT 'pending', -- 'completed', 'partial', 'skipped'
  actual_quantity VARCHAR(100),
  notes TEXT,
  pictures TEXT[], -- Array of picture URLs
  rating INTEGER CHECK (rating >= 1 AND rating <= 5), -- Optional rating 1-5
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_diet_tracking_patient ON diet_tracking(patient_user_id);
CREATE INDEX IF NOT EXISTS idx_diet_tracking_date ON diet_tracking(tracked_date);
CREATE INDEX IF NOT EXISTS idx_diet_tracking_meal ON diet_tracking(calendar_meal_id);

-- Ad-hoc Entries (meals logged outside of template)
CREATE TABLE IF NOT EXISTS diet_ad_hoc_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_user_id VARCHAR(255) NOT NULL,
  entry_date DATE NOT NULL,
  entry_time TIME,
  meal_type VARCHAR(50),
  food_name VARCHAR(255) NOT NULL,
  quantity VARCHAR(100),
  calories DECIMAL(10, 2),
  protein DECIMAL(10, 2),
  carbs DECIMAL(10, 2),
  fats DECIMAL(10, 2),
  fiber DECIMAL(10, 2),
  notes TEXT,
  pictures TEXT[],
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_diet_ad_hoc_patient ON diet_ad_hoc_entries(patient_user_id);
CREATE INDEX IF NOT EXISTS idx_diet_ad_hoc_date ON diet_ad_hoc_entries(entry_date);
