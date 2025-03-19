import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import ApiConfigTabs from '@/components/integration/ApiConfigTabs';
import { Loader2, AlertTriangle, RefreshCcw, Wifi, WifiOff } from 'lucide-react';
import apiService from '@/services/api';
import { useToast } from '@/components/ui/use-toast';
import ErrorBoundary from '@/components/ui-custom/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Settings = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [apiConnectivity, setApiConnectivity] = useState<boolean | null>(null);
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading: authLoading, checkAuth } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is authenticated
    const verifyAuthentication = async () => {
      try {
        console.log('Verifying authentication for settings page...');
        if (!isAuthenticated && !authLoading) {
          const isAuth = await checkAuth();
          
          if (!isAuth) {
            console.log('User not authenticated, redirecting to login');
            navigate('/login', { 
              replace: true,
              state: { from: '/settings' } 
            });
            
            toast({
              variant: 'destructive',
              title: 'Acesso negado',
              description: 'Você precisa estar logado para acessar as configurações.',
            });
            return;
          }
        }
        
        // If we reach here, the user is authenticated, proceed with loading configs
        loadAllConfigs();
      } catch (error) {
        console.error('Error verifying authentication:', error);
        setHasError(true);
        setErrorMessage('Erro ao verificar autenticação');
        setIsLoading(false);
      }
    };
    
    verifyAuthentication();
  }, [isAuthenticated, authLoading]);

  // Check API connectivity
  const checkApiConnectivity = async () => {
    try {
      console.log('Testing API connectivity...');
      setApiConnectivity(null);
      
      const result = await apiService.testApiConnection({
        type: 'employee',
        empresa: 'test',
        codigo: 'test',
        chave: 'test',
        tipoSaida: 'json'
      });
      
      console.log('API connectivity test result:', result);
      
      // Even if the test fails due to invalid credentials,
      // as long as we got a response, the API is reachable
      setApiConnectivity(true);
      return true;
    } catch (error) {
      console.error('API connectivity test failed:', error);
      setApiConnectivity(false);
      return false;
    }
  };

  const loadAllConfigs = async () => {
    try {
      setIsLoading(true);
      setHasError(false);
      
      // Check API connectivity first
      const isConnected = await checkApiConnectivity();
      if (!isConnected) {
        setHasError(true);
        setErrorMessage('Não foi possível conectar ao servidor API. Verifique sua conexão com a internet.');
        setIsLoading(false);
        return;
      }
      
      console.log('Starting to load API configurations...');
      
      // Preload all configs when the settings page loads
      const results = await Promise.allSettled([
        apiService.getApiConfig('employee'),
        apiService.getApiConfig('absenteeism')
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

  if (authLoading) {
    return (
      <DashboardLayout 
        title="Configurações" 
        subtitle="Configure as integrações com APIs externas"
      >
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-vitalis-600" />
            <p className="text-muted-foreground">Verificando autenticação...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!isAuthenticated) {
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
            onClick={() => navigate('/login', { state: { from: '/settings' } })} 
            variant="outline" 
            className="flex mx-auto items-center gap-2 bg-white text-amber-700 border-amber-300"
          >
            Ir para o login
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  if (apiConnectivity === false) {
    return (
      <DashboardLayout 
        title="Configurações" 
        subtitle="Configure as integrações com APIs externas"
      >
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center">
          <WifiOff className="mx-auto h-10 w-10 text-amber-400 mb-3" />
          <h3 className="text-lg font-medium text-amber-800 mb-2">Problema de conectividade</h3>
          <p className="text-amber-600 mb-4">
            Não foi possível conectar ao servidor API. Verifique sua conexão com a internet e tente novamente.
          </p>
          <Button 
            onClick={loadAllConfigs} 
            variant="outline" 
            className="flex mx-auto items-center gap-2 bg-white text-amber-700 border-amber-300"
          >
            <RefreshCcw className="h-4 w-4" />
            Tentar novamente
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
      {apiConnectivity === true && (
        <div className="mb-4 px-4 py-2 bg-green-50 border border-green-100 rounded-md flex items-center text-green-700">
          <Wifi className="h-4 w-4 mr-2 text-green-500" />
          <span className="text-sm">Conexão com o servidor API estabelecida</span>
        </div>
      )}
      <ErrorBoundary>
        <div className="max-w-5xl mx-auto">
          <ApiConfigTabs />
        </div>
      </ErrorBoundary>
    </DashboardLayout>
  );
};

export default Settings;
