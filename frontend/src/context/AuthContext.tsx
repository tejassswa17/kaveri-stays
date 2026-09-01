import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  login as apiLogin,
  logout as apiLogout,
  getMe as apiGetMe,
  getRefreshToken,
} from '../api';
import type { LoginRequest, MeOut, UserRole } from '../types';

interface AuthContextType {
  user: MeOut | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginRequest) => Promise<MeOut>;
  logout: () => Promise<void>;
  refreshUserData: () => Promise<void>;
  isGuest: boolean;
  isStaff: boolean;
  isManager: boolean;
  isOwner: boolean;
  hasRole: (roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<MeOut | null>(() => {
    const saved = localStorage.getItem('user_info');
    return saved ? JSON.parse(saved) : null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchCurrentUser = async (): Promise<MeOut | null> => {
    try {
      const userData = await apiGetMe();
      setUser(userData);
      localStorage.setItem('user_info', JSON.stringify(userData));
      return userData;
    } catch {
      setUser(null);
      localStorage.removeItem('user_info');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      fetchCurrentUser();
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (credentials: LoginRequest): Promise<MeOut> => {
    setIsLoading(true);
    try {
      await apiLogin(credentials);
      const userData = await apiGetMe();
      setUser(userData);
      localStorage.setItem('user_info', JSON.stringify(userData));
      return userData;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      const refreshToken = getRefreshToken();
      if (refreshToken) {
        await apiLogout({ refresh_token: refreshToken });
      }
    } catch {
      // Handled
    } finally {
      setUser(null);
      localStorage.removeItem('user_info');
      setIsLoading(false);
    }
  };

  const refreshUserData = async () => {
    await fetchCurrentUser();
  };

  const isGuest = user?.role === 'guest';
  const isStaff = user?.role === 'staff';
  const isManager = user?.role === 'manager';
  const isOwner = user?.role === 'owner';

  const hasRole = (roles: UserRole[]): boolean => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        refreshUserData,
        isGuest,
        isStaff,
        isManager,
        isOwner,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
