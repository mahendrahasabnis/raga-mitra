import React, { useEffect, useRef, useState } from 'react';
import { getAuth, signInWithPhoneNumber, RecaptchaVerifier, PhoneAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth } from '../config/firebase';
import * as firebaseui from 'firebaseui';
import 'firebaseui/dist/firebaseui.css';

interface FirebaseAuthTestProps {
  isOpen: boolean;
  onClose: () => void;
}

const FirebaseAuthTest: React.FC<FirebaseAuthTestProps> = ({ isOpen, onClose }) => {
  const [phoneNumber, setPhoneNumber] = useState('+919881255701');
  const [otp, setOtp] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [step, setStep] = useState<'phone' | 'otp' | 'success'>('phone');
  
  const recaptchaContainerRef = useRef<HTMLDivElement>(null);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => {
    initializeRecaptcha();
    
    return () => {
      if (recaptchaVerifierRef.current) {
        recaptchaVerifierRef.current.clear();
      }
    };
  }, []);

  const initializeRecaptcha = async () => {
    try {
      if (recaptchaContainerRef.current) {
        recaptchaVerifierRef.current = new RecaptchaVerifier(auth, recaptchaContainerRef.current, {
          size: 'normal',
          callback: (response: string) => {
            console.log('✅ reCAPTCHA solved:', response);
            setError('');
          },
          'expired-callback': () => {
            console.log('⚠️ reCAPTCHA expired');
            setError('reCAPTCHA expired. Please try again.');
          },
          'error-callback': (error: any) => {
            console.error('❌ reCAPTCHA error:', error);
            setError('reCAPTCHA error. Please refresh and try again.');
          }
        });

        await recaptchaVerifierRef.current.render();
        console.log('✅ reCAPTCHA initialized successfully');
      }
    } catch (error) {
      console.error('❌ Failed to initialize reCAPTCHA:', error);
      setError('Failed to initialize reCAPTCHA. Please refresh the page.');
    }
  };

  const handleSendOTP = async () => {
    if (!phoneNumber) {
      setError('Please enter a phone number');
      return;
    }

    if (!recaptchaVerifierRef.current) {
      setError('reCAPTCHA not initialized. Please refresh the page.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      console.log(`📱 [FIREBASE UI TEST] Sending OTP to: ${phoneNumber}`);
      
      const confirmation = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifierRef.current);
      setConfirmationResult(confirmation);
      setStep('otp');
      setSuccess(`OTP sent successfully to ${phoneNumber}! Check your phone for the SMS.`);
      
      console.log('✅ [FIREBASE UI TEST] OTP sent successfully via Firebase Phone Auth');
      
    } catch (error: any) {
      console.error('❌ [FIREBASE UI TEST] Error sending OTP:', error);
      
      let errorMessage = 'Failed to send OTP. Please try again.';
      
      if (error.code === 'auth/invalid-phone-number') {
        errorMessage = 'Invalid phone number format.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many requests. Please try again later.';
      } else if (error.code === 'auth/captcha-check-failed') {
        errorMessage = 'reCAPTCHA verification failed. Please try again.';
      } else if (error.code === 'auth/quota-exceeded') {
        errorMessage = 'SMS quota exceeded. Please try again later.';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your connection.';
      }
      
      setError(errorMessage);
      
      // Reset reCAPTCHA on error
      if (recaptchaVerifierRef.current) {
        recaptchaVerifierRef.current.clear();
        await initializeRecaptcha();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp || !confirmationResult) {
      setError('Please enter the OTP code');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      console.log('🔐 [FIREBASE UI TEST] Verifying OTP:', otp);
      
      const result = await confirmationResult.confirm(otp);
      
      console.log('✅ [FIREBASE UI TEST] OTP verified successfully!', result);
      setStep('success');
      setSuccess('Phone number verified successfully!');
      
      // You can access the user here: result.user
      console.log('📱 [FIREBASE UI TEST] Verified user:', result.user);
      
    } catch (error: any) {
      console.error('❌ [FIREBASE UI TEST] Error verifying OTP:', error);
      
      let errorMessage = 'Invalid OTP. Please try again.';
      
      if (error.code === 'auth/invalid-verification-code') {
        errorMessage = 'The verification code is invalid.';
      } else if (error.code === 'auth/code-expired') {
        errorMessage = 'The verification code has expired.';
      } else if (error.code === 'auth/session-expired') {
        errorMessage = 'Session expired. Please request a new OTP.';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStep('phone');
    setOtp('');
    setConfirmationResult(null);
    setError('');
    setSuccess('');
    
    // Reset reCAPTCHA
    if (recaptchaVerifierRef.current) {
      recaptchaVerifierRef.current.clear();
      initializeRecaptcha();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000] p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold text-gray-800">🔥 Firebase Phone Auth Test</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Info */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-semibold text-blue-800 mb-2">📱 Real SMS Delivery Test</h3>
            <p className="text-blue-700 text-sm">
              This test will send a real SMS to your phone using Firebase Phone Auth with reCAPTCHA.
            </p>
          </div>

          {/* Step Indicator */}
          <div className="flex items-center space-x-4">
            <div className={`flex items-center space-x-2 ${step === 'phone' ? 'text-blue-600' : step === 'otp' ? 'text-green-600' : 'text-green-600'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'phone' ? 'bg-blue-600 text-white' : 'bg-green-600 text-white'}`}>
                1
              </div>
              <span className="text-sm font-medium">Send OTP</span>
            </div>
            <div className={`flex-1 h-1 ${step === 'otp' || step === 'success' ? 'bg-green-600' : 'bg-gray-300'}`}></div>
            <div className={`flex items-center space-x-2 ${step === 'otp' ? 'text-blue-600' : step === 'success' ? 'text-green-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'otp' ? 'bg-blue-600 text-white' : step === 'success' ? 'bg-green-600 text-white' : 'bg-gray-300 text-gray-600'}`}>
                2
              </div>
              <span className="text-sm font-medium">Verify OTP</span>
            </div>
          </div>

          {/* Phone Number Step */}
          {step === 'phone' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+919881255701"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={loading}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter your phone number with country code (e.g., +919881255701)
                </p>
              </div>

              {/* reCAPTCHA Container */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  reCAPTCHA Verification
                </label>
                <div 
                  ref={recaptchaContainerRef}
                  className="border border-gray-300 rounded-lg p-4 min-h-[80px] flex items-center justify-center"
                >
                  <span className="text-gray-500 text-sm">reCAPTCHA will appear here</span>
                </div>
              </div>

              <button
                onClick={handleSendOTP}
                disabled={loading || !phoneNumber}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-3 px-4 rounded-lg font-medium transition-colors"
              >
                {loading ? 'Sending OTP...' : 'Send OTP via Firebase'}
              </button>
            </div>
          )}

          {/* OTP Verification Step */}
          {step === 'otp' && (
            <div className="space-y-4">
              <div className="bg-green-50 p-4 rounded-lg">
                <h4 className="font-semibold text-green-800 mb-1">✅ OTP Sent!</h4>
                <p className="text-green-700 text-sm">
                  Check your phone ({phoneNumber}) for the SMS with verification code.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Enter Verification Code
                </label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-lg tracking-widest"
                  disabled={loading}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter the 6-digit code you received via SMS
                </p>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={handleVerifyOTP}
                  disabled={loading || !otp || otp.length !== 6}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white py-3 px-4 rounded-lg font-medium transition-colors"
                >
                  {loading ? 'Verifying...' : 'Verify OTP'}
                </button>
                
                <button
                  onClick={handleReset}
                  disabled={loading}
                  className="px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Reset
                </button>
              </div>
            </div>
          )}

          {/* Success Step */}
          {step === 'success' && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              
              <div>
                <h3 className="text-xl font-semibold text-green-800 mb-2">Success!</h3>
                <p className="text-green-700">
                  Phone number {phoneNumber} has been verified successfully!
                </p>
              </div>

              <button
                onClick={handleReset}
                className="bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-lg font-medium transition-colors"
              >
                Test Another Number
              </button>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-red-800 text-sm font-medium">Error</span>
              </div>
              <p className="text-red-700 text-sm mt-1">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-green-800 text-sm font-medium">Success</span>
              </div>
              <p className="text-green-700 text-sm mt-1">{success}</p>
            </div>
          )}

          {/* Debug Info */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-semibold text-gray-800 mb-2">🔧 Debug Info</h4>
            <div className="text-xs text-gray-600 space-y-1">
              <div>Phone: {phoneNumber}</div>
              <div>Step: {step}</div>
              <div>reCAPTCHA: {recaptchaVerifierRef.current ? 'Initialized' : 'Not initialized'}</div>
              <div>Confirmation: {confirmationResult ? 'Ready' : 'Not ready'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FirebaseAuthTest;
