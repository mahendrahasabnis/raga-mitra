import { Table, Column, Model, DataType, HasMany, CreatedAt, UpdatedAt, PrimaryKey, Default, AllowNull } from 'sequelize-typescript';
import { PastVisit } from './PastVisit';

@Table({
  tableName: 'unverified_doctors',
  timestamps: true,
  underscored: true
})
export class UnverifiedDoctor extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id!: string;

  @AllowNull(false)
  @Column(DataType.STRING(255))
  doctor_name!: string;

  @Column(DataType.STRING(100))
  specialty?: string;

  @Column(DataType.STRING(50))
  registration_number?: string;

  // Clinic information
  @Column(DataType.STRING(255))
  clinic_name?: string;

  @Column(DataType.STRING(255))
  area?: string;

  @Column(DataType.STRING(100))
  city?: string;

  @Column(DataType.STRING(10))
  pincode?: string;

  @Column(DataType.STRING(255))
  address?: string;

  @Column(DataType.STRING(15))
  phone?: string;

  @Column(DataType.STRING(255))
  email?: string;

  // Usage tracking
  @Default(0)
  @Column(DataType.INTEGER)
  usage_count!: number; // Number of patients who have used this doctor

  // Created by first patient who added this doctor
  @AllowNull(false)
  @Column(DataType.UUID)
  created_by!: string; // First patient user ID

  @Default(false)
  @Column(DataType.BOOLEAN)
  is_verified!: boolean; // Can be verified by admins later

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
  @HasMany(() => PastVisit)
  past_visits?: PastVisit[];
}

