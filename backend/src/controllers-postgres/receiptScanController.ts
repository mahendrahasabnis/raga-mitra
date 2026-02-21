import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { 
  PastVisit, 
  UnverifiedDoctor, 
  Receipt,
  // Patient // Not yet implemented
} from '../models-postgres';
import {
  extractReceiptData,
  extractReceiptDataFromBase64,
  extractPrescriptionData,
  extractPrescriptionDataFromBase64,
  extractTestResultData,
  extractTestResultDataFromBase64,
  ExtractedReceiptData,
  identifyDocumentType,
  identifyDocumentTypeFromBase64,
  mapIdentifiedTypeToLegacy,
  MEDICAL_DOCUMENT_TYPE_LABELS,
} from '../services/geminiAIService';
import { Op } from 'sequelize';

/**
 * Generate unique appointment ID for past visit
 */
function generateAppointmentId(): string {
  const year = new Date().getFullYear();
  const timestamp = Date.now().toString().slice(-8);
  return `PV-${year}-${timestamp}`;
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
 * Extract receipt data only (without creating visit)
 * This allows frontend to populate form fields
 */
export const extractReceiptDataOnly = async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user?.userId;
    if (!currentUserId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const {
      file_url,
      file_base64,
      file_type,
      receipt_type = 'consultation',
      use_ai_extraction = true
    } = req.body;

    // Validate - accept either file_url (for public URLs) or file_base64 (for direct upload)
    if (!file_url && !file_base64) {
      return res.status(400).json({ message: 'Either file_url or file_base64 is required' });
    }

    let extractedData: ExtractedReceiptData | null = null;
    let aiExtractionMetadata = null;

    // Try AI extraction if enabled
    if (use_ai_extraction) {
      try {
        console.log('🤖 [RECEIPT EXTRACT] Extracting receipt data...', {
          hasFileUrl: !!file_url,
          hasBase64: !!file_base64,
          fileType: file_type,
          receiptType: receipt_type
        });

        // Use base64 if provided, otherwise use file_url
        if (file_base64) {
          console.log('📤 [RECEIPT EXTRACT] Using base64 data directly');
          extractedData = await extractReceiptDataFromBase64(
            file_base64,
            file_type || 'image/jpeg',
            receipt_type
          );
        } else if (file_url) {
          console.log('📤 [RECEIPT EXTRACT] Using file URL');
          extractedData = await extractReceiptData(
            file_url,
            file_type || 'image/jpeg',
            receipt_type
          );
        }

        aiExtractionMetadata = {
          extracted_at: new Date(),
          confidence: extractedData?.confidence || 0,
          raw_extraction: extractedData
        };
        console.log(`✅ [RECEIPT EXTRACT] Extraction complete. Confidence: ${extractedData?.confidence || 0}`);
        console.log(`📋 [RECEIPT EXTRACT] Extracted: Doctor: ${extractedData?.doctor_name || 'N/A'}, Clinic: ${extractedData?.clinic_name || 'N/A'}, Date: ${extractedData?.receipt_date || 'N/A'}`);
      } catch (error: any) {
        console.error('❌ [RECEIPT EXTRACT] AI extraction error:', error.message);
        console.error('❌ [RECEIPT EXTRACT] Error stack:', error.stack);
        return res.status(500).json({ 
          message: 'Failed to extract receipt data',
          error: error.message,
          extracted_data: null
        });
      }
    }

    if (!extractedData) {
      return res.status(400).json({ message: 'No receipt data extracted. Please check the file and try again.' });
    }

    // Return extracted data for form population
    res.status(200).json({
      message: 'Receipt data extracted successfully',
      extracted_data: extractedData,
      ai_confidence: extractedData.confidence || null,
      ai_extraction_metadata: aiExtractionMetadata,
      can_create_visit: !!(extractedData.doctor_name && extractedData.receipt_date)
    });

  } catch (error: any) {
    console.error('❌ [RECEIPT EXTRACT] Error:', error);
    res.status(500).json({ 
      message: 'Failed to extract receipt data',
      error: error.message 
    });
  }
};

/**
 * First identify document type with Gemini, then extract data accordingly.
 * Document types: Dr. fee receipt, Dr. prescription, Dr. diagnostic test advice,
 * Diagnostic test report, Medicine bill, Diagnostic receipt.
 */
export const extractDocumentDataOnly = async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user?.userId;
    if (!currentUserId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const {
      file_url,
      file_base64,
      file_type,
      patient_sex,
      patient_age,
    } = req.body;

    if (!file_url && !file_base64) {
      return res.status(400).json({ message: 'Either file_url or file_base64 is required' });
    }

    // Step 1: Identify document type using Gemini (one of the six medical document types)
    const identified = file_base64
      ? await identifyDocumentTypeFromBase64(file_base64, file_type || 'image/jpeg')
      : await identifyDocumentType(file_url, file_type || 'image/jpeg');

    const document_type = identified.document_type;
    const document_type_label = MEDICAL_DOCUMENT_TYPE_LABELS[document_type] || document_type;
    const legacy = mapIdentifiedTypeToLegacy(identified);

    const detection = {
      document_type,
      document_type_label,
      confidence: identified.confidence,
      legacy_document_type: legacy.document_type,
      receipt_type: legacy.receipt_type,
    };

    console.log('📄 [DOC EXTRACT] Identified document type:', document_type_label, `(${document_type}), confidence: ${identified.confidence}`);

    // Step 2: Route to the appropriate extractor
    if (legacy.document_type === 'prescription') {
      const extracted = file_base64
        ? await extractPrescriptionDataFromBase64(file_base64, file_type || 'image/jpeg')
        : await extractPrescriptionData(file_url, file_type || 'image/jpeg');
      return res.status(200).json({
        document_type,
        document_type_label,
        extracted_data: extracted,
        detection,
      });
    }

    if (legacy.document_type === 'test_result') {
      const patientCtx = { sex: patient_sex, age: patient_age };
      const extracted = file_base64
        ? await extractTestResultDataFromBase64(file_base64, file_type || 'image/jpeg', patientCtx)
        : await extractTestResultData(file_url, file_type || 'image/jpeg', patientCtx);
      return res.status(200).json({
        document_type,
        document_type_label,
        extracted_data: extracted,
        detection,
      });
    }

    const receiptType = legacy.receipt_type || 'other';
    const extractedData = file_base64
      ? await extractReceiptDataFromBase64(file_base64, file_type || 'image/jpeg', receiptType)
      : await extractReceiptData(file_url, file_type || 'image/jpeg', receiptType);

    return res.status(200).json({
      document_type,
      document_type_label,
      receipt_type: receiptType,
      extracted_data: extractedData,
      detection,
    });
  } catch (error: any) {
    console.error('❌ [DOC EXTRACT] Error:', error.message || error);
    return res.status(500).json({ message: 'Failed to extract document', error: error.message });
  }
};

/**
 * Scan consultation receipt and auto-create past visit
 */
export const scanReceiptAndCreateVisit = async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user?.userId;
    if (!currentUserId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const {
      file_url,
      file_name,
      file_type,
      receipt_type = 'consultation',
      use_ai_extraction = true,
      manual_data // If user wants to override extracted data
    } = req.body;

    // Validate
    if (!file_url) {
      return res.status(400).json({ message: 'file_url is required' });
    }

    let extractedData: ExtractedReceiptData | null = null;
    let aiExtractionMetadata = null;

    // Try AI extraction if enabled
    if (use_ai_extraction && file_url) {
      try {
        console.log('🤖 [RECEIPT SCAN] Extracting receipt data...');
        extractedData = await extractReceiptData(
          file_url,
          file_type || 'image/jpeg',
          receipt_type
        );
        aiExtractionMetadata = {
          extracted_at: new Date(),
          confidence: extractedData.confidence || 0,
          raw_extraction: extractedData
        };
        console.log(`✅ [RECEIPT SCAN] Extraction complete. Confidence: ${extractedData.confidence || 0}`);
        console.log(`📋 [RECEIPT SCAN] Extracted: Doctor: ${extractedData.doctor_name}, Clinic: ${extractedData.clinic_name}, Date: ${extractedData.receipt_date}`);
      } catch (error: any) {
        console.error('❌ [RECEIPT SCAN] AI extraction error:', error.message);
        if (!manual_data) {
          return res.status(500).json({ 
            message: 'Failed to extract receipt data. Please provide manual data.',
            error: error.message 
          });
        }
      }
    }

    // Use manual data if provided, otherwise use extracted data
    const receiptData = manual_data || extractedData;
    
    if (!receiptData) {
      return res.status(400).json({ message: 'No receipt data available. Enable AI extraction or provide manual data.' });
    }

    // Always return extracted data even if visit creation fails
    // This allows frontend to populate form and let user complete manually
    const extractedDataResponse = {
      extracted_data: receiptData,
      ai_confidence: extractedData?.confidence || null,
      ai_extraction_metadata: aiExtractionMetadata,
      can_create_visit: !!(receiptData.doctor_name && receiptData.receipt_date)
    };

    // Validate required fields for creating past visit
    if (!receiptData.doctor_name || !receiptData.receipt_date) {
      return res.status(200).json({ 
        message: 'Data extracted successfully. Please review and complete the form manually.',
        ...extractedDataResponse,
        missing_fields: {
          doctor_name: !receiptData.doctor_name,
          receipt_date: !receiptData.receipt_date
        }
      });
    }

    // Get or create patient record (Patient model not yet implemented)
    let patientRecord = null;
    // const { sequelize } = await import('../config/database-integrated');
    // const Patient = sequelize.models.Patient as any;
    // if (Patient) {
    //   patientRecord = await Patient.findOne({
    //     where: { user_id: currentUserId, is_active: true }
    //   });
    //   if (!patientRecord) {
    //     const patientPhone = req.user?.phone;
    //     if (patientPhone) {
    //       patientRecord = await Patient.findOne({
    //         where: { phone: patientPhone, is_active: true }
    //       });
    //     }
    //     if (!patientRecord) {
    //       patientRecord = await Patient.create({
    //         user_id: currentUserId,
    //         phone: req.user?.phone || '',
    //         name: 'Patient',
    //         sex: 'male',
    //         age: 30,
    //         year_of_birth: new Date().getFullYear() - 30,
    //         registered_by: currentUserId,
    //         is_active: true
    //       });
    //     }
    //   }
    // }

    // Parse receipt date
    let visitDate: Date;
    try {
      visitDate = new Date(receiptData.receipt_date);
      if (isNaN(visitDate.getTime())) {
        throw new Error('Invalid date format');
      }
    } catch (error) {
      return res.status(200).json({ 
        message: 'Data extracted successfully. Invalid receipt date format. Please review and correct the date in the form.',
        ...extractedDataResponse,
        date_error: true
      });
    }

    // Check if unverified doctor exists, create if needed
    let unverifiedDoctor = null;
    if (receiptData.doctor_name) {
      unverifiedDoctor = await UnverifiedDoctor.findOne({
        where: {
          doctor_name: { [Op.iLike]: receiptData.doctor_name },
          is_active: true
        }
      });

      if (!unverifiedDoctor && receiptData.clinic_name) {
        unverifiedDoctor = await UnverifiedDoctor.create({
          doctor_name: receiptData.doctor_name,
          specialty: receiptData.doctor_specialty || '',
          clinic_name: receiptData.clinic_name,
          area: receiptData.area || '',
          city: receiptData.city || '',
          pincode: receiptData.pincode || '',
          created_by: currentUserId,
          is_active: true
        });
      }
    }

    // Generate appointment ID
    const appointment_id = generateAppointmentId();

    // Create past visit
    const pastVisit = await PastVisit.create({
      appointment_id,
      patient_id: patientRecord.id,
      patient_name: patientRecord.name,
      patient_phone: patientRecord.phone,
      visit_date: visitDate,
      unverified_doctor_id: unverifiedDoctor?.id || null,
      doctor_name: receiptData.doctor_name,
      doctor_specialty: receiptData.doctor_specialty || '',
      clinic_name: receiptData.clinic_name || '',
      area: receiptData.area || '',
      city: receiptData.city || '',
      pincode: receiptData.pincode || '',
      consultation_fee: receiptData.consultation_fee || receiptData.total_amount || null,
      created_by: currentUserId,
      is_active: true
    });

    // Create receipt record
    const receiptId = generateReceiptId();
    const receipt = await Receipt.create({
      receipt_id: receiptId,
      appointment_id: appointment_id,
      patient_id: patientRecord?.id || null, // Patient model not yet implemented
      patient_name: patientRecord?.name || req.user?.phone || 'Patient',
      receipt_type,
      receipt_date: visitDate,
      doctor_name: receiptData.doctor_name,
      clinic_name: receiptData.clinic_name || '',
      total_amount: receiptData.consultation_fee || receiptData.total_amount || null,
      payment_method: receiptData.payment_method || '',
      invoice_number: receiptData.invoice_number || '',
      file_url: file_url,
      file_name: file_name || `${receipt_type}_receipt.pdf`,
      file_type: file_type || 'application/pdf',
      is_ai_extracted: use_ai_extraction && !!extractedData,
      ai_extraction_metadata: aiExtractionMetadata,
      created_by: currentUserId,
      is_active: true
    });

    console.log(`✅ [RECEIPT SCAN] Past visit created: ${appointment_id}`);

    res.status(201).json({
      message: 'Past visit created from receipt',
      past_visit: {
        id: pastVisit.id,
        appointment_id: pastVisit.appointment_id,
        visit_date: pastVisit.visit_date,
        doctor_name: pastVisit.doctor_name,
        clinic_name: pastVisit.clinic_name,
        consultation_fee: pastVisit.consultation_fee
      },
      receipt: {
        id: receipt.id,
        receipt_id: receipt.receipt_id,
        receipt_type: receipt.receipt_type,
        file_url: receipt.file_url
      },
      extracted_data: extractedData,
      ai_confidence: extractedData?.confidence || null
    });

  } catch (error: any) {
    console.error('❌ [RECEIPT SCAN] Error:', error);
    res.status(500).json({ 
      message: 'Failed to scan receipt and create visit',
      error: error.message 
    });
  }
};
