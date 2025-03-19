
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { supabaseAPI } from './apiClient';

export interface User {
  id: string;
  email: string;
  fullName: string;
  companyName: string;
  jobTitle?: string;
  isPremium: boolean;
  token?: string;
  refreshToken?: string;
}

export const authService = {
  // Register a new user
  async register(email: string, password: string, companyName: string): Promise<User> {
    try {
      console.log("Iniciando registro de usuário:", email);
      
      // Check if the email is from a free provider
      const freeEmailProviders = ['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'live.com', 'aol.com', 'icloud.com'];
      const emailDomain = email.split('@')[1].toLowerCase();
      
      if (freeEmailProviders.includes(emailDomain)) {
        console.log("Email de provedor gratuito rejeitado:", emailDomain);
        throw new Error('Por favor, utilize um e-mail corporativo para se registrar.');
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            company_name: companyName,
            full_name: email.split('@')[0] // Default name from email
          }
        }
      });

      if (error) {
        console.error("Erro no registro via Supabase:", error);
        throw error;
      }
      
      if (!data.user) {
        console.error("Usuário não criado após registro");
        throw new Error('Erro ao criar usuário');
      }

      console.log("Usuário registrado com sucesso:", data.user.id);

      // Create a profile record
      if (data.user && data.session) {
        try {
          console.log("Criando perfil para o novo usuário");
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .insert({
              id: data.user.id,
              full_name: data.user.user_metadata?.full_name || email.split('@')[0],
              company_name: companyName,
              is_premium: false,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .select();
            
          if (profileError) {
            console.error('Erro ao criar perfil:', profileError);
          } else {
            console.log("Perfil criado com sucesso");
          }
        } catch (profileErr) {
          console.error('Erro ao criar perfil:', profileErr);
        }
      }

      // Explicitly set the session
      if (data.session) {
        console.log("Configurando sessão após registro");
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token
        });
      }

      return {
        id: data.user.id,
        email: data.user.email || email,
        fullName: data.user.user_metadata?.full_name || email.split('@')[0],
        companyName: data.user.user_metadata?.company_name || companyName,
        isPremium: false,
        token: data.session?.access_token,
        refreshToken: data.session?.refresh_token
      };
    } catch (error: any) {
      console.error('Erro de registro detalhado:', error);
      throw new Error(error.message || 'Falha no registro');
    }
  },

  // Login an existing user
  async login(email: string, password: string): Promise<User> {
    try {
      console.log("Iniciando login para:", email);
      
      // Option 1: Use Supabase Auth directly
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        console.error("Erro no login via Supabase:", error);
        throw error;
      }
      
      if (!data.user || !data.session) {
        console.error("Login sem retorno de usuário ou sessão");
        throw new Error('Erro ao fazer login');
      }

      console.log("Login bem-sucedido, token obtido:", !!data.session.access_token);
      console.log("Expira em:", new Date(data.session.expires_at * 1000).toLocaleString());

      // Configure the session explicitly
      await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token
      });

      console.log("Sessão configurada após login");

      // Get user profile data
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Erro ao buscar perfil:', profileError);
        
        // If profile doesn't exist, create one
        if (profileError.code === 'PGRST104') {
          try {
            console.log("Perfil não encontrado, criando novo perfil");
            const { data: newProfileData, error: createProfileError } = await supabase
              .from('profiles')
              .insert({
                id: data.user.id,
                full_name: data.user.user_metadata?.full_name || email.split('@')[0],
                company_name: data.user.user_metadata?.company_name || 'Empresa',
                is_premium: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .select();
              
            if (createProfileError) {
              console.error('Erro ao criar perfil:', createProfileError);
            } else {
              console.log('Perfil criado com sucesso');
            }
          } catch (createErr) {
            console.error('Erro ao criar perfil:', createErr);
          }
        }
      }

      console.log("Login completo, retornando dados do usuário");
      return {
        id: data.user.id,
        email: data.user.email || email,
        fullName: profileData?.full_name || data.user.user_metadata?.full_name || 'Usuário',
        companyName: profileData?.company_name || data.user.user_metadata?.company_name || 'Empresa',
        jobTitle: profileData?.job_title || data.user.user_metadata?.job_title,
        isPremium: profileData?.is_premium || false,
        token: data.session?.access_token,
        refreshToken: data.session?.refresh_token
      };
    } catch (error: any) {
      console.error('Erro de login detalhado:', error);

      // Handle specific Supabase errors with user-friendly messages
      if (error.message.includes('Invalid login credentials')) {
        throw new Error('E-mail ou senha incorretos');
      }
      
      throw new Error(error.message || 'Falha no login');
    }
  },

  // Logout the current user
  async logout(): Promise<void> {
    console.log("Iniciando logout do usuário");
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Erro ao fazer logout:', error);
      throw error;
    }
    console.log("Logout realizado com sucesso");
  },

  // Get the current user if logged in
  async getCurrentUser(): Promise<User | null> {
    try {
      console.log("Verificando usuário atual");
      const { data: { session } } = await supabase.auth.getSession();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.log("Nenhum usuário autenticado encontrado");
        return null;
      }

      console.log("Usuário autenticado encontrado:", user.id);

      // Get user profile data
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Erro ao buscar perfil:', profileError);
        
        // If profile doesn't exist, create one
        if (profileError.code === 'PGRST104') {
          try {
            console.log("Perfil não encontrado, criando novo perfil");
            const { data: newProfileData, error: createProfileError } = await supabase
              .from('profiles')
              .insert({
                id: user.id,
                full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuário',
                company_name: user.user_metadata?.company_name || 'Empresa',
                is_premium: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .select();
              
            if (createProfileError) {
              console.error('Erro ao criar perfil:', createProfileError);
            } else {
              console.log('Perfil criado com sucesso');
            }
          } catch (createErr) {
            console.error('Erro ao criar perfil:', createErr);
          }
        }
      }

      return {
        id: user.id,
        email: user.email || '',
        fullName: profileData?.full_name || user.user_metadata?.full_name || 'Usuário',
        companyName: profileData?.company_name || user.user_metadata?.company_name || 'Empresa',
        jobTitle: profileData?.job_title || user.user_metadata?.job_title,
        isPremium: profileData?.is_premium || false,
        token: session?.access_token,
        refreshToken: session?.refresh_token
      };
    } catch (error) {
      console.error('Erro ao obter usuário atual:', error);
      return null;
    }
  },

  // Função para salvar configurações do usuário
  async saveSettings(userId: string, settingsData: any): Promise<boolean> {
    try {
      console.log("Iniciando salvamento de configurações para usuário:", userId);
      
      // Verificar se já existem configurações para este usuário
      const { data: existingSettings, error: fetchError } = await supabase
        .from('settings')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Erro ao verificar configurações existentes:', fetchError);
      }

      let result;
      
      // Se já existe uma configuração, atualize-a
      if (existingSettings) {
        console.log("Atualizando configurações existentes");
        result = await supabase
          .from('settings')
          .update({ 
            data: settingsData,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);
      } else {
        // Caso contrário, crie uma nova
        console.log("Criando novas configurações");
        result = await supabase
          .from('settings')
          .insert({
            user_id: userId,
            data: settingsData,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
      }

      if (result.error) {
        console.error('Erro ao salvar configurações:', result.error);
        throw result.error;
      }

      console.log("Configurações salvas com sucesso");
      return true;
    } catch (error: any) {
      console.error('Erro ao salvar configurações:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar configurações',
        description: error.message || 'Não foi possível salvar as configurações'
      });
      return false;
    }
  },

  // Função para recuperar configurações do usuário
  async getSettings(userId: string): Promise<any> {
    try {
      console.log("Buscando configurações para usuário:", userId);
      
      const { data, error } = await supabase
        .from('settings')
        .select('data')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('Erro ao recuperar configurações:', error);
        
        // Se não encontrou nenhuma configuração, retorne um objeto vazio
        if (error.code === 'PGRST116') {
          console.log("Nenhuma configuração encontrada, retornando objeto vazio");
          return {};
        }
        
        throw error;
      }

      console.log("Configurações recuperadas com sucesso");
      return data?.data || {};
    } catch (error: any) {
      console.error('Erro ao buscar configurações:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar configurações',
        description: error.message || 'Não foi possível carregar as configurações'
      });
      return {};
    }
  },

  // Update the user's profile
  async updateProfile(profile: Partial<User>): Promise<User> {
    try {
      const { data: userData } = await supabase.auth.getUser();
      
      if (!userData.user) {
        throw new Error('Usuário não autenticado');
      }

      // Update user metadata
      if (profile.fullName || profile.companyName || profile.jobTitle) {
        const { error: updateError } = await supabase.auth.updateUser({
          data: {
            full_name: profile.fullName,
            company_name: profile.companyName,
            job_title: profile.jobTitle
          }
        });

        if (updateError) {
          throw updateError;
        }
      }

      // Update profile in the database
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: profile.fullName,
          company_name: profile.companyName,
          job_title: profile.jobTitle,
          is_premium: profile.isPremium,
          updated_at: new Date().toISOString()
        })
        .eq('id', userData.user.id)
        .select()
        .single();

      if (profileError) {
        throw profileError;
      }

      return {
        id: userData.user.id,
        email: userData.user.email || '',
        fullName: profileData.full_name,
        companyName: profileData.company_name,
        jobTitle: profileData.job_title,
        isPremium: profileData.is_premium
      };
    } catch (error: any) {
      console.error('Update profile error:', error);
      throw new Error(error.message || 'Falha ao atualizar perfil');
    }
  },

  // Change the user's password
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    try {
      // First, verify the current password by attempting to sign in
      const { data: userData } = await supabase.auth.getUser();
      
      if (!userData.user || !userData.user.email) {
        throw new Error('Usuário não autenticado');
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: userData.user.email,
        password: currentPassword
      });

      if (signInError) {
        throw new Error('Senha atual incorreta');
      }

      // Now update to the new password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) {
        throw updateError;
      }

      toast({
        title: 'Senha alterada',
        description: 'Sua senha foi alterada com sucesso',
      });
    } catch (error: any) {
      console.error('Change password error:', error);
      throw new Error(error.message || 'Falha ao alterar senha');
    }
  }
};
