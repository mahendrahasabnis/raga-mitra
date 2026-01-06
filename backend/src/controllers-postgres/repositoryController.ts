import { Response } from 'express';
import { AuthRequest } from '../middleware/auth-postgres';
import {
  UnverifiedDoctor,
  Pharmacy,
  DiagnosticsCenter
} from '../models-postgres';
import { Op } from 'sequelize';

/**
 * Unverified Doctors Repository
 */

// Search or create unverified doctor
export const searchOrCreateUnverifiedDoctor = async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user?.userId;
    if (!currentUserId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const {
      doctor_name,
      specialty,
      registration_number,
      clinic_name,
      area,
      city,
      pincode,
      address,
      phone,
      email
    } = req.body;

    if (!doctor_name) {
      return res.status(400).json({ message: 'doctor_name is required' });
    }

    // Search for existing unverified doctor
    let doctor = await UnverifiedDoctor.findOne({
      where: {
        doctor_name: { [Op.iLike]: doctor_name },
        clinic_name: clinic_name ? { [Op.iLike]: clinic_name } : undefined,
        city: city ? { [Op.iLike]: city } : undefined,
        is_active: true
      }
    });

    if (doctor) {
      // Increment usage count
      await doctor.update({
        usage_count: doctor.usage_count + 1
      });
      console.log(`✅ [UNVERIFIED DOCTOR] Found existing: ${doctor.doctor_name}`);
    } else {
      // Create new unverified doctor
      doctor = await UnverifiedDoctor.create({
        doctor_name,
        specialty,
        registration_number,
        clinic_name,
        area,
        city,
        pincode,
        address,
        phone,
        email,
        usage_count: 1,
        created_by: currentUserId,
        is_verified: false,
        is_active: true
      });
      console.log(`✅ [UNVERIFIED DOCTOR] Created: ${doctor.doctor_name}`);
    }

    res.json({
      message: 'Unverified doctor retrieved/created successfully',
      doctor
    });
  } catch (error: any) {
    console.error('❌ [UNVERIFIED DOCTOR] Error:', error);
    res.status(500).json({ message: 'Failed to search/create unverified doctor', error: error.message });
  }
};

// Search unverified doctors
export const searchUnverifiedDoctors = async (req: AuthRequest, res: Response) => {
  try {
    const { search, city, specialty } = req.query;

    const whereClause: any = { is_active: true };

    if (search) {
      whereClause[Op.or] = [
        { doctor_name: { [Op.iLike]: `%${search}%` } },
        { clinic_name: { [Op.iLike]: `%${search}%` } },
        { specialty: { [Op.iLike]: `%${search}%` } }
      ];
    }

    if (city) {
      whereClause.city = { [Op.iLike]: `%${city}%` };
    }

    if (specialty) {
      whereClause.specialty = { [Op.iLike]: `%${specialty}%` };
    }

    const doctors = await UnverifiedDoctor.findAll({
      where: whereClause,
      order: [['usage_count', 'DESC'], ['created_at', 'DESC']],
      limit: 50
    });

    res.json({
      message: 'Unverified doctors retrieved successfully',
      doctors,
      count: doctors.length
    });
  } catch (error: any) {
    console.error('❌ [UNVERIFIED DOCTOR] Error:', error);
    res.status(500).json({ message: 'Failed to search unverified doctors', error: error.message });
  }
};

/**
 * Pharmacy Repository
 */

// Search pharmacies
export const searchPharmacies = async (req: AuthRequest, res: Response) => {
  try {
    const { search, city, area } = req.query;

    const whereClause: any = { is_active: true };

    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { owner_name: { [Op.iLike]: `%${search}%` } },
        { phone: { [Op.iLike]: `%${search}%` } }
      ];
    }

    if (city) {
      whereClause.city = { [Op.iLike]: `%${city}%` };
    }

    if (area) {
      whereClause.area = { [Op.iLike]: `%${area}%` };
    }

    const pharmacies = await Pharmacy.findAll({
      where: whereClause,
      order: [['usage_count', 'DESC'], ['created_at', 'DESC']],
      limit: 50
    });

    res.json({
      message: 'Pharmacies retrieved successfully',
      pharmacies,
      count: pharmacies.length
    });
  } catch (error: any) {
    console.error('❌ [PHARMACY] Error:', error);
    res.status(500).json({ message: 'Failed to search pharmacies', error: error.message });
  }
};

// Get pharmacy by ID
export const getPharmacyById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const pharmacy = await Pharmacy.findOne({
      where: { id, is_active: true }
    });

    if (!pharmacy) {
      return res.status(404).json({ message: 'Pharmacy not found' });
    }

    res.json({
      message: 'Pharmacy retrieved successfully',
      pharmacy
    });
  } catch (error: any) {
    console.error('❌ [PHARMACY] Error:', error);
    res.status(500).json({ message: 'Failed to get pharmacy', error: error.message });
  }
};

/**
 * Diagnostics Center Repository
 */

// Search diagnostics centers
export const searchDiagnosticsCenters = async (req: AuthRequest, res: Response) => {
  try {
    const { search, city, area, test_type } = req.query;

    const whereClause: any = { is_active: true };

    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { owner_name: { [Op.iLike]: `%${search}%` } },
        { phone: { [Op.iLike]: `%${search}%` } }
      ];
    }

    if (city) {
      whereClause.city = { [Op.iLike]: `%${city}%` };
    }

    if (area) {
      whereClause.area = { [Op.iLike]: `%${area}%` };
    }

    if (test_type) {
      whereClause.test_types = { [Op.contains]: [test_type] };
    }

    const centers = await DiagnosticsCenter.findAll({
      where: whereClause,
      order: [['usage_count', 'DESC'], ['created_at', 'DESC']],
      limit: 50
    });

    res.json({
      message: 'Diagnostics centers retrieved successfully',
      centers,
      count: centers.length
    });
  } catch (error: any) {
    console.error('❌ [DIAGNOSTICS CENTER] Error:', error);
    res.status(500).json({ message: 'Failed to search diagnostics centers', error: error.message });
  }
};

// Get diagnostics center by ID
export const getDiagnosticsCenterById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const center = await DiagnosticsCenter.findOne({
      where: { id, is_active: true }
    });

    if (!center) {
      return res.status(404).json({ message: 'Diagnostics center not found' });
    }

    res.json({
      message: 'Diagnostics center retrieved successfully',
      center
    });
  } catch (error: any) {
    console.error('❌ [DIAGNOSTICS CENTER] Error:', error);
    res.status(500).json({ message: 'Failed to get diagnostics center', error: error.message });
  }
};
