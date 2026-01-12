import { Table, Column, Model, DataType, ForeignKey, BelongsTo, CreatedAt, UpdatedAt, PrimaryKey, Default, AllowNull } from 'sequelize-typescript';
// import { Patient } from './Patient'; // Not yet implemented
import { UnverifiedDoctor } from './UnverifiedDoctor';

@Table({
  tableName: 'past_visits',
  timestamps: true,
  underscored: true
})
export class PastVisit extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id!: string;

  // Appointment ID - links all related documents (prescriptions, receipts, test results)
  @AllowNull(false)
  @Column({ type: DataType.STRING(100), unique: true })
  appointment_id!: string; // Patient-generated unique ID for this visit

  // Patient reference (Patient model not yet implemented)
  // @ForeignKey(() => Patient)
  @AllowNull(false)
  @Column(DataType.UUID)
  patient_id!: string;

  @AllowNull(false)
  @Column(DataType.STRING(255))
  patient_name!: string;

  @AllowNull(false)
  @Column(DataType.STRING(15))
  patient_phone!: string;

  // Visit date
  @AllowNull(false)
  @Column(DataType.DATE)
  visit_date!: Date;

  // Doctor information (can be from platform or unverified)
  @Column(DataType.UUID)
  doctor_id?: string; // If from platform, references SharedUser

  @ForeignKey(() => UnverifiedDoctor)
  @Column(DataType.UUID)
  unverified_doctor_id?: string; // If custom doctor, references UnverifiedDoctor

  @AllowNull(false)
  @Column(DataType.STRING(255))
  doctor_name!: string;

  @Column(DataType.STRING(100))
  doctor_specialty?: string;

  @Column(DataType.STRING(50))
  doctor_registration_number?: string;

  // Clinic/Healthcare provider information
  @Column(DataType.STRING(255))
  clinic_name?: string;

  @Column(DataType.STRING(255))
  hcp_name?: string; // Healthcare provider name

  @Column(DataType.STRING(255))
  area?: string;

  @Column(DataType.STRING(100))
  city?: string;

  @Column(DataType.STRING(10))
  pincode?: string;

  // Visit details
  @Column(DataType.TEXT)
  chief_complaint?: string;

  @Column(DataType.TEXT)
  diagnosis?: string;

  @Column(DataType.TEXT)
  notes?: string;

  @Column(DataType.DATE)
  follow_up_date?: Date;

  // Consultation fee
  @Column(DataType.DECIMAL(10, 2))
  consultation_fee?: number;

  // Metadata
  @AllowNull(false)
  @Column(DataType.UUID)
  created_by!: string; // Patient user ID

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
  @BelongsTo(() => UnverifiedDoctor, { foreignKey: 'unverified_doctor_id' })
  unverified_doctor?: UnverifiedDoctor;

  // Note: Removed @HasMany associations to prevent foreign key constraint creation
  // Relationships are maintained logically via appointment_id
  // To query related records, use:
  //   const prescriptions = await PastPrescription.findAll({ where: { appointment_id: visit.appointment_id } })
}

