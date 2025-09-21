import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import Header from '../Header';
import { AuthProvider } from '../../contexts/AuthContext';

// Mock the AuthContext
const mockUser = {
  id: '1',
  phone: '+1234567890',
  credits: 10,
  role: 'user' as const,
  isAdmin: false
};

const mockAuthValue = {
  user: mockUser,
  login: vi.fn(),
  signup: vi.fn(),
  logout: vi.fn(),
  isAuthenticated: true,
  loading: false
};

// Mock the AuthContext
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockAuthValue,
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

describe('Header Component', () => {
  const mockProps = {
    onBuyCredits: vi.fn(),
    onTransactionReport: vi.fn(),
    onConfigMenu: vi.fn(),
    isAdmin: false
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the app title', () => {
    render(<Header {...mockProps} />);
    expect(screen.getByText('Raga-Mitra')).toBeInTheDocument();
  });

  it('displays user credits', () => {
    render(<Header {...mockProps} />);
    expect(screen.getByText('10 credits')).toBeInTheDocument();
  });

  it('calls onBuyCredits when buy credits button is clicked', () => {
    render(<Header {...mockProps} />);
    const buyButton = screen.getByText('Buy');
    fireEvent.click(buyButton);
    expect(mockProps.onBuyCredits).toHaveBeenCalledTimes(1);
  });

  it('calls onTransactionReport when transaction button is clicked', () => {
    render(<Header {...mockProps} />);
    const transactionButton = screen.getByTitle('My Transactions');
    fireEvent.click(transactionButton);
    expect(mockProps.onTransactionReport).toHaveBeenCalledTimes(1);
  });

  it('calls onConfigMenu when config button is clicked', () => {
    render(<Header {...mockProps} />);
    const configButton = screen.getByTitle('Configuration');
    fireEvent.click(configButton);
    expect(mockProps.onConfigMenu).toHaveBeenCalledTimes(1);
  });

  it('calls logout when logout button is clicked', () => {
    render(<Header {...mockProps} />);
    const logoutButton = screen.getByTitle('Logout');
    fireEvent.click(logoutButton);
    expect(mockAuthValue.logout).toHaveBeenCalledTimes(1);
  });

  it('displays admin transaction report title when user is admin', () => {
    render(<Header {...mockProps} isAdmin={true} />);
    const transactionButton = screen.getByTitle('Transaction Reports');
    expect(transactionButton).toBeInTheDocument();
  });

  it('displays current date and time', () => {
    render(<Header {...mockProps} />);
    
    // Check if date format is displayed (DD-MMM-YYYY)
    const dateElement = screen.getByText(/\d{2}-\w{3}-\d{4}/);
    expect(dateElement).toBeInTheDocument();
    
    // Check if time format is displayed (HH:MM AM/PM)
    const timeElement = screen.getByText(/\d{2}:\d{2}\s?(AM|PM)/);
    expect(timeElement).toBeInTheDocument();
  });

  it('displays season information', () => {
    render(<Header {...mockProps} />);
    
    // Check if season is displayed (should contain season name)
    const seasonElement = screen.getByText(/Spring|Summer|Autumn|Winter/);
    expect(seasonElement).toBeInTheDocument();
  });

  it('does not render user-specific elements when user is not authenticated', () => {
    const mockAuthValueNoUser = {
      ...mockAuthValue,
      user: null,
      isAuthenticated: false
    };

    vi.mocked(require('../../contexts/AuthContext').useAuth).mockReturnValue(mockAuthValueNoUser);

    render(<Header {...mockProps} />);
    
    expect(screen.queryByText('Buy')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Logout')).not.toBeInTheDocument();
  });
});

