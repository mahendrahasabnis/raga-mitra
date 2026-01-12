import { Table, Column, Model, DataType, ForeignKey, BelongsTo, CreatedAt, UpdatedAt, PrimaryKey, Default, AllowNull } from 'sequelize-typescript';
// import { Patient } from './Patient'; // Not yet implemented
import { Pharmacy } from './Pharmacy';
import { DiagnosticsCenter } from './DiagnosticsCenter';

export enum ReceiptType {
  CONSULTATION = 'consultation',
  MEDICINE = 'medicine',
  TEST = 'test',
  OTHER = 'other'
}

@Table({
  tableName: 'receipts',
  timestamps: true,
  underscored: true
})
export class Receipt extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id!: string;

  @AllowNull(false)
  @Column(DataType.STRING(100))
  receipt_id!: string; // Unique receipt ID

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

  // Receipt type
  @AllowNull(false)
  @Column(DataType.ENUM(...Object.values(ReceiptType)))
  receipt_type!: ReceiptType;

  // Receipt details
  @Column(DataType.DECIMAL(10, 2))
  amount?: number;

  @Column(DataType.STRING(255))
  payment_method?: string; // Cash, Card, UPI, etc.

  @Column(DataType.DATE)
  receipt_date?: Date;

  // For medicine receipts - pharmacy information
  @ForeignKey(() => Pharmacy)
  @Column(DataType.UUID)
  pharmacy_id?: string;

  @Column(DataType.STRING(255))
  pharmacy_name?: string;

  @Column(DataType.STRING(255))
  pharmacy_address?: string;

  // For test receipts - diagnostics center information
  @ForeignKey(() => DiagnosticsCenter)
  @Column(DataType.UUID)
  diagnostics_center_id?: string;

  @Column(DataType.STRING(255))
  diagnostics_center_name?: string;

  @Column(DataType.STRING(255))
  diagnostics_center_address?: string;

  // Document file
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

  // Extracted fields (from AI or manual entry)
  @Column(DataType.JSONB)
  extracted_data?: {
    invoice_number?: string;
    items?: Array<{
      name: string;
      quantity?: number;
      price?: number;
      total?: number;
    }>;
    total_amount?: number;
    tax_amount?: number;
    discount?: number;
    other_details?: any;
  };

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

  @BelongsTo(() => DiagnosticsCenter)
  diagnostics_center?: DiagnosticsCenter;
}

