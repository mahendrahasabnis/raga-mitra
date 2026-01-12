import { Table, Column, Model, DataType, ForeignKey, CreatedAt, UpdatedAt, PrimaryKey, Default, AllowNull } from 'sequelize-typescript';
// import { Patient } from './Patient'; // Not yet implemented

// Medication item embedded structure
export interface IMedicationItem {
  medicine_name: string;
  dosage: string; // e.g., "500mg"
  frequency: string; // e.g., "Twice daily", "1-0-1"
  duration: string; // e.g., "7 days", "2 weeks"
  timing: string; // e.g., "Before meals", "After meals"
  instructions?: string;
  quantity?: number;
}

@Table({
  tableName: 'past_prescriptions',
  timestamps: true,
  underscored: true
})
export class PastPrescription extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id!: string;

  @AllowNull(false)
  @Column(DataType.STRING(100))
  prescription_id!: string; // Unique prescription ID

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

  // Doctor info
  @AllowNull(false)
  @Column(DataType.STRING(255))
  doctor_name!: string;

  @Column(DataType.STRING(100))
  doctor_specialty?: string;

  // Prescription details
  @Column(DataType.TEXT)
  diagnosis?: string;

  @AllowNull(false)
  @Column(DataType.JSONB)
  medications!: IMedicationItem[]; // Array of medication items

  @Column(DataType.ARRAY(DataType.STRING))
  lab_tests?: string[]; // Recommended lab tests

  @Column(DataType.TEXT)
  advice?: string; // General advice/instructions

  @Column(DataType.DATE)
  follow_up_date?: Date;

  @Column(DataType.TEXT)
  follow_up_notes?: string;

  // Document file (if prescription uploaded as image/PDF)
  @Column(DataType.STRING(500))
  file_url?: string;

  @Column(DataType.STRING(255))
  file_name?: string;

  @Column(DataType.STRING(50))
  file_type?: string;

  // AI extracted metadata
  @Default(false)
  @Column(DataType.BOOLEAN)
  is_ai_extracted!: boolean; // Whether data was extracted using AI

  @Column(DataType.JSONB)
  ai_extraction_metadata?: any; // Store AI extraction confidence scores, raw text, etc.

  // Prescription date
  @AllowNull(false)
  @Column(DataType.DATE)
  prescription_date!: Date;

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
  // Use this for ORM queries: await PastPrescription.findAll({ include: [{ association: 'past_visit', required: false }] })
  // For now, removed to prevent Sequelize from creating foreign key constraints
}

