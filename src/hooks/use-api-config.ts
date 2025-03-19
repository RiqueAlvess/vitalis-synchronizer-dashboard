
import { useState, useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';
import apiService from '@/services/api';
import { ApiConfig, EmployeeApiConfig, AbsenteeismApiConfig, CompanyApiConfig } from '@/services/api';

export type ApiConfigType = 'company' | 'employee' | 'absenteeism';

export function useApiConfig(type: ApiConfigType) {
  const { toast } = useToast();
  const [config, setConfig] = useState<ApiConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        setIsLoading(true);
        const data = await apiService.getApiConfig(type);
        setConfig(data);
      } catch (error) {
        console.error(`Error fetching ${type} API config:`, error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: `Could not load ${type} API configuration.`
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchConfig();
  }, [type, toast]);

  const saveConfig = async (configData: ApiConfig | EmployeeApiConfig | AbsenteeismApiConfig | CompanyApiConfig) => {
    try {
      setIsLoading(true);
      const result = await apiService.saveApiConfig(configData);
      setConfig(result);
      return result;
    } catch (error) {
      console.error(`Error saving ${type} API config:`, error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: `Could not save ${type} API configuration.`
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    config,
    saveConfig,
    isLoading
  };
}
