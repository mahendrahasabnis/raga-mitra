import { Sequelize } from 'sequelize-typescript';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../../.env.integrated') });

// Import all models
import { sharedModels } from '../models-shared';

// PostgreSQL models will use the same database
// Import models but they'll be configured separately
import { 
  HealthcareProvider,
  Clinic,
  Practice,
  DoctorProfile,
  DoctorAssignment,
  DoctorSchedule,
  ReceptionistProfile,
  ReceptionistAssignment,
  Patient,
  Appointment,
  AppointmentWorkflowLog,
  PastVisit,
  UnverifiedDoctor,
  PastPrescription,
  Receipt,
  PastTestResult,
  Pharmacy,
  DiagnosticsCenter,
  MedicinePurchase,
  VitalParameter,
  VitalParameterDefinition
} from '../models-postgres';

// Unified database configuration for platforms_99
// Both user management and application data
const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'platforms_99',
  username: process.env.DB_USER || 'app_user',
  password: process.env.DB_PASSWORD || 'app_password_2024',
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

// Create single Sequelize instance for all models
export const sequelize = new Sequelize({
  ...config,
  define: {
    // Disable foreign key constraints - we use logical relationships via appointment_id
    freezeTableName: true,
    underscored: true,
    timestamps: true
  },
  models: [
    ...sharedModels,
    HealthcareProvider,
    Clinic,
    Practice,
    DoctorProfile,
    DoctorAssignment,
    DoctorSchedule,
    ReceptionistProfile,
    ReceptionistAssignment,
    Patient,
    Appointment,
    AppointmentWorkflowLog,
    PastVisit,
    UnverifiedDoctor,
    PastPrescription,
    Receipt,
    PastTestResult,
    Pharmacy,
    DiagnosticsCenter,
    MedicinePurchase,
    VitalParameter,
    VitalParameterDefinition
  ]
});

// Export as both sharedSequelize and appSequelize for compatibility
export const sharedSequelize = sequelize;
export const appSequelize = sequelize;

// Test connection
export const testConnection = async (): Promise<boolean> => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established (Integrated Mode)');
    console.log(`📊 Database: ${config.database} @ ${config.host}:${config.port}`);
    console.log(`📦 Models loaded: User Management + Aarogya-Mitra`);
    return true;
  } catch (error) {
    console.error('❌ Unable to connect to database:', error);
    return false;
  }
};

// Sync database (create tables if they don't exist)
export const syncDatabase = async (force: boolean = false): Promise<void> => {
  try {
    await sequelize.sync({ force, alter: false });
    console.log(`✅ Database synchronized ${force ? '(forced - all data cleared!)' : '(safe mode)'}`);
  } catch (error) {
    console.error('❌ Database sync failed:', error);
    throw error;
  }
};

// Close connection
export const closeConnection = async (): Promise<void> => {
  try {
    await sequelize.close();
    console.log('✅ Database connection closed');
  } catch (error) {
    console.error('❌ Error closing database connection:', error);
  }
};

export default sequelize;

