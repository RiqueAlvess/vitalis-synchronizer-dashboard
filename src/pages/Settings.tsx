
import React, { useState, useEffect, useRef } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import ApiConfigTabs from '@/components/integration/ApiConfigTabs';
import { Loader2, AlertTriangle, RefreshCcw, Wifi, WifiOff } from 'lucide-react';
import apiService from '@/services/api';
import { useToast } from '@/components/ui/use-toast';
import ErrorBoundary from '@/components/ui-custom/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';

const Settings = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [apiConnectivity, setApiConnectivity] = useState<boolean | null>(null);
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const loadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initialLoadAttempted = useRef(false);

  useEffect(() => {
    // Definir um timeout para garantir que não fiquemos presos no carregamento
    loadTimeoutRef.current = setTimeout(() => {
      if (isLoading) {
        console.log('Safety timeout triggered for settings page');
        setIsLoading(false);
      }
    }, 5000);
    
    // Carregar configurações quando o componente montar
    if (!initialLoadAttempted.current) {
      initialLoadAttempted.current = true;
      
      // Se o usuário estiver autenticado, carregar as configurações
      if (isAuthenticated) {
        console.log('User is authenticated, loading settings');
        loadAllConfigs();
      } else {
        console.log('User is not authenticated, not loading settings');
        setIsLoading(false);
      }
    }

    return () => {
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = null;
      }
    };
  }, [isAuthenticated]);

  // Verificar conectividade da API
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
      
      // Mesmo que o teste falhe devido a credenciais inválidas,
      // desde que obtivemos uma resposta, a API está acessível
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
      
      // Verificar conectividade da API primeiro
      const isConnected = await checkApiConnectivity();
      if (!isConnected) {
        setHasError(true);
        setErrorMessage('Não foi possível conectar ao servidor API. Verifique sua conexão com a internet.');
        setIsLoading(false);
        return;
      }
      
      console.log('Starting to load API configurations...');
      
      // Pré-carregar todas as configurações quando a página de configurações for carregada
      const results = await Promise.allSettled([
        apiService.getApiConfig('employee'),
        apiService.getApiConfig('absenteeism')
      ]);
      
      console.log('API config loading results:', results.map(r => ({ 
        status: r.status, 
        value: r.status === 'fulfilled' ? 'Config loaded' : 'Failed to load' 
      })));
      
      // Verificar se todas as promessas foram rejeitadas
      if (results.every(result => result.status === 'rejected')) {
        throw new Error('Não foi possível carregar nenhuma das configurações. Verifique sua conexão com a internet e tente novamente.');
      }
      
      // Se pelo menos uma configuração foi carregada com sucesso, considerar como sucesso
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
      // Limpar o timeout de segurança
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = null;
      }
    }
  };

  // Mostrar um esqueleto de carregamento
  if (isLoading) {
    return (
      <DashboardLayout 
        title="Configurações" 
        subtitle="Configure as integrações com APIs externas"
      >
        <div className="space-y-6">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
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
