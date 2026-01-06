/**
 * Script to add sample past visit data for user +919881255701
 * This version connects directly to Cloud SQL using provided credentials
 */

import 'reflect-metadata';
import dotenv from 'dotenv';
import path from 'path';
import { Sequelize } from 'sequelize-typescript';
import {
  SharedUser,
  PlatformPrivilege
} from '../models-shared';
import {
  Patient,
  PastVisit,
  UnverifiedDoctor,
  PastPrescription,
  Receipt,
  PastTestResult,
  Pharmacy,
  DiagnosticsCenter
} from '../models-postgres';

// Load environment or use provided credentials
dotenv.config({ path: path.join(__dirname, '../../../.env.integrated') });

const PATIENT_PHONE = '+919881255701';

// Database configuration - use environment variables or default to Cloud SQL values
const dbConfig = {
  host: process.env.DB_HOST || process.env.CLOUD_SQL_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'platforms_99',
  username: process.env.DB_USER || 'postgres', // Try postgres as default
  password: process.env.DB_PASSWORD || process.env.CLOUD_SQL_PASSWORD || '',
  dialect: 'postgres' as const,
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  dialectOptions: process.env.DB_SSL === 'true' ? {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  } : undefined
};

// Create Sequelize instance
const sequelize = new Sequelize({
  ...dbConfig,
  models: []
});

async function addSampleData() {
  try {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📝 Adding Sample Past Visit Data');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(`🔗 Connecting to: ${dbConfig.database} @ ${dbConfig.host}:${dbConfig.port}`);
    console.log(`👤 User: ${dbConfig.username}\n`);

    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Connected to database\n');

    // Import models dynamically
    const { default: SharedUserModel } = await import('../models-shared/User');
    const { default: PlatformPrivilegeModel } = await import('../models-shared/PlatformPrivilege');
    
    SharedUserModel.init(sequelize);
    PlatformPrivilegeModel.init(sequelize);
    Patient.init(sequelize);
    PastVisit.init(sequelize);
    UnverifiedDoctor.init(sequelize);
    PastPrescription.init(sequelize);
    Receipt.init(sequelize);
    PastTestResult.init(sequelize);
    Pharmacy.init(sequelize);
    DiagnosticsCenter.init(sequelize);

    // Sync database (create tables if they don't exist)
    console.log('🔄 Syncing database schema...');
    await sequelize.sync({ alter: false });
    console.log('✅ Database schema synchronized\n');

    // Find user by phone
    console.log(`🔍 Finding user with phone: ${PATIENT_PHONE}`);
    const user = await SharedUserModel.findOne({
      where: { phone: PATIENT_PHONE }
    });

    if (!user) {
      console.error(`❌ User with phone ${PATIENT_PHONE} not found!`);
      console.log('   Please ensure the user is registered first.');
      await sequelize.close();
      process.exit(1);
    }

    console.log(`✅ Found user: ${user.name || 'Unknown'} (ID: ${user.id})\n`);

    // Find or create patient record
    let patient = await Patient.findOne({
      where: { user_id: user.id, is_active: true }
    });

    if (!patient) {
      console.log('📋 Creating patient record...');
      patient = await Patient.create({
        user_id: user.id,
        phone: PATIENT_PHONE,
        name: user.name || 'Patient User',
        sex: 'M',
        age: 35,
        year_of_birth: new Date().getFullYear() - 35,
        registered_by: user.id,
        is_active: true
      });
      console.log(`✅ Created patient: ${patient.name} (ID: ${patient.id})\n`);
    } else {
      console.log(`✅ Found existing patient: ${patient.name} (ID: ${patient.id})\n`);
    }

    // Create sample unverified doctors
    console.log('👨‍⚕️ Creating sample unverified doctors...');
    const doctor1 = await UnverifiedDoctor.create({
      doctor_name: 'Dr. Rajesh Kumar',
      specialty: 'General Medicine',
      clinic_name: 'City Health Clinic',
      area: 'Koramangala',
      city: 'Bangalore',
      pincode: '560095',
      address: '123 Main Street, Koramangala, Bangalore',
      phone: '+919876543210',
      usage_count: 1,
      created_by: user.id,
      is_verified: false,
      is_active: true
    });
    console.log(`✅ Created doctor: ${doctor1.doctor_name}`);

    const doctor2 = await UnverifiedDoctor.create({
      doctor_name: 'Dr. Priya Sharma',
      specialty: 'Cardiology',
      clinic_name: 'Heart Care Center',
      area: 'Indiranagar',
      city: 'Bangalore',
      pincode: '560038',
      address: '456 MG Road, Indiranagar, Bangalore',
      phone: '+919876543211',
      usage_count: 1,
      created_by: user.id,
      is_verified: false,
      is_active: true
    });
    console.log(`✅ Created doctor: ${doctor2.doctor_name}\n`);

    // Create sample pharmacies
    console.log('💊 Creating sample pharmacies...');
    const pharmacy1 = await Pharmacy.create({
      name: 'MedPlus Pharmacy',
      owner_name: 'John Doe',
      address: '789 Commercial Street, Bangalore',
      area: 'Commercial Street',
      city: 'Bangalore',
      pincode: '560001',
      phone: '+919876543212',
      usage_count: 1,
      is_verified: false,
      is_active: true
    });
    console.log(`✅ Created pharmacy: ${pharmacy1.name}`);

    const pharmacy2 = await Pharmacy.create({
      name: 'Apollo Pharmacy',
      owner_name: 'Jane Smith',
      address: '321 Brigade Road, Bangalore',
      area: 'Brigade Road',
      city: 'Bangalore',
      pincode: '560025',
      phone: '+919876543213',
      usage_count: 1,
      is_verified: false,
      is_active: true
    });
    console.log(`✅ Created pharmacy: ${pharmacy2.name}\n`);

    // Create sample diagnostics center
    console.log('🔬 Creating sample diagnostics center...');
    const diagnostics1 = await DiagnosticsCenter.create({
      name: 'Metropolis Lab',
      owner_name: 'Dr. Test Lab',
      address: '555 Test Street, Bangalore',
      area: 'HSR Layout',
      city: 'Bangalore',
      pincode: '560102',
      phone: '+919876543214',
      test_types: ['Blood Test', 'Urine Test', 'ECG', 'X-Ray'],
      usage_count: 1,
      is_verified: false,
      is_active: true
    });
    console.log(`✅ Created diagnostics center: ${diagnostics1.name}\n`);

    // Create past visit 1 (3 months ago)
    console.log('📅 Creating past visit 1...');
    const visitDate1 = new Date();
    visitDate1.setMonth(visitDate1.getMonth() - 3);

    const pastVisit1 = await PastVisit.create({
      appointment_id: `PV-${new Date().getFullYear()}-${Date.now().toString().slice(-8)}`,
      patient_id: patient.id,
      patient_name: patient.name,
      patient_phone: patient.phone,
      visit_date: visitDate1,
      unverified_doctor_id: doctor1.id,
      doctor_name: doctor1.doctor_name,
      doctor_specialty: doctor1.specialty,
      clinic_name: doctor1.clinic_name,
      area: doctor1.area,
      city: doctor1.city,
      pincode: doctor1.pincode,
      chief_complaint: 'Fever and cough for 3 days',
      diagnosis: 'Upper respiratory tract infection',
      notes: 'Patient advised to take rest and plenty of fluids',
      consultation_fee: 500,
      created_by: user.id,
      is_active: true
    });
    console.log(`✅ Created visit: ${pastVisit1.appointment_id}`);

    // Add prescription for visit 1
    const prescription1 = await PastPrescription.create({
      prescription_id: `PRX-${new Date().getFullYear()}-${(Date.now() + 1).toString().slice(-8)}`,
      appointment_id: pastVisit1.appointment_id,
      patient_id: patient.id,
      patient_name: patient.name,
      doctor_name: doctor1.doctor_name,
      doctor_specialty: doctor1.specialty,
      diagnosis: 'Upper respiratory tract infection',
      medications: [
        {
          medicine_name: 'Paracetamol 500mg',
          dosage: '500mg',
          frequency: 'Every 6 hours',
          duration: '3 days',
          timing: 'After meals',
          instructions: 'Take with plenty of water',
          quantity: 6
        },
        {
          medicine_name: 'Azithromycin 500mg',
          dosage: '500mg',
          frequency: 'Once daily',
          duration: '3 days',
          timing: 'Before meals',
          instructions: 'Complete full course',
          quantity: 3
        }
      ],
      lab_tests: ['Complete Blood Count', 'Chest X-Ray'],
      advice: 'Rest well, drink plenty of fluids, avoid cold beverages',
      prescription_date: visitDate1,
      is_ai_extracted: false,
      created_by: user.id,
      is_active: true
    });
    console.log(`✅ Created prescription: ${prescription1.prescription_id}`);

    // Add consultation receipt for visit 1
    const receipt1 = await Receipt.create({
      receipt_id: `RCP-${new Date().getFullYear()}-${(Date.now() + 2).toString().slice(-8)}`,
      appointment_id: pastVisit1.appointment_id,
      patient_id: patient.id,
      patient_name: patient.name,
      receipt_type: 'consultation',
      amount: 500,
      payment_method: 'UPI',
      receipt_date: visitDate1,
      is_ai_extracted: false,
      created_by: user.id,
      is_active: true
    });
    console.log(`✅ Created consultation receipt: ${receipt1.receipt_id}`);

    // Add medicine purchase for visit 1
    const receipt2 = await Receipt.create({
      receipt_id: `RCP-${new Date().getFullYear()}-${(Date.now() + 3).toString().slice(-8)}`,
      appointment_id: pastVisit1.appointment_id,
      patient_id: patient.id,
      patient_name: patient.name,
      receipt_type: 'medicine',
      amount: 450,
      payment_method: 'Cash',
      receipt_date: visitDate1,
      pharmacy_id: pharmacy1.id,
      pharmacy_name: pharmacy1.name,
      pharmacy_address: pharmacy1.address,
      extracted_data: {
        items: [
          { name: 'Paracetamol 500mg', quantity: 6, price: 50, total: 300 },
          { name: 'Azithromycin 500mg', quantity: 3, price: 50, total: 150 }
        ],
        total_amount: 450
      },
      is_ai_extracted: false,
      created_by: user.id,
      is_active: true
    });
    console.log(`✅ Created medicine receipt: ${receipt2.receipt_id}\n`);

    // Create past visit 2 (1 month ago)
    console.log('📅 Creating past visit 2...');
    const visitDate2 = new Date();
    visitDate2.setMonth(visitDate2.getMonth() - 1);

    const pastVisit2 = await PastVisit.create({
      appointment_id: `PV-${new Date().getFullYear()}-${(Date.now() + 4).toString().slice(-8)}`,
      patient_id: patient.id,
      patient_name: patient.name,
      patient_phone: patient.phone,
      visit_date: visitDate2,
      unverified_doctor_id: doctor2.id,
      doctor_name: doctor2.doctor_name,
      doctor_specialty: doctor2.specialty,
      clinic_name: doctor2.clinic_name,
      area: doctor2.area,
      city: doctor2.city,
      pincode: doctor2.pincode,
      chief_complaint: 'Chest pain and shortness of breath',
      diagnosis: 'Mild hypertension, advised lifestyle changes',
      notes: 'Regular checkup recommended, monitor blood pressure',
      follow_up_date: new Date(visitDate2.getTime() + 30 * 24 * 60 * 60 * 1000), // 30 days later
      consultation_fee: 800,
      created_by: user.id,
      is_active: true
    });
    console.log(`✅ Created visit: ${pastVisit2.appointment_id}`);

    // Add prescription for visit 2
    const prescription2 = await PastPrescription.create({
      prescription_id: `PRX-${new Date().getFullYear()}-${(Date.now() + 5).toString().slice(-8)}`,
      appointment_id: pastVisit2.appointment_id,
      patient_id: patient.id,
      patient_name: patient.name,
      doctor_name: doctor2.doctor_name,
      doctor_specialty: doctor2.specialty,
      diagnosis: 'Mild hypertension',
      medications: [
        {
          medicine_name: 'Amlodipine 5mg',
          dosage: '5mg',
          frequency: 'Once daily',
          duration: '30 days',
          timing: 'Morning',
          instructions: 'Monitor BP regularly',
          quantity: 30
        }
      ],
      lab_tests: ['Lipid Profile', 'ECG', 'Echo'],
      advice: 'Reduce salt intake, regular exercise, maintain healthy weight',
      follow_up_date: new Date(visitDate2.getTime() + 30 * 24 * 60 * 60 * 1000),
      prescription_date: visitDate2,
      is_ai_extracted: false,
      created_by: user.id,
      is_active: true
    });
    console.log(`✅ Created prescription: ${prescription2.prescription_id}`);

    // Add test result for visit 2
    const testResult1 = await PastTestResult.create({
      test_result_id: `TR-${new Date().getFullYear()}-${(Date.now() + 6).toString().slice(-8)}`,
      appointment_id: pastVisit2.appointment_id,
      patient_id: patient.id,
      patient_name: patient.name,
      test_name: 'Complete Blood Count',
      test_category: 'Blood Test',
      test_date: visitDate2,
      diagnostics_center_id: diagnostics1.id,
      diagnostics_center_name: diagnostics1.name,
      parameters: [
        {
          parameter_name: 'Hemoglobin',
          value: 14.5,
          unit: 'g/dL',
          normal_range_min: 12.0,
          normal_range_max: 16.0,
          is_abnormal: false
        },
        {
          parameter_name: 'Total WBC Count',
          value: 7500,
          unit: '/mm³',
          normal_range_min: 4000,
          normal_range_max: 11000,
          is_abnormal: false
        },
        {
          parameter_name: 'Platelet Count',
          value: 250000,
          unit: '/mm³',
          normal_range_min: 150000,
          normal_range_max: 400000,
          is_abnormal: false
        }
      ],
      interpretation: 'All parameters within normal range',
      notes: 'Regular follow-up recommended',
      is_ai_extracted: false,
      created_by: user.id,
      is_active: true
    });
    console.log(`✅ Created test result: ${testResult1.test_result_id}`);

    // Add test receipt for visit 2
    const receipt3 = await Receipt.create({
      receipt_id: `RCP-${new Date().getFullYear()}-${(Date.now() + 7).toString().slice(-8)}`,
      appointment_id: pastVisit2.appointment_id,
      patient_id: patient.id,
      patient_name: patient.name,
      receipt_type: 'test',
      amount: 1200,
      payment_method: 'Card',
      receipt_date: visitDate2,
      diagnostics_center_id: diagnostics1.id,
      diagnostics_center_name: diagnostics1.name,
      diagnostics_center_address: diagnostics1.address,
      extracted_data: {
        items: [
          { name: 'Complete Blood Count', price: 500, total: 500 },
          { name: 'Lipid Profile', price: 700, total: 700 }
        ],
        total_amount: 1200
      },
      is_ai_extracted: false,
      created_by: user.id,
      is_active: true
    });
    console.log(`✅ Created test receipt: ${receipt3.receipt_id}\n`);

    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ Sample data added successfully!');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('\n📊 Summary:');
    console.log(`   • Patient: ${patient.name}`);
    console.log(`   • Past Visits: 2`);
    console.log(`   • Prescriptions: 2`);
    console.log(`   • Receipts: 3`);
    console.log(`   • Test Results: 1`);
    console.log(`   • Unverified Doctors: 2`);
    console.log(`   • Pharmacies: 2`);
    console.log(`   • Diagnostics Centers: 1\n`);

    await sequelize.close();
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    await sequelize.close();
    process.exit(1);
  }
}

addSampleData();

