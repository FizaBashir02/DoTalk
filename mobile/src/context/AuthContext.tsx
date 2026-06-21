import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, getSocket } from '../utils/api';
import { Alert } from 'react-native';

interface User {
  _id: string;
  fullName: string;
  username: string;
  email: string;
  bio: string;
  profilePhoto: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (emailOrUsername: string, password: string) => Promise<boolean>;
  registerUser: (userData: any) => Promise<string | null>;
  verifyOtpCode: (email: string, otpCode: string) => Promise<boolean>;
  logout: () => Promise<void>;
  updateProfile: (fullName: string, username: string, bio: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load storage states at mount
  useEffect(() => {
    async function loadStoredAuth() {
      try {
        const storedToken = await AsyncStorage.getItem('dotalk_token');
        const storedUser = await AsyncStorage.getItem('dotalk_user');
        if (storedToken && storedUser && storedUser !== 'undefined') {
          const parsed = JSON.parse(storedUser);
          if (parsed) {
            setToken(storedToken);
            setUser(parsed);
            // Apply token header
            api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
          }
        }
      } catch (err) {
        console.log('Error loading cached authentication from storage', err);
      } finally {
        setLoading(false);
      }
    }
    loadStoredAuth();
  }, []);

  const login = async (emailOrUsername: string, password: string): Promise<boolean> => {
    try {
      const response = await api.post('/api/auth/login', { emailOrUsername, password });
      const { accessToken, user: loggedUser } = response.data;

      setToken(accessToken);
      setUser(loggedUser);
      api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;

      await AsyncStorage.setItem('dotalk_token', accessToken);
      await AsyncStorage.setItem('dotalk_user', JSON.stringify(loggedUser));
      return true;
    } catch (err: any) {
      console.error('[AuthContext login error]', err);
      throw err;
    }
  };

  const registerUser = async (userData: any): Promise<string | null> => {
    try {
      const response = await api.post('/api/auth/register', userData);
      return 'SENT';
    } catch (err: any) {
      console.error('[AuthContext registerUser error]', err);
      throw err;
    }
  };

  const verifyOtpCode = async (email: string, otpCode: string): Promise<boolean> => {
    try {
      const response = await api.post('/api/auth/verify-otp', { email, otpCode });
      const { accessToken, user: loggedUser } = response.data;

      setToken(accessToken);
      setUser(loggedUser);
      api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;

      await AsyncStorage.setItem('dotalk_token', accessToken);
      await AsyncStorage.setItem('dotalk_user', JSON.stringify(loggedUser));
      return true;
    } catch (err: any) {
      console.error('[AuthContext verifyOtpCode error]', err);
      throw err;
    }
  };

  const logout = async () => {
    try {
      setUser(null);
      setToken(null);
      delete api.defaults.headers.common['Authorization'];
      await AsyncStorage.removeItem('dotalk_token');
      await AsyncStorage.removeItem('dotalk_user');
    } catch (err) {
      console.log('Logout clear storage error', err);
    }
  };

  const updateProfile = async (fullName: string, username: string, bio: string): Promise<boolean> => {
    try {
      const response = await api.post('/api/profile/update', { fullName, username, bio });
      const updatedUser = response.data.user;
      setUser(updatedUser);
      await AsyncStorage.setItem('dotalk_user', JSON.stringify(updatedUser));
      return true;
    } catch (err: any) {
      const errMsg = err.response?.data?.error || 'Failed updating profile details.';
      Alert.alert('Profile Error', errMsg);
      return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        registerUser,
        verifyOtpCode,
        logout,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be wrapped in AuthProvider');
  }
  return context;
}
