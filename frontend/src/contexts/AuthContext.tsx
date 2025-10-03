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
  checkAuthState: () => void;
  setAuthData: (userData: any, token: string) => void;
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

  const setAuthData = (userData: any, token: string) => {
    console.log('🔄 [AUTH CONTEXT] Setting auth data directly:', { userData, token });
    
    // Set all state values
    setUser(userData);
    setToken(token);
    setIsAuthenticated(true);
    
    // Store in localStorage
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    
    console.log('✅ [AUTH CONTEXT] Auth data set successfully');
    console.log('✅ [AUTH CONTEXT] Current state after setAuthData:', { 
      user: userData, 
      token, 
      isAuthenticated: true 
    });
    
    // Force a re-render by updating state again
    setTimeout(() => {
      console.log('🔄 [AUTH CONTEXT] Forcing state update again');
      setUser(userData);
      setToken(token);
      setIsAuthenticated(true);
    }, 50);
  };

  const checkAuthState = () => {
    const storedToken = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    
    console.log('🔍 [AUTH STATE] Checking auth state:', { 
      hasToken: !!storedToken, 
      hasUserData: !!userData,
      tokenLength: storedToken?.length || 0,
      currentAuthState: isAuthenticated,
      currentUser: user
    });
    
    if (storedToken && userData) {
      try {
        const parsedUser = JSON.parse(userData);
        console.log('✅ [AUTH STATE] Parsed user data:', parsedUser);
        
        // Force state update by setting all values
        setUser(parsedUser);
        setToken(storedToken);
        setIsAuthenticated(true);
        
        console.log('✅ [AUTH STATE] Authentication state restored from localStorage');
        console.log('✅ [AUTH STATE] New state:', { 
          user: parsedUser, 
          token: storedToken, 
          isAuthenticated: true 
        });
        
        // Force multiple re-renders to ensure state is updated
        setTimeout(() => {
          setUser(parsedUser);
          setToken(storedToken);
          setIsAuthenticated(true);
          console.log('🔄 [AUTH STATE] State update confirmed - attempt 1');
        }, 0);
        
        setTimeout(() => {
          setUser(parsedUser);
          setToken(storedToken);
          setIsAuthenticated(true);
          console.log('🔄 [AUTH STATE] State update confirmed - attempt 2');
        }, 50);
      } catch (error) {
        console.error('❌ [AUTH STATE] Error parsing user data:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
        setToken(null);
        setIsAuthenticated(false);
      }
    } else {
      console.log('❌ [AUTH STATE] No authentication data found in localStorage');
      setUser(null);
      setToken(null);
      setIsAuthenticated(false);
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated,
    token,
    login,
    signup,
    logout,
    updateCredits,
    checkAuthState,
    setAuthData
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
