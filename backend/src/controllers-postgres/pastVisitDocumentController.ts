import { Response } from 'express';
import { AuthRequest } from '../middleware/auth-postgres';
import {
  PastVisit,
  PastPrescription,
  Receipt,
  PastTestResult,
  Patient,
  Pharmacy,
  DiagnosticsCenter,
  VitalParameter,
  VitalParameterDefinition
} from '../models-postgres';
import {
  extractPrescriptionData,
  extractPrescriptionDataFromBase64,
  extractReceiptData,
  extractReceiptDataFromBase64,
  extractTestResultData,
  extractTestResultDataFromBase64,
  ExtractedPrescriptionData,
  ExtractedReceiptData,
  ExtractedTestResultData
} from '../services/geminiAIService';
import { Op } from 'sequelize';

/**
 * Generate unique prescription ID
 */
function generatePrescriptionId(): string {
  const year = new Date().getFullYear();
  const timestamp = Date.now().toString().slice(-8);
  return `PRX-${year}-${timestamp}`;
}

/**
 * Generate unique receipt ID
 */
function generateReceiptId(): string {
  const year = new Date().getFullYear();
  const timestamp = Date.now().toString().slice(-8);
  return `RCP-${year}-${timestamp}`;
}

/**
 * Generate unique test result ID
 */
function generateTestResultId(): string {
  const year = new Date().getFullYear();
  const timestamp = Date.now().toString().slice(-8);
  return `TR-${year}-${timestamp}`;
}

/**
 * Upload prescription document
 */
export const uploadPrescription = async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user?.userId;
    if (!currentUserId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    // Get appointment_id from URL params
    const appointment_id = req.params.appointment_id;

    const {
      file_url,
      file_base64,
      file_name,
      file_type,
      use_ai_extraction = true,
      manual_data // If AI extraction fails or user wants to override
    } = req.body;

    // Validate - require appointment_id from params, and either file_url or file_base64
    if (!appointment_id) {
      return res.status(400).json({ message: 'appointment_id is required in URL' });
    }
    
    if (!file_url && !file_base64) {
      return res.status(400).json({ message: 'Either file_url or file_base64 is required' });
    }

    // Verify past visit exists and user has access
    const visit = await PastVisit.findOne({
      where: { appointment_id, is_active: true }
    });

    if (!visit) {
      return res.status(404).json({ message: 'Past visit not found' });
    }

    if (visit.created_by !== currentUserId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    let extractedData: ExtractedPrescriptionData | null = null;
    let aiExtractionMetadata = null;

    // Try AI extraction if enabled
    if (use_ai_extraction && (file_url || file_base64)) {
      try {
        console.log('🤖 [PRESCRIPTION UPLOAD] Extracting prescription data...', {
          hasFileUrl: !!file_url,
          hasBase64: !!file_base64
        });
        
        // Use base64 if provided, otherwise use file_url
        if (file_base64) {
          console.log('📤 [PRESCRIPTION UPLOAD] Using base64 data');
          extractedData = await extractPrescriptionDataFromBase64(
            file_base64,
            file_type || 'image/jpeg'
          );
        } else if (file_url) {
          console.log('📤 [PRESCRIPTION UPLOAD] Using file URL');
          extractedData = await extractPrescriptionData(file_url, file_type || 'image/jpeg');
        }
        
        aiExtractionMetadata = {
          extracted_at: new Date(),
          confidence: extractedData?.confidence || 0,
          raw_extraction: extractedData
        };
        console.log(`✅ [PRESCRIPTION UPLOAD] Extraction complete. Confidence: ${extractedData?.confidence || 0}`);
      } catch (error: any) {
        console.error('❌ [PRESCRIPTION UPLOAD] Extraction failed:', error.message);
        // Continue with manual data if AI fails
      }
    }

    // Use manual data if provided, otherwise use AI extracted data
    const prescriptionData = manual_data || {
      diagnosis: extractedData?.diagnosis || '',
      medications: extractedData?.medications || [],
      lab_tests: extractedData?.lab_tests || [],
      advice: extractedData?.advice,
      follow_up_date: extractedData?.follow_up_date,
      prescription_date: extractedData?.prescription_date || visit.visit_date
    };

    // Create prescription
    const prescription = await PastPrescription.create({
      prescription_id: generatePrescriptionId(),
      appointment_id,
      patient_id: visit.patient_id,
      patient_name: visit.patient_name,
      doctor_name: visit.doctor_name,
      doctor_specialty: visit.doctor_specialty || extractedData?.doctor_specialty,
      diagnosis: prescriptionData.diagnosis,
      medications: prescriptionData.medications || [],
      lab_tests: prescriptionData.lab_tests || [],
      advice: prescriptionData.advice,
      follow_up_date: prescriptionData.follow_up_date ? new Date(prescriptionData.follow_up_date) : null,
      file_url: file_url || '',
      file_name: file_name || 'prescription.pdf',
      file_type: file_type || 'application/pdf',
      prescription_date: prescriptionData.prescription_date ? new Date(prescriptionData.prescription_date) : visit.visit_date,
      is_ai_extracted: use_ai_extraction && extractedData !== null,
      ai_extraction_metadata: aiExtractionMetadata,
      created_by: currentUserId,
      is_active: true
    });

    console.log(`✅ [PRESCRIPTION] Created: ${prescription.prescription_id}`);

    res.status(201).json({
      message: 'Prescription uploaded successfully',
      prescription,
      ai_extraction: extractedData ? {
        success: true,
        confidence: extractedData.confidence,
        data: extractedData
      } : { success: false }
    });
  } catch (error: any) {
    console.error('❌ [PRESCRIPTION] Error:', error);
    res.status(500).json({ message: 'Failed to upload prescription', error: error.message });
  }
};

/**
 * Upload receipt document
 */
export const uploadReceipt = async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user?.userId;
    if (!currentUserId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    // Get appointment_id from URL params (route: /:appointment_id/receipt)
    const appointment_id = req.params.appointment_id;

    const {
      receipt_type, // 'consultation', 'medicine', 'test', 'other'
      file_url,
      file_base64,
      file_name,
      file_type,
      file_size,
      use_ai_extraction = true,
      manual_data
    } = req.body;

    // Validate - appointment_id comes from URL params
    if (!appointment_id || !receipt_type) {
      return res.status(400).json({ message: 'appointment_id (in URL) and receipt_type are required' });
    }
    
    if (!file_url && !file_base64) {
      return res.status(400).json({ message: 'Either file_url or file_base64 is required' });
    }

    // Verify past visit exists and user has access
    const visit = await PastVisit.findOne({
      where: { appointment_id, is_active: true }
    });

    if (!visit) {
      return res.status(404).json({ message: 'Past visit not found' });
    }

    if (visit.created_by !== currentUserId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    let extractedData: ExtractedReceiptData | null = null;
    let aiExtractionMetadata = null;
    let pharmacy = null;
    let diagnosticsCenter = null;

    // Try AI extraction if enabled
    if (use_ai_extraction && (file_url || file_base64)) {
      try {
        console.log(`🤖 [RECEIPT UPLOAD] Extracting ${receipt_type} receipt data...`, {
          hasFileUrl: !!file_url,
          hasBase64: !!file_base64
        });
        
        // Use base64 if provided, otherwise use file_url
        if (file_base64) {
          console.log('📤 [RECEIPT UPLOAD] Using base64 data');
          extractedData = await extractReceiptDataFromBase64(
            file_base64,
            file_type || 'image/jpeg',
            receipt_type
          );
        } else if (file_url) {
          console.log('📤 [RECEIPT UPLOAD] Using file URL');
          extractedData = await extractReceiptData(file_url, file_type || 'image/jpeg', receipt_type);
        }
        aiExtractionMetadata = {
          extracted_at: new Date(),
          confidence: extractedData.confidence || 0,
          raw_extraction: extractedData
        };
        console.log(`✅ [AI] Extraction complete. Confidence: ${extractedData.confidence || 0}`);

        // Extract repository information based on receipt type
        if (receipt_type === 'medicine' && extractedData.pharmacy_name) {
          // Find or create pharmacy
          pharmacy = await Pharmacy.findOne({
            where: {
              [Op.or]: [
                { name: { [Op.iLike]: extractedData.pharmacy_name } },
                { phone: extractedData.pharmacy_phone }
              ],
              is_active: true
            }
          });

          if (!pharmacy) {
            pharmacy = await Pharmacy.create({
              name: extractedData.pharmacy_name,
              address: extractedData.pharmacy_address,
              area: extractedData.pharmacy_address?.split(',')[0],
              phone: extractedData.pharmacy_phone,
              is_verified: false,
              usage_count: 1,
              is_active: true
            });
            console.log(`✅ [PHARMACY] Created: ${pharmacy.name}`);
          } else {
            await pharmacy.update({
              usage_count: pharmacy.usage_count + 1
            });
          }
        }

        if (receipt_type === 'test' && extractedData.diagnostics_center_name) {
          // Find or create diagnostics center
          diagnosticsCenter = await DiagnosticsCenter.findOne({
            where: {
              [Op.or]: [
                { name: { [Op.iLike]: extractedData.diagnostics_center_name } },
                { phone: extractedData.diagnostics_center_phone }
              ],
              is_active: true
            }
          });

          if (!diagnosticsCenter) {
            diagnosticsCenter = await DiagnosticsCenter.create({
              name: extractedData.diagnostics_center_name,
              address: extractedData.diagnostics_center_address,
              area: extractedData.diagnostics_center_address?.split(',')[0],
              phone: extractedData.diagnostics_center_phone,
              is_verified: false,
              usage_count: 1,
              is_active: true
            });
            console.log(`✅ [DIAGNOSTICS] Created: ${diagnosticsCenter.name}`);
          } else {
            await diagnosticsCenter.update({
              usage_count: diagnosticsCenter.usage_count + 1
            });
          }
        }
      } catch (error: any) {
        console.error('❌ [AI] Extraction failed:', error.message);
      }
    }

    // Use manual data if provided, otherwise use AI extracted data
    const receiptData = manual_data || {
      amount: extractedData?.amount || extractedData?.total_amount,
      payment_method: extractedData?.payment_method,
      receipt_date: extractedData?.receipt_date || visit.visit_date,
      extracted_data: {
        invoice_number: extractedData?.invoice_number,
        items: extractedData?.medicines || extractedData?.tests || [],
        total_amount: extractedData?.total_amount,
        tax_amount: extractedData?.tax_amount,
        discount: extractedData?.discount
      }
    };

    // Create receipt
    const receipt = await Receipt.create({
      receipt_id: generateReceiptId(),
      appointment_id,
      patient_id: visit.patient_id,
      patient_name: visit.patient_name,
      receipt_type: receipt_type as any,
      amount: receiptData.amount,
      payment_method: receiptData.payment_method,
      receipt_date: receiptData.receipt_date ? new Date(receiptData.receipt_date) : visit.visit_date,
      pharmacy_id: pharmacy?.id,
      pharmacy_name: extractedData?.pharmacy_name || manual_data?.pharmacy_name,
      pharmacy_address: extractedData?.pharmacy_address || manual_data?.pharmacy_address,
      diagnostics_center_id: diagnosticsCenter?.id,
      diagnostics_center_name: extractedData?.diagnostics_center_name || manual_data?.diagnostics_center_name,
      diagnostics_center_address: extractedData?.diagnostics_center_address || manual_data?.diagnostics_center_address,
      file_url,
      file_name: file_name || 'receipt.pdf',
      file_type: file_type || 'application/pdf',
      file_size: file_size || 0,
      is_ai_extracted: use_ai_extraction && extractedData !== null,
      ai_extraction_metadata: aiExtractionMetadata,
      extracted_data: receiptData.extracted_data,
      created_by: currentUserId,
      is_active: true
    });

    console.log(`✅ [RECEIPT] Created: ${receipt.receipt_id}`);

    res.status(201).json({
      message: 'Receipt uploaded successfully',
      receipt,
      repository_created: {
        pharmacy: pharmacy ? { id: pharmacy.id, name: pharmacy.name } : null,
        diagnostics_center: diagnosticsCenter ? { id: diagnosticsCenter.id, name: diagnosticsCenter.name } : null
      },
      ai_extraction: extractedData ? {
        success: true,
        confidence: extractedData.confidence,
        data: extractedData
      } : { success: false }
    });
  } catch (error: any) {
    console.error('❌ [RECEIPT] Error:', error);
    res.status(500).json({ message: 'Failed to upload receipt', error: error.message });
  }
};

/**
 * Upload test result document
 */
export const uploadTestResult = async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user?.userId;
    if (!currentUserId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    // Get appointment_id from URL params (route: /:appointment_id/test-result)
    const appointment_id = req.params.appointment_id;

    const {
      file_url,
      file_base64,
      file_name,
      file_type,
      file_size,
      use_ai_extraction = true,
      manual_data
    } = req.body;

    // Validate - appointment_id comes from URL params
    if (!appointment_id) {
      return res.status(400).json({ message: 'appointment_id is required in URL' });
    }
    
    if (!file_url && !file_base64) {
      return res.status(400).json({ message: 'Either file_url or file_base64 is required' });
    }

    // Verify past visit exists and user has access
    const visit = await PastVisit.findOne({
      where: { appointment_id, is_active: true }
    });

    if (!visit) {
      return res.status(404).json({ message: 'Past visit not found' });
    }

    if (visit.created_by !== currentUserId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    let extractedData: ExtractedTestResultData | null = null;
    let aiExtractionMetadata = null;
    let diagnosticsCenter = null;

    // Try AI extraction if enabled
    if (use_ai_extraction && (file_url || file_base64)) {
      try {
        console.log('🤖 [TEST RESULT UPLOAD] Extracting test result data...', {
          hasFileUrl: !!file_url,
          hasBase64: !!file_base64
        });
        
        // Use base64 if provided, otherwise use file_url
        if (file_base64) {
          console.log('📤 [TEST RESULT UPLOAD] Using base64 data');
          extractedData = await extractTestResultDataFromBase64(
            file_base64,
            file_type || 'image/jpeg'
          );
        } else if (file_url) {
          console.log('📤 [TEST RESULT UPLOAD] Using file URL');
          extractedData = await extractTestResultData(file_url, file_type || 'image/jpeg');
        }
        aiExtractionMetadata = {
          extracted_at: new Date(),
          confidence: extractedData.confidence || 0,
          raw_extraction: extractedData
        };
        console.log(`✅ [AI] Extraction complete. Confidence: ${extractedData.confidence || 0}`);

        // Extract diagnostics center if found
        if (extractedData.diagnostics_center_name) {
          diagnosticsCenter = await DiagnosticsCenter.findOne({
            where: {
              [Op.or]: [
                { name: { [Op.iLike]: extractedData.diagnostics_center_name } }
              ],
              is_active: true
            }
          });

          if (!diagnosticsCenter) {
            diagnosticsCenter = await DiagnosticsCenter.create({
              name: extractedData.diagnostics_center_name,
              is_verified: false,
              usage_count: 1,
              is_active: true
            });
          } else {
            await diagnosticsCenter.update({
              usage_count: diagnosticsCenter.usage_count + 1
            });
          }
        }
      } catch (error: any) {
        console.error('❌ [AI] Extraction failed:', error.message);
      }
    }

    // Use manual data if provided, otherwise use AI extracted data
    const testData = manual_data || {
      test_name: extractedData?.test_name || 'Test Report',
      test_category: extractedData?.test_category || 'Lab Test',
      test_date: extractedData?.test_date || visit.visit_date,
      test_time: extractedData?.test_time || null,
      parameters: extractedData?.parameters || [],
      interpretation: extractedData?.interpretation,
      notes: extractedData?.notes
    };

    // Create test result
    const testResult = await PastTestResult.create({
      test_result_id: generateTestResultId(),
      appointment_id,
      patient_id: visit.patient_id,
      patient_name: visit.patient_name,
      test_name: testData.test_name,
      test_category: testData.test_category,
      test_date: testData.test_date ? new Date(testData.test_date) : visit.visit_date,
      parameters: testData.parameters || [],
      diagnostics_center_id: diagnosticsCenter?.id,
      diagnostics_center_name: extractedData?.diagnostics_center_name,
      interpretation: testData.interpretation,
      notes: testData.notes,
      file_url,
      file_name: file_name || 'test_result.pdf',
      file_type: file_type || 'application/pdf',
      file_size: file_size || 0,
      is_ai_extracted: use_ai_extraction && extractedData !== null,
      ai_extraction_metadata: aiExtractionMetadata,
      created_by: currentUserId,
      is_active: true
    });

    console.log(`✅ [TEST RESULT] Created: ${testResult.test_result_id}`);

    // Save test parameters to vital parameters database
    const testParameters = testData.parameters || [];
    const testDate = testData.test_date ? new Date(testData.test_date) : visit.visit_date;
    const testTime = testData.test_time || null;

    const savedVitals: Array<{
      parameter_name: string;
      normalized_name?: string;
      value: number;
      unit: string;
      category?: string;
      subcategory?: string | null;
    }> = [];
    
    if (testParameters.length > 0) {
      console.log(`📊 [VITALS] Processing ${testParameters.length} parameters from test result...`);
      console.log(`📅 [VITALS] Test date: ${testDate.toISOString().split('T')[0]}`);
      console.log(`🕐 [VITALS] Test time: ${testTime || 'N/A'}`);
      
      let processedCount = 0;
      
      for (const param of testParameters) {
        processedCount++;
        try {
          console.log(`📝 [VITALS] Processing parameter ${processedCount}/${testParameters.length}: ${param.parameter_name} = ${param.value} ${param.unit || ''}`);
          
          // Skip if value is not numeric or is a string like "normal"/"abnormal"
          let numericValue: number | null = null;
          if (typeof param.value === 'number') {
            numericValue = param.value;
          } else if (typeof param.value === 'string') {
            // Try to parse numeric value from string
            const parsed = parseFloat(param.value);
            if (!isNaN(parsed)) {
              numericValue = parsed;
            } else {
              // Skip non-numeric values
              console.log(`⚠️ [VITALS] Skipping parameter ${param.parameter_name}: non-numeric value "${param.value}"`);
              continue;
            }
          } else {
            console.log(`⚠️ [VITALS] Skipping parameter ${param.parameter_name}: invalid value type`);
            continue;
          }

          // Normalize parameter name (standardize common variations)
          let normalizedParamName = param.parameter_name.trim();
          
          // Common name mappings
          const nameMappings: Record<string, string> = {
            'hb': 'Hemoglobin',
            'hemoglobin': 'Hemoglobin',
            'hba1c': 'HbA1c',
            'glycated hemoglobin': 'HbA1c',
            'fbs': 'Fasting Blood Sugar',
            'fbg': 'Fasting Blood Sugar',
            'fasting glucose': 'Fasting Blood Sugar',
            'ppbs': 'Post-Prandial Blood Sugar',
            'pp': 'Post-Prandial Blood Sugar',
            'rbs': 'Random Blood Sugar',
            'random glucose': 'Random Blood Sugar',
            'total cholesterol': 'Total Cholesterol',
            'hdl': 'HDL Cholesterol',
            'ldl': 'LDL Cholesterol',
            'triglycerides': 'Triglycerides',
            'systolic': 'Systolic BP',
            'diastolic': 'Diastolic BP',
            'systolic bp': 'Systolic BP',
            'diastolic bp': 'Diastolic BP',
            'creatinine': 'Serum Creatinine',
            'serum creatinine': 'Serum Creatinine',
            'bun': 'Blood Urea Nitrogen',
            'blood urea nitrogen': 'Blood Urea Nitrogen',
            'sgpt': 'SGPT/ALT',
            'sgot': 'SGOT/AST',
            'alt': 'SGPT/ALT',
            'ast': 'SGOT/AST',
            'bilirubin': 'Total Bilirubin',
            'tsh': 'TSH',
            't3': 'T3',
            't4': 'T4',
            'free t3': 'Free T3',
            'free t4': 'Free T4'
          };
          
          const lowerParamName = normalizedParamName.toLowerCase();
          if (nameMappings[lowerParamName]) {
            normalizedParamName = nameMappings[lowerParamName];
            console.log(`🔄 [VITALS] Normalized parameter name: "${param.parameter_name}" -> "${normalizedParamName}"`);
          }
          
          // Find or get category from parameter definition
          let category = 'general';
          let subcategory: string | null = null;
          
          // Try to find existing parameter definition to get category
          const paramDef = await VitalParameterDefinition.findOne({
            where: {
              parameter_name: { [Op.iLike]: normalizedParamName }
            }
          });

          if (paramDef) {
            category = paramDef.category || 'general';
            subcategory = paramDef.subcategory || null;
            console.log(`📋 [VITALS] Found parameter definition for "${normalizedParamName}": category="${category}"`);
          } else {
            // Map based on parameter name (more reliable than test category)
            const lowerName = normalizedParamName.toLowerCase();
            
            // Diabetes parameters
            if (lowerName.includes('blood sugar') || lowerName.includes('glucose') || lowerName.includes('fbs') || 
                lowerName.includes('ppbs') || lowerName.includes('rbs') || lowerName.includes('hba1c') || 
                lowerName.includes('glycated')) {
              category = 'diabetes';
              subcategory = 'blood_sugar';
            }
            // Cardiac/Lipid parameters
            else if (lowerName.includes('cholesterol') || lowerName.includes('hdl') || lowerName.includes('ldl') || 
                     lowerName.includes('triglyceride') || lowerName.includes('vldl') || 
                     lowerName.includes('systolic') || lowerName.includes('diastolic') || lowerName.includes('bp')) {
              category = 'cardiac';
              subcategory = lowerName.includes('bp') ? 'blood_pressure' : 'lipid_profile';
            }
            // Kidney parameters
            else if (lowerName.includes('creatinine') || lowerName.includes('urea') || lowerName.includes('bun') || 
                     lowerName.includes('uric acid')) {
              category = 'general';
              subcategory = 'kidney_function';
            }
            // Liver parameters
            else if (lowerName.includes('sgpt') || lowerName.includes('sgot') || lowerName.includes('alt') || 
                     lowerName.includes('ast') || lowerName.includes('bilirubin') || lowerName.includes('albumin') ||
                     lowerName.includes('protein')) {
              category = 'general';
              subcategory = 'liver_function';
            }
            // Thyroid parameters
            else if (lowerName.includes('tsh') || lowerName.includes('t3') || lowerName.includes('t4')) {
              category = 'general';
              subcategory = 'thyroid_function';
            }
            // Blood count parameters
            else if (lowerName.includes('hemoglobin') || lowerName.includes('rbc') || lowerName.includes('wbc') || 
                     lowerName.includes('platelet') || lowerName.includes('hematocrit') || lowerName.includes('mcv') ||
                     lowerName.includes('mch') || lowerName.includes('mchc')) {
              category = 'general';
              subcategory = 'blood_count';
            }
            // Use test category as fallback
            else {
              const testCategory = testData.test_category?.toLowerCase() || '';
              if (testCategory.includes('diabetes') || testCategory.includes('sugar')) {
                category = 'diabetes';
              } else if (testCategory.includes('cardiac') || testCategory.includes('lipid') || testCategory.includes('cholesterol')) {
                category = 'cardiac';
              } else {
                category = 'general';
              }
            }
            
            console.log(`📋 [VITALS] Mapped parameter "${normalizedParamName}" to category="${category}", subcategory="${subcategory}"`);
          }

          // Use normal ranges from parameter if available, otherwise from definition (search by normalized name)
          let normalRangeMin = param.normal_range_min ?? paramDef?.default_normal_range_min ?? null;
          let normalRangeMax = param.normal_range_max ?? paramDef?.default_normal_range_max ?? null;
          
          // If paramDef not found with original name, try with normalized name
          if (!paramDef && normalizedParamName !== param.parameter_name) {
            const normalizedParamDef = await VitalParameterDefinition.findOne({
              where: {
                parameter_name: { [Op.iLike]: normalizedParamName }
              }
            });
            if (normalizedParamDef) {
              normalRangeMin = param.normal_range_min ?? normalizedParamDef.default_normal_range_min ?? null;
              normalRangeMax = param.normal_range_max ?? normalizedParamDef.default_normal_range_max ?? null;
              category = normalizedParamDef.category || category;
              subcategory = normalizedParamDef.subcategory || subcategory;
            }
          }
          
          // Determine if abnormal (use provided flag or calculate)
          let isAbnormal = param.is_abnormal ?? false;
          if (normalRangeMin !== null && normalRangeMax !== null && numericValue !== null) {
            isAbnormal = numericValue < normalRangeMin || numericValue > normalRangeMax;
          }

          // Create vital parameter record
          const vitalParam = await VitalParameter.create({
            patient_id: visit.patient_id,
            parameter_name: normalizedParamName, // Use normalized name
            value: numericValue,
            unit: param.unit || '',
            recorded_date: testDate,
            recorded_time: testTime ? (testTime.includes(':') ? testTime : `${testTime}:00`) : null,
            normal_range_min: normalRangeMin,
            normal_range_max: normalRangeMax,
            category: category,
            subcategory: subcategory,
            is_abnormal: isAbnormal,
            source: 'test_report',
            test_result_id: testResult.id,
            appointment_id: appointment_id,
            recorded_by: currentUserId,
            is_active: true
          });

          savedVitals.push({
            parameter_name: vitalParam.parameter_name,
            normalized_name: normalizedParamName,
            value: numericValue,
            unit: param.unit || '',
            category,
            subcategory
          });
          console.log(`✅ [VITALS] Saved: ${vitalParam.parameter_name} = ${numericValue} ${param.unit || ''} (category: ${category}${subcategory ? `, subcategory: ${subcategory}` : ''})`);
        } catch (error: any) {
          console.error(`❌ [VITALS] Error saving parameter ${param.parameter_name}:`, error.message);
          console.error(`❌ [VITALS] Error stack:`, error.stack);
          // Continue with other parameters
        }
      }

      const savedCount = savedVitals.length;
      const skippedCount = testParameters.length - savedCount;
      
      console.log(`\n📊 [VITALS] Processing Summary:`);
      console.log(`   Total parameters found: ${testParameters.length}`);
      console.log(`   Successfully saved: ${savedCount}`);
      console.log(`   Skipped: ${skippedCount}`);
      
      if (savedCount > 0) {
        console.log(`\n✅ [VITALS] Saved parameters list:`);
        savedVitals.forEach((v, idx) => {
          console.log(`   ${idx + 1}. ${v.parameter_name} = ${v.value} ${v.unit} (${v.category}${v.subcategory ? ` / ${v.subcategory}` : ''})`);
        });
        console.log(`\n📅 [VITALS] Test date: ${testDate.toISOString().split('T')[0]}`);
        console.log(`🕐 [VITALS] Test time: ${testTime || 'N/A'}`);
      } else {
        console.log(`\n⚠️ [VITALS] WARNING: No parameters were saved!`);
        console.log(`   Check if values are numeric and parameter names are valid.`);
      }
    } else {
      console.log(`⚠️ [VITALS] No parameters found in test result to save`);
    }

    res.status(201).json({
      message: 'Test result uploaded successfully',
      test_result: testResult,
      repository_created: diagnosticsCenter ? { id: diagnosticsCenter.id, name: diagnosticsCenter.name } : null,
      ai_extraction: extractedData ? {
        success: true,
        confidence: extractedData.confidence,
        data: extractedData
      } : { success: false },
      vitals_saved: testParameters.length > 0 ? {
        total_parameters: testParameters.length,
        saved_count: savedVitals.length,
        skipped_count: testParameters.length - savedVitals.length,
        parameter_names: savedVitals.map(v => typeof v === 'string' ? v : v.parameter_name),
        parameters_detail: savedVitals.map(v => typeof v === 'string' ? { parameter_name: v } : v),
        test_date: testDate.toISOString().split('T')[0],
        test_time: testTime || null
      } : null
    });
  } catch (error: any) {
    console.error('❌ [TEST RESULT] Error:', error);
    res.status(500).json({ message: 'Failed to upload test result', error: error.message });
  }
};

/**
 * Update prescription
 */
export const updatePrescription = async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user?.userId;
    if (!currentUserId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const { prescription_id } = req.params;
    const updateData = req.body;

    const prescription = await PastPrescription.findOne({
      where: { prescription_id, is_active: true }
    });

    if (!prescription) {
      return res.status(404).json({ message: 'Prescription not found' });
    }

    // Verify access
    if (prescription.created_by !== currentUserId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await prescription.update(updateData);

    console.log(`✅ [PRESCRIPTION] Updated: ${prescription_id}`);

    res.json({
      message: 'Prescription updated successfully',
      prescription
    });
  } catch (error: any) {
    console.error('❌ [PRESCRIPTION] Error:', error);
    res.status(500).json({ message: 'Failed to update prescription', error: error.message });
  }
};

/**
 * Delete prescription (soft delete)
 */
export const deletePrescription = async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user?.userId;
    if (!currentUserId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const { prescription_id } = req.params;

    const prescription = await PastPrescription.findOne({
      where: { prescription_id, is_active: true }
    });

    if (!prescription) {
      return res.status(404).json({ message: 'Prescription not found' });
    }

    // Verify access
    if (prescription.created_by !== currentUserId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await prescription.update({ is_active: false });

    console.log(`✅ [PRESCRIPTION] Deleted: ${prescription_id}`);

    res.json({
      message: 'Prescription deleted successfully'
    });
  } catch (error: any) {
    console.error('❌ [PRESCRIPTION] Error:', error);
    res.status(500).json({ message: 'Failed to delete prescription', error: error.message });
  }
};

/**
 * Update receipt
 */
export const updateReceipt = async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user?.userId;
    if (!currentUserId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const { receipt_id } = req.params;
    const updateData = req.body;

    const receipt = await Receipt.findOne({
      where: { receipt_id, is_active: true }
    });

    if (!receipt) {
      return res.status(404).json({ message: 'Receipt not found' });
    }

    // Verify access
    if (receipt.created_by !== currentUserId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await receipt.update(updateData);

    console.log(`✅ [RECEIPT] Updated: ${receipt_id}`);

    res.json({
      message: 'Receipt updated successfully',
      receipt
    });
  } catch (error: any) {
    console.error('❌ [RECEIPT] Error:', error);
    res.status(500).json({ message: 'Failed to update receipt', error: error.message });
  }
};

/**
 * Delete receipt (soft delete)
 */
export const deleteReceipt = async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user?.userId;
    if (!currentUserId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const { receipt_id } = req.params;

    const receipt = await Receipt.findOne({
      where: { receipt_id, is_active: true }
    });

    if (!receipt) {
      return res.status(404).json({ message: 'Receipt not found' });
    }

    // Verify access
    if (receipt.created_by !== currentUserId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await receipt.update({ is_active: false });

    console.log(`✅ [RECEIPT] Deleted: ${receipt_id}`);

    res.json({
      message: 'Receipt deleted successfully'
    });
  } catch (error: any) {
    console.error('❌ [RECEIPT] Error:', error);
    res.status(500).json({ message: 'Failed to delete receipt', error: error.message });
  }
};

/**
 * Update test result
 */
export const updateTestResult = async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user?.userId;
    if (!currentUserId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const { test_result_id } = req.params;
    const updateData = req.body;

    const testResult = await PastTestResult.findOne({
      where: { test_result_id, is_active: true }
    });

    if (!testResult) {
      return res.status(404).json({ message: 'Test result not found' });
    }

    // Verify access
    if (testResult.created_by !== currentUserId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await testResult.update(updateData);

    console.log(`✅ [TEST RESULT] Updated: ${test_result_id}`);

    res.json({
      message: 'Test result updated successfully',
      test_result: testResult
    });
  } catch (error: any) {
    console.error('❌ [TEST RESULT] Error:', error);
    res.status(500).json({ message: 'Failed to update test result', error: error.message });
  }
};

/**
 * Delete test result (soft delete)
 */
export const deleteTestResult = async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user?.userId;
    if (!currentUserId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const { test_result_id } = req.params;

    const testResult = await PastTestResult.findOne({
      where: { test_result_id, is_active: true }
    });

    if (!testResult) {
      return res.status(404).json({ message: 'Test result not found' });
    }

    // Verify access
    if (testResult.created_by !== currentUserId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await testResult.update({ is_active: false });

    console.log(`✅ [TEST RESULT] Deleted: ${test_result_id}`);

    res.json({
      message: 'Test result deleted successfully'
    });
  } catch (error: any) {
    console.error('❌ [TEST RESULT] Error:', error);
    res.status(500).json({ message: 'Failed to delete test result', error: error.message });
  }
};

