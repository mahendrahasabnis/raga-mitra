import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { QueryTypes } from 'sequelize';
import bcrypt from 'bcrypt';

const getAppSequelize = async () => {
  const { Sequelize } = await import('sequelize');
  return new Sequelize(
    process.env.DB_NAME || 'aarogya_mitra',
    process.env.DB_USER || 'app_user',
    process.env.DB_PASSWORD || 'app_password_2024',
    {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      dialect: 'postgres',
      logging: false,
    }
  );
};

const getSharedSequelize = async () => {
  const { Sequelize } = await import('sequelize');
  return new Sequelize(
    process.env.SHARED_DB_NAME || 'platforms_99',
    process.env.SHARED_DB_USER || process.env.DB_USER || 'postgres',
    process.env.SHARED_DB_PASSWORD || process.env.DB_PASSWORD || '',
    {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      dialect: 'postgres',
      logging: false,
    }
  );
};

export const listResources = async (req: any, res: Response) => {
  const userId = req.user?.id;
  const userPhone = req.user?.phone;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const sequelize = await getAppSequelize();
    await ensurePatientResourcesTable();

    console.log(`🔍 [RESOURCES] listResources: userId=${userId}, userPhone=${userPhone}, user object:`, JSON.stringify(req.user, null, 2));
    
    // First, let's check if we can find the user by phone in the shared DB to get their actual user ID
    const sharedSequelize = await getSharedSequelize();
    const usersByPhone: any = await sharedSequelize.query(
      `SELECT id, phone, name FROM users WHERE phone = :phone LIMIT 1`,
      { replacements: { phone: userPhone }, type: QueryTypes.SELECT }
    );
    
    const actualUserId = Array.isArray(usersByPhone) && usersByPhone.length > 0 ? usersByPhone[0].id : userId;
    console.log(`🔍 [RESOURCES] listResources: actualUserId from DB=${actualUserId}, userId from token=${userId}`);
    
    // Also check what patient_user_id values exist in patient_resources for debugging
    const allResources: any = await sequelize.query(
      `SELECT patient_user_id, resource_name, resource_phone, COUNT(*) as count 
       FROM patient_resources 
       GROUP BY patient_user_id, resource_name, resource_phone 
       LIMIT 10`,
      { type: QueryTypes.SELECT }
    );
    console.log(`🔍 [RESOURCES] Sample patient_user_id values in DB:`, JSON.stringify(allResources, null, 2));
    
    const resources: any = await sequelize.query(
      `SELECT * FROM patient_resources WHERE patient_user_id = :userId ORDER BY created_at DESC`,
      { replacements: { userId: actualUserId }, type: QueryTypes.SELECT }
    );

    const resourcesArray = Array.isArray(resources) ? resources : [];
    console.log(`✅ [RESOURCES] listResources: Found ${resourcesArray.length} resources for userId=${actualUserId}`);
    if (resourcesArray.length > 0) {
      console.log(`✅ [RESOURCES] Resources found:`, JSON.stringify(resourcesArray.map((r: any) => ({ id: r.id, resource_name: r.resource_name, resource_phone: r.resource_phone })), null, 2));
    }
    
    return res.json({ resources: resourcesArray });
  } catch (err: any) {
    console.error('❌ [RESOURCES] listResources error:', err.message || err);
    console.error('❌ [RESOURCES] Stack:', err.stack);
    return res.status(500).json({ message: err.message || 'Internal server error' });
  }
};

export const addResource = async (req: any, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const { name, phone, roles } = req.body || {};
    // Support both single role (backward compatibility) and roles array
    const rolesArray = Array.isArray(roles) ? roles : (roles ? [roles] : (req.body?.role ? [req.body.role] : []));

    if (!name || !phone || rolesArray.length === 0) {
      return res.status(400).json({ message: 'name, phone, and at least one role are required' });
    }

    const sequelize = await getAppSequelize();
    await ensurePatientResourcesTable();

    const sharedSequelize = await getSharedSequelize();

    // Normalize phone (ensure it starts with +)
    const normalizedPhone = phone.startsWith('+') ? phone : `+${phone}`;

    // Check if user exists in platforms_99.users, create if doesn't exist
    const existingUsers: any = await sharedSequelize.query(
      `SELECT id, name FROM users WHERE phone = :phone LIMIT 1`,
      { replacements: { phone: normalizedPhone }, type: QueryTypes.SELECT }
    );

    let resourceUserId: string;
    if (existingUsers && Array.isArray(existingUsers) && existingUsers.length > 0) {
      // User exists, use their ID
      resourceUserId = existingUsers[0].id;
      console.log(`✅ [RESOURCES] Using existing user ${resourceUserId} for phone ${normalizedPhone}`);
    } else {
      // User doesn't exist, create them
      const newUserId = uuidv4();
      const pinHash = await bcrypt.hash('1234', 10); // Default PIN

      try {
        await sharedSequelize.query(
          `INSERT INTO users (id, phone, name, pin_hash, created_at, updated_at)
           VALUES (:id, :phone, :name, :pinHash, NOW(), NOW())`,
          {
            replacements: {
              id: newUserId,
              phone: normalizedPhone,
              name,
              pinHash,
            },
            type: QueryTypes.INSERT,
          }
        );
        resourceUserId = newUserId;
        console.log(`✅ [RESOURCES] Created new user ${resourceUserId} for phone ${normalizedPhone}`);
      } catch (insertErr: any) {
        // If user already exists (race condition or unique constraint violation), fetch the existing user
        if (insertErr.message?.includes('unique') || insertErr.name === 'SequelizeUniqueConstraintError' || insertErr.code === '23505') {
          console.log(`⚠️ [RESOURCES] User creation failed (already exists), fetching existing user for phone ${normalizedPhone}`);
          const retryUsers: any = await sharedSequelize.query(
            `SELECT id, name FROM users WHERE phone = :phone LIMIT 1`,
            { replacements: { phone: normalizedPhone }, type: QueryTypes.SELECT }
          );
          if (retryUsers && Array.isArray(retryUsers) && retryUsers.length > 0) {
            resourceUserId = retryUsers[0].id;
            console.log(`✅ [RESOURCES] Using existing user ${resourceUserId} for phone ${normalizedPhone} (after retry)`);
          } else {
            throw insertErr;
          }
        } else {
          throw insertErr;
        }
      }
    }

    // Add/update roles in platform_privileges for aarogya-mitra platform
    const platformName = 'aarogya-mitra';
    const existingPrivileges: any = await sharedSequelize.query(
      `SELECT id, roles FROM platform_privileges WHERE user_id = :userId AND platform_name = :platformName LIMIT 1`,
      {
        replacements: { userId: resourceUserId, platformName },
        type: QueryTypes.SELECT,
      }
    );

    if (existingPrivileges && Array.isArray(existingPrivileges) && existingPrivileges.length > 0) {
      // Update existing privilege - merge roles
      const existingRoles = existingPrivileges[0].roles || [];
      // Handle both array and JSON string formats
      const existingRolesArray = Array.isArray(existingRoles) 
        ? existingRoles 
        : (typeof existingRoles === 'string' ? JSON.parse(existingRoles) : []);
      const mergedRoles = Array.from(new Set([...existingRolesArray, ...rolesArray]));
      // Format as PostgreSQL array literal: '{value1,value2}'
      const arrayLiteral = `{${mergedRoles.map(r => `"${r}"`).join(',')}}`;
      await sharedSequelize.query(
        `UPDATE platform_privileges SET roles = :roles::text[], updated_at = NOW() WHERE id = :id`,
        {
          replacements: {
            id: existingPrivileges[0].id,
            roles: arrayLiteral,
          },
          type: QueryTypes.UPDATE,
        }
      );
      console.log(`✅ [RESOURCES] Updated platform_privileges with roles: ${mergedRoles.join(', ')}`);
    } else {
      // Create new privilege
      // Format as PostgreSQL array literal: '{value1,value2}'
      const arrayLiteral = `{${rolesArray.map(r => `"${r}"`).join(',')}}`;
      await sharedSequelize.query(
        `INSERT INTO platform_privileges (user_id, platform_name, roles, permissions, is_active, created_at, updated_at)
         VALUES (:userId, :platformName, :roles::text[], :permissions::jsonb, TRUE, NOW(), NOW())`,
        {
          replacements: {
            userId: resourceUserId,
            platformName,
            roles: arrayLiteral,
            permissions: JSON.stringify([]),
          },
          type: QueryTypes.INSERT,
        }
      );
      console.log(`✅ [RESOURCES] Created platform_privileges with roles: ${rolesArray.join(', ')}`);
    }

    // Upsert in patient_resources (store roles as JSONB)
    await sequelize.query(
      `INSERT INTO patient_resources (id, patient_user_id, resource_user_id, roles, resource_name, resource_phone, access_health, access_fitness, access_diet, created_at, updated_at)
       VALUES (:id, :patientUserId, :resourceUserId, :roles, :resourceName, :resourcePhone, TRUE, TRUE, TRUE, NOW(), NOW())
       ON CONFLICT (patient_user_id, resource_user_id) DO UPDATE SET
         roles = EXCLUDED.roles,
         resource_name = EXCLUDED.resource_name,
         resource_phone = EXCLUDED.resource_phone,
         updated_at = NOW()`,
      {
        replacements: {
          id: uuidv4(),
          patientUserId: userId,
          resourceUserId,
          roles: JSON.stringify(rolesArray),
          resourceName: name,
          resourcePhone: normalizedPhone,
        },
        type: QueryTypes.INSERT,
      }
    );

    const resources: any = await sequelize.query(
      `SELECT * FROM patient_resources WHERE patient_user_id = :userId ORDER BY created_at DESC`,
      { replacements: { userId }, type: QueryTypes.SELECT }
    );

    return res.json({ resources: Array.isArray(resources) ? resources : [] });
  } catch (err: any) {
    console.error('❌ [RESOURCES] addResource error:', err.message || err);
    console.error('❌ [RESOURCES] Error name:', err.name);
    console.error('❌ [RESOURCES] Error code:', err.code);
    console.error('❌ [RESOURCES] Error detail:', err.detail);
    console.error('❌ [RESOURCES] Error errors:', err.errors);
    console.error('❌ [RESOURCES] Error original:', err.original);
    console.error('❌ [RESOURCES] Full error object:', JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
    console.error('❌ [RESOURCES] Stack:', err.stack);
    const errorMessage = err.message || err.detail || err.errors?.[0]?.message || err.original?.message || 'Internal server error';
    return res.status(500).json({ message: errorMessage, details: err.detail || err.errors || err.original });
  }
};

export const updateResourceAccess = async (req: any, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const { id } = req.params;
    const { access_health, access_fitness, access_diet, roles } = req.body || {};

    const sequelize = await getAppSequelize();
    await ensurePatientResourcesTable();

    const updates: string[] = [];
    const params: any = { id, userId };

    if (access_health !== undefined) {
      updates.push('access_health = :accessHealth');
      params.accessHealth = access_health;
    }
    if (access_fitness !== undefined) {
      updates.push('access_fitness = :accessFitness');
      params.accessFitness = access_fitness;
    }
    if (access_diet !== undefined) {
      updates.push('access_diet = :accessDiet');
      params.accessDiet = access_diet;
    }
    if (roles !== undefined && Array.isArray(roles)) {
      updates.push('roles = :roles::jsonb');
      params.roles = JSON.stringify(roles);
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: 'No updates provided' });
    }

    updates.push('updated_at = NOW()');

    const sql = `UPDATE patient_resources SET ${updates.join(', ')} WHERE id = :id AND patient_user_id = :userId RETURNING *`;
    const result: any = await sequelize.query(sql, { replacements: params, type: QueryTypes.SELECT });

    const rows = Array.isArray(result) && result.length === 2 ? result[0] : result;
    const updatedResource = Array.isArray(rows) ? rows[0] : rows;

    if (!updatedResource) {
      return res.status(404).json({ message: 'Resource not found' });
    }

    // If roles were updated, also update platform_privileges
    if (roles !== undefined && Array.isArray(roles)) {
      const sharedSequelize = await getSharedSequelize();
      const resourceRows: any = await sequelize.query(
        `SELECT resource_user_id FROM patient_resources WHERE id = :id LIMIT 1`,
        { replacements: { id }, type: QueryTypes.SELECT }
      );
      if (resourceRows && Array.isArray(resourceRows) && resourceRows.length > 0) {
        const resourceUserId = resourceRows[0].resource_user_id;
        const platformName = 'aarogya-mitra';
        const existingPrivileges: any = await sharedSequelize.query(
          `SELECT id, roles FROM platform_privileges WHERE user_id = :userId AND platform_name = :platformName LIMIT 1`,
          {
            replacements: { userId: resourceUserId, platformName },
            type: QueryTypes.SELECT,
          }
        );
        if (existingPrivileges && Array.isArray(existingPrivileges) && existingPrivileges.length > 0) {
          // Format as PostgreSQL array literal: '{value1,value2}'
          const arrayLiteral = `{${roles.map(r => `"${r}"`).join(',')}}`;
          await sharedSequelize.query(
            `UPDATE platform_privileges SET roles = :roles::text[], updated_at = NOW() WHERE id = :id`,
            {
              replacements: {
                id: existingPrivileges[0].id,
                roles: arrayLiteral,
              },
              type: QueryTypes.UPDATE,
            }
          );
        }
      }
    }

    return res.json({ resource: updatedResource });
  } catch (err: any) {
    console.error('❌ [RESOURCES] updateResourceAccess error:', err.message || err);
    console.error('❌ [RESOURCES] Stack:', err.stack);
    return res.status(500).json({ message: err.message || 'Internal server error' });
  }
};

export const deleteResource = async (req: any, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const { id } = req.params;

    const sequelize = await getAppSequelize();
    await ensurePatientResourcesTable();

    const result: any = await sequelize.query(
      `DELETE FROM patient_resources WHERE id = :id AND patient_user_id = :userId RETURNING *`,
      { replacements: { id, userId }, type: QueryTypes.DELETE }
    );

    const rows = Array.isArray(result) && result.length === 2 ? result[0] : result;
    const deletedResource = Array.isArray(rows) ? rows[0] : rows;

    if (!deletedResource) {
      return res.status(404).json({ message: 'Resource not found' });
    }

    return res.json({ message: 'Resource deleted successfully' });
  } catch (err: any) {
    console.error('❌ [RESOURCES] deleteResource error:', err.message || err);
    console.error('❌ [RESOURCES] Stack:', err.stack);
    return res.status(500).json({ message: err.message || 'Internal server error' });
  }
};

export const listClients = async (req: any, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const sequelize = await getAppSequelize();
    await ensurePatientResourcesTable();

    const sharedSequelize = await getSharedSequelize();

    // Get all patients who have added this user as a resource
    const rows: any = await sequelize.query(
      `SELECT DISTINCT patient_user_id
       FROM patient_resources
       WHERE resource_user_id = :userId`,
      {
        replacements: { userId },
        type: QueryTypes.SELECT,
      }
    );

    // Fetch patient names and phones from shared DB
    const clients = [];
    const rowsArray = Array.isArray(rows) ? rows : [];
    for (const row of rowsArray) {
      if (!row || !row.patient_user_id) continue;
      
      const patientUsers: any = await sharedSequelize.query(
        `SELECT id, name, phone FROM users WHERE id = :patientUserId LIMIT 1`,
        {
          replacements: { patientUserId: row.patient_user_id },
          type: QueryTypes.SELECT,
        }
      );

      const patient = Array.isArray(patientUsers) && patientUsers.length > 0 ? patientUsers[0] : null;
      if (patient) {
        clients.push({
          id: patient.id,
          name: patient.name || 'Unknown',
          phone: patient.phone || 'Unknown',
        });
      }
    }

    return res.json({ clients: clients || [] });
  } catch (err: any) {
    console.error('❌ [RESOURCES] listClients error:', err.message || err);
    console.error('❌ [RESOURCES] listClients stack:', err.stack);
    return res.status(500).json({ message: err.message || 'Internal server error' });
  }
};

async function ensurePatientResourcesTable() {
  try {
    const sequelize = await getAppSequelize();
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS patient_resources (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_user_id UUID NOT NULL,
        resource_user_id UUID NOT NULL,
        role VARCHAR(64),
        roles JSONB DEFAULT '[]'::jsonb NOT NULL,
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
    // Migration: Make role nullable and add roles column if it doesn't exist
    await sequelize.query(`
      DO $$ 
      BEGIN
        -- Make role nullable (for existing tables)
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patient_resources' AND column_name = 'role' AND is_nullable = 'NO') THEN
          ALTER TABLE patient_resources ALTER COLUMN role DROP NOT NULL;
        END IF;
        -- Add roles column if it doesn't exist (for existing tables)
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patient_resources' AND column_name = 'roles') THEN
          ALTER TABLE patient_resources ADD COLUMN roles JSONB DEFAULT '[]'::jsonb NOT NULL;
        END IF;
      END $$;
    `);
  } catch (err: any) {
    console.error('⚠️ [RESOURCES] Failed to ensure table (non-fatal):', err.message || err);
    // Don't throw - table might already exist or be created by migration
  }
}
