/**
 * Document Extraction Controllers
 * Extract-only endpoints for prescriptions and test results (similar to receipt extraction)
 */

import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import {
  extractPrescriptionDataFromBase64,
  extractTestResultDataFromBase64,
  extractPrescriptionData,
  extractTestResultData,
  ExtractedPrescriptionData,
  ExtractedTestResultData
} from '../services/geminiAIService';

/**
 * Extract prescription data only (without creating visit or uploading)
 * This allows frontend to populate form fields
 */
export const extractPrescriptionDataOnly = async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user?.userId;
    if (!currentUserId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const {
      file_url,
      file_base64,
      file_type,
      use_ai_extraction = true
    } = req.body;

    // Validate - accept either file_url (for public URLs) or file_base64 (for direct upload)
    if (!file_url && !file_base64) {
      return res.status(400).json({ message: 'Either file_url or file_base64 is required' });
    }

    let extractedData: ExtractedPrescriptionData | null = null;
    let aiExtractionMetadata = null;

    // Try AI extraction if enabled
    if (use_ai_extraction) {
      try {
        console.log('🤖 [PRESCRIPTION EXTRACT] Extracting prescription data...', {
          hasFileUrl: !!file_url,
          hasBase64: !!file_base64,
          fileType: file_type
        });

        // Use base64 if provided, otherwise use file_url
        if (file_base64) {
          console.log('📤 [PRESCRIPTION EXTRACT] Using base64 data directly');
          extractedData = await extractPrescriptionDataFromBase64(
            file_base64,
            file_type || 'image/jpeg'
          );
        } else if (file_url) {
          console.log('📤 [PRESCRIPTION EXTRACT] Using file URL');
          extractedData = await extractPrescriptionData(
            file_url,
            file_type || 'image/jpeg'
          );
        }

        aiExtractionMetadata = {
          extracted_at: new Date(),
          confidence: extractedData?.confidence || 0,
          raw_extraction: extractedData
        };
        console.log(`✅ [PRESCRIPTION EXTRACT] Extraction complete. Confidence: ${extractedData?.confidence || 0}`);
        console.log(`📋 [PRESCRIPTION EXTRACT] Extracted: Doctor: ${extractedData?.doctor_name || 'N/A'}, Clinic: ${extractedData?.clinic_name || 'N/A'}, Medications: ${extractedData?.medications?.length || 0}`);
      } catch (error: any) {
        console.error('❌ [PRESCRIPTION EXTRACT] AI extraction error:', error.message);
        console.error('❌ [PRESCRIPTION EXTRACT] Error stack:', error.stack);
        return res.status(500).json({ 
          message: 'Failed to extract prescription data',
          error: error.message,
          extracted_data: null
        });
      }
    }

    if (!extractedData) {
      return res.status(400).json({ message: 'No prescription data extracted. Please check the file and try again.' });
    }

    // Return extracted data for form population
    res.status(200).json({
      message: 'Prescription data extracted successfully',
      extracted_data: extractedData,
      ai_confidence: extractedData.confidence || null,
      ai_extraction_metadata: aiExtractionMetadata,
      can_create_visit: !!(extractedData.doctor_name && extractedData.prescription_date)
    });

  } catch (error: any) {
    console.error('❌ [PRESCRIPTION EXTRACT] Error:', error);
    res.status(500).json({ 
      message: 'Failed to extract prescription data',
      error: error.message 
    });
  }
};

/**
 * Extract test result data only (without creating visit or uploading)
 * This allows frontend to populate form fields
 */
export const extractTestResultDataOnly = async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user?.userId;
    if (!currentUserId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const {
      file_url,
      file_base64,
      file_type,
      use_ai_extraction = true
    } = req.body;

    // Validate - accept either file_url (for public URLs) or file_base64 (for direct upload)
    if (!file_url && !file_base64) {
      return res.status(400).json({ message: 'Either file_url or file_base64 is required' });
    }

    let extractedData: ExtractedTestResultData | null = null;
    let aiExtractionMetadata = null;

    // Try AI extraction if enabled
    if (use_ai_extraction) {
      try {
        console.log('🤖 [TEST RESULT EXTRACT] Extracting test result data...', {
          hasFileUrl: !!file_url,
          hasBase64: !!file_base64,
          fileType: file_type
        });

        // Use base64 if provided, otherwise use file_url
        if (file_base64) {
          console.log('📤 [TEST RESULT EXTRACT] Using base64 data directly');
          extractedData = await extractTestResultDataFromBase64(
            file_base64,
            file_type || 'image/jpeg'
          );
        } else if (file_url) {
          console.log('📤 [TEST RESULT EXTRACT] Using file URL');
          extractedData = await extractTestResultData(
            file_url,
            file_type || 'image/jpeg'
          );
        }

        aiExtractionMetadata = {
          extracted_at: new Date(),
          confidence: extractedData?.confidence || 0,
          raw_extraction: extractedData
        };
        console.log(`✅ [TEST RESULT EXTRACT] Extraction complete. Confidence: ${extractedData?.confidence || 0}`);
        console.log(`📋 [TEST RESULT EXTRACT] Extracted: Test: ${extractedData?.test_name || 'N/A'}, Parameters: ${extractedData?.parameters?.length || 0}`);
      } catch (error: any) {
        console.error('❌ [TEST RESULT EXTRACT] AI extraction error:', error.message);
        console.error('❌ [TEST RESULT EXTRACT] Error stack:', error.stack);
        return res.status(500).json({ 
          message: 'Failed to extract test result data',
          error: error.message,
          extracted_data: null
        });
      }
    }

    if (!extractedData) {
      return res.status(400).json({ message: 'No test result data extracted. Please check the file and try again.' });
    }

    // Return extracted data for form population
    res.status(200).json({
      message: 'Test result data extracted successfully',
      extracted_data: extractedData,
      ai_confidence: extractedData.confidence || null,
      ai_extraction_metadata: aiExtractionMetadata
    });

  } catch (error: any) {
    console.error('❌ [TEST RESULT EXTRACT] Error:', error);
    res.status(500).json({ 
      message: 'Failed to extract test result data',
      error: error.message 
    });
  }
};

