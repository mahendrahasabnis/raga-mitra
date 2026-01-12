// Models for shared database (platforms_99)
// These models are defined directly here for the backend to use
import { Model, DataTypes, Optional, Sequelize } from 'sequelize';

// SharedUser model definition
interface SharedUserAttributes {
  id: string;
  phone: string;
  name?: string | null;
  global_role?: string;
  credits?: number;
  pin_hash?: string;
  phone_verified?: boolean;
  is_active?: boolean;
  login_attempts?: number;
  last_login_attempt?: Date | null;
  locked_until?: Date | null;
  created_at?: Date;
  updated_at?: Date;
}

interface SharedUserCreationAttributes extends Optional<SharedUserAttributes, 'id' | 'created_at' | 'updated_at'> {}

export class SharedUser extends Model<SharedUserAttributes, SharedUserCreationAttributes> implements SharedUserAttributes {
  public id!: string;
  public phone!: string;
  public name?: string | null;
  public global_role?: string;
  public credits?: number;
  public pin_hash?: string;
  public phone_verified?: boolean;
  public is_active?: boolean;
  public login_attempts?: number;
  public last_login_attempt?: Date | null;
  public locked_until?: Date | null;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;

  public platforms?: PlatformPrivilege[];
}

// PlatformPrivilege model definition
interface PlatformPrivilegeAttributes {
  id: string;
  user_id: string;
  platform_name: string;
  roles: string[];
  permissions: string[];
  is_active?: boolean;
  created_at?: Date;
  updated_at?: Date;
}

interface PlatformPrivilegeCreationAttributes extends Optional<PlatformPrivilegeAttributes, 'id' | 'created_at' | 'updated_at'> {}

export class PlatformPrivilege extends Model<PlatformPrivilegeAttributes, PlatformPrivilegeCreationAttributes> implements PlatformPrivilegeAttributes {
  public id!: string;
  public user_id!: string;
  public platform_name!: string;
  public roles!: string[];
  public permissions!: string[];
  public is_active?: boolean;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

// Initialize function - models are initialized in database-integrated.ts
export function initSharedModels(sequelize: Sequelize) {
  SharedUser.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: true
    },
    global_role: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'user'
    },
    credits: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    pin_hash: {
      type: DataTypes.STRING,
      allowNull: true
    },
    phone_verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    login_attempts: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    last_login_attempt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    locked_until: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'users',
    timestamps: true,
    underscored: true
  });

  PlatformPrivilege.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    platform_name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    roles: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: []
    },
    permissions: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: []
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    sequelize,
    tableName: 'platform_privileges',
    timestamps: true,
    underscored: true
  });

  // Define associations
  SharedUser.hasMany(PlatformPrivilege, { foreignKey: 'user_id', as: 'platforms' });
  PlatformPrivilege.belongsTo(SharedUser, { foreignKey: 'user_id', as: 'user' });
}

// Export as array for database-integrated.ts
export const sharedModels = [
  SharedUser,
  PlatformPrivilege
];
