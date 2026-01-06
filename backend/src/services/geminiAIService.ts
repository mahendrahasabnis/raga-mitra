/**
 * Gemini AI Document Intelligence Service
 * Extracts structured data from medical documents (prescriptions, receipts, test results)
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

export interface ExtractedPrescriptionData {
  doctor_name?: string;
  doctor_specialty?: string;
  clinic_name?: string;
  diagnosis?: string;
  medications?: Array<{
    medicine_name: string;
    dosage: string;
    frequency: string;
    duration: string;
    timing?: string;
    instructions?: string;
    quantity?: number;
  }>;
  lab_tests?: string[];
  advice?: string;
  follow_up_date?: string;
  prescription_date?: string;
  confidence?: number;
}

export interface ExtractedReceiptData {
  receipt_type: 'consultation' | 'medicine' | 'test' | 'other';
  amount?: number;
  payment_method?: string;
  receipt_date?: string;
  invoice_number?: string;
  // For medicine receipts
  pharmacy_name?: string;
  pharmacy_address?: string;
  pharmacy_phone?: string;
  medicines?: Array<{
    name: string;
    quantity?: number;
    price?: number;
    total?: number;
  }>;
  // For test receipts
  diagnostics_center_name?: string;
  diagnostics_center_address?: string;
  diagnostics_center_phone?: string;
  tests?: Array<{
    name: string;
    price?: number;
  }>;
  // For consultation receipts
  doctor_name?: string;
  doctor_specialty?: string;
  clinic_name?: string;
  consultation_fee?: number;
  // Address fields for consultation receipts
  clinic_address?: string;
  area?: string;
  city?: string;
  pincode?: string;
  state?: string;
  // General
  total_amount?: number;
  tax_amount?: number;
  discount?: number;
  confidence?: number;
}

export interface ExtractedTestResultData {
  test_name?: string;
  test_category?: string;
  test_date?: string;
  test_time?: string; // Time in HH:MM:SS or HH:MM format
  diagnostics_center_name?: string;
  parameters?: Array<{
    parameter_name: string;
    value: number | string;
    unit: string;
    normal_range_min?: number;
    normal_range_max?: number;
    is_abnormal?: boolean;
  }>;
  interpretation?: string;
  notes?: string;
  confidence?: number;
}

/**
 * Download file from URL and convert to base64
 */
async function downloadFileAsBase64(fileUrl: string): Promise<{ mimeType: string; data: string }> {
  try {
    let fetchFunc: any;
    
    // Use global fetch (Node 18+) or import dynamically for older versions
    if (typeof fetch !== 'undefined') {
      fetchFunc = fetch;
    } else {
      const nodeFetch = await import('node-fetch');
      fetchFunc = (nodeFetch as any).default || nodeFetch;
    }
    
    const response = await fetchFunc(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Data = buffer.toString('base64');

    // Determine MIME type from response headers
    let contentType = 'image/jpeg'; // default
    if (response.headers) {
      if (typeof response.headers.get === 'function') {
        contentType = response.headers.get('content-type') || contentType;
      } else if ((response.headers as any)['content-type']) {
        contentType = (response.headers as any)['content-type'];
      }
    }
    
    return {
      mimeType: contentType,
      data: base64Data
    };
  } catch (error: any) {
    console.error('❌ [GEMINI AI] Error downloading file:', error.message);
    throw error;
  }
}

/**
 * Parse document using Gemini Vision API - accepts base64 data directly
 */
async function parseDocumentFromBase64(base64Data: string, prompt: string, mimeType: string): Promise<any> {
  try {
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    console.log('🤖 [GEMINI AI] Starting document parsing with base64 data...', {
      mimeType,
      base64Length: base64Data.length
    });

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: mimeType || 'image/jpeg',
          data: base64Data,
        },
      },
    ]);

    const response = await result.response;
    const text = response.text();
    
    console.log('📄 [GEMINI AI] Raw response received:', text.substring(0, 200) + '...');
    
    // Try to extract JSON from the response (Gemini sometimes wraps it in markdown)
    let jsonText = text.trim();
    // Remove markdown code blocks if present
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/g, '').trim();
    }
    
    // Parse JSON response
    try {
      const parsed = JSON.parse(jsonText);
      console.log('✅ [GEMINI AI] Successfully parsed JSON response');
      return parsed;
    } catch (parseError: any) {
      // If not JSON, return as text and let the caller parse it
      console.warn('⚠️ [GEMINI AI] Response is not valid JSON:', parseError.message);
      console.warn('⚠️ [GEMINI AI] Response text:', text.substring(0, 500));
      return { raw_text: text, json_parse_error: true };
    }
  } catch (error: any) {
    console.error('❌ [GEMINI AI] Error parsing document:', error.message);
    console.error('❌ [GEMINI AI] Error stack:', error.stack);
    throw error;
  }
}

/**
 * Parse image or PDF file URL using Gemini Vision API
 */
async function parseDocument(fileUrl: string, prompt: string, fileType?: string): Promise<any> {
  try {
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    
    // Download file and convert to base64
    const fileData = await downloadFileAsBase64(fileUrl);
    
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: fileData.mimeType || fileType || 'image/jpeg',
          data: fileData.data,
        },
      },
    ]);

    const response = await result.response;
    const text = response.text();
    
    // Try to extract JSON from the response (Gemini sometimes wraps it in markdown)
    let jsonText = text.trim();
    // Remove markdown code blocks if present
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/g, '').trim();
    }
    
    // Parse JSON response
    try {
      return JSON.parse(jsonText);
    } catch (parseError) {
      // If not JSON, return as text and let the caller parse it
      console.warn('⚠️ [GEMINI AI] Response is not valid JSON, returning as text');
      return { raw_text: text, json_parse_error: true };
    }
  } catch (error: any) {
    console.error('❌ [GEMINI AI] Error parsing document:', error.message);
    throw error;
  }
}

/**
 * Extract prescription data from base64 image/PDF data
 */
export async function extractPrescriptionDataFromBase64(
  base64Data: string,
  fileType: string
): Promise<ExtractedPrescriptionData> {
  const prompt = `You are a medical document analysis AI. Analyze this prescription document image and extract structured data.

Return ONLY a valid JSON object (no markdown, no code blocks, just pure JSON) with this exact structure:
{
  "doctor_name": "Dr. Name or empty string if not found",
  "doctor_specialty": "Specialty or empty string",
  "clinic_name": "Clinic Name or empty string",
  "diagnosis": "Diagnosis text or empty string",
  "medications": [
    {
      "medicine_name": "Medicine name",
      "dosage": "500mg",
      "frequency": "Twice daily",
      "duration": "7 days",
      "timing": "After meals or empty string",
      "instructions": "Additional instructions or empty string",
      "quantity": 10 or null
    }
  ],
  "lab_tests": ["Test 1", "Test 2"] or empty array,
  "advice": "General advice or empty string",
  "follow_up_date": "YYYY-MM-DD or empty string",
  "prescription_date": "YYYY-MM-DD or empty string",
  "confidence": 0.95
}

Extract all medication information you can find. If any field is not found, use empty string for text fields, empty array for arrays, null for numbers. Return ONLY the JSON object, nothing else.`;

  try {
    const extracted = await parseDocumentFromBase64(base64Data, prompt, fileType);
    
    // If JSON parsing failed, return empty structure
    if (extracted.json_parse_error) {
      console.warn('⚠️ [GEMINI AI] Failed to parse JSON, returning empty structure');
      return {
        confidence: 0.3,
      };
    }
    
    return {
      doctor_name: extracted.doctor_name || '',
      doctor_specialty: extracted.doctor_specialty || '',
      clinic_name: extracted.clinic_name || '',
      diagnosis: extracted.diagnosis || '',
      medications: extracted.medications || [],
      lab_tests: extracted.lab_tests || [],
      advice: extracted.advice || '',
      follow_up_date: extracted.follow_up_date || '',
      prescription_date: extracted.prescription_date || '',
      confidence: extracted.confidence || 0.7,
    };
  } catch (error: any) {
    console.error('❌ [GEMINI AI] Error extracting prescription from base64:', error.message);
    console.error('❌ [GEMINI AI] Error stack:', error.stack);
    return {
      confidence: 0,
    };
  }
}

/**
 * Extract prescription data from image/PDF (URL-based, kept for backward compatibility)
 */
export async function extractPrescriptionData(fileUrl: string, fileType: string): Promise<ExtractedPrescriptionData> {
  const prompt = `You are a medical document analysis AI. Analyze this prescription document image and extract structured data.

Return ONLY a valid JSON object (no markdown, no code blocks, just pure JSON) with this exact structure:
{
  "doctor_name": "Dr. Name or empty string if not found",
  "doctor_specialty": "Specialty or empty string",
  "clinic_name": "Clinic Name or empty string",
  "diagnosis": "Diagnosis text or empty string",
  "medications": [
    {
      "medicine_name": "Medicine name",
      "dosage": "500mg",
      "frequency": "Twice daily",
      "duration": "7 days",
      "timing": "After meals or empty string",
      "instructions": "Additional instructions or empty string",
      "quantity": 10 or null
    }
  ],
  "lab_tests": ["Test 1", "Test 2"] or empty array,
  "advice": "General advice or empty string",
  "follow_up_date": "YYYY-MM-DD or empty string",
  "prescription_date": "YYYY-MM-DD or empty string",
  "confidence": 0.95
}

Extract all medication information you can find. If any field is not found, use empty string for text fields, empty array for arrays, null for numbers. Return ONLY the JSON object, nothing else.`;

  try {
    const extracted = await parseDocument(fileUrl, prompt, fileType);
    
    // If JSON parsing failed, return empty structure
    if (extracted.json_parse_error) {
      console.warn('⚠️ [GEMINI AI] Failed to parse JSON, returning empty structure');
      return {
        confidence: 0.3,
      };
    }
    
    return {
      doctor_name: extracted.doctor_name || '',
      doctor_specialty: extracted.doctor_specialty || '',
      clinic_name: extracted.clinic_name || '',
      diagnosis: extracted.diagnosis || '',
      medications: extracted.medications || [],
      lab_tests: extracted.lab_tests || [],
      advice: extracted.advice || '',
      follow_up_date: extracted.follow_up_date || '',
      prescription_date: extracted.prescription_date || '',
      confidence: extracted.confidence || 0.7,
    };
  } catch (error: any) {
    console.error('❌ [GEMINI AI] Error extracting prescription:', error.message);
    return {
      confidence: 0,
    };
  }
}

/**
 * Extract receipt data from base64 image/PDF data
 */
export async function extractReceiptDataFromBase64(
  base64Data: string,
  fileType: string,
  receiptType: 'consultation' | 'medicine' | 'test' | 'other'
): Promise<ExtractedReceiptData> {
  const typeSpecificPrompt = {
    consultation: `Extract consultation receipt data. Look for: doctor name, doctor specialty (if mentioned), clinic name, clinic address (including area, city, state, pincode), consultation fee, date, payment method, invoice number. Extract full address and parse into area, city, state, and pincode fields separately if available. Return pharmacy_name and diagnostics_center_name as empty strings.`,
    medicine: `Extract medicine purchase receipt. Look for: pharmacy name, address, phone, medicine names with quantities and prices, total amount, tax, discount, payment method, date. Return doctor_name and diagnostics_center_name as empty strings. Include medicines array with name, quantity, price, total for each.`,
    test: `Extract diagnostic test receipt. Look for: diagnostics center name, address, phone, test names with prices, total amount, tax, payment method, date. Return doctor_name and pharmacy_name as empty strings. Include tests array with name and price for each.`,
    other: `Extract receipt data. Look for: amount, date, payment method, invoice number, items, total, tax. Return doctor_name, pharmacy_name, and diagnostics_center_name as empty strings.`,
  };

  const prompt = `You are a receipt analysis AI. Analyze this ${receiptType} receipt document and extract structured data.

${typeSpecificPrompt[receiptType]}

Return ONLY a valid JSON object (no markdown, no code blocks, just pure JSON) with this structure:
{
  "receipt_type": "${receiptType}",
  "amount": 500.00 or null,
  "payment_method": "Cash/Card/UPI or empty string",
  "receipt_date": "YYYY-MM-DD or empty string",
  "invoice_number": "Invoice number or empty string",
  "pharmacy_name": "Pharmacy name or empty string",
  "pharmacy_address": "Address or empty string",
  "pharmacy_phone": "Phone or empty string",
  "diagnostics_center_name": "Center name or empty string",
  "diagnostics_center_address": "Address or empty string",
  "diagnostics_center_phone": "Phone or empty string",
  "doctor_name": "Doctor name or empty string",
  "doctor_specialty": "Doctor specialty or empty string",
  "clinic_name": "Clinic name or empty string",
  "clinic_address": "Full clinic address or empty string",
  "area": "Area/locality or empty string",
  "city": "City name or empty string",
  "state": "State name or empty string",
  "pincode": "PIN code (6 digits) or empty string",
  "consultation_fee": 300.00 or null,
  "medicines": [{"name": "Medicine", "quantity": 10, "price": 50.00, "total": 500.00}] or empty array,
  "tests": [{"name": "Test", "price": 500.00}] or empty array,
  "total_amount": 500.00 or null,
  "tax_amount": 50.00 or null,
  "discount": 0.00 or null,
  "confidence": 0.95
}

If any field is not found, use empty string for text, empty array for arrays, null for numbers. Return ONLY the JSON object.`;

  try {
    const extracted = await parseDocumentFromBase64(base64Data, prompt, fileType);
    
    if (extracted.json_parse_error) {
      console.warn('⚠️ [GEMINI AI] Failed to parse JSON, returning empty structure');
      return {
        receipt_type: receiptType,
        confidence: 0.3,
      };
    }
    
    return {
      receipt_type: receiptType,
      amount: extracted.amount || extracted.total_amount || null,
      payment_method: extracted.payment_method || '',
      receipt_date: extracted.receipt_date || '',
      invoice_number: extracted.invoice_number || '',
      pharmacy_name: extracted.pharmacy_name || '',
      pharmacy_address: extracted.pharmacy_address || '',
      pharmacy_phone: extracted.pharmacy_phone || '',
      diagnostics_center_name: extracted.diagnostics_center_name || '',
      diagnostics_center_address: extracted.diagnostics_center_address || '',
      diagnostics_center_phone: extracted.diagnostics_center_phone || '',
      doctor_name: extracted.doctor_name || '',
      doctor_specialty: extracted.doctor_specialty || '',
      clinic_name: extracted.clinic_name || '',
      clinic_address: extracted.clinic_address || '',
      area: extracted.area || '',
      city: extracted.city || '',
      state: extracted.state || '',
      pincode: extracted.pincode || '',
      consultation_fee: extracted.consultation_fee || null,
      medicines: extracted.medicines || [],
      tests: extracted.tests || [],
      total_amount: extracted.total_amount || extracted.amount || null,
      tax_amount: extracted.tax_amount || null,
      discount: extracted.discount || null,
      confidence: extracted.confidence || 0.7,
    };
  } catch (error: any) {
    console.error('❌ [GEMINI AI] Error extracting receipt from base64:', error.message);
    console.error('❌ [GEMINI AI] Error stack:', error.stack);
    return {
      receipt_type: receiptType,
      confidence: 0,
    };
  }
}

/**
 * Extract receipt data from image/PDF
 */
export async function extractReceiptData(
  fileUrl: string,
  fileType: string,
  receiptType: 'consultation' | 'medicine' | 'test' | 'other'
): Promise<ExtractedReceiptData> {
  const typeSpecificPrompt = {
    consultation: `Extract consultation receipt data. Look for: doctor name, doctor specialty (if mentioned), clinic name, clinic address (including area, city, state, pincode), consultation fee, date, payment method, invoice number. Extract full address and parse into area, city, state, and pincode fields separately if available. Return pharmacy_name and diagnostics_center_name as empty strings.`,
    medicine: `Extract medicine purchase receipt. Look for: pharmacy name, address, phone, medicine names with quantities and prices, total amount, tax, discount, payment method, date. Return doctor_name and diagnostics_center_name as empty strings. Include medicines array with name, quantity, price, total for each.`,
    test: `Extract diagnostic test receipt. Look for: diagnostics center name, address, phone, test names with prices, total amount, tax, payment method, date. Return doctor_name and pharmacy_name as empty strings. Include tests array with name and price for each.`,
    other: `Extract receipt data. Look for: amount, date, payment method, invoice number, items, total, tax. Return doctor_name, pharmacy_name, and diagnostics_center_name as empty strings.`,
  };

  const prompt = `You are a receipt analysis AI. Analyze this ${receiptType} receipt document and extract structured data.

${typeSpecificPrompt[receiptType]}

Return ONLY a valid JSON object (no markdown, no code blocks, just pure JSON) with this structure:
{
  "receipt_type": "${receiptType}",
  "amount": 500.00 or null,
  "payment_method": "Cash/Card/UPI or empty string",
  "receipt_date": "YYYY-MM-DD or empty string",
  "invoice_number": "Invoice number or empty string",
  "pharmacy_name": "Pharmacy name or empty string",
  "pharmacy_address": "Address or empty string",
  "pharmacy_phone": "Phone or empty string",
  "diagnostics_center_name": "Center name or empty string",
  "diagnostics_center_address": "Address or empty string",
  "diagnostics_center_phone": "Phone or empty string",
  "doctor_name": "Doctor name or empty string",
  "doctor_specialty": "Doctor specialty or empty string",
  "clinic_name": "Clinic name or empty string",
  "clinic_address": "Full clinic address or empty string",
  "area": "Area/locality or empty string",
  "city": "City name or empty string",
  "state": "State name or empty string",
  "pincode": "PIN code (6 digits) or empty string",
  "consultation_fee": 300.00 or null,
  "medicines": [{"name": "Medicine", "quantity": 10, "price": 50.00, "total": 500.00}] or empty array,
  "tests": [{"name": "Test", "price": 500.00}] or empty array,
  "total_amount": 500.00 or null,
  "tax_amount": 50.00 or null,
  "discount": 0.00 or null,
  "confidence": 0.95
}

If any field is not found, use empty string for text, empty array for arrays, null for numbers. Return ONLY the JSON object.`;

  try {
    const extracted = await parseDocument(fileUrl, prompt, fileType);
    
    if (extracted.json_parse_error) {
      console.warn('⚠️ [GEMINI AI] Failed to parse JSON, returning empty structure');
      return {
        receipt_type: receiptType,
        confidence: 0.3,
      };
    }
    
    return {
      receipt_type: receiptType,
      amount: extracted.amount || extracted.total_amount || null,
      payment_method: extracted.payment_method || '',
      receipt_date: extracted.receipt_date || '',
      invoice_number: extracted.invoice_number || '',
      pharmacy_name: extracted.pharmacy_name || '',
      pharmacy_address: extracted.pharmacy_address || '',
      pharmacy_phone: extracted.pharmacy_phone || '',
      diagnostics_center_name: extracted.diagnostics_center_name || '',
      diagnostics_center_address: extracted.diagnostics_center_address || '',
      diagnostics_center_phone: extracted.diagnostics_center_phone || '',
      doctor_name: extracted.doctor_name || '',
      doctor_specialty: extracted.doctor_specialty || '',
      clinic_name: extracted.clinic_name || '',
      clinic_address: extracted.clinic_address || '',
      area: extracted.area || '',
      city: extracted.city || '',
      state: extracted.state || '',
      pincode: extracted.pincode || '',
      consultation_fee: extracted.consultation_fee || null,
      medicines: extracted.medicines || [],
      tests: extracted.tests || [],
      total_amount: extracted.total_amount || extracted.amount || null,
      tax_amount: extracted.tax_amount || null,
      discount: extracted.discount || null,
      confidence: extracted.confidence || 0.7,
    };
  } catch (error: any) {
    console.error('❌ [GEMINI AI] Error extracting receipt:', error.message);
    return {
      receipt_type: receiptType,
      confidence: 0,
    };
  }
}

/**
 * Extract test result data from base64 image/PDF data
 */
export async function extractTestResultDataFromBase64(
  base64Data: string,
  fileType: string
): Promise<ExtractedTestResultData> {
  const prompt = `You are a medical test result analysis AI. Analyze this test result/report document and extract structured data for vital parameters.

CRITICAL INSTRUCTIONS FOR VITAL PARAMETERS:
1. Extract ONLY numeric values - if value is text like "normal" or "abnormal", try to find the actual numeric value from the report. If no numeric value exists, set value to null and skip in parameters array.
2. Use STANDARDIZED parameter names from this list:
   - Blood Sugar: "Fasting Blood Sugar" (FBG/FBS), "Post-Prandial Blood Sugar" (PPBS), "Random Blood Sugar" (RBS), "HbA1c" (HbA1C/Glycated Hemoglobin)
   - Blood Pressure: "Systolic BP", "Diastolic BP" (extract as separate parameters)
   - Lipid Profile: "Total Cholesterol", "HDL Cholesterol", "LDL Cholesterol", "Triglycerides", "VLDL"
   - Complete Blood Count: "Hemoglobin" (Hb), "RBC Count", "WBC Count", "Platelet Count", "Hematocrit", "MCV", "MCH", "MCHC"
   - Kidney Function: "Serum Creatinine", "Blood Urea Nitrogen" (BUN), "Urea", "Uric Acid"
   - Liver Function: "SGOT/AST", "SGPT/ALT", "Total Bilirubin", "Direct Bilirubin", "Indirect Bilirubin", "Albumin", "Total Protein"
   - Thyroid: "TSH", "T3", "T4", "Free T3", "Free T4"
   - General: "Weight" (in kg), "BMI", "Height" (in cm)
   - Other common: "ESR", "CRP", "Vitamin D", "Vitamin B12", "Folic Acid"
3. Always extract numeric value - NEVER use text values like "normal", "abnormal", "high", "low"
4. Extract normal ranges (min/max) from the report if available
5. Mark is_abnormal as true if value is outside normal range

Return ONLY a valid JSON object (no markdown, no code blocks, just pure JSON) with this EXACT structure:
{
  "test_name": "Complete Blood Count or empty string",
  "test_category": "Blood Test/Urine Test/Metabolic Panel/Diabetes Test/Lipid Profile/Liver Function/Kidney Function/Thyroid Function or empty string",
  "test_date": "YYYY-MM-DD format (extract from report, required if available)",
  "test_time": "HH:MM format (extract if available, otherwise empty string)",
  "diagnostics_center_name": "Lab Name or empty string",
  "parameters": [
    {
      "parameter_name": "Hemoglobin (use standardized name from list above)",
      "value": 14.5 (MUST be numeric, NEVER string - extract actual number from report),
      "unit": "g/dL (extract unit from report)",
      "normal_range_min": 12.0 (extract from report if available, otherwise null),
      "normal_range_max": 16.0 (extract from report if available, otherwise null),
      "is_abnormal": false (true if value outside normal range, false otherwise)
    }
  ],
  "interpretation": "Test interpretation text or empty string",
  "notes": "Additional notes or empty string",
  "confidence": 0.95
}

IMPORTANT:
- If a parameter value cannot be extracted as a number, DO NOT include it in the parameters array
- Use parameter_name exactly as listed in the standardized names above
- Always extract numeric values, units, and normal ranges
- Return empty parameters array [] if no numeric values found
- Return ONLY the JSON object, no other text`;

  try {
    const extracted = await parseDocumentFromBase64(base64Data, prompt, fileType);
    
    if (extracted.json_parse_error) {
      console.warn('⚠️ [GEMINI AI] Failed to parse JSON, returning empty structure');
      return {
        confidence: 0.3,
      };
    }
    
    return {
      test_name: extracted.test_name || '',
      test_category: extracted.test_category || '',
      test_date: extracted.test_date || '',
      test_time: extracted.test_time || '',
      diagnostics_center_name: extracted.diagnostics_center_name || '',
      parameters: extracted.parameters || [],
      interpretation: extracted.interpretation || '',
      notes: extracted.notes || '',
      confidence: extracted.confidence || 0.7,
    };
  } catch (error: any) {
    console.error('❌ [GEMINI AI] Error extracting test result from base64:', error.message);
    console.error('❌ [GEMINI AI] Error stack:', error.stack);
    return {
      confidence: 0,
    };
  }
}

/**
 * Extract test result data from image/PDF (URL-based, kept for backward compatibility)
 */
export async function extractTestResultData(fileUrl: string, fileType: string): Promise<ExtractedTestResultData> {
  const prompt = `You are a medical test result analysis AI. Analyze this test result/report document and extract structured data for vital parameters.

CRITICAL INSTRUCTIONS FOR VITAL PARAMETERS:
1. Extract ONLY numeric values - if value is text like "normal" or "abnormal", try to find the actual numeric value from the report. If no numeric value exists, set value to null and skip in parameters array.
2. Use STANDARDIZED parameter names from this list:
   - Blood Sugar: "Fasting Blood Sugar" (FBG/FBS), "Post-Prandial Blood Sugar" (PPBS), "Random Blood Sugar" (RBS), "HbA1c" (HbA1C/Glycated Hemoglobin)
   - Blood Pressure: "Systolic BP", "Diastolic BP" (extract as separate parameters)
   - Lipid Profile: "Total Cholesterol", "HDL Cholesterol", "LDL Cholesterol", "Triglycerides", "VLDL"
   - Complete Blood Count: "Hemoglobin" (Hb), "RBC Count", "WBC Count", "Platelet Count", "Hematocrit", "MCV", "MCH", "MCHC"
   - Kidney Function: "Serum Creatinine", "Blood Urea Nitrogen" (BUN), "Urea", "Uric Acid"
   - Liver Function: "SGOT/AST", "SGPT/ALT", "Total Bilirubin", "Direct Bilirubin", "Indirect Bilirubin", "Albumin", "Total Protein"
   - Thyroid: "TSH", "T3", "T4", "Free T3", "Free T4"
   - General: "Weight" (in kg), "BMI", "Height" (in cm)
   - Other common: "ESR", "CRP", "Vitamin D", "Vitamin B12", "Folic Acid"
3. Always extract numeric value - NEVER use text values like "normal", "abnormal", "high", "low"
4. Extract normal ranges (min/max) from the report if available
5. Mark is_abnormal as true if value is outside normal range

Return ONLY a valid JSON object (no markdown, no code blocks, just pure JSON) with this EXACT structure:
{
  "test_name": "Complete Blood Count or empty string",
  "test_category": "Blood Test/Urine Test/Metabolic Panel/Diabetes Test/Lipid Profile/Liver Function/Kidney Function/Thyroid Function or empty string",
  "test_date": "YYYY-MM-DD format (extract from report, required if available)",
  "test_time": "HH:MM format (extract if available, otherwise empty string)",
  "diagnostics_center_name": "Lab Name or empty string",
  "parameters": [
    {
      "parameter_name": "Hemoglobin (use standardized name from list above)",
      "value": 14.5 (MUST be numeric, NEVER string - extract actual number from report),
      "unit": "g/dL (extract unit from report)",
      "normal_range_min": 12.0 (extract from report if available, otherwise null),
      "normal_range_max": 16.0 (extract from report if available, otherwise null),
      "is_abnormal": false (true if value outside normal range, false otherwise)
    }
  ],
  "interpretation": "Test interpretation text or empty string",
  "notes": "Additional notes or empty string",
  "confidence": 0.95
}

IMPORTANT:
- If a parameter value cannot be extracted as a number, DO NOT include it in the parameters array
- Use parameter_name exactly as listed in the standardized names above
- Always extract numeric values, units, and normal ranges
- Return empty parameters array [] if no numeric values found
- Return ONLY the JSON object, no other text`;

  try {
    const extracted = await parseDocument(fileUrl, prompt, fileType);
    
    if (extracted.json_parse_error) {
      console.warn('⚠️ [GEMINI AI] Failed to parse JSON, returning empty structure');
      return {
        confidence: 0.3,
      };
    }
    
    return {
      test_name: extracted.test_name || '',
      test_category: extracted.test_category || '',
      test_date: extracted.test_date || '',
      test_time: extracted.test_time || '',
      diagnostics_center_name: extracted.diagnostics_center_name || '',
      parameters: extracted.parameters || [],
      interpretation: extracted.interpretation || '',
      notes: extracted.notes || '',
      confidence: extracted.confidence || 0.7,
    };
  } catch (error: any) {
    console.error('❌ [GEMINI AI] Error extracting test result:', error.message);
    return {
      confidence: 0,
    };
  }
}

/**
 * Generic document text extraction (fallback)
 */
export async function extractTextFromDocument(fileUrl: string, fileType: string): Promise<string> {
  const prompt = 'Extract all text from this document. Return the text as-is.';

  try {
    const result = await parseDocument(fileUrl, prompt);
    return result.raw_text || result.text || '';
  } catch (error: any) {
    console.error('❌ [GEMINI AI] Error extracting text:', error.message);
    return '';
  }
}

