
import { Dispatch, SetStateAction, useCallback } from 'react';
import { AuthState, AuthStateManager, User } from '@/types/auth';

export const useAuthStateManager = (
  setState: Dispatch<SetStateAction<AuthState>>
): AuthStateManager => {
  const setUser = useCallback((user: User) => {
    setState(prev => ({
      ...prev,
      user,
      isAuthenticated: true,
      isLoading: false,
      error: null
    }));
  }, [setState]);

  const clearUser = useCallback(() => {
    setState(prev => ({
      ...prev,
      user: null,
      isAuthenticated: false,
      isLoading: false
    }));
  }, [setState]);

  const setLoading = useCallback((isLoading: boolean) => {
    setState(prev => ({
      ...prev,
      isLoading
    }));
  }, [setState]);

  const setError = useCallback((error: string | null) => {
    setState(prev => ({
      ...prev,
      error,
      isLoading: false
    }));
  }, [setState]);

  return {
    setUser,
    clearUser,
    setLoading,
    setError
  };
};
