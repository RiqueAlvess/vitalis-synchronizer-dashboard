
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from '@/components/ui/use-toast';
import { authService } from '@/services/authService';
import { AuthState, AuthContextValue } from '@/types/auth';
import { useAuthStateManager } from '@/hooks/useAuthStateManager';
import { useAuthActions } from '@/hooks/useAuthActions';

const initialState: AuthState = {
  user: null,
  isLoading: true,
  isAuthenticated: false,
  error: null
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>(initialState);
  const location = useLocation();
  const navigate = useNavigate();
  
  // Use nossos novos hooks refatorados
  const stateManager = useAuthStateManager(setState);
  const { login, register, logout, updateProfile, saveSettings, getSettings } = 
    useAuthActions(stateManager, navigate, location);
  
  // Função para verificar autenticação com cache para evitar chamadas redundantes
  const checkAuthRef = useRef<Promise<boolean> | null>(null);
  const checkAuth = useCallback(async (): Promise<boolean> => {
    // Se já estiver uma verificação em andamento, retorne a mesma Promise
    if (checkAuthRef.current) return checkAuthRef.current;
    
    // Se já estiver autenticado, não faça verificação
    if (state.user && !state.isLoading) return true;
    
    // Cria uma nova Promise de verificação
    checkAuthRef.current = (async () => {
      try {
        stateManager.setLoading(true);
        const userData = await authService.getCurrentUser();
        
        if (userData) {
          stateManager.setUser(userData);
          return true;
        } else {
          stateManager.clearUser();
          return false;
        }
      } catch (err) {
        console.error('Auth check failed:', err);
        stateManager.clearUser();
        return false;
      } finally {
        stateManager.setLoading(false);
        // Limpar a referência para permitir novas verificações
        checkAuthRef.current = null;
      }
    })();
    
    return checkAuthRef.current;
  }, [state.user, state.isLoading, stateManager]);
  
  // Contexto final a ser fornecido
  const contextValue: AuthContextValue = {
    ...state,
    login,
    register,
    logout,
    checkAuth,
    saveSettings,
    getSettings,
    updateProfile
  };
  
  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
