
import axios from 'axios';
import { localStorageService } from './localStorageService';

// Define API configuration types
export type ApiConfigType = 'company' | 'employee' | 'absenteeism';

export interface ApiConfig {
  type: ApiConfigType;
  empresa: string;
  codigo: string;
  chave: string;
  tipoSaida: string;
  isConfigured?: boolean;
  savedLocally?: boolean;
  savedAt?: string;
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

export const supabaseAPI = axios.create({
  baseURL: import.meta.env.DEV 
    ? '/api'
    : 'https://rdrvashvfvjdtuuuqjio.supabase.co/functions/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
  withCredentials: true, // Enable sending cookies with requests
});

// Add request interceptor to include authentication headers
supabaseAPI.interceptors.request.use(
  async config => {
    // Add any additional headers or authentication tokens if needed
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle authentication errors
supabaseAPI.interceptors.response.use(
  response => {
    return response;
  },
  async error => {
    console.error('API request failed:', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      error: error.message
    });
    
    if (error.response?.status === 401) {
      console.error('Authentication error (401 Unauthorized)');
      // Redirect to login page
      window.location.href = '/login';
      return Promise.reject(new Error('Authentication failed. Please log in again.'));
    }
    
    if (typeof error.response?.data === 'string' && 
        error.response.data.includes('<!DOCTYPE html>')) {
      console.error('Received HTML instead of JSON - possible auth or endpoint issue');
      error.isHtmlResponse = true;
      error.message = 'Authentication error. Please log in and try again.';
    }
    
    if (error.message === 'Network Error') {
      console.error('Network error details:', {
        navigator: navigator?.onLine ? 'Online' : 'Offline',
        url: error.config?.url,
        method: error.config?.method,
      });
      error.message = 'Falha na conexão com o servidor. Verifique sua conexão com a internet.';
    }
    
    return Promise.reject(error);
  }
);

export const retryRequest = async (fn, maxRetries = 3, delay = 1000) => {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      console.log(`Attempt ${i + 1} failed:`, error.message);
      lastError = error;
      if (i < maxRetries - 1) {
        await new Promise(res => setTimeout(res, delay));
        delay *= 1.5;
      }
    }
  }
  throw lastError;
};

// API service with all the methods
const apiService = {
  // API Configuration methods
  getApiConfig: async (type: ApiConfigType): Promise<ApiConfig | EmployeeApiConfig | AbsenteeismApiConfig> => {
    try {
      // First check if config exists in localStorage
      const localConfig = localStorageService.getConfig<ApiConfig | EmployeeApiConfig | AbsenteeismApiConfig>(type);
      if (localConfig) {
        return { ...localConfig, savedLocally: true };
      }
      
      // If not, try to get from API
      const response = await supabaseAPI.get(`/get-api-config/${type}`);
      return { ...response.data, savedLocally: false };
    } catch (error) {
      console.error(`Error getting ${type} API config:`, error);
      
      // Return default configuration for each type
      if (type === 'employee') {
        return {
          type: 'employee',
          empresa: '423',
          codigo: '25722',
          chave: 'b4c740208036d64c467b',
          tipoSaida: 'json',
          ativo: 'Sim',
          inativo: '',
          afastado: '',
          pendente: '',
          ferias: '',
          isConfigured: false,
          savedLocally: false
        } as EmployeeApiConfig;
      } else if (type === 'absenteeism') {
        return {
          type: 'absenteeism',
          empresa: '423',
          codigo: '183868',
          chave: '6dff7b9a8a635edaddf5',
          tipoSaida: 'json',
          empresaTrabalho: '',
          dataInicio: '',
          dataFim: '',
          isConfigured: false,
          savedLocally: false
        } as AbsenteeismApiConfig;
      } else {
        return {
          type: 'company',
          empresa: '423',
          codigo: '26625',
          chave: '7e9da216f3bfda8c024b',
          tipoSaida: 'json',
          isConfigured: false,
          savedLocally: false
        } as ApiConfig;
      }
    }
  },
  
  saveApiConfig: async (config: ApiConfig | EmployeeApiConfig | AbsenteeismApiConfig): Promise<ApiConfig | EmployeeApiConfig | AbsenteeismApiConfig> => {
    try {
      // Save to localStorage
      localStorageService.saveConfig(config.type, {
        ...config,
        savedAt: new Date().toISOString(),
        isConfigured: true
      });
      
      // Also try to save to API if available
      try {
        const response = await supabaseAPI.post('/save-api-config', config);
        return { ...response.data, savedLocally: true, isConfigured: true };
      } catch (apiError) {
        console.warn('Could not save to API, but saved locally:', apiError);
        return { 
          ...config, 
          savedLocally: true, 
          isConfigured: true,
          savedAt: new Date().toISOString()
        };
      }
    } catch (error) {
      console.error('Error saving API config:', error);
      throw error;
    }
  },
  
  testApiConnection: async (config: ApiConfig | EmployeeApiConfig | AbsenteeismApiConfig): Promise<{success: boolean; message: string}> => {
    try {
      const response = await supabaseAPI.post('/test-connection', config);
      return response.data;
    } catch (error) {
      console.error('Error testing API connection:', error);
      return {
        success: false,
        message: error.message || 'Erro ao testar conexão com a API'
      };
    }
  },

  // Dashboard data
  getDashboardData: async () => {
    try {
      const response = await supabaseAPI.get('/dashboard-data');
      return response.data;
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      // Return mock data if API fails
      return {
        absenteeismRate: 3.42,
        totalAbsenceDays: 156,
        employeesAbsent: 23,
        costImpact: 'R$ 12.450,00',
        trend: 'up',
        monthlyTrend: [
          { month: 'Jan', value: 2.1 },
          { month: 'Fev', value: 2.5 },
          { month: 'Mar', value: 3.1 },
          { month: 'Abr', value: 2.8 },
          { month: 'Mai', value: 3.2 },
          { month: 'Jun', value: 3.42 }
        ],
        bySector: [
          { name: 'Administrativo', value: 2.1, count: 5 },
          { name: 'Comercial', value: 3.7, count: 8 },
          { name: 'Operacional', value: 4.2, count: 10 },
          { name: 'TI', value: 1.5, count: 2 }
        ],
        topCIDs: [
          { code: 'J11', description: 'Influenza', count: 12 },
          { code: 'M54', description: 'Dorsalgia', count: 8 },
          { code: 'F41', description: 'Transtornos ansiosos', count: 6 }
        ]
      };
    }
  },

  // API Configuration by resource type
  apiConfig: {
    get: async (type: ApiConfigType): Promise<ApiConfig | EmployeeApiConfig | AbsenteeismApiConfig> => {
      return apiService.getApiConfig(type);
    },
    save: async (config: ApiConfig | EmployeeApiConfig | AbsenteeismApiConfig): Promise<ApiConfig | EmployeeApiConfig | AbsenteeismApiConfig> => {
      return apiService.saveApiConfig(config);
    },
    test: async (config: ApiConfig | EmployeeApiConfig | AbsenteeismApiConfig): Promise<{success: boolean; message: string}> => {
      return apiService.testApiConnection(config);
    }
  },

  // Employee-related API endpoints
  employees: {
    getAll: async () => {
      try {
        const response = await supabaseAPI.get('/employees');
        return response.data;
      } catch (error) {
        console.error('Error fetching employees:', error);
        throw error;
      }
    },
    getById: async (id: string) => {
      try {
        const response = await supabaseAPI.get(`/employees/${id}`);
        return response.data;
      } catch (error) {
        console.error(`Error fetching employee with ID ${id}:`, error);
        throw error;
      }
    },
    create: async (employeeData: any) => {
      try {
        const response = await supabaseAPI.post('/employees', employeeData);
        return response.data;
      } catch (error) {
        console.error('Error creating employee:', error);
        throw error;
      }
    },
    update: async (id: string, employeeData: any) => {
      try {
        const response = await supabaseAPI.put(`/employees/${id}`, employeeData);
        return response.data;
      } catch (error) {
        console.error(`Error updating employee with ID ${id}:`, error);
        throw error;
      }
    },
    delete: async (id: string) => {
      try {
        await supabaseAPI.delete(`/employees/${id}`);
      } catch (error) {
        console.error(`Error deleting employee with ID ${id}:`, error);
        throw error;
      }
    },
    sync: async () => {
      try {
        // Get the employee API config
        const config = await apiService.getApiConfig('employee') as EmployeeApiConfig;
        
        const response = await supabaseAPI.post('/sync-soc-api', {
          type: 'employee',
          params: {
            empresa: config.empresa,
            codigo: config.codigo,
            chave: config.chave,
            tipoSaida: 'json',
            ativo: config.ativo,
            inativo: config.inativo,
            afastado: config.afastado,
            pendente: config.pendente,
            ferias: config.ferias
          }
        });
        return response.data;
      } catch (error) {
        console.error('Error syncing employees:', error);
        throw error;
      }
    }
  },
  
  // Absenteeism-related API endpoints
  absenteeism: {
    getAll: async () => {
      try {
        const response = await supabaseAPI.get('/absenteeism');
        return response.data;
      } catch (error) {
        console.error('Error fetching absenteeism data:', error);
        throw error;
      }
    },
    sync: async () => {
      try {
        // Get the absenteeism API config
        const config = await apiService.getApiConfig('absenteeism') as AbsenteeismApiConfig;
        
        const response = await supabaseAPI.post('/sync-soc-api', {
          type: 'absenteeism',
          params: {
            empresa: config.empresa,
            codigo: config.codigo,
            chave: config.chave,
            tipoSaida: 'json',
            empresaTrabalho: config.empresaTrabalho,
            dataInicio: config.dataInicio,
            dataFim: config.dataFim
          }
        });
        return response.data;
      } catch (error) {
        console.error('Error syncing absenteeism:', error);
        throw error;
      }
    }
  },
  
  // Company-related API endpoints
  companies: {
    getAll: async () => {
      try {
        const response = await supabaseAPI.get('/companies');
        return response.data;
      } catch (error) {
        console.error('Error fetching companies:', error);
        throw error;
      }
    },
    sync: async () => {
      try {
        // Get the company API config
        const config = await apiService.getApiConfig('company') as ApiConfig;
        
        const response = await supabaseAPI.post('/sync-soc-api', {
          type: 'company',
          params: {
            empresa: config.empresa,
            codigo: config.codigo,
            chave: config.chave,
            tipoSaida: 'json'
          }
        });
        return response.data;
      } catch (error) {
        console.error('Error syncing companies:', error);
        throw error;
      }
    }
  },
  
  // Sync logs API endpoints
  syncLogs: {
    getAll: async () => {
      try {
        const response = await supabaseAPI.get('/sync-logs');
        return response.data;
      } catch (error) {
        console.error('Error fetching sync logs:', error);
        throw error;
      }
    }
  },
  
  // Authentication-related API endpoints
  auth: {
    login: async (credentials: any) => {
      try {
        const response = await supabaseAPI.post('/auth/login', credentials);
        return response.data;
      } catch (error) {
        console.error('Error during login:', error);
        throw error;
      }
    },
    register: async (userData: any) => {
      try {
        const response = await supabaseAPI.post('/auth/register', userData);
        return response.data;
      } catch (error) {
        console.error('Error during registration:', error);
        throw error;
      }
    },
    logout: async () => {
      try {
        await supabaseAPI.post('/auth/logout', {});
      } catch (error) {
        console.error('Error during logout:', error);
        throw error;
      }
    },
    getSession: async () => {
      try {
        const response = await supabaseAPI.get('/auth/session');
        return response.data;
      } catch (error) {
        console.error('Error getting session:', error);
        throw error;
      }
    }
  },
  
  // Background sync queue API endpoints
  sync: {
    employees: async () => {
      try {
        // Get the employee API config
        const config = await apiService.getApiConfig('employee') as EmployeeApiConfig;
        
        const response = await supabaseAPI.post('/queue-sync-processor/enqueue', {
          type: 'employee',
          params: {
            empresa: config.empresa,
            codigo: config.codigo,
            chave: config.chave,
            tipoSaida: 'json',
            ativo: config.ativo,
            inativo: config.inativo,
            afastado: config.afastado,
            pendente: config.pendente,
            ferias: config.ferias
          }
        });
        
        return response.data;
      } catch (error) {
        console.error('Error syncing employees:', error);
        throw new Error('Failed to sync employees: ' + (error.message || 'Unknown error'));
      }
    },
    
    absenteeism: async () => {
      try {
        // Get the absenteeism API config
        const config = await apiService.getApiConfig('absenteeism') as AbsenteeismApiConfig;
        
        const response = await supabaseAPI.post('/queue-sync-processor/enqueue', {
          type: 'absenteeism',
          params: {
            empresa: config.empresa,
            codigo: config.codigo,
            chave: config.chave,
            tipoSaida: 'json',
            empresaTrabalho: config.empresaTrabalho,
            dataInicio: config.dataInicio,
            dataFim: config.dataFim
          }
        });
        
        return response.data;
      } catch (error) {
        console.error('Error syncing absenteeism:', error);
        throw new Error('Failed to sync absenteeism: ' + (error.message || 'Unknown error'));
      }
    },
    
    companies: async () => {
      try {
        // Get the company API config
        const config = await apiService.getApiConfig('company') as ApiConfig;
        
        const response = await supabaseAPI.post('/queue-sync-processor/enqueue', {
          type: 'company',
          params: {
            empresa: config.empresa,
            codigo: config.codigo,
            chave: config.chave,
            tipoSaida: 'json'
          }
        });
        
        return response.data;
      } catch (error) {
        console.error('Error syncing companies:', error);
        throw new Error('Failed to sync companies: ' + (error.message || 'Unknown error'));
      }
    },
    
    checkJobStatus: async (jobId: string) => {
      try {
        const response = await supabaseAPI.get(`/queue-sync-processor/status?jobId=${jobId}`);
        return response.data;
      } catch (error) {
        console.error('Error checking job status:', error);
        throw new Error('Failed to check job status: ' + (error.message || 'Unknown error'));
      }
    }
  },
};

export default apiService;
