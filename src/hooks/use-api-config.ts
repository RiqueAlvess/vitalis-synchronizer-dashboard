
import { useState, useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';
import apiService, { ApiConfig, EmployeeApiConfig, AbsenteeismApiConfig, ApiConfigType } from '@/services/api';
import { supabase } from '@/integrations/supabase/client';

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
        
        // Ensure we have a valid session before proceeding
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          await supabase.auth.refreshSession();
        }
        
        const data = await apiService.getApiConfig(type);
        console.log(`Fetched ${type} config:`, data);
        setConfig(data);
      } catch (error) {
        console.error(`Error fetching ${type} API config:`, error);
        setError(error instanceof Error ? error : new Error('Unknown error'));
        toast({
          variant: 'destructive',
          title: 'Erro ao carregar configuração',
          description: `Não foi possível carregar a configuração da API de ${type === 'employee' ? 'funcionários' : 'absenteísmo'}.`
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
      
      // Ensure we have a valid session before proceeding
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        const { data } = await supabase.auth.refreshSession();
        if (!data.session) {
          throw new Error('Not authenticated. Please log in again to save configuration.');
        }
      }
      
      // Ensure we're sending the right format to the API
      const configToSave = {
        ...configData,
        tipoSaida: 'json'
      };
      
      // Use the retry utility to attempt the save multiple times if needed
      const result = await apiService.retryRequest(
        () => apiService.saveApiConfig(configToSave),
        3,  // Try up to 3 times
        1000 // Start with 1 second delay
      );
      
      if (!result) {
        throw new Error('Failed to save API configuration');
      }
      
      console.log(`Saved ${type} config result:`, result);
      setConfig(result);
      
      toast({
        title: 'Configuração salva',
        description: `A configuração da API de ${type === 'employee' ? 'funcionários' : 'absenteísmo'} foi salva com sucesso.`
      });
      
      return result;
    } catch (err) {
      console.error(`Error saving ${type} API config:`, err);
      
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(err instanceof Error ? err : new Error('Unknown error'));
      
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar configuração',
        description: `Não foi possível salvar a configuração da API de ${type === 'employee' ? 'funcionários' : 'absenteísmo'}.`
      });
      
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const testConnection = async (configData: ApiConfig | EmployeeApiConfig | AbsenteeismApiConfig) => {
    try {
      console.log(`Testing ${type} connection:`, configData);
      
      // Ensure we have a valid session before proceeding
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        await supabase.auth.refreshSession();
      }
      
      // Ensure we're sending the right format to the API
      const configToTest = {
        ...configData,
        tipoSaida: 'json'
      };
      
      const result = await apiService.testApiConnection(configToTest);
      
      console.log(`Test connection result:`, result);
      return result;
    } catch (err) {
      console.error(`Error testing ${type} API connection:`, err);
      throw err;
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
