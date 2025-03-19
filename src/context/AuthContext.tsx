
import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService, User } from '@/services/authService';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, companyName: string) => Promise<void>;
  logout: () => void;
  error: string | null;
  checkAuth: () => Promise<boolean>;
  saveSettings: (settings: any) => Promise<boolean>;
  getSettings: () => Promise<any>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Set up auth state change listener
  useEffect(() => {
    console.log("Configurando listener de alteração de estado de autenticação");
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log(`Evento de autenticação detectado: ${event}`, session ? 'Com sessão' : 'Sem sessão');
        
        if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session) {
          // User has signed in or token refreshed
          try {
            console.log("Obtendo dados do usuário após evento de autenticação");
            const userData = await authService.getCurrentUser();
            if (userData) {
              console.log("Dados do usuário atualizados após evento:", userData.email);
              setUser(userData);
              setIsLoading(false);
              
              // Redirecionar para dashboard apenas em caso de login inicial
              if (event === 'SIGNED_IN' && location.pathname === '/login') {
                console.log("Redirecionando para dashboard após login");
                navigate('/dashboard');
              }
            }
          } catch (err) {
            console.error('Erro ao obter dados do usuário após alteração de estado de autenticação:', err);
            setIsLoading(false);
          }
        } else if (event === 'SIGNED_OUT') {
          // User has signed out
          console.log("Usuário desconectado, limpando estado");
          setUser(null);
          setIsLoading(false);
        } else {
          // Para outros eventos, garanta que isLoading não fique preso
          setIsLoading(false);
        }
      }
    );

    // Cleanup subscription
    return () => {
      console.log("Limpando inscrição de eventos de autenticação");
      subscription.unsubscribe();
    };
  }, [navigate, location.pathname]);

  // Verify authentication status
  const checkAuth = async (): Promise<boolean> => {
    try {
      console.log("Verificando status de autenticação...");
      setIsLoading(true);
      
      // First check if we have a session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        // Try to refresh the session if no session exists
        console.log("Nenhuma sessão encontrada, tentando atualizar...");
        const { data, error } = await supabase.auth.refreshSession();
        
        if (error || !data.session) {
          console.log("Falha na atualização da sessão:", error?.message);
          setUser(null);
          setIsLoading(false);
          return false;
        }
        
        console.log("Sessão atualizada com sucesso");
      }
      
      // Now that we have a session (either existing or refreshed), get user data
      const userData = await authService.getCurrentUser();
      
      if (userData) {
        console.log("Usuário autenticado:", userData.email);
        setUser(userData);
        setIsLoading(false);
        return true;
      }
      
      console.log("Usuário não autenticado");
      setUser(null);
      setIsLoading(false);
      return false;
    } catch (err) {
      console.error('Verificação de autenticação falhou:', err);
      setUser(null);
      setIsLoading(false);
      return false;
    }
  };

  // Check if user is logged in on app load
  useEffect(() => {
    const verifyAuth = async () => {
      try {
        console.log("Verificando autenticação na inicialização do aplicativo...");
        const isAuthenticated = await checkAuth();
        
        // Se o usuário estiver na página inicial ou de login e estiver autenticado, redirecione para o dashboard
        if (isAuthenticated && (location.pathname === '/' || location.pathname === '/login')) {
          console.log("Redirecionando usuário autenticado para o dashboard");
          navigate('/dashboard');
        }
      } catch (err) {
        console.error('Verificação de autenticação falhou:', err);
        setIsLoading(false);
      }
    };

    verifyAuth();
  }, [navigate, location.pathname]);

  // Redirect unauthenticated users from protected routes
  useEffect(() => {
    const protectedRoutes = ['/dashboard', '/settings', '/companies', '/employees', '/sync'];
    
    const checkProtectedRoute = async () => {
      if (protectedRoutes.includes(location.pathname)) {
        if (!isLoading) {
          console.log(`Verificando acesso à rota protegida: ${location.pathname}`);
          const isAuth = await checkAuth();
          
          if (!isAuth) {
            console.log('Redirecionando usuário não autenticado da rota protegida:', location.pathname);
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
      console.log("Tentando login...");
      const userData = await authService.login(email, password);
      console.log("Login bem-sucedido:", userData.email);
      
      setUser(userData);
      
      // Ensure session is explicitly set globally
      if (userData.token) {
        await supabase.auth.setSession({
          access_token: userData.token,
          refresh_token: userData.refreshToken || ''
        });
        console.log("Sessão configurada explicitamente após login");
      }
      
      // Redirect to intended page or dashboard
      const intendedPath = location.state?.from || '/dashboard';
      console.log(`Redirecionando para: ${intendedPath}`);
      navigate(intendedPath, { replace: true });
      
      toast({
        title: 'Login bem-sucedido',
        description: 'Bem-vindo de volta!',
      });
    } catch (err) {
      console.error('Erro de login:', err);
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
      console.log("Tentando registro...");
      const userData = await authService.register(email, password, companyName);
      console.log("Registro bem-sucedido:", userData.email);
      
      setUser(userData);
      
      // Ensure session is explicitly set globally
      if (userData.token) {
        await supabase.auth.setSession({
          access_token: userData.token,
          refresh_token: userData.refreshToken || ''
        });
        console.log("Sessão configurada após registro");
      }
      
      console.log("Redirecionando para dashboard após registro");
      navigate('/dashboard', { replace: true });
      
      toast({
        title: 'Cadastro realizado',
        description: 'Sua conta foi criada com sucesso!',
      });
    } catch (err) {
      console.error('Erro de registro:', err);
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

  const logout = async () => {
    try {
      console.log("Iniciando logout...");
      setIsLoading(true);
      await authService.logout();
      setUser(null);
      console.log("Redirecionando para página de login após logout");
      navigate('/login', { replace: true });
      toast({
        title: 'Logout realizado',
        description: 'Você foi desconectado com sucesso.',
      });
    } catch (err) {
      console.error('Erro no logout:', err);
      toast({
        variant: 'destructive',
        title: 'Erro ao sair',
        description: 'Ocorreu um erro ao tentar sair do sistema.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Função para salvar configurações do usuário atual
  const saveSettings = async (settings: any): Promise<boolean> => {
    if (!user) {
      console.error("Tentativa de salvar configurações sem usuário autenticado");
      toast({
        variant: 'destructive',
        title: 'Erro de autenticação',
        description: 'Você precisa estar logado para salvar configurações',
      });
      return false;
    }
    
    return await authService.saveSettings(user.id, settings);
  };

  // Função para obter configurações do usuário atual
  const getSettings = async (): Promise<any> => {
    if (!user) {
      console.error("Tentativa de obter configurações sem usuário autenticado");
      return {};
    }
    
    return await authService.getSettings(user.id);
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
        saveSettings,
        getSettings
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
