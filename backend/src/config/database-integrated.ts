import { Sequelize } from 'sequelize-typescript';
import dotenv from 'dotenv';
import path from 'path';
import { sharedModels, initSharedModels } from '../models-shared';

dotenv.config({ path: path.join(__dirname, '../../../.env.integrated') });

// Separate connections:
// - sharedSequelize: platforms_99 (users / platform_privileges)
// - appSequelize: aarogya_mitra (app data)
const baseConfig = {
  dialect: 'postgres' as const,
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  pool: {
    max: parseInt(process.env.DB_POOL_MAX || '10'),
    min: parseInt(process.env.DB_POOL_MIN || '2'),
    acquire: 30000,
    idle: 10000
  },
  dialectOptions: {
    ssl: process.env.DB_SSL === 'true' ? {
      require: true,
      rejectUnauthorized: false
    } : undefined
  }
};

const sharedConfig = {
  host: process.env.SHARED_DB_HOST || process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.SHARED_DB_PORT || process.env.DB_PORT || '5432'),
  database: process.env.SHARED_DB_NAME || process.env.DB_NAME || 'platforms_99',
  username: process.env.SHARED_DB_USER || process.env.DB_USER || 'app_user',
  password: process.env.SHARED_DB_PASSWORD || process.env.DB_PASSWORD || 'app_password_2024',
};

const appConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'aarogya_mitra',
  username: process.env.DB_USER || 'app_user',
  password: process.env.DB_PASSWORD || 'app_password_2024',
};

export const sharedSequelize = new Sequelize({
  database: sharedConfig.database,
  username: sharedConfig.username,
  password: sharedConfig.password,
  host: sharedConfig.host,
  port: sharedConfig.port,
  dialect: baseConfig.dialect,
  logging: baseConfig.logging,
  pool: baseConfig.pool,
  dialectOptions: baseConfig.dialectOptions,
  define: {
    freezeTableName: true,
    underscored: true,
    timestamps: true
  }
} as any);

export const appSequelize = new Sequelize({
  database: appConfig.database,
  username: appConfig.username,
  password: appConfig.password,
  host: appConfig.host,
  port: appConfig.port,
  dialect: baseConfig.dialect,
  logging: baseConfig.logging,
  pool: baseConfig.pool,
  dialectOptions: baseConfig.dialectOptions,
  define: {
    freezeTableName: true,
    underscored: true,
    timestamps: true
  }
} as any);

// Initialize shared models on the shared connection (users / platform_privileges)
initSharedModels(sharedSequelize);
const allShared = [...sharedModels];
if ((sharedSequelize as any).addModels && typeof (sharedSequelize as any).addModels === 'function') {
  (sharedSequelize as any).addModels(allShared);
} else {
  allShared.forEach((Model: any) => {
    if (Model && typeof Model.init === 'function' && !Model.initialized) {
      Model.init(Model.rawAttributes || {}, { sequelize: sharedSequelize });
    }
  });
}
initSharedModels(sharedSequelize);

// For compatibility: default export uses app DB
export const sequelize = appSequelize;
export default appSequelize;

// Test connections
export const testConnection = async (): Promise<boolean> => {
  try {
    await sharedSequelize.authenticate();
    await appSequelize.authenticate();
    console.log('✅ DB connections established');
    console.log(`📊 Shared DB: ${sharedConfig.database} @ ${sharedConfig.host}:${sharedConfig.port}`);
    console.log(`📊 App DB: ${appConfig.database} @ ${appConfig.host}:${appConfig.port}`);
    return true;
  } catch (error) {
    console.error('❌ Unable to connect to database:', error);
    return false;
  }
};

// Sync app DB only (shared DB already exists)
export const syncDatabase = async (force: boolean = false): Promise<void> => {
  try {
    await appSequelize.sync({ force, alter: false });
    console.log(`✅ App database synchronized ${force ? '(forced)' : '(safe mode)'}`);
  } catch (error) {
    console.error('❌ Database sync failed:', error);
    throw error;
  }
};

export const closeConnection = async (): Promise<void> => {
  try {
    await sharedSequelize.close();
    await appSequelize.close();
    console.log('✅ Database connections closed');
  } catch (error) {
    console.error('❌ Error closing database connections:', error);
  }
};
