import { Table, Column, Model, DataType, ForeignKey, BelongsTo, CreatedAt, UpdatedAt, PrimaryKey, Default, AllowNull } from 'sequelize-typescript';
// import { Patient } from './Patient'; // Not yet implemented
import { Pharmacy } from './Pharmacy';
import { PastPrescription } from './PastPrescription';

@Table({
  tableName: 'medicine_purchases',
  timestamps: true,
  underscored: true
})
export class MedicinePurchase extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id!: string;

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

  // Prescription reference (optional - medicine might be purchased without prescription)
  @ForeignKey(() => PastPrescription)
  @Column(DataType.UUID)
  prescription_id?: string;

  // Pharmacy information
  @ForeignKey(() => Pharmacy)
  @Column(DataType.UUID)
  pharmacy_id?: string;

  @Column(DataType.STRING(255))
  pharmacy_name?: string;

  @Column(DataType.STRING(255))
  pharmacy_address?: string;

  // Purchase details
  @AllowNull(false)
  @Column(DataType.DATE)
  purchase_date!: Date;

  @Column(DataType.DECIMAL(10, 2))
  total_amount?: number;

  @Column(DataType.DECIMAL(10, 2))
  tax_amount?: number;

  @Column(DataType.DECIMAL(10, 2))
  discount?: number;

  @Column(DataType.STRING(255))
  payment_method?: string; // Cash, Card, UPI, etc.

  // Medicine items purchased
  @AllowNull(false)
  @Column(DataType.JSONB)
  items!: Array<{
    medicine_name: string;
    quantity: number;
    unit?: string; // e.g., "strip", "bottle", "tablets"
    price_per_unit?: number;
    total_price?: number;
    manufacturer?: string;
    batch_number?: string;
    expiry_date?: string;
  }>;

  // Receipt reference (if receipt uploaded)
  @Column(DataType.UUID)
  receipt_id?: string; // References Receipt table

  @Column(DataType.STRING(500))
  receipt_file_url?: string;

  // AI extracted metadata (if extracted from receipt)
  @Default(false)
  @Column(DataType.BOOLEAN)
  is_ai_extracted!: boolean;

  @Column(DataType.JSONB)
  ai_extraction_metadata?: any;

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

  @BelongsTo(() => Pharmacy)
  pharmacy?: Pharmacy;

  @BelongsTo(() => PastPrescription)
  prescription?: PastPrescription;
}

