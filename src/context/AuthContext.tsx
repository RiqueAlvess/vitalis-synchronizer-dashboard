import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { authService, User } from '@/services/authService';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from '@/components/ui/use-toast';
import { supabase, hasStoredSession } from '@/integrations/supabase/client';

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
  const authChecked = useRef(false);
  const refreshAttempts = useRef(0);
  const MAX_REFRESH_ATTEMPTS = 3;
  const initialCheckComplete = useRef(false);

  useEffect(() => {
    console.log("Configurando listener de alteração de estado de autenticação");
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log(`Evento de autenticação detectado: ${event}`, session ? 'Com sessão' : 'Sem sessão');
        
        try {
          if (event === 'SIGNED_IN' && session) {
            console.log("Obtendo dados do usuário após evento de autenticação");
            const userData = await authService.getCurrentUser();
            if (userData) {
              console.log("Dados do usuário atualizados após evento:", userData.email);
              setUser(userData);
              setIsLoading(false);
              authChecked.current = true;
              refreshAttempts.current = 0;
              
              if (location.pathname === '/login' || location.pathname === '/register') {
                const intended = location.state?.from || '/dashboard';
                console.log(`Redirecionando para: ${intended} após login`);
                navigate(intended, { replace: true });
              }
            }
          } else if (event === 'SIGNED_OUT') {
            console.log("Usuário desconectado, limpando estado");
            setUser(null);
            setIsLoading(false);
            authChecked.current = true;
            
            if (location.pathname !== '/login' && 
                location.pathname !== '/register' && 
                location.pathname !== '/') {
              navigate('/login', { replace: true });
            }
          } else if (event === 'INITIAL_SESSION') {
            initialCheckComplete.current = true;
            if (!session) {
              setIsLoading(false);
            }
          }
        } catch (err) {
          console.error('Erro ao processar evento de autenticação:', err);
          setIsLoading(false);
          authChecked.current = true;
        }
      }
    );

    return () => {
      console.log("Limpando inscrição de eventos de autenticação");
      subscription.unsubscribe();
    };
  }, [navigate, location.pathname, location.state]);

  useEffect(() => {
    const verifyAuth = async () => {
      try {
        console.log("Verificando autenticação na inicialização do aplicativo...");
        
        if (!hasStoredSession()) {
          console.log("Nenhuma sessão armazenada, definindo como não autenticado");
          setUser(null);
          setIsLoading(false);
          authChecked.current = true;
          return;
        }
        
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          console.log("Sessão encontrada, obtendo dados do usuário");
          const userData = await authService.getCurrentUser();
          if (userData) {
            console.log("Usuário autenticado:", userData.email);
            setUser(userData);
          } else {
            console.log("Dados do usuário não encontrados");
            setUser(null);
          }
        } else {
          console.log("Nenhuma sessão ativa encontrada");
          setUser(null);
        }
        
        setIsLoading(false);
        authChecked.current = true;
      } catch (err) {
        console.error('Verificação de autenticação falhou:', err);
        setUser(null);
        setIsLoading(false);
        authChecked.current = true;
      }
    };

    if (!initialCheckComplete.current) {
      verifyAuth();
    }
  }, []);

  const checkAuth = async (): Promise<boolean> => {
    if (isLoading) {
      return !!user;
    }
    
    if (authChecked.current && user) {
      return true;
    }
    
    if (refreshAttempts.current >= MAX_REFRESH_ATTEMPTS) {
      console.log(`Máximo de ${MAX_REFRESH_ATTEMPTS} tentativas de atualização atingido`);
      return false;
    }
    
    refreshAttempts.current += 1;
    
    try {
      console.log("Verificando status de autenticação...");
      setIsLoading(true);
      
      if (!hasStoredSession()) {
        console.log("Nenhuma sessão armazenada");
        setUser(null);
        setIsLoading(false);
        return false;
      }
      
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
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
      
      const userData = await authService.getCurrentUser();
      
      if (userData) {
        console.log("Usuário autenticado:", userData.email);
        setUser(userData);
        setIsLoading(false);
        refreshAttempts.current = 0;
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

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log("Tentando login...");
      const userData = await authService.login(email, password);
      console.log("Login bem-sucedido:", userData.email);
      
      setUser(userData);
      
      const intended = location.state?.from || '/dashboard';
      console.log(`Redirecionando para: ${intended}`);
      navigate(intended, { replace: true });
      
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
