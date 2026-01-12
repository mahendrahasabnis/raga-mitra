import React, { useState, useEffect, useRef } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authApi, userApi } from '../services/api';
import { elegantFirebasePhoneAuth } from '../services/firebasePhoneAuthElegant';
import { Heart, Shield, Users, Stethoscope, Phone, Eye, EyeOff, ChevronDown, ArrowLeft, CheckCircle, AlertCircle, UserCheck, Building2, ClipboardList, CreditCard } from 'lucide-react';

// Country code data
const countryData = [
  { code: '+91', country: 'India', flag: '🇮🇳', format: 'XXXXX XXXXX', maxLength: 10 },
  { code: '+1', country: 'United States', flag: '🇺🇸', format: 'XXX XXX XXXX', maxLength: 10 },
  { code: '+44', country: 'United Kingdom', flag: '🇬🇧', format: 'XXXX XXX XXX', maxLength: 10 },
  { code: '+86', country: 'China', flag: '🇨🇳', format: 'XXX XXXX XXXX', maxLength: 11 },
  { code: '+81', country: 'Japan', flag: '🇯🇵', format: 'XX XXXX XXXX', maxLength: 10 },
];

const LoginPage: React.FC = () => {
  const { user, isLoading, login } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<'login' | 'register' | 'reset'>('login');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState(countryData[0]);
  const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<any>(null);
  const [isOtpVerified, setIsOtpVerified] = useState(false);
  const [registrationData, setRegistrationData] = useState<any>(null);
  const [userLookupResult, setUserLookupResult] = useState<{name?: string; roles?: string[]} | null>(null);
  const [isLookingUpUser, setIsLookingUpUser] = useState(false);
  const countryDropdownRef = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'dark';
  });

  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    // Legacy class support for backward compatibility
    document.documentElement.classList.remove('theme-dark', 'theme-light');
    document.documentElement.classList.add(theme === 'light' ? 'theme-light' : 'theme-dark');
  }, [theme]);

  // Close country dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(event.target as Node)) {
        setIsCountryDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const formatPhoneNumber = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    const maxLength = selectedCountry.maxLength;
    const truncated = cleaned.slice(0, maxLength);
    return truncated;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhone(formatted);
    // Clear user lookup result when phone changes
    setUserLookupResult(null);
  };

  // Lookup user when phone number is 10 digits or more
  useEffect(() => {
    const lookupUser = async () => {
      if (phone.length >= 10 && phone.length === selectedCountry.maxLength) {
        setIsLookingUpUser(true);
        try {
          const fullPhoneNumber = selectedCountry.code + phone;
          const userData = await userApi.getByPhone(fullPhoneNumber);
          
          if (userData && userData.user) {
            // Extract name and roles from user data
            const user = userData.user;
            const rolesSet = new Set<string>();

            // Extract roles from aarogya-mitra privileges if available
            if (user.privileges && Array.isArray(user.privileges)) {
              const aarogyaPrivilege = user.privileges.find((p: any) => p.platform === 'aarogya-mitra');
              if (aarogyaPrivilege && Array.isArray(aarogyaPrivilege.roles)) {
                aarogyaPrivilege.roles.forEach((r: string) => {
                  if (r && r.toLowerCase() !== 'guest') rolesSet.add(r);
                });
              }
            }

            // Fallbacks
            if (user.role && user.role.toLowerCase() !== 'guest') {
              rolesSet.add(user.role);
            }
            if ((user as any).global_role && (user as any).global_role.toLowerCase() !== 'guest') {
              rolesSet.add((user as any).global_role);
            }
            if (rolesSet.size === 0) {
              rolesSet.add('patient');
            }

            // Hard overrides for known numbers
            const fullPhone = (user.phone || fullPhoneNumber || '').replace(/\s+/g, '');
            if (fullPhone === '+919881255702') {
              rolesSet.clear();
              rolesSet.add('Doctor');
              rolesSet.add('patient');
            } else if (fullPhone === '+919881255701') {
              rolesSet.clear();
              rolesSet.add('patient');
            }

            setUserLookupResult({
              name: user.name || user.phone || 'User',
              roles: Array.from(rolesSet)
            });
          } else {
            setUserLookupResult(null);
          }
        } catch (error: any) {
          // User not found - this is expected for new users
          if (error.response?.status === 404) {
            setUserLookupResult(null);
          } else {
            console.error('Error looking up user:', error);
            setUserLookupResult(null);
          }
        } finally {
          setIsLookingUpUser(false);
        }
      } else {
        setUserLookupResult(null);
      }
    };

    // Debounce the lookup
    const timeoutId = setTimeout(lookupUser, 500);
    return () => clearTimeout(timeoutId);
  }, [phone, selectedCountry]);

  const handleSendOtp = async () => {
    if (!phone) {
      setError('Please enter your phone number');
      return;
    }

    if (phone.length < selectedCountry.maxLength) {
      setError(`Please enter a valid ${selectedCountry.country} phone number`);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const fullPhoneNumber = selectedCountry.code + phone;
      console.log('🔥 [LOGIN STEP 1] Sending OTP to:', fullPhoneNumber);
      
      const result = await elegantFirebasePhoneAuth.sendOTP(fullPhoneNumber);
      console.log('🔥 [LOGIN STEP 1] OTP sent successfully:', result);
      
      if (result.success && result.confirmationResult) {
        setConfirmationResult(result.confirmationResult);
        setOtpSent(true);
        setSuccess('OTP sent successfully!');
      } else {
        setError(result.message || 'Failed to send OTP');
      }
    } catch (err: any) {
      console.error('❌ [LOGIN STEP 1] OTP send failed:', err);
      setError(err.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp || !confirmationResult) {
      setError('Please enter the OTP');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      console.log('🔥 [LOGIN STEP 2] Verifying OTP:', otp);
      
      const result = await elegantFirebasePhoneAuth.verifyOTP(confirmationResult, otp);
      console.log('🔥 [LOGIN STEP 2] OTP verification result:', result);
      
      if (result.success) {
        setIsOtpVerified(true);
        setSuccess('OTP verified successfully!');
        
        // If it's registration, proceed to registration
        if (currentStep === 'register') {
          setRegistrationData({ phone: selectedCountry.code + phone, otpVerified: true });
        } else {
          // For login, proceed with PIN verification
          setCurrentStep('login');
        }
      } else {
        setError(result.message || 'Invalid OTP');
      }
    } catch (err: any) {
      console.error('❌ [LOGIN STEP 2] OTP verification failed:', err);
      setError(err.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!phone || !pin) {
      setError('Please enter your phone number and PIN');
      return;
    }

    if (phone.length < selectedCountry.maxLength) {
      setError(`Please enter a valid ${selectedCountry.country} phone number`);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const fullPhoneNumber = selectedCountry.code + phone;
      console.log('🔥 [LOGIN] Logging in with:', fullPhoneNumber);
      
      const result = await authApi.login(fullPhoneNumber, pin);
      console.log('🔥 [LOGIN] Login successful:', result);
      
      // Set user data in context
      if (result.user && result.token) {
        login(result.user, result.token);
        setSuccess('Login successful! Redirecting...');
        // Go to appointments dashboard after login
        setTimeout(() => navigate('/appointments'), 300);
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err: any) {
      console.error('❌ [LOGIN] Login failed:', err);
      setError(err.response?.data?.message || err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!pin || !confirmPin) {
      setError('Please enter and confirm your PIN');
      return;
    }

    if (pin !== confirmPin) {
      setError('PINs do not match');
      return;
    }

    if (pin.length < 4) {
      setError('PIN must be at least 4 digits');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const fullPhoneNumber = selectedCountry.code + phone;
      console.log('🔥 [REGISTRATION STEP 3] Registering user with phone:', fullPhoneNumber);
      
      const result = await authApi.signup(fullPhoneNumber, pin, otp);
      console.log('🔥 [REGISTRATION STEP 3] Registration successful:', result);
      
      // Set user data in context
      if (result.user && result.token) {
        login(result.user, result.token);
        setSuccess('Registration successful! Redirecting...');
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err: any) {
      console.error('❌ [REGISTRATION STEP 3] Registration failed:', err);
      setError(err.response?.data?.message || err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPin = async () => {
    if (!pin) {
      setError('Please enter your new PIN');
      return;
    }

    if (pin.length < 4) {
      setError('PIN must be at least 4 digits');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const fullPhoneNumber = selectedCountry.code + phone;
      console.log('🔥 [RESET PIN] Resetting PIN for phone:', fullPhoneNumber);
      
      const result = await authApi.resetPin(fullPhoneNumber, otp, pin);
      console.log('🔥 [RESET PIN] Reset successful:', result);
      
      setSuccess('PIN reset successful! Please login with your new PIN.');
      // Reset form and go back to login
      setTimeout(() => {
        resetForm();
      }, 2000);
    } catch (err: any) {
      console.error('❌ [RESET PIN] Reset failed:', err);
      setError(err.response?.data?.message || err.message || 'PIN reset failed');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setPhone('');
    setPin('');
    setConfirmPin('');
    setOtp('');
    setOtpSent(false);
    setIsOtpVerified(false);
    // setVerificationId(null);
    setRegistrationData(null);
    setError(null);
    setSuccess(null);
    // Reset to login by default
    setCurrentStep('login');
  };

  const handleStepChange = (step: 'login' | 'register' | 'reset') => {
    setCurrentStep(step);
    // Only reset form state, not the step
    setPhone('');
    setPin('');
    setConfirmPin('');
    setOtp('');
    setOtpSent(false);
    setIsOtpVerified(false);
    // setVerificationId(null);
    setRegistrationData(null);
    setError(null);
    setSuccess(null);
  };

  // Test login function for role testing
  const handleTestLogin = (role: string) => {
    const testPhone = selectedCountry.code + phone;
    const testToken = `test-token-${role}-${Date.now()}`;
    
    // Create test user object based on role
    let testUser: any = {
      id: `test-user-${role}`,
      phone: testPhone,
      name: `Test ${role.charAt(0).toUpperCase() + role.slice(1)}`,
      platform: 'aarogya-mitra',
      role: 'user',
      credits: 5,
      privileges: [{
        platform: 'aarogya-mitra',
        roles: [] as string[],
        permissions: [] as string[]
      }]
    };

    // Set roles and permissions based on role type
    switch (role) {
      case 'owner':
        testUser.privileges[0].roles = ['owner'];
        testUser.privileges[0].permissions = [
          'view_own_data', 'edit_own_profile', 'view_appointments', 'manage_appointments',
          'view_doctors', 'manage_doctors', 'view_clinics', 'manage_clinics', 'manage_hcp',
          'manage_receptionists', 'manage_practices', 'view_analytics', 'view_patient_records',
          'update_patient_records', 'view_billing_reports', 'manage_payments'
        ];
        break;
      case 'clinic_admin':
        testUser.privileges[0].roles = ['clinic_admin'];
        testUser.privileges[0].permissions = [
          'view_own_data', 'edit_own_profile', 'view_appointments', 'manage_appointments',
          'view_doctors', 'manage_doctors', 'view_clinics', 'manage_clinics', 'manage_hcp',
          'manage_receptionists', 'manage_practices', 'view_analytics', 'view_patient_records',
          'update_patient_records'
        ];
        break;
      case 'doctor':
        testUser.privileges[0].roles = ['doctor'];
        testUser.privileges[0].permissions = [
          'view_own_data', 'edit_own_profile', 'view_appointments', 'view_patient_records',
          'update_patient_records', 'manage_own_schedule', 'view_prescriptions'
        ];
        break;
      case 'receptionist':
        testUser.privileges[0].roles = ['receptionist'];
        testUser.privileges[0].permissions = [
          'view_own_data', 'edit_own_profile', 'view_appointments', 'manage_appointments',
          'view_patient_list', 'book_appointment', 'view_doctors', 'view_clinics'
        ];
        break;
      case 'billing':
        testUser.privileges[0].roles = ['billing'];
        testUser.privileges[0].permissions = [
          'view_own_data', 'edit_own_profile', 'view_invoices', 'manage_payments',
          'view_billing_reports', 'view_appointments'
        ];
        break;
      case 'patient':
        testUser.privileges[0].roles = ['patient'];
        testUser.privileges[0].permissions = [
          'view_own_data', 'edit_own_profile', 'book_appointment', 'view_appointments',
          'cancel_appointment', 'view_doctors', 'view_clinics', 'view_medical_records',
          'view_prescriptions'
        ];
        break;
      default:
        testUser.privileges[0].roles = ['patient'];
        testUser.privileges[0].permissions = ['view_own_data', 'edit_own_profile', 'book_appointment'];
    }

    console.log(`🧪 [TEST LOGIN] Logging in as ${role}:`, testUser);
    
    // Mark as test mode in localStorage
    localStorage.setItem('test-mode', 'true');
    localStorage.setItem('test-role', role);
    
    login(testUser, testToken);
    setSuccess(`Test login as ${role} successful! Redirecting...`);
  };

  // Check if test buttons should be shown
  const showTestButtons = phone === '9999999999' && currentStep === 'login';

  // If user is already authenticated, redirect to appropriate dashboard
  if (user) {
    const userRoles = user.privileges?.flatMap(p => p.roles) || [];
    
    // Determine dashboard based on role priority (work roles first, then personal)
    let dashboardPath = '/';
    
    // Priority: receptionist > doctor > owner > patient
    if (userRoles.includes('receptionist') || userRoles.includes('reception')) {
      dashboardPath = '/dashboard/reception';
      console.log('🔀 [LOGIN] Redirecting receptionist to Reception Dashboard');
    } else if (userRoles.includes('doctor')) {
      dashboardPath = '/dashboard/doctor';
      console.log('🔀 [LOGIN] Redirecting doctor to Doctor Dashboard');
    } else if (userRoles.includes('owner') || userRoles.includes('clinic_admin') || userRoles.includes('admin')) {
      // Owners/admins without doctor role go to HCP management or patient dashboard
      dashboardPath = '/hcp'; // Show HCP management instead
      console.log('🔀 [LOGIN] Redirecting owner/admin to HCP Management');
    } else if (userRoles.includes('patient') || userRoles.includes('user')) {
      dashboardPath = '/dashboard/patient';
      console.log('🔀 [LOGIN] Redirecting patient to Patient Dashboard');
    }
    
    return <Navigate to={dashboardPath} replace />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 via-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${
      theme === 'light'
        ? 'bg-gradient-to-b from-[#fef7f0] via-[#fdeee5] to-[#fde8d8]'
        : 'bg-[#0a0a0f]'
    }`}>
      <div className="max-w-4xl w-full">
        <div className="flex justify-end mb-4">
          <button
            onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
            className={`px-4 py-2 rounded-full text-sm font-medium border transition ${
              theme === 'light'
                ? 'bg-white text-slate-900 border-slate-200 shadow-sm'
                : 'bg-white/10 text-white border-white/15'
            }`}
          >
            {theme === 'light' ? 'Dark theme' : 'Light theme'}
          </button>
        </div>
        <div className={`grid grid-cols-1 lg:grid-cols-2 gap-8 items-center ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>
          {/* Left Side - Branding & Info */}
          <div className="text-center lg:text-left space-y-6">
            <div className="mb-2">
              <p className={`text-sm uppercase tracking-[0.15em] ${theme === 'light' ? 'text-rose-600' : 'text-rose-300'}`}>Aarogya Mitra</p>
              <h2 className={`text-3xl font-bold ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>
                Health · Fitness · Diet
              </h2>
              <p className={`text-lg ${theme === 'light' ? 'text-slate-600' : 'text-gray-300'}`}>
                Secure, modern, mobile-first experience.
              </p>
            </div>

            {/* Role Information */}
            <div className="grid grid-cols-1 sm/grid-cols-2 gap-4">
              {[
                { icon: Shield, title: 'Platform Owner', desc: 'Full system access', color: 'text-rose-500' },
                { icon: Users, title: 'Clinic Owner', desc: 'Manage clinics & teams', color: 'text-emerald-500' },
                { icon: Stethoscope, title: 'Doctor', desc: 'Care & records', color: 'text-indigo-500' },
                { icon: Heart, title: 'Patient', desc: 'View own records', color: 'text-orange-500' },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className={`flex items-center space-x-3 p-4 rounded-lg shadow-sm ${
                      theme === 'light'
                        ? 'bg-white border border-slate-200'
                        : 'bg-white/5 border border-white/10'
                    }`}
                  >
                    <Icon className={`h-8 w-8 ${item.color}`} />
                    <div>
                      <p className={`font-semibold ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>{item.title}</p>
                      <p className={`text-sm ${theme === 'light' ? 'text-slate-600' : 'text-gray-300'}`}>{item.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Side - Login Form */}
          <div className={`${theme === 'light' ? 'bg-white text-slate-900 border border-slate-200' : 'bg-white/5 backdrop-blur-xl text-white border border-white/10'} rounded-2xl shadow-lg shadow-black/40 p-8`}>
            {/* Step Indicator - Only show for registration and reset */}
            {(currentStep === 'register' || currentStep === 'reset') && (
              <div className="flex items-center justify-center mb-8">
                <div className="flex items-center space-x-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                    !otpSent ? 'bg-blue-600 text-white' : 'bg-green-500 text-white'
                  }`}>
                    {!otpSent ? '1' : <CheckCircle className="w-5 h-5" />}
                  </div>
                  <div className={`w-16 h-1 ${otpSent ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                    otpSent && !isOtpVerified ? 'bg-blue-600 text-white' : 
                    isOtpVerified ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-500'
                  }`}>
                    {otpSent && !isOtpVerified ? '2' : isOtpVerified ? <CheckCircle className="w-5 h-5" /> : '2'}
                  </div>
                  <div className={`w-16 h-1 ${isOtpVerified ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                    isOtpVerified ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-500'
                  }`}>
                    3
                  </div>
                </div>
              </div>
            )}

            {/* Tab Navigation */}
            <div className={`flex space-x-1 mb-8 rounded-lg p-1 ${
              theme === 'light' ? 'bg-slate-100' : 'bg-white/10 border border-white/15'
            }`}>
              <button
                onClick={() => handleStepChange('login')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  currentStep === 'login' 
                    ? theme === 'light' ? 'bg-white text-rose-700 shadow-sm' : 'bg-white/15 text-white border border-white/10'
                    : theme === 'light' ? 'text-slate-600 hover:text-slate-800' : 'text-gray-300 hover:text-white'
                }`}
              >
                Login
              </button>
              <button
                onClick={() => handleStepChange('register')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  currentStep === 'register' 
                    ? theme === 'light' ? 'bg-white text-rose-700 shadow-sm' : 'bg-white/15 text-white border border-white/10'
                    : theme === 'light' ? 'text-slate-600 hover:text-slate-800' : 'text-gray-300 hover:text-white'
                }`}
              >
                Register
              </button>
              <button
                onClick={() => handleStepChange('reset')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  currentStep === 'reset' 
                    ? theme === 'light' ? 'bg-white text-rose-700 shadow-sm' : 'bg-white/15 text-white border border-white/10'
                    : theme === 'light' ? 'text-slate-600 hover:text-slate-800' : 'text-gray-300 hover:text-white'
                }`}
              >
                Reset PIN
              </button>
            </div>

            {/* Error/Success Messages */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <p className="text-red-800">{error}</p>
              </div>
            )}

            {success && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <p className="text-green-800">{success}</p>
              </div>
            )}

            {/* Phone Number Input */}
            {!otpSent && (
              <div className="space-y-6">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'light' ? 'text-slate-700' : 'text-gray-200'}`}>
                    Phone Number
                  </label>
                  <div className="flex space-x-2">
                    {/* Country Dropdown */}
                    <div className="relative" ref={countryDropdownRef}>
                      <button
                        type="button"
                        onClick={() => setIsCountryDropdownOpen(!isCountryDropdownOpen)}
                        className={`flex items-center space-x-2 px-3 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 ${
                          theme === 'light'
                            ? 'bg-white border border-slate-200 text-slate-900 hover:bg-slate-50'
                            : 'bg-white/10 border border-white/20 text-white hover:bg-white/15'
                        }`}
                      >
                        <span className="text-lg">{selectedCountry.flag}</span>
                        <span className="text-sm font-medium">{selectedCountry.code}</span>
                        <ChevronDown className={`w-4 h-4 ${theme === 'light' ? 'text-slate-800' : 'text-gray-200'}`} />
                      </button>
                      
                      {isCountryDropdownOpen && (
                        <div className={`absolute top-full left-0 mt-1 w-64 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto ${
                          theme === 'light'
                            ? 'bg-white border border-slate-200'
                            : 'bg-white/5 border border-white/10 text-white'
                        }`}>
                          {countryData.map((country) => (
                            <button
                              key={country.code}
                              onClick={() => {
                                setSelectedCountry(country);
                                setIsCountryDropdownOpen(false);
                              }}
                              className={`w-full flex items-center space-x-3 px-4 py-2 text-left ${
                                theme === 'light'
                                  ? 'hover:bg-slate-50 text-slate-900'
                                  : 'hover:bg-white/10 text-white'
                              }`}
                            >
                              <span className="text-lg">{country.flag}</span>
                              <div>
                                <div className="font-medium">{country.country}</div>
                                <div className={theme === 'light' ? 'text-sm text-slate-600' : 'text-sm text-gray-300'}>{country.code}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Phone Input */}
                  <div className="flex-1">
                      <input
                        type="tel"
                        value={phone}
                        onChange={handlePhoneChange}
                        placeholder={selectedCountry.format}
                        maxLength={selectedCountry.maxLength}
                    className={`w-full px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent ${
                        theme === 'light'
                          ? 'bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400'
                          : 'bg-white/10 border border-white/20 text-white placeholder:text-gray-200'
                      }`}
                      />
                    </div>
                  </div>
                  
                  {/* User Lookup Result */}
                  {phone.length >= 10 && (
                    <div className="mt-2">
                      {isLookingUpUser ? (
                        <p className={`text-xs ${theme === 'light' ? 'text-slate-500' : 'text-gray-300'}`}>Searching...</p>
                      ) : userLookupResult ? (
                        <div className={`text-xs space-y-1 ${theme === 'light' ? 'text-slate-700' : 'text-gray-200'}`}>
                          <p className="font-semibold">Name: {userLookupResult.name}</p>
                          {userLookupResult.roles && userLookupResult.roles.length > 0 && (
                            <p className={`${theme === 'light' ? 'text-rose-700' : 'text-rose-200'} font-semibold`}>
                              Role(s): {userLookupResult.roles.join(', ')}
                            </p>
                          )}
                        </div>
                      ) : phone.length === selectedCountry.maxLength ? (
                        <p className="text-xs text-red-600">Pl. register yourself</p>
                      ) : null}
                    </div>
                  )}
                </div>

                {/* PIN Input for Login */}
                {currentStep === 'login' && (
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${theme === 'light' ? 'text-slate-700' : 'text-gray-200'}`}>
                      PIN
                    </label>
                    <div className="relative">
                      <input
                        type={showPin ? 'text' : 'password'}
                        value={pin}
                        onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="Enter your PIN"
                        maxLength={6}
                        inputMode="numeric"
                        className={`w-full px-4 py-3 pr-12 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent ${
                          theme === 'light'
                            ? 'bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400'
                            : 'bg-white/10 border border-white/20 text-white placeholder:text-gray-200'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPin(!showPin)}
                        className={`absolute right-3 top-1/2 transform -translate-y-1/2 ${
                          theme === 'light' ? 'text-slate-500 hover:text-slate-700' : 'text-gray-300 hover:text-white'
                        }`}
                      >
                        {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Test Role Buttons - Only visible when phone is 9881255701 */}
                {showTestButtons && (
                  <div className="space-y-3">
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg mb-4">
                      <p className="text-sm font-medium text-yellow-800 mb-2">🧪 Test Mode - Quick Role Login</p>
                      <p className="text-xs text-yellow-700">Click any button below to login with that role</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleTestLogin('owner')}
                        className="flex items-center justify-center space-x-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
                        title="Login as Owner"
                      >
                        <Building2 className="w-4 h-4" />
                        <span>Owner</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTestLogin('clinic_admin')}
                        className="flex items-center justify-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                        title="Login as Clinic Admin"
                      >
                        <Shield className="w-4 h-4" />
                        <span>Clinic Admin</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTestLogin('doctor')}
                        className="flex items-center justify-center space-x-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                        title="Login as Doctor"
                      >
                        <Stethoscope className="w-4 h-4" />
                        <span>Doctor</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTestLogin('receptionist')}
                        className="flex items-center justify-center space-x-2 px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium"
                        title="Login as Receptionist"
                      >
                        <ClipboardList className="w-4 h-4" />
                        <span>Receptionist</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTestLogin('billing')}
                        className="flex items-center justify-center space-x-2 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
                        title="Login as Billing Staff"
                      >
                        <CreditCard className="w-4 h-4" />
                        <span>Billing</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTestLogin('patient')}
                        className="flex items-center justify-center space-x-2 px-3 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium"
                        title="Login as Patient"
                      >
                        <UserCheck className="w-4 h-4" />
                        <span>Patient</span>
                      </button>
                    </div>
                  </div>
                )}

                <button
                  onClick={currentStep === 'login' ? handleLogin : handleSendOtp}
                  disabled={loading || phone.length < selectedCountry.maxLength || (currentStep === 'login' && !pin)}
                  className="w-full bg-gradient-to-r from-blue-600 to-teal-600 text-white py-3 px-6 rounded-lg hover:from-blue-700 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    <Phone className="w-5 h-5" />
                  )}
                  <span>{currentStep === 'login' ? 'Login' : 'Send OTP'}</span>
                </button>
              </div>
            )}

            {/* OTP Input - Only for Registration and Reset */}
            {(currentStep === 'register' || currentStep === 'reset') && otpSent && !isOtpVerified && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Enter OTP
                  </label>
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    maxLength={6}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-2xl tracking-widest"
                  />
                  <p className="text-sm text-gray-500 mt-2 text-center">
                    OTP sent to {selectedCountry.code} {phone}
                  </p>
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={() => {
                      setOtpSent(false);
                      setOtp('');
                    }}
                    className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-center space-x-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>
                  <button
                    onClick={handleVerifyOtp}
                    disabled={loading || otp.length !== 6}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-teal-600 text-white py-3 px-6 rounded-lg hover:from-blue-700 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                  >
                    {loading ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    ) : (
                      <CheckCircle className="w-5 h-5" />
                    )}
                    <span>Verify OTP</span>
                  </button>
                </div>
              </div>
            )}

            {/* PIN Input - Only for Registration and Reset after OTP */}
            {(currentStep === 'register' || currentStep === 'reset') && isOtpVerified && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {currentStep === 'register' ? 'Create PIN' : 'Enter New PIN'}
                  </label>
                  <div className="relative">
                    <input
                      type={showPin ? 'text' : 'password'}
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="Enter 4-6 digit PIN"
                      maxLength={6}
                      className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPin(!showPin)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {currentStep === 'register' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Confirm PIN
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPin ? 'text' : 'password'}
                        value={confirmPin}
                        onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="Confirm your PIN"
                        maxLength={6}
                        className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPin(!showConfirmPin)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showConfirmPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex space-x-3">
                  <button
                    onClick={() => {
                      setIsOtpVerified(false);
                      setOtp('');
                    }}
                    className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-center space-x-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>
                      <button
                        onClick={currentStep === 'register' ? handleRegister : currentStep === 'reset' ? handleResetPin : handleLogin}
                        disabled={loading || pin.length < 4 || (currentStep === 'register' && pin !== confirmPin)}
                        className="flex-1 bg-gradient-to-r from-blue-600 to-teal-600 text-white py-3 px-6 rounded-lg hover:from-blue-700 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                      >
                        {loading ? (
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        ) : (
                          <CheckCircle className="w-5 h-5" />
                        )}
                        <span>{currentStep === 'register' ? 'Register' : currentStep === 'reset' ? 'Reset PIN' : 'Login'}</span>
                      </button>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="mt-8 text-center text-sm text-gray-500">
              <p>© 2024 Aarogya-Mitra. All rights reserved.</p>
              <p className="mt-1">Secure • Reliable • Healthcare Management</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;