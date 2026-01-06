import { Response } from 'express';
import { AuthRequest } from '../middleware/auth-postgres';
import { 
  VitalParameter, 
  VitalParameterDefinition,
  Patient 
} from '../models-postgres';
import { Op } from 'sequelize';

/**
 * Get all vital parameter definitions
 */
export const getParameterDefinitions = async (req: AuthRequest, res: Response) => {
  try {
    const { category, subcategory } = req.query;

    const where: any = { is_active: true };
    if (category) {
      where.category = category;
    }
    if (subcategory) {
      where.subcategory = subcategory;
    }

    const definitions = await VitalParameterDefinition.findAll({
      where,
      order: [['sort_order', 'ASC'], ['parameter_name', 'ASC']]
    });

    res.json({
      message: 'Parameter definitions retrieved',
      definitions
    });
  } catch (error: any) {
    console.error('❌ [VITAL PARAMS] Error getting definitions:', error);
    res.status(500).json({ message: 'Failed to get parameter definitions', error: error.message });
  }
};

/**
 * Add a new vital parameter reading
 */
export const addVitalParameter = async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user?.userId;
    if (!currentUserId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const {
      parameter_name,
      value,
      unit,
      recorded_date,
      recorded_time,
      normal_range_min,
      normal_range_max,
      category,
      subcategory,
      source = 'manual_entry',
      test_result_id,
      appointment_id,
      notes
    } = req.body;

    // Validate required fields
    if (!parameter_name || value === undefined || !recorded_date) {
      return res.status(400).json({ message: 'parameter_name, value, and recorded_date are required' });
    }

    // Get or create patient record
    let patientRecord = await Patient.findOne({
      where: {
        user_id: currentUserId,
        is_active: true
      }
    });

    if (!patientRecord) {
      return res.status(404).json({ message: 'Patient record not found. Please create a patient profile first.' });
    }

    // Get parameter definition for default ranges if not provided
    let definition = null;
    if (!normal_range_min || !normal_range_max) {
      definition = await VitalParameterDefinition.findOne({
        where: { parameter_name, is_active: true }
      });
    }

    const finalNormalRangeMin = normal_range_min || definition?.default_normal_range_min || null;
    const finalNormalRangeMax = normal_range_max || definition?.default_normal_range_max || null;
    const finalCategory = category || definition?.category || 'general';
    const finalSubcategory = subcategory || definition?.subcategory || null;
    const finalUnit = unit || definition?.unit || '';

    // Determine if value is abnormal
    let isAbnormal = false;
    if (finalNormalRangeMin !== null && finalNormalRangeMax !== null) {
      const numValue = typeof value === 'number' ? value : parseFloat(String(value));
      if (!isNaN(numValue)) {
        isAbnormal = numValue < finalNormalRangeMin || numValue > finalNormalRangeMax;
      }
    }

    // Parse recorded date
    const recordedDate = new Date(recorded_date);
    if (isNaN(recordedDate.getTime())) {
      return res.status(400).json({ message: 'Invalid recorded_date format' });
    }

    // Create vital parameter
    const vitalParameter = await VitalParameter.create({
      patient_id: patientRecord.id,
      parameter_name,
      value: typeof value === 'number' ? value : parseFloat(String(value)),
      unit: finalUnit,
      recorded_date: recordedDate,
      recorded_time: recorded_time || null,
      normal_range_min: finalNormalRangeMin,
      normal_range_max: finalNormalRangeMax,
      category: finalCategory,
      subcategory: finalSubcategory,
      is_abnormal: isAbnormal,
      source,
      test_result_id: test_result_id || null,
      appointment_id: appointment_id || null,
      notes: notes || null,
      recorded_by: currentUserId,
      is_active: true
    });

    res.status(201).json({
      message: 'Vital parameter added successfully',
      parameter: vitalParameter
    });
  } catch (error: any) {
    console.error('❌ [VITAL PARAMS] Error adding parameter:', error);
    res.status(500).json({ message: 'Failed to add vital parameter', error: error.message });
  }
};

/**
 * Get vital parameters with filters
 */
export const getVitalParameters = async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user?.userId;
    if (!currentUserId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const {
      parameter_name,
      category,
      start_date,
      end_date,
      include_abnormal_only
    } = req.query;

    // Get patient record
    const patientRecord = await Patient.findOne({
      where: {
        user_id: currentUserId,
        is_active: true
      }
    });

    if (!patientRecord) {
      return res.json({
        message: 'Patient record not found',
        parameters: [],
        total: 0
      });
    }

    // Build where clause
    const where: any = {
      patient_id: patientRecord.id,
      is_active: true
    };

    if (parameter_name) {
      where.parameter_name = parameter_name;
    }

    if (category) {
      where.category = category;
    }

    if (start_date || end_date) {
      where.recorded_date = {};
      if (start_date) {
        where.recorded_date[Op.gte] = new Date(start_date as string);
      }
      if (end_date) {
        where.recorded_date[Op.lte] = new Date(end_date as string);
      }
    }

    if (include_abnormal_only === 'true') {
      where.is_abnormal = true;
    }

    const parameters = await VitalParameter.findAll({
      where,
      order: [['recorded_date', 'DESC'], ['recorded_time', 'DESC']]
    });

    res.json({
      message: 'Vital parameters retrieved',
      parameters,
      total: parameters.length
    });
  } catch (error: any) {
    console.error('❌ [VITAL PARAMS] Error getting parameters:', error);
    res.status(500).json({ message: 'Failed to get vital parameters', error: error.message });
  }
};

/**
 * Get graph data for multiple parameters
 */
export const getGraphData = async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user?.userId;
    if (!currentUserId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const {
      parameter_names, // Comma-separated list or array
      start_date,
      end_date
    } = req.query;

    // Get patient record
    const patientRecord = await Patient.findOne({
      where: {
        user_id: currentUserId,
        is_active: true
      }
    });

    if (!patientRecord) {
      return res.json({
        message: 'Patient record not found',
        graph_data: []
      });
    }

    // Parse parameter names
    let paramNames: string[] = [];
    if (typeof parameter_names === 'string') {
      paramNames = parameter_names.split(',').map(p => p.trim());
    } else if (Array.isArray(parameter_names)) {
      paramNames = parameter_names.map(p => String(p).trim());
    }

    if (paramNames.length === 0) {
      return res.status(400).json({ message: 'parameter_names is required' });
    }

    // Limit to 5 parameters
    if (paramNames.length > 5) {
      return res.status(400).json({ message: 'Maximum 5 parameters allowed for comparison' });
    }

    // Build where clause
    const where: any = {
      patient_id: patientRecord.id,
      parameter_name: { [Op.in]: paramNames },
      is_active: true
    };

    // Set default date range to 1 year if not provided
    // Make sure endDate includes today (end of day)
    const endDate = end_date ? new Date(end_date as string) : new Date();
    endDate.setHours(23, 59, 59, 999); // Include full day
    
    const startDate = start_date 
      ? new Date(start_date as string)
      : new Date(new Date().setFullYear(endDate.getFullYear() - 1));
    startDate.setHours(0, 0, 0, 0); // Start of day

    where.recorded_date = {
      [Op.between]: [startDate, endDate]
    };

    // Get parameters
    const parameters = await VitalParameter.findAll({
      where,
      order: [['recorded_date', 'ASC'], ['recorded_time', 'ASC']]
    });

    // Group by parameter name
    const graphData: any = {};
    paramNames.forEach(paramName => {
      graphData[paramName] = {
        parameter_name: paramName,
        data_points: [],
        unit: null,
        normal_range_min: null,
        normal_range_max: null,
        category: null
      };
    });

    parameters.forEach(param => {
      const paramData = graphData[param.parameter_name];
      if (paramData) {
        paramData.data_points.push({
          date: param.recorded_date,
          time: param.recorded_time,
          value: param.value,
          is_abnormal: param.is_abnormal
        });
        // Set metadata from first occurrence
        if (!paramData.unit && param.unit) paramData.unit = param.unit;
        if (paramData.normal_range_min === null && param.normal_range_min !== null) {
          paramData.normal_range_min = param.normal_range_min;
        }
        if (paramData.normal_range_max === null && param.normal_range_max !== null) {
          paramData.normal_range_max = param.normal_range_max;
        }
        if (!paramData.category && param.category) paramData.category = param.category;
      }
    });

    // Convert to array format
    const graphDataArray = Object.values(graphData);

    res.json({
      message: 'Graph data retrieved',
      graph_data: graphDataArray,
      date_range: {
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString()
      },
      parameters_count: paramNames.length
    });
  } catch (error: any) {
    console.error('❌ [VITAL PARAMS] Error getting graph data:', error);
    res.status(500).json({ message: 'Failed to get graph data', error: error.message });
  }
};

/**
 * Get parameters by category
 */
export const getParametersByCategory = async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user?.userId;
    if (!currentUserId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    // Get patient record
    const patientRecord = await Patient.findOne({
      where: {
        user_id: currentUserId,
        is_active: true
      }
    });

    if (!patientRecord) {
      return res.json({
        message: 'Patient record not found',
        categories: {}
      });
    }

    // Get all parameters grouped by category
    const parameters = await VitalParameter.findAll({
      where: {
        patient_id: patientRecord.id,
        is_active: true
      },
      order: [['recorded_date', 'DESC']]
    });

    // Group by category
    const categories: any = {};
    parameters.forEach(param => {
      const category = param.category || 'general';
      if (!categories[category]) {
        categories[category] = {
          category_name: category,
          parameters: [],
          unique_parameter_names: new Set()
        };
      }
      categories[category].unique_parameter_names.add(param.parameter_name);
      categories[category].parameters.push(param);
    });

    // Convert Sets to arrays and get unique parameter names
    const result: any = {};
    Object.keys(categories).forEach(category => {
      result[category] = {
        category_name: category,
        parameter_names: Array.from(categories[category].unique_parameter_names),
        total_readings: categories[category].parameters.length,
        latest_reading_date: categories[category].parameters.length > 0
          ? categories[category].parameters[0].recorded_date
          : null
      };
    });

    res.json({
      message: 'Parameters by category retrieved',
      categories: result
    });
  } catch (error: any) {
    console.error('❌ [VITAL PARAMS] Error getting parameters by category:', error);
    res.status(500).json({ message: 'Failed to get parameters by category', error: error.message });
  }
};

/**
 * Update vital parameter
 */
export const updateVitalParameter = async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user?.userId;
    if (!currentUserId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const { id } = req.params;
    const updateData = req.body;

    // Get parameter
    const parameter = await VitalParameter.findByPk(id);
    if (!parameter) {
      return res.status(404).json({ message: 'Vital parameter not found' });
    }

    // Verify ownership
    const patientRecord = await Patient.findOne({
      where: {
        id: parameter.patient_id,
        user_id: currentUserId,
        is_active: true
      }
    });

    if (!patientRecord) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Update
    await parameter.update(updateData);

    res.json({
      message: 'Vital parameter updated successfully',
      parameter
    });
  } catch (error: any) {
    console.error('❌ [VITAL PARAMS] Error updating parameter:', error);
    res.status(500).json({ message: 'Failed to update vital parameter', error: error.message });
  }
};

/**
 * Delete vital parameter
 */
export const deleteVitalParameter = async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user?.userId;
    if (!currentUserId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const { id } = req.params;

    // Get parameter
    const parameter = await VitalParameter.findByPk(id);
    if (!parameter) {
      return res.status(404).json({ message: 'Vital parameter not found' });
    }

    // Verify ownership
    const patientRecord = await Patient.findOne({
      where: {
        id: parameter.patient_id,
        user_id: currentUserId,
        is_active: true
      }
    });

    if (!patientRecord) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Soft delete
    await parameter.update({ is_active: false });

    res.json({
      message: 'Vital parameter deleted successfully'
    });
  } catch (error: any) {
    console.error('❌ [VITAL PARAMS] Error deleting parameter:', error);
    res.status(500).json({ message: 'Failed to delete vital parameter', error: error.message });
  }
};

