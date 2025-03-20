
import axios from 'axios';
import { supabase } from '@/integrations/supabase/client';

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
  baseURL: SUPABASE_URL,
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
    employees: async () => {
      try {
        // Iniciar a sincronização com processamento paralelo
        const { data } = await api.post('/functions/v1/sync-soc-data', { 
          type: 'employee',
          parallel: true,
          batchSize: 100, // Tamanho reduzido para processamento mais rápido
          maxConcurrent: 3 // Máximo de lotes processados simultaneamente
        });
        return data;
      } catch (error) {
        console.error('Error syncing employees:', error);
        throw error;
      }
    },

    absenteeism: async () => {
      try {
        // Iniciar a sincronização com processamento paralelo
        const { data } = await api.post('/functions/v1/sync-soc-data', { 
          type: 'absenteeism',
          parallel: true,
          batchSize: 100, // Tamanho reduzido para processamento mais rápido
          maxConcurrent: 3 // Máximo de lotes processados simultaneamente
        });
        return data;
      } catch (error) {
        console.error('Error syncing absenteeism data:', error);
        throw error;
      }
    },

    checkSyncStatus: async (syncId: number) => {
      try {
        const { data } = await api.get(`/functions/v1/sync-logs?id=${syncId}`);
        return data;
      } catch (error) {
        console.error('Error checking sync status:', error);
        throw error;
      }
    },
    
    // Method to cancel a sync process
    cancelSync: async (syncId: number) => {
      try {
        const { data } = await api.post('/functions/v1/sync-logs/cancel', { syncId });
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
        const { data } = await api.get('/functions/v1/employees');
        
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
      try {
        const { data } = await api.post('/functions/v1/sync-soc-data', { 
          type: 'employee',
          parallel: true,
          batchSize: 100,
          maxConcurrent: 3
        });
        return data;
      } catch (error) {
        console.error('Error syncing employees:', error);
        throw error;
      }
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
