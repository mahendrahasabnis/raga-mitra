import { Table, Column, Model, DataType, ForeignKey, BelongsTo, CreatedAt, UpdatedAt, PrimaryKey, Default, AllowNull } from 'sequelize-typescript';
// import { Patient } from './Patient'; // Not yet implemented
import { DiagnosticsCenter } from './DiagnosticsCenter';

// Test parameter structure
export interface ITestParameter {
  parameter_name: string;
  value: number | string;
  unit: string;
  normal_range_min?: number;
  normal_range_max?: number;
  is_abnormal?: boolean;
}

@Table({
  tableName: 'past_test_results',
  timestamps: true,
  underscored: true
})
export class PastTestResult extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id!: string;

  @AllowNull(false)
  @Column(DataType.STRING(100))
  test_result_id!: string; // Unique test result ID

  // Appointment reference (links to past visit)
  // Note: Using logical reference via appointment_id (not enforced foreign key)
  @AllowNull(false)
  @Column(DataType.STRING(100))
  appointment_id!: string;

  // Patient reference
  // @ForeignKey(() => Patient) // Patient model not yet implemented
  @AllowNull(false)
  @Column(DataType.UUID)
  patient_id!: string;

  @AllowNull(false)
  @Column(DataType.STRING(255))
  patient_name!: string;

  // Test details
  @AllowNull(false)
  @Column(DataType.STRING(255))
  test_name!: string; // e.g., "Complete Blood Count", "Lipid Profile"

  @Column(DataType.STRING(100))
  test_category?: string; // e.g., "Blood Test", "Urine Test", "Metabolic Panel"

  @AllowNull(false)
  @Column(DataType.DATE)
  test_date!: Date;

  // Test parameters with values
  @Column(DataType.JSONB)
  parameters?: ITestParameter[];

  // Diagnostics center information
  @ForeignKey(() => DiagnosticsCenter)
  @Column(DataType.UUID)
  diagnostics_center_id?: string;

  @Column(DataType.STRING(255))
  diagnostics_center_name?: string;

  // Additional info
  @Column(DataType.TEXT)
  notes?: string;

  @Column(DataType.TEXT)
  interpretation?: string; // Doctor's interpretation

  // Document file (if test report uploaded)
  @Column(DataType.STRING(500))
  file_url?: string;

  @Column(DataType.STRING(255))
  file_name?: string;

  @Column(DataType.STRING(50))
  file_type?: string;

  @Column(DataType.INTEGER)
  file_size?: number; // in bytes

  // AI extracted metadata
  @Default(false)
  @Column(DataType.BOOLEAN)
  is_ai_extracted!: boolean;

  @Column(DataType.JSONB)
  ai_extraction_metadata?: any; // Store AI extraction results

  // Metadata
  @AllowNull(false)
  @Column(DataType.UUID)
  created_by!: string;

  @Default(true)
  @Column(DataType.BOOLEAN)
  is_active!: boolean;

  @CreatedAt
  @Column(DataType.DATE)
  created_at!: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  updated_at!: Date;

  // Associations
  // Note: Logical association via appointment_id - no database foreign key

  @BelongsTo(() => DiagnosticsCenter)
  diagnostics_center?: DiagnosticsCenter;
}

