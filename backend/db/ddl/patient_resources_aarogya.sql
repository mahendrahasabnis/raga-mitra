-- Create patient_resources table in aarogya_mitra (app DB)
-- Run this against the aarogya_mitra database (not platforms_99)
CREATE TABLE IF NOT EXISTS patient_resources (
  id UUID PRIMARY KEY,
  patient_user_id UUID NOT NULL,
  resource_user_id UUID NOT NULL,
  role VARCHAR(64) NOT NULL,
  access_health BOOLEAN DEFAULT TRUE,
  access_fitness BOOLEAN DEFAULT TRUE,
  access_diet BOOLEAN DEFAULT TRUE,
  resource_phone VARCHAR(32),
  resource_name VARCHAR(255),
  patient_phone VARCHAR(32),
  patient_name VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure uniqueness per patient-resource pair
CREATE UNIQUE INDEX IF NOT EXISTS ux_patient_resource
  ON patient_resources (patient_user_id, resource_user_id);

-- Helpful lookup indexes
CREATE INDEX IF NOT EXISTS idx_resource_user_id ON patient_resources (resource_user_id);
CREATE INDEX IF NOT EXISTS idx_resource_phone ON patient_resources (resource_phone);

-- Trigger to update updated_at (optional; only if not already present)
-- CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
-- BEGIN
--   NEW.updated_at = NOW();
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;
--
-- DROP TRIGGER IF EXISTS trg_patient_resources_updated_at ON patient_resources;
-- CREATE TRIGGER trg_patient_resources_updated_at
-- BEFORE UPDATE ON patient_resources
-- FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

