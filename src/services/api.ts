// src/services/api.ts
import axios from 'axios';
import { supabase } from '@/integrations/supabase/client';
import { syncLogsService } from './syncLogsService';

// Type definitions
export type ApiConfigType = 'employee' | 'absenteeism' | 'company';

export interface ApiConfig {
  type: ApiConfigType;
  empresa: string;
  codigo: string;
  chave: string;
  tipoSaida: string;
  isConfigured?: boolean;
}

export interface EmployeeApiConfig extends ApiConfig {
  type: 'employee';
  ativo: string;
  inativo: string;
  afastado: string;
  pendente: string;
  ferias: string;
}

export interface AbsenteeismApiConfig extends ApiConfig {
  type: 'absenteeism';
  empresaTrabalho: string;
  dataInicio: string;
  dataFim: string;
}

// Ensure URLs are constructed properly
const ensureUrlFormat = (url: string): string => {
  if (!url) return '';
  return url.endsWith('/') ? url : `${url}/`;
};

// Create base API instance
const api = axios.create({
  baseURL: 'https://rdrvashvfvjdtuuuqjio.supabase.co',
});

// Add authentication token to all requests
api.interceptors.request.use(async (config) => {
  const session = await supabase.auth.getSession();
  if (session?.data?.session?.access_token) {
    config.headers.Authorization = `Bearer ${session.data.session.access_token}`;
  }
  return config;
});

// Handle common response errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      console.error('API Error Response:', error.response.data);
    } else if (error.request) {
      console.error('API Request Error:', error.request);
    } else {
      console.error('API Error:', error.message);
    }
    return Promise.reject(error);
  }
);

// Default mock employees for fallback
const defaultMockEmployees = [
  {
    id: 1,
    name: 'João Silva',
    full_name: 'João Carlos Silva',
    position: 'Analista de TI',
    position_name: 'Analista de Sistemas',
    sector: 'TI',
    sector_name: 'Tecnologia da Informação',
    status: 'Ativo',
    cpf: '123.456.789-00'
  },
  {
    id: 2,
    name: 'Maria Souza',
    full_name: 'Maria Eduarda Souza',
    position: 'Gerente de RH',
    position_name: 'Gerente de Recursos Humanos',
    sector: 'RH',
    sector_name: 'Recursos Humanos',
    status: 'Ativo',
    cpf: '987.654.321-00'
  },
  {
    id: 3,
    name: 'Pedro Santos',
    full_name: 'Pedro Henrique Santos',
    position: 'Assistente Administrativo',
    position_name: 'Assistente Administrativo',
    sector: 'ADM',
    sector_name: 'Administrativo',
    status: 'Afastado',
    cpf: '456.789.123-00'
  }
];

// API Services
const apiService = {
  // Authentication
  auth: {
    register: async (userData: any) => {
      try {
        const { data } = await api.post('/functions/v1/auth', userData);
        return data;
      } catch (error) {
        console.error('Registration error:', error);
        throw error;
      }
    },
  },

  // Dashboard Data
  dashboard: {
    getAbsenteeismData: async () => {
      try {
        const { data } = await api.get('/functions/v1/dashboard-data');
        return data;
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        throw error;
      }
    },
    
    getDashboardData: async () => {
      try {
        const { data } = await api.get('/functions/v1/dashboard-data');
        return data;
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        throw error;
      }
    },
  },

  // API Configuration
  apiConfig: {
    get: async (type: ApiConfigType) => {
      try {
        const { data } = await api.get(`/functions/v1/get-api-config?type=${type}`);
        return data;
      } catch (error) {
        console.error(`Error fetching ${type} API configuration:`, error);
        throw error;
      }
    },

    save: async (config: ApiConfig | EmployeeApiConfig | AbsenteeismApiConfig) => {
      try {
        const { data } = await api.post('/functions/v1/save-api-config', config);
        return data;
      } catch (error) {
        console.error('Error saving API configuration:', error);
        throw error;
      }
    },

    test: async (config: ApiConfig | EmployeeApiConfig | AbsenteeismApiConfig) => {
      try {
        const { data } = await api.post('/functions/v1/test-connection', config);
        return data;
      } catch (error) {
        console.error('Error testing API connection:', error);
        throw error;
      }
    },
  },

  // Synchronization
  sync: {
    // Check for active syncs before starting a new one
    checkActiveSyncs: async () => {
      try {
        const activeSyncs = await syncLogsService.getActiveSyncs();
        return activeSyncs;
      } catch (error) {
        console.error('Error checking active syncs:', error);
        throw error;
      }
    },

    // Start employee sync after checking active syncs
    employees: async () => {
      try {
        // Check for active syncs first
        const activeSyncs = await apiService.sync.checkActiveSyncs();
        if (activeSyncs.count > 0) {
          throw new Error(`Já existe uma sincronização em andamento: ${activeSyncs.types.join(', ')}. Aguarde a conclusão antes de iniciar uma nova.`);
        }

        // Set up automatic timeout for hung synchs
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error('Timeout: A requisição de sincronização excedeu o tempo limite. O processo pode continuar em segundo plano.'));
          }, 60000); // 60 second timeout for sync start
        });

        // Iniciar a sincronização com processamento paralelo
        const syncPromise = api.post('/functions/v1/sync-soc-data', { 
          type: 'employee',
          parallel: true,
          batchSize: 100, // Tamanho reduzido para processamento mais rápido
          maxConcurrent: 3, // Máximo de lotes processados simultaneamente
          timeoutSeconds: 600 // Defina um timeout de 10 minutos para cada operação
        });

        const { data } = await Promise.race([syncPromise, timeoutPromise]) as any;
        return data;
      } catch (error) {
        console.error('Error syncing employees:', error);
        
        // Improved error handling for conflict errors
        if (error.response && error.response.status === 409) {
          const errorMessage = error.response.data?.message || 
            'Já existe uma sincronização em andamento. Aguarde a conclusão antes de iniciar uma nova.';
          
          throw new Error(errorMessage);
        }
        
        throw error;
      }
    },

    // Start absenteeism sync after checking active syncs
    absenteeism: async () => {
      try {
        // Check for active syncs first
        const activeSyncs = await apiService.sync.checkActiveSyncs();
        if (activeSyncs.count > 0) {
          throw new Error(`Já existe uma sincronização em andamento: ${activeSyncs.types.join(', ')}. Aguarde a conclusão antes de iniciar uma nova.`);
        }

        // Set up automatic timeout for hung syncs
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error('Timeout: A requisição de sincronização excedeu o tempo limite. O processo pode continuar em segundo plano.'));
          }, 60000); // 60 second timeout for sync start
        });

        // Iniciar a sincronização com processamento paralelo
        const syncPromise = api.post('/functions/v1/sync-soc-data', { 
          type: 'absenteeism',
          parallel: true,
          batchSize: 100, // Tamanho reduzido para processamento mais rápido
          maxConcurrent: 3, // Máximo de lotes processados simultaneamente
          timeoutSeconds: 600 // Defina um timeout de 10 minutos para cada operação
        });
        
        const { data } = await Promise.race([syncPromise, timeoutPromise]) as any;
        return data;
      } catch (error) {
        console.error('Error syncing absenteeism data:', error);
        
        // Improved error handling for conflict errors
        if (error.response && error.response.status === 409) {
          const errorMessage = error.response.data?.message || 
            'Já existe uma sincronização em andamento. Aguarde a conclusão antes de iniciar uma nova.';
          
          throw new Error(errorMessage);
        }
        
        throw error;
      }
    },

    checkSyncStatus: async (syncId: number) => {
      try {
        const { data } = await api.get(`/functions/v1/sync-logs?id=${syncId}`, {
          timeout: 30000 // 30 second timeout for status check
        });
        return data;
      } catch (error) {
        console.error('Error checking sync status:', error);
        throw error;
      }
    },
    
    // Method to cancel a sync process
    cancelSync: async (syncId: number) => {
      try {
        const { data } = await api.post('/functions/v1/sync-logs/cancel', { 
          syncId,
          force: true // Add force parameter to ensure cancellation works
        }, {
          timeout: 30000 // 30 second timeout for cancel operation
        });
        return data;
      } catch (error) {
        console.error('Error cancelling sync process:', error);
        throw error;
      }
    }
  },

  // Employees
  employees: {
    getAll: async () => {
      try {
        const { data } = await api.get('/functions/v1/employees', {
          timeout: 30000 // 30 second timeout for employees fetch
        });
        
        // Validar se os dados retornados são um array
        if (Array.isArray(data)) {
          console.log('Loaded employees array:', data);
          return data;
        } else {
          console.error('API returned non-array data:', data);
          console.log('Returning mock data instead');
          return defaultMockEmployees;
        }
      } catch (error) {
        console.error('Error fetching employees:', error);
        console.log('Returning mock data due to error');
        return defaultMockEmployees;
      }
    },
    
    sync: async () => {
      // Delegate to the central sync.employees function to ensure proper checks
      return apiService.sync.employees();
    },
  },

  // Companies
  companies: {
    getAll: async () => {
      try {
        const { data } = await api.get('/functions/v1/companies');
        return data;
      } catch (error) {
        console.error('Error fetching companies:', error);
        throw error;
      }
    },
  },
  
  // Helper methods to match the direct calls in the components
  getApiConfig: async (type: ApiConfigType) => {
    return apiService.apiConfig.get(type);
  },
  
  saveApiConfig: async (config: ApiConfig | EmployeeApiConfig | AbsenteeismApiConfig) => {
    return apiService.apiConfig.save(config);
  },
  
  testApiConnection: async (config: ApiConfig | EmployeeApiConfig | AbsenteeismApiConfig) => {
    return apiService.apiConfig.test(config);
  }
};

export default apiService;
