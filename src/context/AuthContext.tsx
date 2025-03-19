
import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService, User } from '@/services/authService';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from '@/components/ui/use-toast';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, companyName: string) => Promise<void>;
  logout: () => void;
  error: string | null;
  checkAuth: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Verify authentication status
  const checkAuth = async (): Promise<boolean> => {
    try {
      console.log("Checking authentication status...");
      const userData = await authService.getCurrentUser();
      
      if (userData) {
        setUser(userData);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Authentication check failed:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Check if user is logged in on app load
  useEffect(() => {
    const verifyAuth = async () => {
      try {
        console.log("Verifying authentication on app load...");
        await checkAuth();
      } catch (err) {
        console.error('Authentication verification failed:', err);
      } finally {
        setIsLoading(false);
      }
    };

    verifyAuth();
  }, []);

  // Redirect unauthenticated users from protected routes
  useEffect(() => {
    const protectedRoutes = ['/dashboard', '/settings', '/companies', '/employees', '/sync'];
    
    const checkProtectedRoute = async () => {
      if (protectedRoutes.includes(location.pathname)) {
        const isAuth = await checkAuth();
        
        if (!isAuth && !isLoading) {
          console.log('Redirecting unauthenticated user from protected route:', location.pathname);
          navigate('/login', { 
            replace: true,
            state: { from: location.pathname } 
          });
          toast({
            variant: 'destructive',
            title: 'Acesso negado',
            description: 'Você precisa estar logado para acessar esta página.',
          });
        }
      }
    };

    if (!isLoading) {
      checkProtectedRoute();
    }
  }, [location.pathname, isLoading, navigate]);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log("Attempting login...");
      const userData = await authService.login(email, password);
      console.log("Login successful:", userData);
      
      setUser(userData);
      
      // Redirect to intended page or dashboard
      const intendedPath = location.state?.from || '/dashboard';
      navigate(intendedPath);
      
      toast({
        title: 'Login bem-sucedido',
        description: 'Bem-vindo de volta!',
      });
    } catch (err) {
      console.error('Login error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Falha no login';
      setError(errorMessage);
      toast({
        variant: 'destructive',
        title: 'Erro no login',
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (email: string, password: string, companyName: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log("Attempting registration...");
      const userData = await authService.register(email, password, companyName);
      console.log("Registration successful:", userData);
      
      setUser(userData);
      navigate('/dashboard');
      toast({
        title: 'Cadastro realizado',
        description: 'Sua conta foi criada com sucesso!',
      });
    } catch (err) {
      console.error('Registration error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Falha no cadastro';
      setError(errorMessage);
      toast({
        variant: 'destructive',
        title: 'Erro no cadastro',
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    try {
      authService.logout();
      setUser(null);
      navigate('/login');
      toast({
        title: 'Logout realizado',
        description: 'Você foi desconectado com sucesso.',
      });
    } catch (err) {
      console.error('Logout error:', err);
      toast({
        variant: 'destructive',
        title: 'Erro ao sair',
        description: 'Ocorreu um erro ao tentar sair do sistema.',
      });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        error,
        checkAuth,
      }}
    >
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
