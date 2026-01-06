import { Table, Column, Model, DataType, HasMany, CreatedAt, UpdatedAt, PrimaryKey, Default, AllowNull } from 'sequelize-typescript';
import { Receipt } from './Receipt';
import { PastTestResult } from './PastTestResult';

@Table({
  tableName: 'diagnostics_centers',
  timestamps: true,
  underscored: true
})
export class DiagnosticsCenter extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id!: string;

  @AllowNull(false)
  @Column(DataType.STRING(255))
  name!: string;

  @Column(DataType.STRING(255))
  owner_name?: string;

  @Column(DataType.STRING(255))
  address?: string;

  @Column(DataType.STRING(255))
  area?: string;

  @Column(DataType.STRING(100))
  city?: string;

  @Column(DataType.STRING(10))
  pincode?: string;

  @Column(DataType.STRING(15))
  phone?: string;

  @Column(DataType.STRING(15))
  alternate_phone?: string;

  @Column(DataType.STRING(255))
  email?: string;

  @Column(DataType.STRING(50))
  license_number?: string;

  @Column(DataType.STRING(50))
  gst_number?: string;

  // Types of tests available (can be array stored as JSONB or separate table)
  @Column(DataType.ARRAY(DataType.STRING))
  test_types?: string[]; // e.g., ["Blood Test", "X-Ray", "MRI", "CT Scan"]

  // Usage tracking
  @Default(0)
  @Column(DataType.INTEGER)
  usage_count!: number; // Number of times this center appears in receipts/test results

  // Source tracking
  @Default(false)
  @Column(DataType.BOOLEAN)
  is_verified!: boolean; // Can be verified by admins

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
  @HasMany(() => Receipt)
  receipts?: Receipt[];

  @HasMany(() => PastTestResult)
  test_results?: PastTestResult[];
}

