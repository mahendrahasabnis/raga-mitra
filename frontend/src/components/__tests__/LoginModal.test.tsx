import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import LoginModal from '../LoginModal';
import { authApi } from '../../services/api';

// Mock the AuthContext
const mockAuthValue = {
  user: null,
  login: vi.fn(),
  signup: vi.fn(),
  logout: vi.fn(),
  isAuthenticated: false,
  loading: false
};

// Mock the API
vi.mock('../../services/api', () => ({
  authApi: {
    sendOTP: vi.fn(),
    verifyOTP: vi.fn(),
    signup: vi.fn(),
    login: vi.fn(),
    resetPin: vi.fn()
  }
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockAuthValue
}));

describe('LoginModal Component', () => {
  const mockProps = {
    isOpen: true,
    onClose: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders when isOpen is true', () => {
    render(<LoginModal {...mockProps} />);
    expect(screen.getByText('Welcome Back')).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    render(<LoginModal {...mockProps} isOpen={false} />);
    expect(screen.queryByText('Welcome Back')).not.toBeInTheDocument();
  });

  it('switches between login and signup modes', () => {
    render(<LoginModal {...mockProps} />);
    
    // Initially in login mode
    expect(screen.getByText('Welcome Back')).toBeInTheDocument();
    
    // Switch to signup mode
    const switchButton = screen.getByText("Don't have an account? Sign up");
    fireEvent.click(switchButton);
    
    expect(screen.getByText('Create Account')).toBeInTheDocument();
  });

  it('handles phone number input', async () => {
    const user = userEvent.setup();
    render(<LoginModal {...mockProps} />);
    
    const phoneInput = screen.getByPlaceholderText('+1234567890');
    await user.type(phoneInput, '+1234567890');
    
    expect(phoneInput).toHaveValue('+1234567890');
  });

  it('handles PIN input', async () => {
    const user = userEvent.setup();
    render(<LoginModal {...mockProps} />);
    
    const pinInput = screen.getByPlaceholderText('1234');
    await user.type(pinInput, '1234');
    
    expect(pinInput).toHaveValue('1234');
  });

  it('toggles PIN visibility', () => {
    render(<LoginModal {...mockProps} />);
    
    const pinInput = screen.getByPlaceholderText('1234');
    const toggleButton = screen.getByRole('button', { name: '' }); // Eye icon button
    
    // Initially password type
    expect(pinInput).toHaveAttribute('type', 'password');
    
    // Click to show PIN
    fireEvent.click(toggleButton);
    expect(pinInput).toHaveAttribute('type', 'text');
    
    // Click to hide PIN
    fireEvent.click(toggleButton);
    expect(pinInput).toHaveAttribute('type', 'password');
  });

  it('shows error when phone number is missing', async () => {
    const user = userEvent.setup();
    render(<LoginModal {...mockProps} />);
    
    const submitButton = screen.getByText('Login');
    await user.click(submitButton);
    
    expect(screen.getByText('Please fill in all fields')).toBeInTheDocument();
  });

  it('calls login API when form is submitted in login mode', async () => {
    const user = userEvent.setup();
    mockAuthValue.login.mockResolvedValue(true);
    
    render(<LoginModal {...mockProps} />);
    
    const phoneInput = screen.getByPlaceholderText('+1234567890');
    const pinInput = screen.getByPlaceholderText('1234');
    const submitButton = screen.getByText('Login');
    
    await user.type(phoneInput, '+1234567890');
    await user.type(pinInput, '1234');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(mockAuthValue.login).toHaveBeenCalledWith('+1234567890', '1234');
    });
  });

  it('calls signup API when form is submitted in signup mode', async () => {
    const user = userEvent.setup();
    mockAuthValue.signup.mockResolvedValue(true);
    
    render(<LoginModal {...mockProps} />);
    
    // Switch to signup mode
    const switchButton = screen.getByText("Don't have an account? Sign up");
    fireEvent.click(switchButton);
    
    const phoneInput = screen.getByPlaceholderText('+1234567890');
    const pinInput = screen.getByPlaceholderText('1234');
    const submitButton = screen.getByText('Create Account');
    
    await user.type(phoneInput, '+1234567890');
    await user.type(pinInput, '1234');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(mockAuthValue.signup).toHaveBeenCalledWith('+1234567890', '1234');
    });
  });

  it('closes modal after successful login', async () => {
    const user = userEvent.setup();
    mockAuthValue.login.mockResolvedValue(true);
    
    render(<LoginModal {...mockProps} />);
    
    const phoneInput = screen.getByPlaceholderText('+1234567890');
    const pinInput = screen.getByPlaceholderText('1234');
    const submitButton = screen.getByText('Login');
    
    await user.type(phoneInput, '+1234567890');
    await user.type(pinInput, '1234');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(mockProps.onClose).toHaveBeenCalled();
    });
  });

  it('shows OTP form when send OTP is clicked', async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.sendOTP).mockResolvedValue({ message: 'OTP sent' });
    
    render(<LoginModal {...mockProps} />);
    
    const phoneInput = screen.getByPlaceholderText('+1234567890');
    await user.type(phoneInput, '+1234567890');
    
    const sendOtpButton = screen.getByText('Forgot PIN? Reset with OTP');
    await user.click(sendOtpButton);
    
    await waitFor(() => {
      expect(screen.getByText('Enter OTP')).toBeInTheDocument();
    });
  });

  it('shows error when OTP send fails', async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.sendOTP).mockRejectedValue(new Error('Failed to send OTP'));
    
    render(<LoginModal {...mockProps} />);
    
    const phoneInput = screen.getByPlaceholderText('+1234567890');
    await user.type(phoneInput, '+1234567890');
    
    const sendOtpButton = screen.getByText('Forgot PIN? Reset with OTP');
    await user.click(sendOtpButton);
    
    await waitFor(() => {
      expect(screen.getByText('Failed to send OTP. Please try again.')).toBeInTheDocument();
    });
  });

  it('closes modal when close button is clicked', () => {
    render(<LoginModal {...mockProps} />);
    
    const closeButton = screen.getByRole('button', { name: '' }); // X button
    fireEvent.click(closeButton);
    
    expect(mockProps.onClose).toHaveBeenCalled();
  });

  it('shows loading state during form submission', async () => {
    const user = userEvent.setup();
    mockAuthValue.login.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
    
    render(<LoginModal {...mockProps} />);
    
    const phoneInput = screen.getByPlaceholderText('+1234567890');
    const pinInput = screen.getByPlaceholderText('1234');
    const submitButton = screen.getByText('Login');
    
    await user.type(phoneInput, '+1234567890');
    await user.type(pinInput, '1234');
    await user.click(submitButton);
    
    expect(screen.getByText('Please wait...')).toBeInTheDocument();
    expect(submitButton).toBeDisabled();
  });
});

