
import { supabase } from '@/integrations/supabase/client';
import { User } from '@/types/auth';
import { supabaseAPI } from './apiClient';

export const authService = {
  // Login with email and password
  async login(email: string, password: string): Promise<User> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data.user) {
        throw new Error('Usuário não encontrado');
      }

      // Fetch user profile from profiles table
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      return {
        id: data.user.id,
        email: data.user.email!,
        fullName: profileData?.full_name || 'Usuário',
        companyName: profileData?.company_name || 'Empresa',
        jobTitle: profileData?.job_title,
        isPremium: profileData?.is_premium || false,
        token: data.session?.access_token,
        refreshToken: data.session?.refresh_token
      };
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  },

  // Register a new user
  async register(email: string, password: string, companyName: string): Promise<User> {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            company_name: companyName
          }
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data.user) {
        throw new Error('Falha ao criar usuário');
      }

      return {
        id: data.user.id,
        email: data.user.email!,
        fullName: data.user.user_metadata?.full_name || 'Usuário',
        companyName: companyName,
        isPremium: false,
        token: data.session?.access_token,
        refreshToken: data.session?.refresh_token
      };
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  },

  // Logout the current user
  async logout(): Promise<void> {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw new Error(error.message);
      }
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  },

  // Get the current authenticated user
  async getCurrentUser(): Promise<User | null> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        return null;
      }

      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        return null;
      }

      // Fetch profile data
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      return {
        id: user.id,
        email: user.email!,
        fullName: profileData?.full_name || user.user_metadata?.full_name || 'Usuário',
        companyName: profileData?.company_name || user.user_metadata?.company_name || 'Empresa',
        jobTitle: profileData?.job_title || user.user_metadata?.job_title,
        isPremium: profileData?.is_premium || false
      };
    } catch (error) {
      console.error('Get current user error:', error);
      return null;
    }
  },

  // Save user settings
  async saveSettings(userId: string, settings: any): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('settings')
        .upsert({ 
          user_id: userId,
          data: settings
        });

      if (error) {
        throw new Error(error.message);
      }

      return true;
    } catch (error) {
      console.error('Save settings error:', error);
      return false;
    }
  },

  // Get user settings
  async getSettings(userId: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('data')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      return data?.data || {};
    } catch (error) {
      console.error('Get settings error:', error);
      return {};
    }
  },

  // Update user profile
  async updateProfile(profile: Partial<User>): Promise<User> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      // Update profile in profiles table
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: profile.fullName,
          company_name: profile.companyName,
          job_title: profile.jobTitle
        })
        .eq('id', user.id);

      if (error) {
        throw new Error(error.message);
      }

      // Return updated user
      const updatedUser = await this.getCurrentUser();
      if (!updatedUser) {
        throw new Error('Falha ao obter usuário atualizado');
      }

      return updatedUser;
    } catch (error) {
      console.error('Update profile error:', error);
      throw error;
    }
  }
};
