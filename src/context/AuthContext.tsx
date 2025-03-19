
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/components/ui/use-toast';
import { authService } from '@/services/authService';
import { AuthState, AuthContextValue } from '@/types/auth';
import { supabase, hasStoredSession } from '@/integrations/supabase/client';

// Initial authentication state
const initialState: AuthState = {
  user: null,
  isLoading: true,
  isAuthenticated: false,
  error: null
};

// Create the auth context
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>(initialState);
  const navigate = useNavigate();
  
  // Effect to check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      // If we already have a stored session, set authenticated immediately to prevent flicker
      const hasSession = hasStoredSession();
      if (hasSession) {
        setState(prev => ({ ...prev, isAuthenticated: true }));
      }
      
      try {
        const userData = await authService.getCurrentUser();
        
        if (userData) {
          setState({
            user: userData,
            isLoading: false,
            isAuthenticated: true,
            error: null
          });
        } else {
          setState({
            user: null,
            isLoading: false,
            isAuthenticated: false,
            error: null
          });
        }
      } catch (err) {
        console.error('Auth check failed:', err);
        setState({
          user: null,
          isLoading: false,
          isAuthenticated: false,
          error: err instanceof Error ? err.message : 'Error checking authentication'
        });
      }
    };
    
    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session ? 'Session exists' : 'No session');
        
        if (event === 'SIGNED_IN' && session) {
          try {
            const userData = await authService.getCurrentUser();
            setState({
              user: userData,
              isLoading: false,
              isAuthenticated: true,
              error: null
            });
          } catch (error) {
            console.error('Error getting user data after sign in:', error);
          }
        } else if (event === 'SIGNED_OUT') {
          setState({
            user: null,
            isLoading: false,
            isAuthenticated: false,
            error: null
          });
        }
      }
    );
    
    // Check auth on mount
    checkAuth();
    
    return () => {
      subscription.unsubscribe();
    };
  }, []);
  
  // Authentication actions
  const login = async (email: string, password: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const userData = await authService.login(email, password);
      
      setState({
        user: userData,
        isLoading: false,
        isAuthenticated: true,
        error: null
      });
      
      toast({
        title: 'Login bem-sucedido',
        description: 'Bem-vindo de volta!',
      });
      
      navigate('/dashboard');
      
      return userData;
    } catch (err) {
      console.error('Login error:', err);
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Falha no login'
      }));
      
      toast({
        variant: 'destructive',
        title: 'Erro no login',
        description: err instanceof Error ? err.message : 'Falha no login',
      });
      
      throw err;
    }
  };
  
  const register = async (email: string, password: string, companyName: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const userData = await authService.register(email, password, companyName);
      
      setState({
        user: userData,
        isLoading: false,
        isAuthenticated: true,
        error: null
      });
      
      toast({
        title: 'Cadastro realizado',
        description: 'Sua conta foi criada com sucesso!',
      });
      
      navigate('/dashboard');
      
      return userData;
    } catch (err) {
      console.error('Registration error:', err);
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Falha no cadastro'
      }));
      
      toast({
        variant: 'destructive',
        title: 'Erro no cadastro',
        description: err instanceof Error ? err.message : 'Falha no cadastro',
      });
      
      throw err;
    }
  };
  
  const logout = async () => {
    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      await authService.logout();
      
      setState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        error: null
      });
      
      toast({
        title: 'Logout realizado',
        description: 'Você foi desconectado com sucesso.',
      });
      
      navigate('/login');
    } catch (err) {
      console.error('Logout error:', err);
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Falha no logout'
      }));
      
      toast({
        variant: 'destructive',
        title: 'Erro ao sair',
        description: 'Ocorreu um erro ao tentar sair do sistema.',
      });
    }
  };
  
  const checkAuth = async (): Promise<boolean> => {
    if (state.isAuthenticated && state.user) {
      return true;
    }
    
    try {
      const userData = await authService.getCurrentUser();
      if (userData) {
        setState({
          user: userData,
          isLoading: false,
          isAuthenticated: true,
          error: null
        });
        return true;
      }
      return false;
    } catch (err) {
      console.error('Auth check failed:', err);
      return false;
    }
  };
  
  const saveSettings = async (settings: any): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      
      return await authService.saveSettings(user.id, settings);
    } catch (error) {
      console.error('Error saving settings:', error);
      return false;
    }
  };
  
  const getSettings = async (): Promise<any> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return {};
      
      return await authService.getSettings(user.id);
    } catch (error) {
      console.error('Error getting settings:', error);
      return {};
    }
  };
  
  const updateProfile = async (profile: Partial<any>): Promise<any> => {
    try {
      const updatedUser = await authService.updateProfile(profile);
      
      setState(prev => ({
        ...prev,
        user: updatedUser,
        isLoading: false,
        isAuthenticated: true
      }));
      
      return updatedUser;
    } catch (err) {
      console.error('Error updating profile:', err);
      throw err;
    }
  };
  
  // Context value to be provided
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

// Hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
