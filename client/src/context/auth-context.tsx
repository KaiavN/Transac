import { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '@shared/schema';

// Helper function for signature generation
function generateSignatureKey(length: number = 24): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

interface AuthContextType {
  user: User | null;
  login: (
    email: string,
    fullName: string,
    password: string,
    payment: {
      type: 'credit_card' | 'paypal' | 'bank_account';
      token: string;
      last4?: string;
      receivePaymentsTo: 'paypal' | 'bank_account';
      receivePaymentsDetails: string;
    },
    organizationId?: string
  ) => Promise<void>;
  logout: () => void;
  updateUser: (updatedUser: User) => void;
  register: (userData: {
    email: string;
    fullName: string;
    password: string;
    isBusinessAccount?: boolean;
    signatureKey?: string;
    payment: {
      type: 'credit_card' | 'paypal' | 'bank_account';
      token: string;
      last4?: string;
      receivePaymentsTo: 'paypal' | 'bank_account';
      receivePaymentsDetails: string;
    };
  }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  // Improved utility to safely parse JSON response
  const parseJSONResponse = async (response: Response) => {
    try {
      const contentType = response.headers.get('content-type') || '';
      
      // Special case: If response is 200 OK but not JSON content-type
      if (response.status === 200 && !contentType.includes('application/json')) {
        console.log('Server returned 200 OK without JSON content-type.');
        const text = await response.text();
        
        // If the response is empty or whitespace, return a generic success object
        if (!text || text.trim() === '') {
          console.log('Empty response body, treating as success');
          return { success: true };
        }
        
        // Try to parse the text as JSON anyway (sometimes servers misconfigure content-type)
        try {
          return JSON.parse(text);
        } catch (e) {
          console.log('Response is not parseable as JSON:', text.substring(0, 100));
          // Return a minimal success object with the text preview
          return { 
            success: true, 
            message: 'Operation completed successfully',
            responseText: text.substring(0, 50) 
          };
        }
      }
      
      // If content type is JSON, parse as JSON
      if (contentType.includes('application/json')) {
        return await response.json();
      }
      
      // Not JSON, try to extract useful information from the response
      const text = await response.text();
      
      // Try to extract error message from HTML if possible
      let errorMessage = `Server returned non-JSON response (${response.status} ${response.statusText})`;
      
      if (text.includes('<title>')) {
        // Extract title from HTML which might contain error info
        const titleMatch = text.match(/<title>(.*?)<\/title>/i);
        if (titleMatch && titleMatch[1]) {
          errorMessage += `: ${titleMatch[1]}`;
        }
      }
      
      console.error('Non-JSON response:', {
        status: response.status,
        contentType,
        textPreview: text.substring(0, 500)
      });
      
      throw new Error(errorMessage);
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON response from server: ${error.message}`);
      }
      throw error;
    }
  };

  const verifyAuth = async () => {
    try {
      setIsLoading(true);
      const sessionId = localStorage.getItem('session-id');
      if (!sessionId) {
        setUser(null);
        localStorage.removeItem('user');
        localStorage.removeItem('session-id');
        return;
      }
      
      // Get API URL from environment or use default
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const url = apiUrl ? `${apiUrl}/auth/verify` : '/auth/verify';
      
      console.log(`Verifying auth at: ${url}`);
      
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Origin': window.location.origin,
          'x-session-id': sessionId,
          'Cache-Control': 'no-cache'
        }
      });
      
      if (!response.ok) {
        console.error(`Auth verification failed with status: ${response.status}`);
        throw new Error(`Auth verification failed: ${response.statusText}`);
      }
      
      const data = await parseJSONResponse(response);
      setUser(data);
      localStorage.setItem('user', JSON.stringify(data));
      
      const newSessionId = response.headers.get('x-session-id');
      if (newSessionId) {
        localStorage.setItem('session-id', newSessionId);
      }
    } catch (error) {
      console.error('Auth verification error:', error);
      setUser(null);
      localStorage.removeItem('user');
      localStorage.removeItem('session-id');
    } finally {
      setIsLoading(false);
    }
  };

  // Registration method with improved signature handling
  const register = async (userData: {
    email: string;
    fullName: string;
    password: string;
    isBusinessAccount?: boolean;
    signatureKey?: string;
    payment: {
      type: 'credit_card' | 'paypal' | 'bank_account';
      token: string;
      last4?: string;
      receivePaymentsTo: 'paypal' | 'bank_account';
      receivePaymentsDetails: string;
    };
  }) => {
    try {
      if (!userData.email || !userData.fullName) {
        throw new Error('Email and full name are required');
      }
      
      // Generate a signature key if not provided
      const signatureKey = userData.signatureKey || generateSignatureKey(24);
      
      // Get API URL from environment or use default
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const url = apiUrl ? `${apiUrl}/auth/register` : '/auth/register';
      
      console.log(`Registering user at: ${url}`);
      
      const finalUserData = {
        ...userData,
        signatureKey
      };
      
      console.log('Registration data:', JSON.stringify(finalUserData));
      
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Origin': window.location.origin
        },
        body: JSON.stringify(finalUserData)
      });
      
      console.log(`Registration response status: ${response.status}`);
      
      const data = await parseJSONResponse(response);
      
      if (!response.ok) {
        throw new Error(data.error || `Registration failed with status ${response.status}`);
      }
      
      // Create a minimal user object if the server doesn't return one
      const userWithSignature = data.id ? data : {
        id: crypto.randomUUID(), // Generate a temporary ID
        email: userData.email,
        fullName: userData.fullName,
        signatureKey: signatureKey,
        isBusinessAccount: userData.isBusinessAccount || false,
        createdAt: new Date().toISOString()
      };
      
      // Ensure the signature key is included in the user object
      if (!userWithSignature.signatureKey) {
        userWithSignature.signatureKey = signatureKey;
      }
      
      // Update user state
      setUser(userWithSignature);
      localStorage.setItem('user', JSON.stringify(userWithSignature));
      
      const newSessionId = response.headers.get('x-session-id');
      if (newSessionId) {
        localStorage.setItem('session-id', newSessionId);
      }
      
      return data;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  };

  const login = async (
    email: string,
    fullName: string,
    password: string,
    payment: {
      type: 'credit_card' | 'paypal' | 'bank_account';
      token: string;
      last4?: string;
      receivePaymentsTo: 'paypal' | 'bank_account';
      receivePaymentsDetails: string;
    },
    organizationId?: string
  ) => {
    try {
      if (!email || !fullName) {
        throw new Error('Email and full name are required');
      }
      
      if (!payment || !payment.type || !payment.receivePaymentsTo) {
        throw new Error('Invalid payment information');
      }
      
      // Get API URL from environment or use default
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const url = apiUrl ? `${apiUrl}/auth/login` : '/auth/login';
      
      console.log(`Logging in at: ${url}`);
      
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Origin': window.location.origin
        },
        body: JSON.stringify({ email, fullName, password, payment, organizationId })
      });
      
      const data = await parseJSONResponse(response);
      
      if (!response.ok) {
        throw new Error(data.error || `Authentication failed with status ${response.status}`);
      }
      
      setUser(data);
      localStorage.setItem('user', JSON.stringify(data));
      
      const newSessionId = response.headers.get('x-session-id');
      if (newSessionId) {
        localStorage.setItem('session-id', newSessionId);
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      const sessionId = localStorage.getItem('session-id');
      
      // Get API URL from environment or use default
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const url = apiUrl ? `${apiUrl}/auth/logout` : '/auth/logout';
      
      await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: sessionId ? { 'x-session-id': sessionId } : undefined
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      localStorage.removeItem('user');
      localStorage.removeItem('session-id');
    }
  };

  useEffect(() => {
    verifyAuth();
    const interval = setInterval(verifyAuth, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser, register }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};