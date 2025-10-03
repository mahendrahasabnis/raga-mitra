// Firebase Phone Authentication service for frontend
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
  verificationId?: string;
}

class FirebasePhoneAuthService {
  private recaptchaVerifier: RecaptchaVerifier | null = null;
  private isTestMode: boolean = false;

  /**
   * Initialize reCAPTCHA verifier
   */
  async initializeRecaptcha(containerId: string = 'recaptcha-container'): Promise<boolean> {
    try {
      console.log('🔐 [FIREBASE PHONE AUTH] Initializing reCAPTCHA verifier');
      
      // Check if reCAPTCHA container exists
      let container = document.getElementById(containerId);
      if (!container) {
        // Create reCAPTCHA container if it doesn't exist
        container = document.createElement('div');
        container.id = containerId;
        container.style.display = 'none'; // Hide the reCAPTCHA widget
        document.body.appendChild(container);
        console.log('🔐 [FIREBASE PHONE AUTH] Created reCAPTCHA container');
      }

      // Create reCAPTCHA verifier
      this.recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
        'size': 'invisible', // Use invisible reCAPTCHA
        'callback': (response: string) => {
          console.log('✅ [FIREBASE PHONE AUTH] reCAPTCHA solved:', response);
        },
        'expired-callback': () => {
          console.log('⏰ [FIREBASE PHONE AUTH] reCAPTCHA expired');
        },
        'error-callback': (error: any) => {
          console.error('❌ [FIREBASE PHONE AUTH] reCAPTCHA error:', error);
        }
      });

      // Render the reCAPTCHA verifier
      await this.recaptchaVerifier.render();
      console.log('✅ [FIREBASE PHONE AUTH] reCAPTCHA verifier initialized successfully');
      
      return true;
    } catch (error) {
      console.error('❌ [FIREBASE PHONE AUTH] Failed to initialize reCAPTCHA:', error);
      return false;
    }
  }

  /**
   * Send OTP to phone number using Firebase Phone Auth
   */
  async sendOTP(phoneNumber: string): Promise<PhoneAuthResult> {
    try {
      console.log('📱 [FIREBASE PHONE AUTH] Sending OTP to:', phoneNumber);
      
      // Initialize reCAPTCHA if not already done
      if (!this.recaptchaVerifier) {
        const initialized = await this.initializeRecaptcha();
        if (!initialized) {
          return {
            success: false,
            message: 'Failed to initialize reCAPTCHA verifier'
          };
        }
      }

      // Send verification code
      console.log('📤 [FIREBASE PHONE AUTH] Sending verification code...');
      const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, this.recaptchaVerifier!);
      
      console.log('✅ [FIREBASE PHONE AUTH] Verification code sent successfully');
      console.log('📱 [FIREBASE PHONE AUTH] Confirmation result:', confirmationResult);
      
      return {
        success: true,
        message: 'OTP sent successfully via Firebase Phone Auth',
        confirmationResult,
        verificationId: confirmationResult.verificationId
      };
      
    } catch (error: any) {
      console.error('❌ [FIREBASE PHONE AUTH] Failed to send OTP:', error);
      
      let errorMessage = 'Failed to send OTP';
      
      if (error.code) {
        switch (error.code) {
          case 'auth/invalid-phone-number':
            errorMessage = 'Invalid phone number format';
            break;
          case 'auth/too-many-requests':
            errorMessage = 'Too many requests. Please try again later';
            break;
          case 'auth/quota-exceeded':
            errorMessage = 'SMS quota exceeded. Please try again later';
            break;
          case 'auth/captcha-check-failed':
            errorMessage = 'reCAPTCHA verification failed';
            break;
          default:
            errorMessage = `Firebase Auth error: ${error.message}`;
        }
      }
      
      return {
        success: false,
        message: errorMessage
      };
    }
  }

  /**
   * Verify OTP code
   */
  async verifyOTP(confirmationResult: ConfirmationResult, otpCode: string): Promise<PhoneAuthResult> {
    try {
      console.log('🔐 [FIREBASE PHONE AUTH] Verifying OTP code:', otpCode);
      
      // Verify the OTP code
      const result = await confirmationResult.confirm(otpCode);
      
      console.log('✅ [FIREBASE PHONE AUTH] OTP verified successfully');
      console.log('👤 [FIREBASE PHONE AUTH] User:', result.user);
      
      return {
        success: true,
        message: 'OTP verified successfully',
        verificationId: result.user.uid
      };
      
    } catch (error: any) {
      console.error('❌ [FIREBASE PHONE AUTH] Failed to verify OTP:', error);
      
      let errorMessage = 'Failed to verify OTP';
      
      if (error.code) {
        switch (error.code) {
          case 'auth/invalid-verification-code':
            errorMessage = 'Invalid OTP code';
            break;
          case 'auth/code-expired':
            errorMessage = 'OTP code has expired';
            break;
          default:
            errorMessage = `Verification error: ${error.message}`;
        }
      }
      
      return {
        success: false,
        message: errorMessage
      };
    }
  }

  /**
   * Clean up reCAPTCHA verifier
   */
  cleanup(): void {
    try {
      if (this.recaptchaVerifier) {
        this.recaptchaVerifier.clear();
        this.recaptchaVerifier = null;
        console.log('🧹 [FIREBASE PHONE AUTH] reCAPTCHA verifier cleaned up');
      }
    } catch (error) {
      console.error('❌ [FIREBASE PHONE AUTH] Failed to cleanup reCAPTCHA:', error);
    }
  }

  /**
   * Check if phone number is valid
   */
  isValidPhoneNumber(phoneNumber: string): boolean {
    // Basic phone number validation
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    return phoneRegex.test(phoneNumber);
  }

  /**
   * Format phone number for Firebase
   */
  formatPhoneNumber(phoneNumber: string): string {
    // Remove all non-digit characters except +
    let formatted = phoneNumber.replace(/[^\d+]/g, '');
    
    // Ensure it starts with +
    if (!formatted.startsWith('+')) {
      formatted = '+' + formatted;
    }
    
    return formatted;
  }
}

// Export singleton instance
export const firebasePhoneAuth = new FirebasePhoneAuthService();
export default firebasePhoneAuth;
