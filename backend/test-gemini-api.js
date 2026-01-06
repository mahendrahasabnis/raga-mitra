/**
 * Step-by-step Gemini API Verification Script
 * This script tests the Gemini API connection and document extraction
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyAXyFZy83Xe2i3pJjP2sK444xmQ4uwkjZg';

console.log('════════════════════════════════════════════════════════════════');
console.log('🔍 Step-by-Step Gemini API Verification');
console.log('════════════════════════════════════════════════════════════════');
console.log('');

// Step 1: Verify API Key
console.log('📋 STEP 1: Verifying Gemini API Key');
console.log('────────────────────────────────────────────────────────────────');
if (!GEMINI_API_KEY || GEMINI_API_KEY === '') {
  console.error('❌ ERROR: GEMINI_API_KEY is not configured!');
  console.error('   Please set GEMINI_API_KEY in your environment variables or .env file');
  process.exit(1);
}

if (GEMINI_API_KEY.length < 20) {
  console.error('❌ ERROR: GEMINI_API_KEY appears to be invalid (too short)');
  process.exit(1);
}

console.log('✅ API Key found:', GEMINI_API_KEY.substring(0, 10) + '...' + GEMINI_API_KEY.substring(GEMINI_API_KEY.length - 4));
console.log('✅ API Key length:', GEMINI_API_KEY.length, 'characters');
console.log('');

// Step 2: Initialize Gemini AI
console.log('📋 STEP 2: Initializing Google Generative AI Client');
console.log('────────────────────────────────────────────────────────────────');
try {
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  console.log('✅ GoogleGenerativeAI client initialized successfully');
  console.log('');
} catch (error) {
  console.error('❌ ERROR: Failed to initialize GoogleGenerativeAI:', error.message);
  process.exit(1);
}

// Step 3: Test Basic Connection
console.log('📋 STEP 3: Testing Basic API Connection');
console.log('────────────────────────────────────────────────────────────────');
async function testBasicConnection() {
  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
    
    console.log('📤 Sending test request to Gemini API...');
    const result = await model.generateContent('Say "Hello" if you can read this.');
    const response = await result.response;
    const text = response.text();
    
    console.log('✅ API Connection successful!');
    console.log('📥 Response:', text.substring(0, 100));
    console.log('');
    return true;
  } catch (error) {
    console.error('❌ ERROR: Failed to connect to Gemini API');
    console.error('   Error message:', error.message);
    console.error('   Error details:', error.toString());
    if (error.stack) {
      console.error('   Stack trace:', error.stack.split('\n').slice(0, 5).join('\n'));
    }
    console.log('');
    return false;
  }
}

// Step 4: Test Document Parsing (Text Mode)
console.log('📋 STEP 4: Testing Document Parsing (Text Mode)');
console.log('────────────────────────────────────────────────────────────────');
async function testTextParsing() {
  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
    
    const prompt = `Extract information from this text and return ONLY valid JSON:
    
Doctor: Dr. John Smith
Clinic: Health Clinic
Date: 2024-01-15
Fee: 500

Return JSON: {"doctor_name": "...", "clinic_name": "...", "receipt_date": "...", "consultation_fee": ...}`;
    
    console.log('📤 Sending text extraction request...');
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    console.log('✅ Text parsing successful!');
    console.log('📥 Raw response:', text.substring(0, 200));
    
    // Try to parse JSON
    let jsonText = text.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/g, '').trim();
    }
    
    try {
      const parsed = JSON.parse(jsonText);
      console.log('✅ JSON parsing successful!');
      console.log('📊 Extracted data:', JSON.stringify(parsed, null, 2));
      console.log('');
      return true;
    } catch (parseError) {
      console.warn('⚠️  WARNING: Response is not valid JSON');
      console.warn('   Response text:', text.substring(0, 300));
      console.log('');
      return false;
    }
  } catch (error) {
    console.error('❌ ERROR: Failed to parse text');
    console.error('   Error:', error.message);
    console.log('');
    return false;
  }
}

// Step 5: Test Base64 Image Parsing
console.log('📋 STEP 5: Testing Base64 Image Parsing');
console.log('────────────────────────────────────────────────────────────────');
async function testBase64ImageParsing() {
  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
    
    // Create a simple 1x1 pixel red PNG as base64 (for testing)
    // This is a minimal valid PNG image
    const testBase64Image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    
    const prompt = `Analyze this image and return ONLY valid JSON with this structure:
{
  "doctor_name": "extracted doctor name or empty string",
  "clinic_name": "extracted clinic name or empty string",
  "receipt_date": "YYYY-MM-DD or empty string",
  "consultation_fee": 0 or null,
  "confidence": 0.5
}

If you cannot extract information, return all fields as empty strings with confidence 0.5. Return ONLY the JSON object, no markdown, no code blocks.`;
    
    console.log('📤 Sending base64 image parsing request...');
    console.log('   Base64 length:', testBase64Image.length);
    
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: 'image/png',
          data: testBase64Image,
        },
      },
    ]);
    
    const response = await result.response;
    const text = response.text();
    
    console.log('✅ Base64 image parsing successful!');
    console.log('📥 Raw response:', text.substring(0, 200));
    
    // Try to parse JSON
    let jsonText = text.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/g, '').trim();
    }
    
    try {
      const parsed = JSON.parse(jsonText);
      console.log('✅ JSON parsing successful!');
      console.log('📊 Extracted data:', JSON.stringify(parsed, null, 2));
      console.log('');
      return true;
    } catch (parseError) {
      console.warn('⚠️  WARNING: Response is not valid JSON');
      console.warn('   Response text:', text.substring(0, 300));
      console.log('');
      return false;
    }
  } catch (error) {
    console.error('❌ ERROR: Failed to parse base64 image');
    console.error('   Error message:', error.message);
    console.error('   Error details:', error.toString());
    if (error.code) {
      console.error('   Error code:', error.code);
    }
    if (error.status) {
      console.error('   HTTP status:', error.status);
    }
    console.log('');
    return false;
  }
}

// Run all tests
async function runAllTests() {
  console.log('');
  console.log('🚀 Running all verification tests...');
  console.log('');
  
  const results = {
    basicConnection: false,
    textParsing: false,
    base64Parsing: false,
  };
  
  results.basicConnection = await testBasicConnection();
  
  if (results.basicConnection) {
    results.textParsing = await testTextParsing();
    results.base64Parsing = await testBase64ImageParsing();
  }
  
  // Summary
  console.log('════════════════════════════════════════════════════════════════');
  console.log('📊 VERIFICATION SUMMARY');
  console.log('════════════════════════════════════════════════════════════════');
  console.log('');
  console.log('✅ Basic API Connection:', results.basicConnection ? 'PASS' : 'FAIL');
  console.log('✅ Text Parsing:', results.textParsing ? 'PASS' : 'FAIL');
  console.log('✅ Base64 Image Parsing:', results.base64Parsing ? 'PASS' : 'FAIL');
  console.log('');
  
  if (results.basicConnection && results.textParsing && results.base64Parsing) {
    console.log('🎉 All tests passed! Gemini API is working correctly.');
  } else {
    console.log('⚠️  Some tests failed. Please check the errors above.');
    if (!results.basicConnection) {
      console.log('');
      console.log('💡 Troubleshooting:');
      console.log('   1. Verify GEMINI_API_KEY is correct');
      console.log('   2. Check if the API key has proper permissions');
      console.log('   3. Verify internet connection');
      console.log('   4. Check if @google/generative-ai package is installed');
    }
  }
  console.log('');
}

// Execute
runAllTests().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

