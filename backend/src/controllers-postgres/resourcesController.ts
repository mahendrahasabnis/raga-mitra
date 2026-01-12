import { Request, Response } from 'express';
import { QueryTypes, Sequelize } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

const inMemoryResources: any[] = [];

// Create plain Sequelize instances directly (bypass sequelize-typescript model validation)
// We use raw SQL queries, so we don't need the ORM models
const getSharedSequelize = async () => {
  return new Sequelize({
    database: process.env.SHARED_DB_NAME || process.env.DB_NAME || 'platforms_99',
    username: process.env.SHARED_DB_USER || process.env.DB_USER || 'app_user',
    password: process.env.SHARED_DB_PASSWORD || process.env.DB_PASSWORD || 'app_password_2024',
    host: process.env.SHARED_DB_HOST || process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.SHARED_DB_PORT || process.env.DB_PORT || '5432'),
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    dialectOptions: process.env.DB_SSL === 'true' ? {
      ssl: { require: true, rejectUnauthorized: false }
    } : undefined
  } as any);
};

const getAppSequelize = async () => {
  return new Sequelize({
    database: process.env.DB_NAME || 'aarogya_mitra',
    username: process.env.DB_USER || 'app_user',
    password: process.env.DB_PASSWORD || 'app_password_2024',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    dialectOptions: process.env.DB_SSL === 'true' ? {
      ssl: { require: true, rejectUnauthorized: false }
    } : undefined
  } as any);
};

let patientResourcesEnsured = false;
const ensurePatientResourcesTable = async () => {
  if (patientResourcesEnsured) {
    console.log('🔵 [RESOURCES] Table already ensured, skipping');
    return;
  }
  try {
    console.log('🔵 [RESOURCES] Ensuring patient_resources table exists...');
    const appDb = await getAppSequelize();
    console.log('🔵 [RESOURCES] App DB connection obtained');
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
    patientResourcesEnsured = true;
    console.log('✅ [RESOURCES] patient_resources table ensured');
  } catch (err: any) {
    console.error('❌ [RESOURCES] ensurePatientResourcesTable failed:', err.message || err);
    console.error('❌ [RESOURCES] Error stack:', err.stack);
  }
};

export const listResources = async (req: any, res: Response) => {
  console.log('🔵 [RESOURCES] listResources called');
  const patientId = req.user?.id;
  console.log('🔵 [RESOURCES] patientId:', patientId);
  if (!patientId) {
    console.error('❌ [RESOURCES] No patientId, returning 401');
    return res.status(401).json({ message: 'Unauthorized' });
  }
  try {
    await ensurePatientResourcesTable();
    const sequelize = await getAppSequelize();
    console.log('🔵 [RESOURCES] Querying patient_resources for patient:', patientId);
    const queryResult: any = await sequelize.query(
      `SELECT pr.id,
              pr.role,
              pr.access_health,
              pr.access_fitness,
              pr.access_diet,
              pr.resource_user_id,
              pr.resource_phone,
              pr.resource_name
         FROM patient_resources pr
        WHERE pr.patient_user_id = :patient`,
      { replacements: { patient: patientId }, type: QueryTypes.SELECT }
    );
    // Sequelize.query with QueryTypes.SELECT returns [rows, metadata]
    // But when using plain Sequelize (not sequelize-typescript), it might return just rows
    const rows = Array.isArray(queryResult) && queryResult.length === 2 ? queryResult[0] : queryResult;
    // Ensure it's always an array
    const resourcesArray = Array.isArray(rows) ? rows : (rows ? [rows] : []);
    console.log('✅ [RESOURCES] Found', resourcesArray.length, 'resources');
    console.log('🔵 [RESOURCES] Resources:', JSON.stringify(resourcesArray, null, 2));
    return res.json({ resources: resourcesArray });
  } catch (err: any) {
    console.error('❌ [RESOURCES] listResources error:', err.message || err);
    console.error('❌ [RESOURCES] Error stack:', err.stack);
    const rows = inMemoryResources.filter((r) => r.patient_user_id === patientId);
    console.log('🔵 [RESOURCES] Falling back to in-memory resources:', rows.length);
    return res.json({ resources: rows, warning: 'DB unavailable, using in-memory data' });
  }
};

// List patients who added the current user as a resource (for doctor/trainer/dietitian views)
export const listClients = async (req: any, res: Response) => {
  const resourceId = req.user?.id;
  const resourcePhone = req.user?.phone;
  console.log('🔵 [RESOURCES] listClients called');
  console.log('🔵 [RESOURCES] resourceId (logged-in user ID):', resourceId);
  console.log('🔵 [RESOURCES] resourcePhone (logged-in user phone):', resourcePhone);
  if (!resourceId) return res.status(401).json({ message: 'Unauthorized' });
  try {
    await ensurePatientResourcesTable();
    const appDb = await getAppSequelize();
    const sharedDb = await getSharedSequelize();
    
    console.log('🔵 [RESOURCES] Querying patient_resources for resource:', resourceId, resourcePhone);
    // First, get the patient_resources rows
    const queryResult: any = await appDb.query(
      `SELECT pr.id,
              pr.role,
              pr.patient_user_id,
              pr.resource_user_id
         FROM patient_resources pr
        WHERE pr.resource_user_id = :resource
           OR (:rphone IS NOT NULL AND pr.resource_phone = :rphone)`,
      { replacements: { resource: resourceId, rphone: resourcePhone || null }, type: QueryTypes.SELECT }
    );
    console.log('🔵 [RESOURCES] Raw query result:', JSON.stringify(queryResult, null, 2));
    const rows = Array.isArray(queryResult) && queryResult.length === 2 ? queryResult[0] : queryResult;
    const patientResources = Array.isArray(rows) ? rows : (rows ? [rows] : []);
    console.log('🔵 [RESOURCES] Found', patientResources.length, 'patient_resources rows');
    
    // Now fetch patient names and phones from users table
    const clientsArray: any[] = [];
    for (const pr of patientResources) {
      if (!pr.patient_user_id) continue;
      try {
        const [userRows]: any = await sharedDb.query(
          `SELECT id, phone, name FROM users WHERE id = :userId`,
          { replacements: { userId: pr.patient_user_id }, type: QueryTypes.SELECT }
        );
        const userData = Array.isArray(userRows) ? userRows[0] : userRows;
        if (userData) {
          clientsArray.push({
            id: pr.id,
            name: userData.name || '',
            phone: userData.phone || '',
            role: pr.role,
            patient_user_id: pr.patient_user_id
          });
        } else {
          // If user not found, still include with empty name/phone
          clientsArray.push({
            id: pr.id,
            name: '',
            phone: '',
            role: pr.role,
            patient_user_id: pr.patient_user_id
          });
        }
      } catch (err: any) {
        console.warn('⚠️ [RESOURCES] Failed to fetch user data for patient_user_id:', pr.patient_user_id, err.message);
        // Still include the row with empty name/phone
        clientsArray.push({
          id: pr.id,
          name: '',
          phone: '',
          role: pr.role,
          patient_user_id: pr.patient_user_id
        });
      }
    }
    
    console.log('✅ [RESOURCES] Found', clientsArray.length, 'clients');
    console.log('🔵 [RESOURCES] Clients array:', JSON.stringify(clientsArray, null, 2));
    return res.json({ clients: clientsArray });
  } catch (err: any) {
    console.error('❌ [RESOURCES] listClients app query failed:', err.message || err);
    console.error('❌ [RESOURCES] Error stack:', err.stack);
    return res.json({ clients: [] });
  }
};

export const addResource = async (req: any, res: Response) => {
  console.log('🔵 [RESOURCES] addResource called');
  console.log('🔵 [RESOURCES] req.user:', JSON.stringify(req.user, null, 2));
  const patientId = req.user?.id;
  console.log('🔵 [RESOURCES] patientId:', patientId);
  if (!patientId) {
    console.error('❌ [RESOURCES] No patientId, returning 401');
    return res.status(401).json({ message: 'Unauthorized' });
  }
  const { name, phone, role, access_health = true, access_fitness = true, access_diet = true } = req.body || {};
  console.log('🔵 [RESOURCES] Request body:', { name, phone, role, access_health, access_fitness, access_diet });
  if (!phone || !role) {
    console.error('❌ [RESOURCES] Missing phone or role');
    return res.status(400).json({ message: 'phone and role are required' });
  }

  try {
    console.log('🔵 [RESOURCES] Ensuring patient_resources table exists...');
    await ensurePatientResourcesTable();
    console.log('🔵 [RESOURCES] Getting database connections...');
    const shared = await getSharedSequelize();
    const appDb = await getAppSequelize();
    console.log('🔵 [RESOURCES] Database connections obtained');
    const userId = uuidv4();
    console.log('🔵 [RESOURCES] Generated userId:', userId);

    // Upsert user by phone
    console.log('🔵 [RESOURCES] Upserting user in shared DB (platforms_99.users)...');
    // Don't set global_role - let it use the default 'user' or NULL
    // The actual role (Doctor/FitnessTrainer/Dietitian) goes into platform_privileges
    // Generate a placeholder pin_hash for new users (they'll set a real PIN when they register)
    const placeholderPinHash = await bcrypt.hash('TEMP_PLACEHOLDER_' + phone, 10);
    const userReplacements = { id: userId, phone, name: name || phone, pinHash: placeholderPinHash };
    console.log('🔵 [RESOURCES] User replacements:', { id: userId, phone, name: name || phone });
    const [userRows]: any = await shared.query(
      `INSERT INTO users (id, phone, name, pin_hash, is_active)
       VALUES (:id, :phone, :name, :pinHash, true)
       ON CONFLICT (phone) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      { replacements: userReplacements, type: QueryTypes.INSERT }
    );
    console.log('🔵 [RESOURCES] User upsert result:', JSON.stringify(userRows, null, 2));
    const createdUserId = (Array.isArray(userRows) ? userRows[0]?.id : userRows?.id) || userId;
    console.log('🔵 [RESOURCES] Created/resolved userId:', createdUserId);

    // Upsert platform privilege (best-effort)
    try {
      await shared.query(
        `INSERT INTO platform_privileges (id, user_id, platform_name, roles, permissions, is_active)
         VALUES (:id, :user_id, :platform, ARRAY[:role], ARRAY[]::varchar[], true)
         ON CONFLICT (user_id, platform_name)
         DO UPDATE SET roles = EXCLUDED.roles, permissions = EXCLUDED.permissions, is_active = true`,
        { replacements: { id: uuidv4(), user_id: createdUserId, platform: 'aarogya-mitra', role }, type: QueryTypes.INSERT }
      );
    } catch (err: any) {
      console.warn('⚠️ [RESOURCES] platform_privileges upsert failed (continuing):', err.message || err);
    }

    // Insert link into aarogya_mitra.patient_resources
    const linkId = uuidv4();
    console.log('🔵 [RESOURCES] Generated linkId:', linkId);
    const baseInsert = `INSERT INTO patient_resources (id, patient_user_id, resource_user_id, role, access_health, access_fitness, access_diet, resource_phone, resource_name)
                        VALUES (:id, :patient, :resource, :role, :ahealth, :afit, :adiet, :rphone, :rname)
                        ON CONFLICT (patient_user_id, resource_user_id)
                        DO UPDATE SET role = EXCLUDED.role, access_health = EXCLUDED.access_health, access_fitness = EXCLUDED.access_fitness, access_diet = EXCLUDED.access_diet, resource_phone = EXCLUDED.resource_phone, resource_name = EXCLUDED.resource_name
                        RETURNING *`;
    let linkRows: any;
    const linkReplacements = {
      id: linkId,
      patient: patientId,
      resource: createdUserId,
      role,
      ahealth: access_health,
      afit: access_fitness,
      adiet: access_diet,
      rphone: phone,
      rname: name || phone,
    };
    console.log('🔵 [RESOURCES] Attempting to insert into aarogya_mitra.patient_resources...');
    console.log('🔵 [RESOURCES] Link replacements:', JSON.stringify(linkReplacements, null, 2));
    console.log('🔵 [RESOURCES] SQL:', baseInsert);
    try {
      const [rows]: any = await appDb.query(baseInsert, {
        replacements: linkReplacements,
        type: QueryTypes.INSERT
      });
      console.log('✅ [RESOURCES] patient_resources insert successful');
      console.log('🔵 [RESOURCES] Insert result:', JSON.stringify(rows, null, 2));
      linkRows = rows;
    } catch (err: any) {
      console.error('❌ [RESOURCES] patient_resources insert failed in app DB:', err.message || err);
      console.error('❌ [RESOURCES] Error stack:', err.stack);
      // Fallback minimal insert without phone/name
      const [rows]: any = await appDb.query(
        `INSERT INTO patient_resources (id, patient_user_id, resource_user_id, role, access_health, access_fitness, access_diet)
         VALUES (:id, :patient, :resource, :role, :ahealth, :afit, :adiet)
         ON CONFLICT (patient_user_id, resource_user_id)
         DO UPDATE SET role = EXCLUDED.role, access_health = EXCLUDED.access_health, access_fitness = EXCLUDED.access_fitness, access_diet = EXCLUDED.access_diet
         RETURNING *`,
        {
          replacements: {
            id: linkId,
            patient: patientId,
            resource: createdUserId,
            role,
            ahealth: access_health,
            afit: access_fitness,
            adiet: access_diet,
          },
          type: QueryTypes.INSERT
        }
      );
      linkRows = rows;
      console.log('🔵 [RESOURCES] Fallback insert result:', JSON.stringify(rows, null, 2));
    }

    console.log('🔵 [RESOURCES] Processing linkRows...');
    console.log('🔵 [RESOURCES] linkRows type:', Array.isArray(linkRows) ? 'array' : typeof linkRows);
    console.log('🔵 [RESOURCES] linkRows:', JSON.stringify(linkRows, null, 2));
    const resourceLink = Array.isArray(linkRows) ? linkRows[0] : linkRows;
    console.log('🔵 [RESOURCES] Extracted resourceLink:', JSON.stringify(resourceLink, null, 2));
    if (!resourceLink) {
      console.error('❌ [RESOURCES] No resourceLink created, returning 500');
      return res.status(500).json({ message: 'Failed to create resource link in aarogya_mitra.patient_resources' });
    }
    const responseData = { ...resourceLink, phone, name };
    console.log('✅ [RESOURCES] Returning success response:', JSON.stringify(responseData, null, 2));
    return res.json({ resource: responseData });
  } catch (err: any) {
    console.error('❌ [RESOURCES] addResource exception caught:', err.message || err);
    console.error('❌ [RESOURCES] Error stack:', err.stack);
    const item = {
      id: uuidv4(),
      patient_user_id: patientId,
      resource_user_id: uuidv4(),
      phone,
      name: name || phone,
      role,
      access_health,
      access_fitness,
      access_diet,
      created_at: new Date().toISOString(),
    };
    inMemoryResources.push(item);
    return res.json({ resource: item, warning: 'DB unavailable, stored in-memory' });
  }
};
