/**
 * Test the fixed Gemini model name
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

if (!GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY is not set. See GEMINI-GCP-SECRET-SETUP.md');
  process.exit(1);
}

async function testFixedModel() {
  console.log('🔍 Testing Fixed Model Name\n');
  
  const modelName = 'gemini-2.5-flash';
  console.log(`Testing model: ${modelName}\n`);
  
  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: modelName });
    
    console.log('📤 Sending test request...');
    const result = await model.generateContent('Say "Hello, Gemini API is working!"');
    const response = await result.response;
    const text = response.text();
    
    console.log('✅ SUCCESS! Model is working!');
    console.log(`📥 Response: ${text}\n`);
    
    // Now test with base64 image
    console.log('📤 Testing base64 image parsing...');
    const testBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    
    const prompt = `Analyze this image and return ONLY valid JSON:
{
  "doctor_name": "extracted name or empty string",
  "clinic_name": "extracted clinic or empty string",
  "confidence": 0.5
}`;
    
    const imageResult = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: 'image/png',
          data: testBase64,
        },
      },
    ]);
    
    const imageResponse = await imageResult.response;
    const imageText = imageResponse.text();
    
    console.log('✅ Base64 image parsing works!');
    console.log(`📥 Response: ${imageText.substring(0, 200)}\n`);
    
    console.log('🎉 All tests passed! The model name is correct.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Details:', error.toString());
  }
}

testFixedModel();

