import { Request, Response } from 'express';

// Lazy get models to avoid initialization issues
const getModels = async () => {
  try {
    const { sequelize } = await import('../config/database-integrated');
    return {
      SharedUser: sequelize?.models?.SharedUser as any,
      PlatformPrivilege: sequelize?.models?.PlatformPrivilege as any
    };
  } catch (err) {
    // Fallback: create a minimal sequelize instance with shared models only
    console.error('⚠️ [USER LOOKUP] Falling back to minimal sequelize:', err);
    try {
      const { Sequelize, DataTypes } = await import('sequelize');
      const fallbackSequelize: any = new Sequelize(
        process.env.DB_NAME || 'platforms_99',
        process.env.DB_USER || 'app_user',
        process.env.DB_PASSWORD || 'app_password_2024',
        {
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '5432'),
          dialect: 'postgres',
          logging: false
        }
      );

      // Minimal model definitions without decorators
      const SharedUser = fallbackSequelize.define('shared_users', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        phone: { type: DataTypes.STRING },
        name: { type: DataTypes.STRING },
        global_role: { type: DataTypes.STRING }
      }, { timestamps: true, underscored: true });

      const PlatformPrivilege = fallbackSequelize.define('platform_privileges', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        user_id: { type: DataTypes.INTEGER },
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
