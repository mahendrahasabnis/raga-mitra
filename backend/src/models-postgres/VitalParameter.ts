import { Table, Column, Model, DataType, ForeignKey, CreatedAt, UpdatedAt, PrimaryKey, Default, AllowNull, Index } from 'sequelize-typescript';
// import { Patient } from './Patient'; // Not yet implemented

export interface IVitalParameterValue {
  parameter_name: string;
  value: number | string;
  unit: string;
  date: string; // ISO date string
  time?: string; // Optional time if available
  normal_range_min?: number;
  normal_range_max?: number;
  is_abnormal?: boolean;
  test_name?: string;
  test_result_id?: string; // Reference to PastTestResult if from test report
}

@Table({
  tableName: 'vital_parameters',
  timestamps: true,
  underscored: true
})
export class VitalParameter extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id!: string;

  // @ForeignKey(() => Patient) // Patient model not yet implemented
  @AllowNull(false)
  @Column(DataType.UUID)
  patient_id!: string;

  @AllowNull(false)
  @Column(DataType.STRING(100))
  parameter_name!: string; // e.g., "Weight", "HbA1c", "Fasting Blood Sugar", "Blood Pressure"

  @AllowNull(false)
  @Column(DataType.DECIMAL(10, 2))
  value!: number; // Numeric value for the parameter

  @Column(DataType.STRING(50))
  unit?: string; // e.g., "kg", "%", "mg/dL", "mmHg"

  @AllowNull(false)
  @Index
  @Column(DataType.DATE)
  recorded_date!: Date; // Date when parameter was recorded

  @Column(DataType.TIME)
  recorded_time?: string; // Optional time component

  @Column(DataType.DECIMAL(10, 2))
  normal_range_min?: number; // Lower bound of normal range

  @Column(DataType.DECIMAL(10, 2))
  normal_range_max?: number; // Upper bound of normal range

  @Column(DataType.STRING(50))
  category?: string; // 'general', 'diabetes', 'hypertension', 'cardiac', etc.

  @Column(DataType.STRING(100))
  subcategory?: string; // 'blood_sugar', 'lipid_profile', 'liver_function', etc.

  @Default(false)
  @Column(DataType.BOOLEAN)
  is_abnormal!: boolean; // Flag if value is outside normal range

  // Source information
  @Column(DataType.STRING(100))
  source?: string; // 'manual_entry', 'test_report', 'receipt', 'device'

  @Column(DataType.UUID)
  test_result_id?: string; // If extracted from test result document

  @Column(DataType.UUID)
  appointment_id?: string; // If linked to a past visit

  @Column(DataType.TEXT)
  notes?: string; // Additional notes

  @AllowNull(false)
  @Column(DataType.UUID)
  recorded_by!: string; // User ID who recorded this

  @Default(true)
  @Column(DataType.BOOLEAN)
  is_active!: boolean;

  @CreatedAt
  @Column(DataType.DATE)
  created_at!: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  updated_at!: Date;
}

