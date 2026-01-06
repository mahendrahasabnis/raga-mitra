/**
 * Comprehensive Gemini API Diagnostic Script
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyAXyFZy83Xe2i3pJjP2sK444xmQ4uwkjZg';

console.log('════════════════════════════════════════════════════════════════');
console.log('🔍 Comprehensive Gemini API Diagnosis');
console.log('════════════════════════════════════════════════════════════════');
console.log('');

async function diagnose() {
  // Step 1: Verify API Key Format
  console.log('📋 STEP 1: API Key Analysis');
  console.log('────────────────────────────────────────────────────────────────');
  console.log('API Key:', GEMINI_API_KEY.substring(0, 10) + '...' + GEMINI_API_KEY.substring(GEMINI_API_KEY.length - 4));
  console.log('Length:', GEMINI_API_KEY.length);
  console.log('Format check:', GEMINI_API_KEY.startsWith('AIza') ? '✅ Valid format' : '❌ Invalid format');
  console.log('');

  // Step 2: Test Direct API Call
  console.log('📋 STEP 2: Testing Direct API Call');
  console.log('────────────────────────────────────────────────────────────────');
  
  try {
    // Try making a direct HTTP request to check API key validity
    const fetch = require('node-fetch');
    
    const testUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`;
    console.log('Testing API key with direct HTTP request...');
    console.log('URL:', testUrl.substring(0, 80) + '...');
    
    const response = await fetch(testUrl);
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ API Key is valid!');
      console.log('Available models:');
      if (data.models && data.models.length > 0) {
        data.models.forEach(model => {
          console.log(`  - ${model.name}`);
        });
      } else {
        console.log('  (No models returned - check API access)');
      }
    } else {
      console.log('❌ API Key validation failed');
      console.log('Status:', response.status);
      console.log('Response:', JSON.stringify(data, null, 2));
      
      if (data.error) {
        console.log('\nError details:');
        console.log('  Message:', data.error.message);
        console.log('  Status:', data.error.status);
        if (data.error.details) {
          console.log('  Details:', JSON.stringify(data.error.details, null, 2));
        }
      }
    }
    console.log('');
  } catch (error) {
    console.log('❌ Error making direct API call:', error.message);
    console.log('');
  }

  // Step 3: Test with SDK
  console.log('📋 STEP 3: Testing with Google Generative AI SDK');
  console.log('────────────────────────────────────────────────────────────────');
  
  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    
    // Try to list models using the SDK
    console.log('Attempting to use SDK...');
    
    // Try different model names that might work
    const modelsToTry = [
      'gemini-pro',
      'gemini-1.5-pro',
      'gemini-1.5-flash',
      'text-bison-001', // Older model
    ];
    
    for (const modelName of modelsToTry) {
      try {
        console.log(`\nTrying model: ${modelName}`);
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent('Test');
        const response = await result.response;
        const text = response.text();
        console.log(`✅ ${modelName} WORKS! Response: ${text.substring(0, 50)}`);
        break;
      } catch (error) {
        const errorMsg = error.message || error.toString();
        if (errorMsg.includes('404')) {
          console.log(`❌ ${modelName} - Not found (404)`);
        } else if (errorMsg.includes('403')) {
          console.log(`❌ ${modelName} - Access denied (403) - Check API key permissions`);
        } else if (errorMsg.includes('401')) {
          console.log(`❌ ${modelName} - Unauthorized (401) - Invalid API key`);
        } else {
          console.log(`❌ ${modelName} - Error: ${errorMsg.substring(0, 100)}`);
        }
      }
    }
    
  } catch (error) {
    console.log('❌ SDK Error:', error.message);
    if (error.stack) {
      console.log('Stack:', error.stack.split('\n').slice(0, 5).join('\n'));
    }
  }
  
  console.log('');
  
  // Step 4: Recommendations
  console.log('📋 STEP 4: Recommendations');
  console.log('────────────────────────────────────────────────────────────────');
  console.log('If API key validation failed, check:');
  console.log('  1. API key is correct and active in Google Cloud Console');
  console.log('  2. Generative Language API is enabled for your project');
  console.log('  3. API key has proper permissions/scopes');
  console.log('  4. Billing is enabled for your Google Cloud project');
  console.log('  5. Check API key restrictions in Google Cloud Console');
  console.log('');
  console.log('Enable API here:');
  console.log('  https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com');
  console.log('');
  console.log('Check API key here:');
  console.log('  https://console.cloud.google.com/apis/credentials');
  console.log('');
}

diagnose().catch(error => {
  console.error('Fatal error:', error);
});

