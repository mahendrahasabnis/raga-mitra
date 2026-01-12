import { QueryTypes } from 'sequelize';

let ensured = false;

export const ensurePatientResources = async () => {
  if (ensured) return;
  try {
    const db = await import('../config/database-integrated');
    const appDb = db.appSequelize;
    await appDb.query(`
      CREATE TABLE IF NOT EXISTS patient_resources (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
      CREATE UNIQUE INDEX IF NOT EXISTS ux_patient_resource ON patient_resources (patient_user_id, resource_user_id);
      CREATE INDEX IF NOT EXISTS idx_resource_user_id ON patient_resources (resource_user_id);
      CREATE INDEX IF NOT EXISTS idx_resource_phone ON patient_resources (resource_phone);
    `);
    ensured = true;
    console.log('✅ [RESOURCES] patient_resources ensured in aarogya_mitra');
  } catch (err: any) {
    console.error('⚠️ [RESOURCES] ensurePatientResources failed:', err.message || err);
  }
};

export default ensurePatientResources;
