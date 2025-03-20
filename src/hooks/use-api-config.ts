
import { useState, useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';
import apiService, { ApiConfig, EmployeeApiConfig, AbsenteeismApiConfig, ApiConfigType } from '@/services/api';
import { supabase } from '@/integrations/supabase/client';
import { retryRequest } from '@/services/apiClient';

export function useApiConfig(type: ApiConfigType) {
  const { toast } = useToast();
  const [config, setConfig] = useState<ApiConfig | EmployeeApiConfig | AbsenteeismApiConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        setIsLoading(true);
        setError(null);
        console.log(`Fetching ${type} API config...`);
        
        // Verificar a sessão explicitamente antes de prosseguir
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          console.log('No active session, attempting to refresh...');
          const { data } = await supabase.auth.refreshSession();
          if (!data.session) {
            console.error('Failed to refresh session for config fetch');
            throw new Error('Sua sessão expirou. Por favor, faça login novamente para carregar as configurações.');
          }
        }
        
        // Usar o mecanismo de retry para obter a configuração
        const data = await retryRequest(
          () => apiService.apiConfig.get(type),
          3,  // Tentar até 3 vezes
          1000 // Começar com 1 segundo de atraso
        );
        
        console.log(`Fetched ${type} config:`, data);
        setConfig(data);
      } catch (error) {
        console.error(`Error fetching ${type} API config:`, error);
        setError(error instanceof Error ? error : new Error('Erro desconhecido'));
        toast({
          variant: 'destructive',
          title: 'Erro ao carregar configuração',
          description: `Não foi possível carregar a configuração da API de ${type === 'employee' ? 'funcionários' : 'absenteísmo'}. ${error instanceof Error ? error.message : ''}`,
          duration: 5000
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchConfig();
  }, [type, toast]);

  const saveConfig = async (configData: ApiConfig | EmployeeApiConfig | AbsenteeismApiConfig) => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log(`Saving ${type} config:`, configData);
      
      // Verificar a sessão explicitamente antes de prosseguir
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.log('No active session, attempting to refresh before save...');
        const { data } = await supabase.auth.refreshSession();
        if (!data.session) {
          console.error('Failed to refresh session before save');
          throw new Error('Sua sessão expirou. Por favor, faça login novamente para salvar a configuração.');
        }
        console.log('Session refreshed successfully');
      } else {
        console.log('Using existing session for save operation');
      }
      
      // Garantir que estamos enviando o formato correto para a API
      const configToSave = {
        ...configData,
        tipoSaida: 'json'
      };
      
      // Usar o mecanismo de retry com backoff exponencial para tentar o salvamento múltiplas vezes
      const result = await retryRequest(
        () => apiService.apiConfig.save(configToSave),
        3,  // Tentar até 3 vezes
        1000 // Começar com 1 segundo de atraso
      );
      
      if (!result) {
        throw new Error('Falha ao salvar a configuração da API');
      }
      
      console.log(`Saved ${type} config result:`, result);
      setConfig(result);
      
      toast({
        title: 'Configuração salva',
        description: `A configuração da API de ${type === 'employee' ? 'funcionários' : 'absenteísmo'} foi salva com sucesso.`,
        duration: 3000
      });
      
      return result;
    } catch (err) {
      console.error(`Error saving ${type} API config:`, err);
      
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(err instanceof Error ? err : new Error('Erro desconhecido'));
      
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar configuração',
        description: `Não foi possível salvar a configuração da API de ${type === 'employee' ? 'funcionários' : 'absenteísmo'}. ${errorMessage}`,
        duration: 5000
      });
      
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const testConnection = async (configData: ApiConfig | EmployeeApiConfig | AbsenteeismApiConfig) => {
    try {
      console.log(`Testing ${type} connection:`, configData);
      
      // Verificar a sessão explicitamente antes de prosseguir
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        const { data } = await supabase.auth.refreshSession();
        if (!data.session) {
          throw new Error('Sua sessão expirou. Por favor, faça login novamente para testar a conexão.');
        }
      }
      
      // Garantir que estamos enviando o formato correto para a API
      const configToTest = {
        ...configData,
        tipoSaida: 'json'
      };
      
      // Usar o mecanismo de retry para teste também
      const result = await retryRequest(
        () => apiService.apiConfig.test(configToTest),
        2,  // Tentar até 2 vezes
        1000 // Começar com 1 segundo de atraso
      );
      
      console.log(`Test connection result:`, result);
      return result;
    } catch (err) {
      console.error(`Error testing ${type} API connection:`, err);
      
      // Retornar um objeto de erro formatado
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Erro ao testar conexão com a API'
      };
    }
  };

  return {
    config,
    saveConfig,
    testConnection,
    isLoading,
    error
  };
}
