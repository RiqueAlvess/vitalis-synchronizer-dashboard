
import axios from 'axios';
import { supabase } from '@/integrations/supabase/client';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

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
        const { data } = await api.post('/functions/v1/sync-soc-data', { type: 'employee' });
        return data;
      } catch (error) {
        console.error('Error syncing employees:', error);
        throw error;
      }
    },

    absenteeism: async () => {
      try {
        const { data } = await api.post('/functions/v1/sync-soc-data', { type: 'absenteeism' });
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
        return data;
      } catch (error) {
        console.error('Error fetching employees:', error);
        throw error;
      }
    },
    
    sync: async () => {
      try {
        const { data } = await api.post('/functions/v1/sync-soc-data', { type: 'employee' });
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
