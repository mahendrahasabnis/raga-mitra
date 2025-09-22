import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
// import { User, AuthResponse } from '../types';
import { authApi } from '../services/api';

interface AuthContextType {
  user: any | null;
  isAuthenticated: boolean;
  token: string | null;
  login: (phone: string, pin: string) => Promise<boolean>;
  signup: (phone: string, pin: string) => Promise<boolean>;
  logout: () => void;
  updateCredits: (credits: number) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    
    if (storedToken && userData) {
      try {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
        setToken(storedToken);
        setIsAuthenticated(true);
      } catch (error) {
        console.error('Error parsing user data:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
  }, []);

  const login = async (phone: string, pin: string): Promise<boolean> => {
    try {
      const response = await authApi.login(phone, pin);
      if (response.token && response.user) {
          const { token: newToken, user: userData } = response;
          localStorage.setItem('token', newToken);
          localStorage.setItem('user', JSON.stringify(userData));
          setUser(userData);
          setToken(newToken);
          setIsAuthenticated(true);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const signup = async (phone: string, pin: string): Promise<boolean> => {
    try {
      const response = await authApi.signup(phone, pin);
      if (response.token && response.user) {
        const { token: newToken, user: userData } = response;
        localStorage.setItem('token', newToken);
        localStorage.setItem('user', JSON.stringify(userData));
        setUser(userData);
        setToken(newToken);
        setIsAuthenticated(true);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Signup error:', error);
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setToken(null);
    setIsAuthenticated(false);
  };

  const updateCredits = (credits: number) => {
    if (user) {
      const updatedUser = { ...user, credits };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated,
    token,
    login,
    signup,
    logout,
    updateCredits
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
