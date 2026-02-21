/**
 * List available Gemini models to find the correct model name
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

if (!GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY is not set. See GEMINI-GCP-SECRET-SETUP.md');
  process.exit(1);
}

async function listModels() {
  try {
    console.log('🔍 Listing available Gemini models...\n');
    
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    
    // Try to list models (if API supports it)
    // Otherwise, we'll try common model names
    
    const modelNames = [
      'gemini-1.5-pro',
      'gemini-1.5-pro-latest',
      'gemini-pro',
      'gemini-pro-vision',
      'gemini-1.5-flash',
      'gemini-1.5-flash-latest',
      'models/gemini-1.5-pro',
      'models/gemini-pro'
    ];
    
    console.log('📋 Testing common model names:\n');
    
    for (const modelName of modelNames) {
      try {
        console.log(`Testing: ${modelName}...`);
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent('Say "OK"');
        const response = await result.response;
        const text = response.text();
        console.log(`✅ ${modelName} - WORKS! Response: ${text.substring(0, 50)}\n`);
        return modelName;
      } catch (error) {
        if (error.message.includes('404') || error.message.includes('not found')) {
          console.log(`❌ ${modelName} - Not found\n`);
        } else {
          console.log(`⚠️  ${modelName} - Error: ${error.message.substring(0, 100)}\n`);
        }
      }
    }
    
    console.log('\n❌ None of the tested model names worked.');
    console.log('Please check the Gemini API documentation for correct model names.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

listModels();

