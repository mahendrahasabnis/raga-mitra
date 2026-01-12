import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import {
  PastVisit,
  PastPrescription,
  Receipt,
  PastTestResult
  // Patient // Not yet implemented
} from '../models-postgres';
import { Op } from 'sequelize';

/**
 * Get complete medical history for a patient
 */
export const getMedicalHistory = async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user?.userId;
    if (!currentUserId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const { patient_id } = req.query;

    // Verify patient belongs to current user (Patient model not yet implemented)
    // if (patient_id) {
    //   const { sequelize } = await import('../config/database-integrated');
    //   const Patient = sequelize.models.Patient as any;
    //   if (Patient) {
    //     const patient = await Patient.findOne({
    //       where: { id: patient_id as string, user_id: currentUserId, is_active: true }
    //     });
    //     if (!patient) {
    //       return res.status(403).json({ message: 'Patient not found or access denied' });
    //     }
    //   }
    // }

    const whereClause: any = {
      is_active: true
    };

    if (patient_id) {
      whereClause.patient_id = patient_id;
    }
    // TODO: Re-enable when Patient model is implemented
    // else {
    //   const { sequelize } = await import('../config/database-integrated');
    //   const Patient = sequelize.models.Patient as any;
    //   if (Patient) {
    //     const patients = await Patient.findAll({
    //       where: { user_id: currentUserId, is_active: true },
    //       attributes: ['id']
    //     });
    //     const patientIds = patients.map((p: any) => p.id);
    //     whereClause.patient_id = { [Op.in]: patientIds };
    //   }
    // }

    // Get all visits with related documents
    const visits = await PastVisit.findAll({
      where: whereClause,
      order: [['visit_date', 'DESC']],
      limit: 100
    });

    const appointmentIds = visits.map(v => v.appointment_id);

    // Get all related documents
    const [prescriptions, receipts, testResults] = await Promise.all([
      PastPrescription.findAll({
        where: {
          appointment_id: { [Op.in]: appointmentIds },
          is_active: true
        },
        order: [['prescription_date', 'DESC']]
      }),
      Receipt.findAll({
        where: {
          appointment_id: { [Op.in]: appointmentIds },
          is_active: true
        },
        order: [['receipt_date', 'DESC']]
      }),
      PastTestResult.findAll({
        where: {
          appointment_id: { [Op.in]: appointmentIds },
          is_active: true
        },
        order: [['test_date', 'DESC']]
      })
    ]);

    // Group documents by appointment_id
    const documentsByAppointment: any = {};
    
    prescriptions.forEach(p => {
      if (!documentsByAppointment[p.appointment_id]) {
        documentsByAppointment[p.appointment_id] = { prescriptions: [], receipts: [], test_results: [] };
      }
      documentsByAppointment[p.appointment_id].prescriptions.push(p);
    });

    receipts.forEach(r => {
      if (!documentsByAppointment[r.appointment_id]) {
        documentsByAppointment[r.appointment_id] = { prescriptions: [], receipts: [], test_results: [] };
      }
      documentsByAppointment[r.appointment_id].receipts.push(r);
    });

    testResults.forEach(t => {
      if (!documentsByAppointment[t.appointment_id]) {
        documentsByAppointment[t.appointment_id] = { prescriptions: [], receipts: [], test_results: [] };
      }
      documentsByAppointment[t.appointment_id].test_results.push(t);
    });

    // Combine visits with documents
    const history = visits.map(visit => ({
      visit,
      documents: documentsByAppointment[visit.appointment_id] || {
        prescriptions: [],
        receipts: [],
        test_results: []
      }
    }));

    res.json({
      message: 'Medical history retrieved successfully',
      history,
      summary: {
        total_visits: visits.length,
        total_prescriptions: prescriptions.length,
        total_receipts: receipts.length,
        total_test_results: testResults.length
      }
    });
  } catch (error: any) {
    console.error('❌ [MEDICAL HISTORY] Error:', error);
    res.status(500).json({ message: 'Failed to retrieve medical history', error: error.message });
  }
};

/**
 * Get all prescriptions for a patient
 */
export const getAllPrescriptions = async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user?.userId;
    if (!currentUserId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const { patient_id } = req.query;

    // Get patient visits to verify access (Patient model not yet implemented)
    let patientIds: string[] = [];
    if (patient_id) {
      // const { sequelize } = await import('../config/database-integrated');
      // const Patient = sequelize.models.Patient as any;
      // if (Patient) {
      //   const patient = await Patient.findOne({
      //     where: { id: patient_id as string, user_id: currentUserId, is_active: true }
      //   });
      //   if (!patient) {
      //     return res.status(403).json({ message: 'Patient not found or access denied' });
      //   }
      // }
      patientIds = [patient_id as string];
    }
    // else {
    //   const { sequelize } = await import('../config/database-integrated');
    //   const Patient = sequelize.models.Patient as any;
    //   if (Patient) {
    //     const patients = await Patient.findAll({
    //       where: { user_id: currentUserId, is_active: true },
    //       attributes: ['id']
    //     });
    //     patientIds = patients.map((p: any) => p.id);
    //   }
    // }

    // Get all visits for these patients
    const visits = await PastVisit.findAll({
      where: {
        patient_id: { [Op.in]: patientIds },
        is_active: true
      },
      attributes: ['appointment_id']
    });

    const appointmentIds = visits.map(v => v.appointment_id);

    const prescriptions = await PastPrescription.findAll({
      where: {
        appointment_id: { [Op.in]: appointmentIds },
        is_active: true
      },
      order: [['prescription_date', 'DESC']]
    });

    res.json({
      message: 'Prescriptions retrieved successfully',
      prescriptions,
      count: prescriptions.length
    });
  } catch (error: any) {
    console.error('❌ [PRESCRIPTIONS] Error:', error);
    res.status(500).json({ message: 'Failed to retrieve prescriptions', error: error.message });
  }
};

/**
 * Get all test results for a patient
 */
export const getAllTestResults = async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user?.userId;
    if (!currentUserId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const { patient_id } = req.query;

    // Get patient visits to verify access (Patient model not yet implemented)
    let patientIds: string[] = [];
    if (patient_id) {
      // const { sequelize } = await import('../config/database-integrated');
      // const Patient = sequelize.models.Patient as any;
      // if (Patient) {
      //   const patient = await Patient.findOne({
      //     where: { id: patient_id as string, user_id: currentUserId, is_active: true }
      //   });
      //   if (!patient) {
      //     return res.status(403).json({ message: 'Patient not found or access denied' });
      //   }
      // }
      patientIds = [patient_id as string];
    }
    // else {
    //   const { sequelize } = await import('../config/database-integrated');
    //   const Patient = sequelize.models.Patient as any;
    //   if (Patient) {
    //     const patients = await Patient.findAll({
    //       where: { user_id: currentUserId, is_active: true },
    //       attributes: ['id']
    //     });
    //     patientIds = patients.map((p: any) => p.id);
    //   }
    // }

    // Get all visits for these patients
    const visits = await PastVisit.findAll({
      where: {
        patient_id: { [Op.in]: patientIds },
        is_active: true
      },
      attributes: ['appointment_id']
    });

    const appointmentIds = visits.map(v => v.appointment_id);

    const testResults = await PastTestResult.findAll({
      where: {
        appointment_id: { [Op.in]: appointmentIds },
        is_active: true
      },
      order: [['test_date', 'DESC']]
    });

    res.json({
      message: 'Test results retrieved successfully',
      test_results: testResults,
      count: testResults.length
    });
  } catch (error: any) {
    console.error('❌ [TEST RESULTS] Error:', error);
    res.status(500).json({ message: 'Failed to retrieve test results', error: error.message });
  }
};

