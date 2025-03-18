
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';

export interface User {
  id: string;
  email: string;
  fullName: string;
  companyName: string;
  jobTitle?: string;
  isPremium: boolean;
}

export const authService = {
  // Register a new user
  async register(email: string, password: string, companyName: string): Promise<User> {
    try {
      // Check if the email is from a free provider
      const freeEmailProviders = ['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'live.com', 'aol.com', 'icloud.com'];
      const emailDomain = email.split('@')[1].toLowerCase();
      
      if (freeEmailProviders.includes(emailDomain)) {
        throw new Error('Por favor, utilize um e-mail corporativo para se registrar.');
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            company_name: companyName
          }
        }
      });

      if (error) throw error;
      
      if (!data.user) {
        throw new Error('Erro ao criar usuário');
      }

      return {
        id: data.user.id,
        email: data.user.email || email,
        fullName: data.user.user_metadata?.full_name || 'Usuário',
        companyName: data.user.user_metadata?.company_name || companyName,
        isPremium: false
      };
    } catch (error: any) {
      console.error('Registration error:', error);
      throw new Error(error.message || 'Falha no registro');
    }
  },

  // Login an existing user
  async login(email: string, password: string): Promise<User> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;
      
      if (!data.user) {
        throw new Error('Erro ao fazer login');
      }

      // Get user profile data
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
      }

      return {
        id: data.user.id,
        email: data.user.email || email,
        fullName: profileData?.full_name || data.user.user_metadata?.full_name || 'Usuário',
        companyName: profileData?.company_name || data.user.user_metadata?.company_name || 'Empresa',
        jobTitle: profileData?.job_title || data.user.user_metadata?.job_title,
        isPremium: profileData?.is_premium || false
      };
    } catch (error: any) {
      console.error('Login error:', error);

      // Handle specific Supabase errors with user-friendly messages
      if (error.message.includes('Invalid login credentials')) {
        throw new Error('E-mail ou senha incorretos');
      }
      
      throw new Error(error.message || 'Falha no login');
    }
  },

  // Logout the current user
  async logout(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Logout error:', error);
      throw error;
    }
  },

  // Get the current user if logged in
  async getCurrentUser(): Promise<User | null> {
    try {
      const { data } = await supabase.auth.getUser();
      
      if (!data.user) {
        return null;
      }

      // Get user profile data
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Error fetching profile:', profileError);
      }

      return {
        id: data.user.id,
        email: data.user.email || '',
        fullName: profileData?.full_name || data.user.user_metadata?.full_name || 'Usuário',
        companyName: profileData?.company_name || data.user.user_metadata?.company_name || 'Empresa',
        jobTitle: profileData?.job_title || data.user.user_metadata?.job_title,
        isPremium: profileData?.is_premium || false
      };
    } catch (error) {
      console.error('Get current user error:', error);
      return null;
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
