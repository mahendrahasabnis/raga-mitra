import { Table, Column, Model, DataType, CreatedAt, UpdatedAt, PrimaryKey, Default, AllowNull, Unique } from 'sequelize-typescript';

@Table({
  tableName: 'vital_parameter_definitions',
  timestamps: true,
  underscored: true
})
export class VitalParameterDefinition extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id!: string;

  @Unique
  @AllowNull(false)
  @Column(DataType.STRING(100))
  parameter_name!: string; // e.g., "Weight", "HbA1c", "Fasting Blood Sugar"

  @Column(DataType.STRING(50))
  display_name?: string; // Friendly display name

  @Column(DataType.STRING(50))
  unit?: string; // Default unit

  @AllowNull(false)
  @Column(DataType.STRING(50))
  category!: string; // 'general', 'diabetes', 'hypertension', 'cardiac', etc.

  @Column(DataType.STRING(100))
  subcategory?: string; // 'blood_sugar', 'lipid_profile', 'liver_function', etc.

  @Column(DataType.DECIMAL(10, 2))
  default_normal_range_min?: number;

  @Column(DataType.DECIMAL(10, 2))
  default_normal_range_max?: number;

  @Column(DataType.STRING(50))
  parameter_type?: string; // 'numeric', 'percentage', 'ratio', etc.

  @Column(DataType.TEXT)
  description?: string;

  @Column(DataType.JSONB)
  related_parameters?: string[]; // Array of related parameter names for grouping

  @Column(DataType.INTEGER)
  sort_order?: number; // For display ordering

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

