import { Response } from 'express';
import { AuthRequest } from '../middleware/auth-postgres';
import { 
  PastVisit, 
  UnverifiedDoctor, 
  PastPrescription, 
  Receipt, 
  PastTestResult,
  Patient 
} from '../models-postgres';
import { Op } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';

/**
 * Generate unique appointment ID for past visit
 */
function generateAppointmentId(): string {
  const year = new Date().getFullYear();
  const timestamp = Date.now().toString().slice(-8);
  return `PV-${year}-${timestamp}`;
}

/**
 * Create a new past visit
 */
export const createPastVisit = async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user?.userId;
    if (!currentUserId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const {
      visit_date,
      doctor_id, // Platform doctor ID (optional)
      unverified_doctor_id, // Unverified doctor ID (optional)
      doctor_name, // Required
      doctor_specialty,
      doctor_registration_number,
      clinic_name,
      hcp_name,
      area,
      city,
      pincode,
      chief_complaint,
      diagnosis,
      notes,
      follow_up_date,
      consultation_fee,
      patient_id,
      patient_name,
      patient_phone
    } = req.body;

    // Validate required fields
    if (!visit_date || !doctor_name || !patient_name) {
      return res.status(400).json({ message: 'visit_date, doctor_name, and patient_name are required' });
    }

    // Get or create patient record
    let patientRecord = null;
    if (patient_id) {
      // Verify patient belongs to current user (if patient_id is provided)
      patientRecord = await Patient.findOne({
        where: { id: patient_id, user_id: currentUserId, is_active: true }
      });
      if (!patientRecord) {
        return res.status(403).json({ message: 'Patient not found or access denied' });
      }
    } else {
      // No patient_id provided - find or create patient record
      const patientPhone = patient_phone || req.user?.phone;
      if (patientPhone) {
        // Try to find existing patient by user_id or phone
        patientRecord = await Patient.findOne({
          where: {
            user_id: currentUserId,
            is_active: true
          }
        });

        if (!patientRecord) {
          // Try by phone
          patientRecord = await Patient.findOne({
            where: {
              phone: patientPhone,
              is_active: true
            }
          });
        }

        // If still not found, create a new patient record
        if (!patientRecord) {
          patientRecord = await Patient.create({
            user_id: currentUserId,
            phone: patientPhone,
            name: patient_name || 'Patient',
            sex: 'male', // Default
            age: 30, // Default
            year_of_birth: new Date().getFullYear() - 30,
            registered_by: currentUserId,
            is_active: true
          });
        }
      }
    }

    // Use patient record ID if available, otherwise use null
    const finalPatientId = patientRecord?.id || patient_id || null;

    // Generate appointment ID
    const appointment_id = generateAppointmentId();

    // Create past visit
    const pastVisit = await PastVisit.create({
      appointment_id,
      patient_id: finalPatientId,
      patient_name: patient_name || patientRecord?.name || 'Patient',
      patient_phone: patient_phone || patientRecord?.phone || req.user?.phone || '',
      visit_date: new Date(visit_date),
      doctor_id: doctor_id || null,
      unverified_doctor_id: unverified_doctor_id || null,
      doctor_name,
      doctor_specialty,
      doctor_registration_number,
      clinic_name,
      hcp_name,
      area,
      city,
      pincode,
      chief_complaint,
      diagnosis,
      notes,
      follow_up_date: follow_up_date ? new Date(follow_up_date) : null,
      consultation_fee,
      created_by: currentUserId,
      is_active: true
    });

    console.log(`✅ [PAST VISIT] Created: ${appointment_id} for patient ${patient_name}`);

    res.status(201).json({
      message: 'Past visit created successfully',
      visit: pastVisit,
      appointment_id
    });
  } catch (error: any) {
    console.error('❌ [PAST VISIT] Error:', error);
    res.status(500).json({ message: 'Failed to create past visit', error: error.message });
  }
};

/**
 * Get all past visits for a patient
 */
export const getPastVisits = async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user?.userId;
    if (!currentUserId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const { patient_id } = req.query;

    // Verify patient belongs to current user
    if (patient_id) {
      const patient = await Patient.findOne({
        where: { id: patient_id as string, user_id: currentUserId, is_active: true }
      });
      if (!patient) {
        return res.status(403).json({ message: 'Patient not found or access denied' });
      }
    }

    const whereClause: any = {
      is_active: true
    };

    if (patient_id) {
      whereClause.patient_id = patient_id;
    } else {
      // Get all patients for this user and their visits
      const patients = await Patient.findAll({
        where: { user_id: currentUserId, is_active: true },
        attributes: ['id']
      });
      const patientIds = patients.map(p => p.id);
      whereClause.patient_id = { [Op.in]: patientIds };
    }

    const visits = await PastVisit.findAll({
      where: whereClause,
      order: [['visit_date', 'DESC']]
    });

    res.json({
      message: 'Past visits retrieved successfully',
      visits,
      count: visits.length
    });
  } catch (error: any) {
    console.error('❌ [PAST VISIT] Error:', error);
    res.status(500).json({ message: 'Failed to retrieve past visits', error: error.message });
  }
};

/**
 * Get past visit details with all related documents
 */
export const getPastVisitDetails = async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user?.userId;
    if (!currentUserId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const { appointment_id } = req.params;

    const visit = await PastVisit.findOne({
      where: { appointment_id, is_active: true }
    });

    if (!visit) {
      return res.status(404).json({ message: 'Past visit not found' });
    }

    // Verify access
    const patient = await Patient.findOne({
      where: { id: visit.patient_id, is_active: true }
    });

    if (!patient || patient.user_id !== currentUserId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Get all related documents
    const [prescriptions, receipts, testResults] = await Promise.all([
      PastPrescription.findAll({
        where: { appointment_id, is_active: true },
        order: [['prescription_date', 'DESC']]
      }),
      Receipt.findAll({
        where: { appointment_id, is_active: true },
        order: [['receipt_date', 'DESC']]
      }),
      PastTestResult.findAll({
        where: { appointment_id, is_active: true },
        order: [['test_date', 'DESC']]
      })
    ]);

    res.json({
      message: 'Past visit details retrieved successfully',
      visit,
      documents: {
        prescriptions,
        receipts,
        test_results: testResults
      }
    });
  } catch (error: any) {
    console.error('❌ [PAST VISIT] Error:', error);
    res.status(500).json({ message: 'Failed to retrieve past visit details', error: error.message });
  }
};

/**
 * Update past visit
 */
export const updatePastVisit = async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user?.userId;
    if (!currentUserId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const { appointment_id } = req.params;
    const updateData = req.body;

    const visit = await PastVisit.findOne({
      where: { appointment_id, is_active: true }
    });

    if (!visit) {
      return res.status(404).json({ message: 'Past visit not found' });
    }

    // Verify access
    if (visit.created_by !== currentUserId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Update visit
    await visit.update(updateData);

    console.log(`✅ [PAST VISIT] Updated: ${appointment_id}`);

    res.json({
      message: 'Past visit updated successfully',
      visit
    });
  } catch (error: any) {
    console.error('❌ [PAST VISIT] Error:', error);
    res.status(500).json({ message: 'Failed to update past visit', error: error.message });
  }
};

/**
 * Delete past visit (soft delete)
 */
export const deletePastVisit = async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user?.userId;
    if (!currentUserId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const { appointment_id } = req.params;

    const visit = await PastVisit.findOne({
      where: { appointment_id, is_active: true }
    });

    if (!visit) {
      return res.status(404).json({ message: 'Past visit not found' });
    }

    // Verify access
    if (visit.created_by !== currentUserId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Soft delete
    await visit.update({ is_active: false });

    console.log(`✅ [PAST VISIT] Deleted: ${appointment_id}`);

    res.json({
      message: 'Past visit deleted successfully'
    });
  } catch (error: any) {
    console.error('❌ [PAST VISIT] Error:', error);
    res.status(500).json({ message: 'Failed to delete past visit', error: error.message });
  }
};

