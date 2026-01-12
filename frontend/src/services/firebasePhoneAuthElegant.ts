// Firebase Phone Authentication service - ELEGANT SOLUTION
// Based on Firebase documentation: https://firebase.google.com/docs/auth/web/phone-auth

import {
  signInWithPhoneNumber,
  RecaptchaVerifier,
  PhoneAuthProvider,
  signInWithCredential
} from 'firebase/auth';

// Type for confirmation result
type ConfirmationResult = {
  verificationId: string;
  confirm: (verificationCode: string) => Promise<any>;
};

import { auth, RECAPTCHA_SITE_KEY } from '../config/firebase';

interface PhoneAuthResult {
  success: boolean;
  message: string;
  confirmationResult?: ConfirmationResult;
}

class ElegantFirebasePhoneAuthService {
  private recaptchaVerifier: RecaptchaVerifier | null = null;
  private isTestMode: boolean = false;
  private testPhoneNumbers: { [key: string]: string } = {
    '+16505554567': '123456',  // Firebase test number
    '+16505554568': '123456',  // Firebase test number
    '+16505554569': '123456',  // Firebase test number
    // '+919881255701': '123456', // Removed - now using real SMS delivery
  };

  constructor() {
    this.initializeService();
  }

  private initializeService() {
    // Check if we're in development/test mode
    this.isTestMode = import.meta.env.DEV || 
                     window.location.hostname === 'localhost' || 
                     window.location.hostname.includes('dev') ||
                     window.location.hostname.includes('test');
    
    console.log(`🧪 [ELEGANT FIREBASE AUTH] Test mode: ${this.isTestMode}`);
    
    // Only disable app verification for actual test numbers, not for real numbers
    if (this.isTestMode) {
      console.log('🧪 [ELEGANT FIREBASE AUTH] Test mode detected - app verification will be handled per phone number');
      // Don't globally disable app verification - handle per phone number
    }
  }

  /**
   * Initialize reCAPTCHA verifier (elegant version)
   */
  private async initializeRecaptcha(): Promise<boolean> {
    try {
      if (this.recaptchaVerifier) {
        return true; // Already initialized
      }

      console.log('🔐 [ELEGANT FIREBASE AUTH] Initializing reCAPTCHA verifier');
      
      // Create or find reCAPTCHA container
      let container = document.getElementById('recaptcha-container');
      if (!container) {
        container = document.createElement('div');
        container.id = 'recaptcha-container';
        container.style.display = 'none';
        document.body.appendChild(container);
        console.log('🔐 [ELEGANT FIREBASE AUTH] Created reCAPTCHA container');
      }

      // Create reCAPTCHA verifier with elegant settings
      this.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        'size': 'invisible',
        'callback': (_response: string) => {
          console.log('✅ [ELEGANT FIREBASE AUTH] reCAPTCHA solved automatically');
        },
        'expired-callback': () => {
          console.warn('⚠️ [ELEGANT FIREBASE AUTH] reCAPTCHA expired, auto-resolving');
          this.recaptchaVerifier?.render().then((widgetId) => {
            // this.recaptchaVerifier?.reset(widgetId); // reset() method not available in current RecaptchaVerifier type
          });
        }
      });

      // Render the reCAPTCHA verifier
      await this.recaptchaVerifier.render();
      console.log('✅ [ELEGANT FIREBASE AUTH] reCAPTCHA verifier initialized successfully');
      
      return true;
    } catch (error) {
      console.error('❌ [ELEGANT FIREBASE AUTH] Failed to initialize reCAPTCHA:', error);
      return false;
    }
  }

  /**
   * Check if phone number is a test number
   */
  private isTestPhoneNumber(phoneNumber: string): boolean {
    return this.testPhoneNumbers.hasOwnProperty(phoneNumber);
  }

  /**
   * Get test verification code for test phone number
   */
  private getTestVerificationCode(phoneNumber: string): string {
    return this.testPhoneNumbers[phoneNumber] || '123456';
  }

  /**
   * Send OTP with elegant error handling
   */
  async sendOTP(phoneNumber: string): Promise<PhoneAuthResult> {
    try {
      console.log(`📱 [ELEGANT FIREBASE AUTH] Sending OTP to: ${phoneNumber}`);
      
      // Check if it's a test phone number
      if (this.isTestPhoneNumber(phoneNumber)) {
        console.log(`🧪 [ELEGANT FIREBASE AUTH] Test phone number detected: ${phoneNumber}`);
        console.log(`🧪 [ELEGANT FIREBASE AUTH] Test verification code: ${this.getTestVerificationCode(phoneNumber)}`);
        
        // For test numbers, we simulate the Firebase flow
        const mockConfirmationResult: ConfirmationResult = {
          verificationId: `test-${Date.now()}`,
          confirm: async (code: string) => {
            const expectedCode = this.getTestVerificationCode(phoneNumber);
            if (code === expectedCode) {
              console.log('✅ [ELEGANT FIREBASE AUTH] Test OTP verified successfully');
              return { user: { phoneNumber, uid: `test-${Date.now()}` } };
            } else {
              throw new Error('Invalid verification code');
            }
          }
        };
        
        return {
          success: true,
          message: `Test OTP sent to ${phoneNumber}. Use code: ${this.getTestVerificationCode(phoneNumber)}`,
          confirmationResult: mockConfirmationResult
        };
      }

      // For real phone numbers, use Firebase Phone Auth with reCAPTCHA
      if (!this.recaptchaVerifier) {
        const initialized = await this.initializeRecaptcha();
        if (!initialized) {
          return { success: false, message: 'Failed to initialize reCAPTCHA verifier' };
        }
      }

      console.log('🔥 [ELEGANT FIREBASE AUTH] Using Firebase Phone Auth for real number:', phoneNumber);
      console.log('📱 [ELEGANT FIREBASE AUTH] Sending real SMS to your phone...');
      
      const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, this.recaptchaVerifier!);
      
      console.log('✅ [ELEGANT FIREBASE AUTH] Real SMS sent successfully via Firebase!');
      console.log('📱 [ELEGANT FIREBASE AUTH] Check your phone for the SMS with verification code');
      
      return {
        success: true,
        message: `Real SMS sent to ${phoneNumber}! Check your phone for the verification code.`,
        confirmationResult: confirmationResult as ConfirmationResult
      };
      
    } catch (error: any) {
      console.error('❌ [ELEGANT FIREBASE AUTH] Error sending OTP:', error);
      
      // Handle specific Firebase errors elegantly
      let errorMessage = 'Failed to send OTP. Please try again.';
      
      if (error.code === 'auth/invalid-phone-number') {
        errorMessage = 'Invalid phone number format.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many requests. Please try again later.';
      } else if (error.code === 'auth/captcha-check-failed') {
        errorMessage = 'reCAPTCHA verification failed. Please try again.';
      } else if (error.code === 'auth/quota-exceeded') {
        errorMessage = 'SMS quota exceeded. Please try again later.';
      }
      
      return { success: false, message: errorMessage };
    }
  }

  /**
   * Verify OTP with elegant error handling
   */
  async verifyOTP(confirmationResult: ConfirmationResult, otp: string): Promise<{ success: boolean; message: string }> {
    try {
      console.log('🔐 [ELEGANT FIREBASE AUTH] Verifying OTP');
      
      await confirmationResult.confirm(otp);
      console.log('✅ [ELEGANT FIREBASE AUTH] OTP verified successfully!');
      
      return { 
        success: true, 
        message: 'OTP verified successfully!' 
      };
      
    } catch (error: any) {
      console.error('❌ [ELEGANT FIREBASE AUTH] Error verifying OTP:', error);
      
      let errorMessage = 'Invalid OTP. Please try again.';
      
      if (error.code === 'auth/invalid-verification-code') {
        errorMessage = 'The verification code is invalid.';
      } else if (error.code === 'auth/code-expired') {
        errorMessage = 'The verification code has expired.';
      } else if (error.code === 'auth/session-expired') {
        errorMessage = 'Session expired. Please request a new OTP.';
      }
      
      return { success: false, message: errorMessage };
    }
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    if (this.recaptchaVerifier) {
      console.log('🧹 [ELEGANT FIREBASE AUTH] Cleaning up reCAPTCHA verifier');
      this.recaptchaVerifier.clear();
      this.recaptchaVerifier = null;
    }
  }

  /**
   * Get test phone numbers for development
   */
  getTestPhoneNumbers(): { [key: string]: string } {
    return this.testPhoneNumbers;
  }
}

export const elegantFirebasePhoneAuth = new ElegantFirebasePhoneAuthService();
