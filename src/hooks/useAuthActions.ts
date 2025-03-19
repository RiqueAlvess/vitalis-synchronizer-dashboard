
import { useCallback } from 'react';
import { NavigateFunction, Location } from 'react-router-dom';
import { authService } from '@/services/authService';
import { AuthStateManager, User } from '@/types/auth';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';

export const useAuthActions = (
  stateManager: AuthStateManager,
  navigate: NavigateFunction,
  location: Location
) => {
  const login = useCallback(async (email: string, password: string) => {
    stateManager.setLoading(true);
    stateManager.setError(null);
    
    try {
      console.log("Tentando login...");
      const userData = await authService.login(email, password);
      console.log("Login bem-sucedido:", userData.email);
      
      stateManager.setUser(userData);
      
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
      stateManager.setError(errorMessage);
      toast({
        variant: 'destructive',
        title: 'Erro no login',
        description: errorMessage,
      });
    } finally {
      stateManager.setLoading(false);
    }
  }, [stateManager, navigate, location]);

  const register = useCallback(async (email: string, password: string, companyName: string) => {
    stateManager.setLoading(true);
    stateManager.setError(null);
    
    try {
      console.log("Tentando registro...");
      const userData = await authService.register(email, password, companyName);
      console.log("Registro bem-sucedido:", userData.email);
      
      stateManager.setUser(userData);
      
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
      stateManager.setError(errorMessage);
      toast({
        variant: 'destructive',
        title: 'Erro no cadastro',
        description: errorMessage,
      });
    } finally {
      stateManager.setLoading(false);
    }
  }, [stateManager, navigate]);

  const logout = useCallback(async () => {
    try {
      console.log("Iniciando logout...");
      stateManager.setLoading(true);
      await authService.logout();
      stateManager.clearUser();
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
      stateManager.setLoading(false);
    }
  }, [stateManager, navigate]);

  const saveSettings = useCallback(async (settings: any): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          variant: 'destructive',
          title: 'Erro de autenticação',
          description: 'Você precisa estar logado para salvar configurações',
        });
        return false;
      }
      
      return await authService.saveSettings(user.id, settings);
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar configurações',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
      });
      return false;
    }
  }, []);

  const getSettings = useCallback(async (): Promise<any> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error("Tentativa de obter configurações sem usuário autenticado");
        return {};
      }
      
      return await authService.getSettings(user.id);
    } catch (error) {
      console.error('Erro ao obter configurações:', error);
      return {};
    }
  }, []);

  const updateProfile = useCallback(async (profile: Partial<User>): Promise<User> => {
    try {
      console.log("Atualizando perfil do usuário:", profile);
      const updatedUser = await authService.updateProfile(profile);
      
      stateManager.setUser(updatedUser);
      
      toast({
        title: 'Perfil atualizado',
        description: 'Suas informações foram atualizadas com sucesso!',
      });
      
      return updatedUser;
    } catch (err) {
      console.error('Erro na atualização do perfil:', err);
      const errorMessage = err instanceof Error ? err.message : 'Falha ao atualizar perfil';
      
      toast({
        variant: 'destructive',
        title: 'Erro na atualização',
        description: errorMessage,
      });
      
      throw err;
    }
  }, [stateManager]);

  return {
    login,
    register,
    logout,
    saveSettings,
    getSettings,
    updateProfile
  };
};
