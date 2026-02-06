import { Request, Response } from 'express';
import { Op, QueryTypes } from 'sequelize';

// Lazy get models to avoid initialization issues
const getModels = async () => {
  try {
    const { sharedSequelize } = await import('../config/database-integrated');
    return {
      SharedUser: sharedSequelize?.models?.SharedUser as any,
      PlatformPrivilege: sharedSequelize?.models?.PlatformPrivilege as any
    };
  } catch (err) {
    // Fallback: create a minimal sequelize instance with shared models only
    console.error('⚠️ [USER LOOKUP] Falling back to minimal sequelize:', err);
    try {
      const { Sequelize, DataTypes } = await import('sequelize');
      const fallbackSequelize: any = new Sequelize(
        process.env.SHARED_DB_NAME || process.env.DB_NAME || 'platforms_99',
        process.env.SHARED_DB_USER || process.env.DB_USER || 'app_user',
        process.env.SHARED_DB_PASSWORD || process.env.DB_PASSWORD || 'app_password_2024',
        {
          host: process.env.SHARED_DB_HOST || process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.SHARED_DB_PORT || process.env.DB_PORT || '5432'),
          dialect: 'postgres',
          logging: false
        }
      );

      // Minimal model definitions without decorators
      const SharedUser = fallbackSequelize.define('shared_users', {
        id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
        phone: { type: DataTypes.STRING },
        name: { type: DataTypes.STRING },
        global_role: { type: DataTypes.STRING }
      }, { timestamps: true, underscored: true });

      const PlatformPrivilege = fallbackSequelize.define('platform_privileges', {
        id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
        user_id: { type: DataTypes.UUID },
        platform_name: { type: DataTypes.STRING },
        roles: { type: DataTypes.JSONB },
        permissions: { type: DataTypes.JSONB }
      }, { timestamps: true, underscored: true });

      SharedUser.hasMany(PlatformPrivilege, { foreignKey: 'user_id', as: 'platforms' });
      PlatformPrivilege.belongsTo(SharedUser, { foreignKey: 'user_id', as: 'user' });

      return { SharedUser, PlatformPrivilege };
    } catch (fallbackErr) {
      console.error('❌ [USER LOOKUP] Fallback sequelize failed:', fallbackErr);
      return { SharedUser: null, PlatformPrivilege: null };
    }
  }
};

// Get user by phone number (for login lookup)
export const getByPhone = async (req: Request, res: Response) => {
  try {
    const { phone } = req.params;

    if (!phone) {
      return res.status(400).json({ message: 'Phone number is required' });
    }

    // Get models (lazy load to avoid initialization issues)
    const { SharedUser, PlatformPrivilege } = await getModels();
    if (!SharedUser) {
      console.error('❌ [USER LOOKUP] SharedUser model not available');
      return res.status(503).json({ message: 'Service initializing, please retry' });
    }

    // Build query safely even if PlatformPrivilege isn't available
    const query: any = { where: { phone } };
    if (PlatformPrivilege) {
      query.include = [{ model: PlatformPrivilege, as: 'platforms' }];
    }

    // Find user in shared database
    let user;
    try {
      user = await SharedUser.findOne(query);
    } catch (err: any) {
      if (err?.message && err.message.includes('relation "shared_users" does not exist')) {
        console.error('⚠️ [USER LOOKUP] shared_users table missing; service initializing');
        return res.status(503).json({ message: 'Service initializing, please retry' });
      }
      throw err;
    }

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get user's actual name from profile tables
    let userName = user.name;
    if (!userName) {
      // Check doctor profile (not yet implemented)
      // const DoctorProfile = sequelize.models.DoctorProfile as any;
      // if (DoctorProfile) {
      //   const doctorProfile = await DoctorProfile.findOne({
      //     where: { user_id: user.id, is_active: true }
      //   });
      //   if (doctorProfile) {
      //     userName = doctorProfile.name;
      //   }
      // }

      // Check receptionist profile (not yet implemented)
      // const ReceptionistProfile = sequelize.models.ReceptionistProfile as any;
      // if (!userName && ReceptionistProfile) {
      //   const receptionistProfile = await ReceptionistProfile.findOne({
      //     where: { user_id: user.id, is_active: true }
      //   });
      //   if (receptionistProfile) {
      //     userName = receptionistProfile.name;
      //   }
      // }

      // Check patient profile (Patient model not yet implemented)
      // if (!userName) {
      //   const Patient = sequelize.models.Patient as any;
      //   if (Patient) {
      //     const patient = await Patient.findOne({
      //       where: { user_id: user.id, is_active: true }
      //     });
      //     if (patient) {
      //       userName = patient.name;
      //     }
      //   }
      // }
    }

    // Extract aarogya-mitra platform privileges
    const aarogyaPrivilege = user.platforms?.find((p: any) => p.platform_name === 'aarogya-mitra');
    const roles = aarogyaPrivilege?.roles || [];
    const permissions = aarogyaPrivilege?.permissions || [];

    // Transform platforms to privileges for frontend compatibility
    const privileges = user.platforms?.map((p: any) => ({
      platform: p.platform_name,
      roles: p.roles,
      permissions: p.permissions
    })) || [];

    res.json({
      user: {
        id: user.id,
        phone: user.phone,
        name: userName || user.phone || 'User',
        platform: 'aarogya-mitra',
        role: user.global_role,
        privileges: privileges,
        roles: roles.length > 0 ? roles : (user.global_role ? [user.global_role] : [])
      }
    });
  } catch (error: any) {
    console.error('❌ [USER LOOKUP] Error:', error);
    res.status(500).json({ message: 'Failed to lookup user', error: error.message });
  }
};

export const searchUsers = async (req: Request, res: Response) => {
  try {
    const searchTerm = String(req.query.searchTerm || req.query.search || '').trim();
    if (!searchTerm) {
      return res.json({ users: [] });
    }

    const { SharedUser, PlatformPrivilege } = await getModels();
    if (!SharedUser) {
      console.error('❌ [USER SEARCH] SharedUser model not available');
      return res.status(503).json({ message: 'Service initializing, please retry' });
    }

    const query: any = {
      where: {
        [Op.or]: [
          { name: { [Op.iLike]: `%${searchTerm}%` } },
          { phone: { [Op.iLike]: `%${searchTerm}%` } }
        ]
      },
      limit: 20,
      order: [['updated_at', 'DESC']]
    };

    if (PlatformPrivilege) {
      query.include = [{ model: PlatformPrivilege, as: 'platforms', required: false }];
    }

    const users = await SharedUser.findAll(query);
    const payload = users.map((u: any) => ({
      id: u.id,
      name: u.name || u.phone,
      phone: u.phone,
      role: u.global_role || null,
      privileges: u.platforms || []
    }));

    return res.json({ users: payload });
  } catch (error: any) {
    console.error('❌ [USER SEARCH] Error:', error);
    res.status(500).json({ message: 'Failed to search users', error: error.message });
  }
};

export const searchDoctors = async (req: Request, res: Response) => {
  try {
    const searchTerm = String(req.query.searchTerm || req.query.search || '').trim();
    if (!searchTerm) {
      return res.json({ users: [] });
    }

    const { SharedUser, PlatformPrivilege } = await getModels();
    if (!SharedUser) {
      console.error('❌ [DOCTOR SEARCH] SharedUser model not available');
      return res.status(503).json({ message: 'Service initializing, please retry' });
    }

    try {
      const { sharedSequelize } = await import('../config/database-integrated');
      const [rows]: any = await sharedSequelize.query(
        `SELECT DISTINCT ON (u.id)
           u.id,
           u.name,
           u.phone,
           u.global_role
         FROM users u
         LEFT JOIN platform_privileges p
           ON u.id = p.user_id
          AND p.platform_name = 'aarogya-mitra'
         WHERE (u.name ILIKE :search OR u.phone ILIKE :search)
           AND (
             LOWER(COALESCE(u.global_role, '')) = 'doctor'
             OR (
               p.roles IS NOT NULL
               AND LOWER(COALESCE(p.roles::text, '')) LIKE '%doctor%'
             )
           )
         ORDER BY u.id, u.updated_at DESC
         LIMIT 20`,
        {
          replacements: { search: `%${searchTerm}%` },
          type: QueryTypes.SELECT,
        }
      );

      const list = (Array.isArray(rows) ? rows : []).map((u: any) => ({
        id: u.id,
        name: u.name || u.phone,
        phone: u.phone,
        role: u.global_role || null,
        is_doctor: true,
        platform_roles: ['doctor']
      }));
      return res.json({ users: list });
    } catch (rawErr: any) {
      console.warn('⚠️ [DOCTOR SEARCH] Raw query failed, falling back:', rawErr?.message || rawErr);
    }

    const baseQuery: any = {
      where: {
        [Op.or]: [
          { name: { [Op.iLike]: `%${searchTerm}%` } },
          { phone: { [Op.iLike]: `%${searchTerm}%` } }
        ]
      },
      limit: 20,
      order: [['updated_at', 'DESC']]
    };

    if (PlatformPrivilege) {
      baseQuery.include = [{ model: PlatformPrivilege, as: 'platforms', required: false }];
    }

    const users = await SharedUser.findAll(baseQuery);
    const doctors = users.filter((u: any) => {
      if ((u.global_role || '').toLowerCase() === 'doctor') return true;
      const platforms = u.platforms || [];
      return platforms.some((p: any) =>
        String(p.platform_name || '').toLowerCase() === 'aarogya-mitra' &&
        Array.isArray(p.roles) &&
        p.roles.some((r: string) => String(r).toLowerCase() === 'doctor')
      );
    });

    const list = doctors.map((u: any) => {
      const platforms = u.platforms || [];
      const aarogya = platforms.find((p: any) =>
        String(p.platform_name || '').toLowerCase() === 'aarogya-mitra'
      );
      const roles = Array.isArray(aarogya?.roles) ? aarogya.roles : [];
      return {
        id: u.id,
        name: u.name || u.phone,
        phone: u.phone,
        role: u.global_role || null,
        is_doctor: true,
        platform_roles: roles.length > 0 ? roles : ['doctor']
      };
    });

    return res.json({ users: list });
  } catch (error: any) {
    console.error('❌ [DOCTOR SEARCH] Error:', error);
    res.status(500).json({ message: 'Failed to search doctors', error: error.message });
  }
};

export const createOrGetDoctor = async (req: Request, res: Response) => {
  try {
    const phone = String(req.body?.phone || '').trim();
    const name = String(req.body?.name || '').trim();

    if (!phone) {
      return res.status(400).json({ message: 'Phone number is required' });
    }

    const { SharedUser, PlatformPrivilege } = await getModels();
    if (!SharedUser) {
      console.error('❌ [DOCTOR CREATE] SharedUser model not available');
      return res.status(503).json({ message: 'Service initializing, please retry' });
    }

    let user = await SharedUser.findOne({ where: { phone } });
    if (!user) {
      const displayName = name || phone;
      user = await SharedUser.create({
        phone,
        name: displayName,
        global_role: 'doctor',
        phone_verified: false,
        is_active: true
      });
    } else {
      const currentRole = (user.global_role || '').toLowerCase();
      if (currentRole !== 'doctor') {
        await user.update({ global_role: 'doctor', name: name || user.name || phone });
      }
    }

    if (PlatformPrivilege) {
      try {
        const existingPriv = await PlatformPrivilege.findOne({
          where: { user_id: user.id, platform_name: 'aarogya-mitra' }
        });
        if (!existingPriv) {
          await PlatformPrivilege.create({
            user_id: user.id,
            platform_name: 'aarogya-mitra',
            roles: ['doctor'],
            permissions: [],
            is_active: true
          });
        } else {
          const roles = Array.isArray(existingPriv.roles) ? existingPriv.roles : [];
          if (!roles.some((r: string) => String(r).toLowerCase() === 'doctor')) {
            await existingPriv.update({ roles: [...roles, 'doctor'] });
          }
        }
      } catch (e: any) {
        console.warn('⚠️ [DOCTOR CREATE] Failed to ensure platform privilege:', e?.message || e);
      }
    }

    return res.json({
      user: {
        id: user.id,
        name: user.name || user.phone,
        phone: user.phone,
        role: user.global_role || null
      }
    });
  } catch (error: any) {
    console.error('❌ [DOCTOR CREATE] Error:', error);
    res.status(500).json({ message: 'Failed to create doctor', error: error.message });
  }
};
