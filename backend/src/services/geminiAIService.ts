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

export interface ExtractedAudioSummary {
  summary?: string;
  categories?: string[];
  key_points?: string[];
  chief_complaint?: string;
  vitals?: {
    weight?: string;
    height?: string;
    blood_pressure?: string;
    oxygen_saturation?: string;
  };
  advice?: string;
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
const getGeminiModelName = () => process.env.GEMINI_MODEL || 'gemini-2.5-flash';

const parseGeminiJson = (text: string) => {
  let jsonText = text.trim();
  if (jsonText.startsWith('```json')) {
    jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  } else if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/```\n?/g, '').trim();
  }
  try {
    return JSON.parse(jsonText);
  } catch {
    const start = jsonText.indexOf('{');
    if (start === -1) return { raw_text: text, json_parse_error: true };
    let depth = 0;
    for (let i = start; i < jsonText.length; i += 1) {
      if (jsonText[i] === '{') depth += 1;
      if (jsonText[i] === '}') depth -= 1;
      if (depth === 0) {
        const candidate = jsonText.slice(start, i + 1);
        try {
          return JSON.parse(candidate);
        } catch {
          break;
        }
      }
    }
    return { raw_text: text, json_parse_error: true };
  }
};

async function parseDocumentFromBase64(base64Data: string, prompt: string, mimeType: string): Promise<any> {
  try {
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    console.log('🤖 [GEMINI AI] Starting document parsing with base64 data...', {
      mimeType,
      base64Length: base64Data.length
    });

    const modelName = getGeminiModelName();
    const model = genAI.getGenerativeModel({ model: modelName });
    
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
    
    const parsed = parseGeminiJson(text);
    if (parsed.json_parse_error) {
      console.warn('⚠️ [GEMINI AI] Response is not valid JSON');
      console.warn('⚠️ [GEMINI AI] Response text:', text.substring(0, 500));
      return { ...parsed, model: modelName };
    }
    console.log('✅ [GEMINI AI] Successfully parsed JSON response');
    return parsed;
  } catch (error: any) {
    console.error('❌ [GEMINI AI] Error parsing document:', error.message);
    console.error('❌ [GEMINI AI] Error stack:', error.stack);
    throw error;
  }
}

async function parseAudioFromBase64(base64Data: string, prompt: string, mimeType: string): Promise<any> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured');
  }
  const model = genAI.getGenerativeModel({ model: getGeminiModelName() });
  const result = await model.generateContent([
    prompt,
    {
      inlineData: {
        mimeType: mimeType || 'audio/webm',
        data: base64Data,
      },
    },
  ]);
  const response = await result.response;
  const text = response.text();
  let jsonText = text.trim();
  if (jsonText.startsWith('```json')) {
    jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  } else if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/```\n?/g, '').trim();
  }
  try {
    return JSON.parse(jsonText);
  } catch (parseError) {
    return { raw_text: text, json_parse_error: true };
  }
}

async function parseText(prompt: string): Promise<any> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured');
  }
  const model = genAI.getGenerativeModel({ model: getGeminiModelName() });
  const result = await model.generateContent([prompt]);
  const response = await result.response;
  const text = response.text();
  let jsonText = text.trim();
  if (jsonText.startsWith('```json')) {
    jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  } else if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/```\n?/g, '').trim();
  }
  try {
    return JSON.parse(jsonText);
  } catch (parseError) {
    return { raw_text: text, json_parse_error: true };
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

    const modelName = getGeminiModelName();
    const model = genAI.getGenerativeModel({ model: modelName });
    
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
    
    const parsed = parseGeminiJson(text);
    if (parsed.json_parse_error) {
      console.warn('⚠️ [GEMINI AI] Response is not valid JSON, returning as text');
      return { ...parsed, model: modelName };
    }
    return parsed;
  } catch (error: any) {
    console.error('❌ [GEMINI AI] Error parsing document:', error.message);
    throw error;
  }
}

/** Supported medical document types for classification (Gemini). */
export type MedicalDocumentType =
  | 'dr_fee_receipt'
  | 'dr_prescription'
  | 'dr_diagnostic_test_advice'
  | 'diagnostic_test_report'
  | 'medicine_bill'
  | 'diagnostic_receipt';

export const MEDICAL_DOCUMENT_TYPE_LABELS: Record<MedicalDocumentType, string> = {
  dr_fee_receipt: 'Dr. fee receipt',
  dr_prescription: 'Dr. prescription',
  dr_diagnostic_test_advice: 'Dr. diagnostic test advice',
  diagnostic_test_report: 'Diagnostic test report',
  medicine_bill: 'Medicine bill',
  diagnostic_receipt: 'Diagnostic receipt',
};

const MEDICAL_DOCUMENT_TYPES: MedicalDocumentType[] = [
  'dr_fee_receipt',
  'dr_prescription',
  'dr_diagnostic_test_advice',
  'diagnostic_test_report',
  'medicine_bill',
  'diagnostic_receipt',
];

const IDENTIFY_DOCUMENT_PROMPT = `
You are a medical document classifier. Look at this image and identify the type of document.

Classify into exactly ONE of these types:

- dr_fee_receipt: A receipt or bill for doctor consultation fees (clinic/hospital visit charges, consultation payment).
- dr_prescription: A doctor's prescription (medications, dosage, instructions written by a doctor).
- dr_diagnostic_test_advice: A doctor's advice or slip recommending diagnostic tests/lab tests to be done (test names, no results).
- diagnostic_test_report: A lab or diagnostic test report showing results, values, reference ranges (e.g. blood test, CBC, lipid panel, radiology report).
- medicine_bill: A pharmacy or medicine bill/receipt (list of medicines purchased with prices).
- diagnostic_receipt: A receipt or bill from a diagnostic/lab center for tests done (payment for tests, not the test results).

Return ONLY a valid JSON object with this exact structure (no other text):
{
  "document_type": "dr_fee_receipt" | "dr_prescription" | "dr_diagnostic_test_advice" | "diagnostic_test_report" | "medicine_bill" | "diagnostic_receipt",
  "confidence": 0.0-1.0
}
`;

export interface IdentifiedDocumentType {
  document_type: MedicalDocumentType;
  confidence: number;
}

/**
 * Identify medical document type using Gemini (first step for scan/upload).
 * Returns one of the six supported types for routing to extraction and downstream (appointments, vitals, bills).
 */
export async function identifyDocumentTypeFromBase64(
  base64Data: string,
  fileType: string
): Promise<IdentifiedDocumentType> {
  try {
    const extracted = await parseDocumentFromBase64(base64Data, IDENTIFY_DOCUMENT_PROMPT, fileType);
    if (extracted.json_parse_error) {
      console.warn('⚠️ [GEMINI AI] Document type response was not valid JSON, defaulting to dr_fee_receipt');
      return { document_type: 'dr_fee_receipt', confidence: 0.2 };
    }
    const docType = extracted.document_type;
    const validType = MEDICAL_DOCUMENT_TYPES.includes(docType) ? docType : 'dr_fee_receipt';
    return {
      document_type: validType,
      confidence: typeof extracted.confidence === 'number' ? extracted.confidence : 0.6,
    };
  } catch (error: any) {
    console.error('❌ [GEMINI AI] Error identifying document type:', error.message);
    return { document_type: 'dr_fee_receipt', confidence: 0 };
  }
}

export async function identifyDocumentType(
  fileUrl: string,
  fileType: string
): Promise<IdentifiedDocumentType> {
  try {
    const extracted = await parseDocument(fileUrl, IDENTIFY_DOCUMENT_PROMPT, fileType);
    if (extracted.json_parse_error) {
      return { document_type: 'dr_fee_receipt', confidence: 0.2 };
    }
    const docType = extracted.document_type;
    const validType = MEDICAL_DOCUMENT_TYPES.includes(docType) ? docType : 'dr_fee_receipt';
    return {
      document_type: validType,
      confidence: typeof extracted.confidence === 'number' ? extracted.confidence : 0.6,
    };
  } catch (error: any) {
    console.error('❌ [GEMINI AI] Error identifying document type:', error.message);
    return { document_type: 'dr_fee_receipt', confidence: 0 };
  }
}

/** Map identified type to legacy document_type + receipt_type for existing extraction flows. */
export function mapIdentifiedTypeToLegacy(
  identified: IdentifiedDocumentType
): { document_type: 'prescription' | 'receipt' | 'test_result'; receipt_type?: 'consultation' | 'medicine' | 'test' | 'other' } {
  switch (identified.document_type) {
    case 'dr_prescription':
    case 'dr_diagnostic_test_advice':
      return { document_type: 'prescription', receipt_type: undefined };
    case 'diagnostic_test_report':
      return { document_type: 'test_result', receipt_type: undefined };
    case 'dr_fee_receipt':
      return { document_type: 'receipt', receipt_type: 'consultation' };
    case 'medicine_bill':
      return { document_type: 'receipt', receipt_type: 'medicine' };
    case 'diagnostic_receipt':
      return { document_type: 'receipt', receipt_type: 'test' };
    default:
      return { document_type: 'receipt', receipt_type: 'other' };
  }
}

export async function detectDocumentTypeFromBase64(
  base64Data: string,
  fileType: string
): Promise<{ document_type: 'prescription' | 'receipt'; receipt_type?: 'consultation' | 'medicine' | 'test' | 'other'; confidence: number }> {
  const identified = await identifyDocumentTypeFromBase64(base64Data, fileType);
  const legacy = mapIdentifiedTypeToLegacy(identified);
  return {
    document_type: legacy.document_type === 'test_result' ? 'receipt' : legacy.document_type,
    receipt_type: legacy.receipt_type ?? 'other',
    confidence: identified.confidence,
  };
}

export async function detectDocumentType(
  fileUrl: string,
  fileType: string
): Promise<{ document_type: 'prescription' | 'receipt'; receipt_type?: 'consultation' | 'medicine' | 'test' | 'other'; confidence: number }> {
  const identified = await identifyDocumentType(fileUrl, fileType);
  const legacy = mapIdentifiedTypeToLegacy(identified);
  return {
    document_type: legacy.document_type === 'test_result' ? 'receipt' : legacy.document_type,
    receipt_type: legacy.receipt_type ?? 'other',
    confidence: identified.confidence,
  };
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
        raw_text: extracted.raw_text,
        model: extracted.model
      } as any;
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
        raw_text: extracted.raw_text,
        model: extracted.model
      } as any;
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
        raw_text: extracted.raw_text,
        model: extracted.model
      } as any;
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
        raw_text: extracted.raw_text,
        model: extracted.model
      } as any;
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

export async function summarizeAppointmentAudioFromBase64(
  base64Data: string,
  fileType: string
): Promise<ExtractedAudioSummary> {
  const prompt = `You are a medical scribe assistant. Listen to the audio and extract structured notes.
Return ONLY valid JSON with this shape:
{
  "summary": "Short visit summary",
  "categories": ["History", "Vitals", "Advice", "Prescription", "Diagnostics", "Billing", "Other"],
  "key_points": ["point 1", "point 2"],
  "chief_complaint": "text or empty string",
  "vitals": {
    "weight": "value or empty string",
    "height": "value or empty string",
    "blood_pressure": "value or empty string",
    "oxygen_saturation": "value or empty string"
  },
  "advice": "doctor advice text or empty string",
  "confidence": 0.0
}
If any field is unknown, use empty string or empty arrays. Return only JSON.`;

  try {
    const extracted = await parseAudioFromBase64(base64Data, prompt, fileType || 'audio/webm');
    if (extracted.json_parse_error) {
      return { summary: '', categories: [], confidence: 0.2 };
    }
    return {
      summary: extracted.summary || '',
      categories: extracted.categories || [],
      key_points: extracted.key_points || [],
      chief_complaint: extracted.chief_complaint || '',
      vitals: extracted.vitals || {},
      advice: extracted.advice || '',
      confidence: extracted.confidence || 0.6,
    };
  } catch (error: any) {
    console.error('❌ [GEMINI AI] Error summarizing audio:', error.message);
    return { summary: '', categories: [], confidence: 0 };
  }
}

export async function summarizeAppointmentText(
  transcript: string
): Promise<ExtractedAudioSummary> {
  const prompt = `You are a medical scribe assistant. Analyze this transcript and extract structured notes.
Transcript:
"""
${transcript}
"""

Return ONLY valid JSON with this shape:
{
  "summary": "Short visit summary",
  "categories": ["History", "Vitals", "Advice", "Prescription", "Diagnostics", "Billing", "Other"],
  "key_points": ["point 1", "point 2"],
  "chief_complaint": "text or empty string",
  "vitals": {
    "weight": "value or empty string",
    "height": "value or empty string",
    "blood_pressure": "value or empty string",
    "oxygen_saturation": "value or empty string"
  },
  "advice": "doctor advice text or empty string",
  "confidence": 0.0
}
If any field is unknown, use empty string or empty arrays. Return only JSON.`;

  try {
    const extracted = await parseText(prompt);
    if (extracted.json_parse_error) {
      return { summary: '', categories: [], confidence: 0.2 };
    }
    return {
      summary: extracted.summary || '',
      categories: extracted.categories || [],
      key_points: extracted.key_points || [],
      chief_complaint: extracted.chief_complaint || '',
      vitals: extracted.vitals || {},
      advice: extracted.advice || '',
      confidence: extracted.confidence || 0.6,
    };
  } catch (error: any) {
    console.error('❌ [GEMINI AI] Error summarizing text:', error.message);
    return { summary: '', categories: [], confidence: 0 };
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

/**
 * Extract patient monitoring/vitals data from CSV or spreadsheet text using Gemini.
 * Handles various column names, formats, and "--" for missing values.
 * Returns array of readings: { recorded_at, heart_rate, breath_rate, spo2, temperature, systolic_bp, diastolic_bp, movement }
 */
export async function extractMonitoringDataFromCsvText(csvOrTableText: string): Promise<{
  readings: Array<{
    recorded_at: string;
    heart_rate: number | null;
    breath_rate: number | null;
    spo2: number | null;
    temperature: number | null;
    systolic_bp: number | null;
    diastolic_bp: number | null;
    movement: number | null;
  }>;
}> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const prompt = `You are a medical data extraction assistant. Extract patient monitoring/vitals data from the following CSV or tabular data.

The data may have columns with names like: Timestamp (Device UTC timestamp), HeartRate (BPM), BreathRate (RR), Spo2 (%), Temperature (°F), Systolic BP (mmHg), Diastolic BP (mmHg), Movement, Occupancy, etc.
- "Timestamp" or "recorded_at" or "datetime" = when the reading was taken. Convert to ISO 8601 format (e.g. 2026-01-13T00:00:00.000Z).
- "HeartRate" or "heart_rate" = beats per minute (number)
- "BreathRate" or "breath_rate" = respiratory rate (number)
- "Spo2" or "spo2" = oxygen saturation % (number)
- "Temperature" or "temperature" = in °F (number)
- "Systolic BP" or "systolic_bp" = mmHg (number)
- "Diastolic BP" or "diastolic_bp" = mmHg (number)
- "Movement" = 0 (No Movement) or 1 (Movement). Treat "0 - No Movement", "Off Bed", "No" as 0; "1 - Movement", "On Bed", "Yes" as 1.
- Ignore "Occupancy" and any other columns not listed above.
- Treat "--", empty, "N/A", "NA" as null for numeric fields.
- For dates: "1/13/2026 12:00:00 AM" → ISO format. Assume UTC if no timezone.

Return ONLY valid JSON in this exact format (no markdown, no explanation):
{"readings":[{"recorded_at":"2026-01-13T00:00:00.000Z","heart_rate":72,"breath_rate":16,"spo2":98,"temperature":98.6,"systolic_bp":120,"diastolic_bp":80,"movement":0},...]}

Each reading must have: recorded_at (string, ISO), heart_rate, breath_rate, spo2, temperature, systolic_bp, diastolic_bp, movement (all number or null).
Extract ALL data rows. Do not skip any rows.

DATA:
\`\`\`
${csvOrTableText}
\`\`\``;

  try {
    const model = genAI.getGenerativeModel({ model: getGeminiModelName() });
    const result = await model.generateContent([prompt]);
    const response = await result.response;
    const text = response.text();
    const parsed = parseGeminiJson(text);
    if (parsed.json_parse_error) {
      console.warn('⚠️ [GEMINI AI] Monitoring extraction response not valid JSON:', text?.substring(0, 300));
      throw new Error('Gemini did not return valid JSON');
    }
    const readings = Array.isArray(parsed?.readings) ? parsed.readings : [];
    return { readings };
  } catch (error: any) {
    console.error('❌ [GEMINI AI] extractMonitoringDataFromCsvText error:', error.message);
    throw error;
  }
}

