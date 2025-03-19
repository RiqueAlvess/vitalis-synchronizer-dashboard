
import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import ApiConfigTabs from '@/components/integration/ApiConfigTabs';
import { Loader2, AlertTriangle, RefreshCcw } from 'lucide-react';
import apiService from '@/services/api';
import { useToast } from '@/components/ui/use-toast';
import ErrorBoundary from '@/components/ui-custom/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

const Settings = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Check if user is authenticated
    const checkAuth = async () => {
      try {
        console.log('Checking authentication status...');
        const { data } = await supabase.auth.getSession();
        const isAuth = !!data.session;
        console.log('Authentication status:', isAuth ? 'Authenticated' : 'Not authenticated');
        setIsAuthenticated(isAuth);
      } catch (error) {
        console.error('Error checking authentication:', error);
        setIsAuthenticated(false);
      }
    };
    
    checkAuth();
  }, []);

  const loadAllConfigs = async () => {
    try {
      setIsLoading(true);
      setHasError(false);
      
      // If user is not authenticated, show an error
      if (isAuthenticated === false) {
        setHasError(true);
        setErrorMessage('Você precisa estar autenticado para acessar as configurações');
        setIsLoading(false);
        return;
      }
      
      console.log('Starting to load API configurations...');
      
      // Preload all configs when the settings page loads
      const results = await Promise.allSettled([
        apiService.apiConfig.get('company'),
        apiService.apiConfig.get('employee'),
        apiService.apiConfig.get('absenteeism')
      ]);
      
      console.log('API config loading results:', results.map(r => ({ 
        status: r.status, 
        value: r.status === 'fulfilled' ? 'Config loaded' : 'Failed to load' 
      })));
      
      // Check if all promises were rejected
      if (results.every(result => result.status === 'rejected')) {
        throw new Error('Não foi possível carregar nenhuma das configurações. Verifique sua conexão com a internet e tente novamente.');
      }
      
      // If at least one config was loaded successfully, consider it a success
      if (results.some(result => result.status === 'fulfilled')) {
        console.log('At least some API configs loaded successfully');
        setHasError(false);
      }
    } catch (err) {
      console.error('Error loading API configurations:', err);
      setHasError(true);
      setErrorMessage(err instanceof Error ? err.message : 'Erro desconhecido ao carregar configurações');
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar configurações',
        description: 'Não foi possível carregar as configurações das APIs.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Only try to load configs if authentication status has been determined
    if (isAuthenticated !== null) {
      loadAllConfigs();
    }
  }, [isAuthenticated]);

  if (isAuthenticated === false) {
    return (
      <DashboardLayout 
        title="Configurações" 
        subtitle="Configure as integrações com APIs externas"
      >
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-amber-400 mb-3" />
          <h3 className="text-lg font-medium text-amber-800 mb-2">Autenticação necessária</h3>
          <p className="text-amber-600 mb-4">
            Você precisa estar autenticado para acessar as configurações. Por favor, faça login e tente novamente.
          </p>
          <Button 
            onClick={() => window.location.href = '/login'} 
            variant="outline" 
            className="flex mx-auto items-center gap-2 bg-white text-amber-700 border-amber-300"
          >
            Ir para o login
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  if (isLoading) {
    return (
      <DashboardLayout 
        title="Configurações" 
        subtitle="Configure as integrações com APIs externas"
      >
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-vitalis-600" />
            <p className="text-muted-foreground">Carregando configurações...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (hasError) {
    return (
      <DashboardLayout 
        title="Configurações" 
        subtitle="Configure as integrações com APIs externas"
      >
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-red-400 mb-3" />
          <h3 className="text-lg font-medium text-red-800 mb-2">Erro ao carregar configurações</h3>
          <p className="text-red-600 mb-4">
            {errorMessage || "Ocorreu um erro ao carregar as configurações. Por favor, tente novamente mais tarde."}
          </p>
          <Button 
            onClick={loadAllConfigs} 
            variant="outline" 
            className="flex mx-auto items-center gap-2"
          >
            <RefreshCcw className="h-4 w-4" />
            Tentar novamente
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout 
      title="Configurações" 
      subtitle="Configure as integrações com APIs externas"
    >
      <ErrorBoundary>
        <div className="max-w-5xl mx-auto">
          <ApiConfigTabs />
        </div>
      </ErrorBoundary>
    </DashboardLayout>
  );
};

export default Settings;
