import axios from 'axios';
import { supabase } from '@/integrations/supabase/client';
import { DashboardData, MonthlyTrendData, SectorData } from '@/types/dashboard';
import type { MockCompanyData, MockEmployeeData } from '@/types/dashboard';
import { localStorageService } from '@/services/localStorageService';

const retryRequest = async (fn, maxRetries = 3, delay = 1000) => {
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

const supabaseAPI = axios.create({
  baseURL: import.meta.env.DEV 
    ? '/api'
    : 'https://rdrvashvfvjdtuuuqjio.supabase.co/functions/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
  withCredentials: false,
});

supabaseAPI.interceptors.request.use(async (config) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      config.headers.Authorization = `Bearer ${session.access_token}`;
      console.log('Added auth token to request:', config.url);
    } else {
      console.warn('No active session found when making API request to:', config.url);
    }
  } catch (error) {
    console.error('Error adding auth token to request:', error);
  }
  return config;
}, (error) => {
  console.error('Request interceptor error:', error);
  return Promise.reject(error);
});

supabaseAPI.interceptors.response.use(
  response => {
    if (typeof response.data === 'string' && response.data.includes('<!DOCTYPE html>')) {
      console.error('Received HTML instead of JSON:', {
        url: response.config?.url,
        status: response.status,
        data: response.data.substring(0, 200) + '...'
      });
      return Promise.reject(new Error('Received HTML instead of JSON. Authentication may have failed.'));
    }
    return response;
  },
  error => {
    console.error('API request failed:', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      error: error.message
    });
    
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
      error.message = 'Falha na conexão com o servidor. Verifique sua conexão de internet.';
    }
    
    return Promise.reject(error);
  }
);

export interface ApiConfig {
  type: 'company' | 'employee' | 'absenteeism';
  empresa: string;
  codigo: string;
  chave: string;
  tipoSaida: string;
  isConfigured?: boolean;
  savedLocally?: boolean;
  savedAt?: string;
}

export interface CompanyApiConfig extends ApiConfig {
  type: 'company';
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

interface ApiResponse<T> {
  data: T[] | null;
  error: string | null;
}

export interface Company {
  id: number;
  name: string;
  cnpj: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Employee {
  id: number;
  name: string;
  email: string;
  phone: string;
  companyId: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Absenteeism {
  id: number;
  employeeId: number;
  companyId: number;
  startDate: Date;
  endDate: Date;
  reason: string;
  cid: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: number;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

const generateMockData = (type: string): MockCompanyData[] | MockEmployeeData[] | DashboardData => {
  if (type === 'dashboard') {
    return {
      absenteeismRate: 3.42,
      totalAbsenceDays: 128,
      employeesAbsent: 24,
      costImpact: 'R$ 18.750,00',
      trend: 'down',
      monthlyTrend: [
        { month: '1/2023', count: 10, hours: 80, value: 2.8 },
        { month: '2/2023', count: 12, hours: 96, value: 3.1 },
        { month: '3/2023', count: 14, hours: 112, value: 3.6 },
        { month: '4/2023', count: 16, hours: 128, value: 4.2 },
        { month: '5/2023', count: 15, hours: 120, value: 3.9 },
        { month: '6/2023', count: 13, hours: 104, value: 3.4 },
      ],
      bySector: [
        { name: 'Administrativo', value: 45 },
        { name: 'Produção', value: 32 },
        { name: 'Comercial', value: 24 },
        { name: 'Logística', value: 18 },
        { name: 'Manutenção', value: 9 }
      ]
    } as DashboardData;
  } else if (type === 'companies') {
    return Array.from({ length: 5 }, (_, i) => ({
      id: i + 1,
      name: `Empresa ${i + 1} Ltda`,
      short_name: `Empresa ${i + 1}`,
      corporate_name: `Empresa ${i + 1} Ltda`,
      tax_id: `${10000000000000 + i}`,
      employees: Math.floor(Math.random() * 100) + 10,
      syncStatus: ['synced', 'pending', 'error'][Math.floor(Math.random() * 3)],
      lastSync: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()
    })) as MockCompanyData[];
  } else if (type === 'employees') {
    return Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      name: `Funcionário ${i + 1}`,
      full_name: `Funcionário Exemplo ${i + 1}`,
      position: `Cargo ${Math.floor(i / 3) + 1}`,
      position_name: `Cargo ${Math.floor(i / 3) + 1}`,
      sector: `Setor ${Math.floor(i / 2) + 1}`,
      sector_name: `Setor ${Math.floor(i / 2) + 1}`,
      status: ['Ativo', 'Afastado', 'Inativo'][Math.floor(Math.random() * 3)],
      absentDays: Math.floor(Math.random() * 20)
    })) as MockEmployeeData[];
  }
  return [] as MockCompanyData[];
};

const hoursToDecimal = (hoursString: string): number => {
  if (!hoursString) return 0;
  
  const [hours, minutes] = hoursString.split(':').map(part => {
    const num = parseInt(part, 10);
    return isNaN(num) ? 0 : num;
  });
  
  return hours + (minutes / 60);
};

async function fetchDataFromExternalApi<T>(config: ApiConfig): Promise<ApiResponse<T>> {
  try {
    if (!config) {
      throw new Error('API configuration not found');
    }

    let url = '';
    if (config.type === 'company') {
      url = `/companies?empresa=${config.empresa}&codigo=${config.codigo}&chave=${config.chave}&tipoSaida=${config.tipoSaida}`;
    } else if (config.type === 'employee') {
      url = `/employees?empresa=${config.empresa}&codigo=${config.codigo}&chave=${config.chave}&tipoSaida=${config.tipoSaida}`;
    } else if (config.type === 'absenteeism') {
      url = `/absenteeism?empresa=${config.empresa}&codigo=${config.codigo}&chave=${config.chave}&tipoSaida=${config.tipoSaida}`;
    } else {
      throw new Error('Invalid API type');
    }

    const response = await retryRequest(() => supabaseAPI.get(url), 2);

    if (response.status !== 200) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    return { data: response.data as T[], error: null };
  } catch (error: any) {
    console.error('Error fetching data from external API:', error);
    return { data: null, error: error.message || 'Failed to fetch data from external API' };
  }
}

const checkApiConnectivity = async (): Promise<boolean> => {
  try {
    if (localStorageService.isPreviewEnvironment()) {
      console.log('Preview environment detected, API connectivity check skipped');
      return false;
    }
    
    await supabaseAPI.get('/test-connection');
    return true;
  } catch (error) {
    console.warn('API connectivity check failed:', error.message);
    
    if (error.response) {
      return true;
    }
    
    return false;
  }
};

const apiService = {
  companies: {
    getAll: async (): Promise<MockCompanyData[]> => {
      try {
        const config = await apiService.apiConfig.get('company');
        
        if (!config || !config.isConfigured) {
          console.warn('Company API not configured, returning mock data');
          return generateMockData('companies') as MockCompanyData[];
        }
        
        const response = await supabaseAPI.get<MockCompanyData[]>('/api/companies');
        
        if (Array.isArray(response.data) && response.data.length > 0) {
          return response.data;
        } else {
          console.warn('Empty response from API, returning mock data');
          return generateMockData('companies') as MockCompanyData[];
        }
      } catch (error) {
        console.error('Error fetching companies, using mock data:', error);
        return generateMockData('companies') as MockCompanyData[];
      }
    },
    getById: async (id: number): Promise<MockCompanyData | null> => {
      try {
        const response = await supabaseAPI.get<MockCompanyData>(`/api/companies/${id}`);
        return response.data;
      } catch (error) {
        console.error('Error fetching company:', error);
        return null;
      }
    },
    create: async (data: Omit<MockCompanyData, 'id' | 'createdAt' | 'updatedAt'>): Promise<MockCompanyData | null> => {
      try {
        const response = await supabaseAPI.post<MockCompanyData>('/api/companies', data);
        return response.data;
      } catch (error) {
        console.error('Error creating company:', error);
        return null;
      }
    },
    update: async (id: number, data: Omit<MockCompanyData, 'createdAt' | 'updatedAt' | 'id'>): Promise<MockCompanyData | null> => {
      try {
        const response = await supabaseAPI.put<MockCompanyData>(`/api/companies/${id}`, data);
        return response.data;
      } catch (error) {
        console.error('Error updating company:', error);
        return null;
      }
    },
    delete: async (id: number): Promise<boolean> => {
      try {
        await supabaseAPI.delete(`/api/companies/${id}`);
        return true;
      } catch (error) {
        console.error('Error deleting company:', error);
        return false;
      }
    },
    sync: async (): Promise<boolean> => {
      try {
        const config = await apiService.apiConfig.get('company');
        
        if (!config || !config.isConfigured) {
          console.warn('Company API not configured, sync not attempted');
          return false;
        }
        
        await supabaseAPI.post('/api/companies/sync');
        return true;
      } catch (error) {
        console.error('Error syncing companies:', error);
        return false;
      }
    }
  },
  employees: {
    getAll: async (): Promise<MockEmployeeData[]> => {
      try {
        const config = await apiService.apiConfig.get('employee');
        
        if (!config || !config.isConfigured) {
          console.warn('Employee API not configured, returning mock data');
          return generateMockData('employees') as MockEmployeeData[];
        }
        
        const response = await supabaseAPI.get<MockEmployeeData[]>('/api/employees');
        
        if (Array.isArray(response.data) && response.data.length > 0) {
          return response.data;
        } else {
          console.warn('Empty response from API, returning mock data');
          return generateMockData('employees') as MockEmployeeData[];
        }
      } catch (error) {
        console.error('Error fetching employees, using mock data:', error);
        return generateMockData('employees') as MockEmployeeData[];
      }
    },
    getById: async (id: number): Promise<MockEmployeeData | null> => {
      try {
        const response = await supabaseAPI.get<MockEmployeeData>(`/api/employees/${id}`);
        return response.data;
      } catch (error) {
        console.error('Error fetching employee:', error);
        return null;
      }
    },
    create: async (data: Omit<MockEmployeeData, 'id' | 'createdAt' | 'updatedAt'>): Promise<MockEmployeeData | null> => {
      try {
        const response = await supabaseAPI.post<MockEmployeeData>('/api/employees', data);
        return response.data;
      } catch (error) {
        console.error('Error creating employee:', error);
        return null;
      }
    },
    update: async (id: number, data: Omit<MockEmployeeData, 'createdAt' | 'updatedAt' | 'id'>): Promise<MockEmployeeData | null> => {
      try {
        const response = await supabaseAPI.put<MockEmployeeData>(`/api/employees/${id}`, data);
        return response.data;
      } catch (error) {
        console.error('Error updating employee:', error);
        return null;
      }
    },
    delete: async (id: number): Promise<boolean> => {
      try {
        await supabaseAPI.delete(`/api/employees/${id}`);
        return true;
      } catch (error) {
        console.error('Error deleting employee:', error);
        return false;
      }
    },
    sync: async (): Promise<boolean> => {
      try {
        const config = await apiService.apiConfig.get('employee');
        
        if (!config || !config.isConfigured) {
          console.warn('Employee API not configured, sync not attempted');
          return false;
        }
        
        await supabaseAPI.post('/api/employees/sync');
        return true;
      } catch (error) {
        console.error('Error syncing employees:', error);
        return false;
      }
    },
    testConnection: async (config: EmployeeApiConfig): Promise<{success: boolean, count: number}> => {
      try {
        const response = await supabaseAPI.post('/api/employees/test-connection', config);
        return response.data;
      } catch (error) {
        console.error('Error testing employee API connection:', error);
        throw error;
      }
    }
  },
  absenteeism: {
    getAll: async (): Promise<Absenteeism[]> => {
      try {
        const response = await supabaseAPI.get<Absenteeism[]>('/api/absenteeism');
        return response.data;
      } catch (error) {
        console.error('Error fetching absenteeism:', error);
        return [];
      }
    },
    getById: async (id: number): Promise<Absenteeism | null> => {
      try {
        const response = await supabaseAPI.get<Absenteeism>(`/api/absenteeism/${id}`);
        return response.data;
      } catch (error) {
        console.error('Error fetching absenteeism:', error);
        return null;
      }
    },
    create: async (data: Omit<Absenteeism, 'id' | 'createdAt' | 'updatedAt'>): Promise<Absenteeism | null> => {
      try {
        const response = await supabaseAPI.post<Absenteeism>('/api/absenteeism', data);
        return response.data;
      } catch (error) {
        console.error('Error creating absenteeism:', error);
        return null;
      }
    },
    update: async (id: number, data: Omit<Absenteeism, 'createdAt' | 'updatedAt' | 'id'>): Promise<Absenteeism | null> => {
      try {
        const response = await supabaseAPI.put<Absenteeism>(`/api/absenteeism/${id}`, data);
        return response.data;
      } catch (error) {
        console.error('Error updating absenteeism:', error);
        return null;
      }
    },
    delete: async (id: number): Promise<boolean> => {
      try {
        await supabaseAPI.delete(`/api/absenteeism/${id}`);
        return true;
      } catch (error) {
        console.error('Error deleting absenteeism:', error);
        return false;
      }
    }
  },
  users: {
    getMe: async (): Promise<User | null> => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;
        
        return {
          id: parseInt(user.id, 36) % 1000000,
          name: user.user_metadata?.name || 'User',
          email: user.email || '',
          createdAt: new Date(user.created_at),
          updatedAt: new Date()
        };
      } catch (error) {
        console.error('Error fetching user:', error);
        return null;
      }
    },
  },
  apiConfig: {
    get: async (type: 'company' | 'employee' | 'absenteeism'): Promise<ApiConfig | EmployeeApiConfig | AbsenteeismApiConfig | CompanyApiConfig | null> => {
      try {
        console.log(`Fetching ${type} API config...`);
        
        if (localStorageService.isPreviewEnvironment()) {
          console.log(`Preview environment detected, using localStorage for ${type} config`);
          const localConfig = localStorageService.getConfig(type);
          
          if (localConfig) {
            console.log(`Found local ${type} config:`, localConfig);
            return {
              ...localConfig,
              isConfigured: !!(localConfig.empresa && localConfig.codigo && localConfig.chave)
            };
          }
          
          return {
            type,
            empresa: '',
            codigo: '',
            chave: '',
            tipoSaida: 'json',
            isConfigured: false
          };
        }
        
        const cachedConfig = localStorage.getItem(`api_config_${type}`);
        let localConfig = null;
        
        if (cachedConfig) {
          try {
            localConfig = JSON.parse(cachedConfig);
            console.log(`Found cached ${type} config in localStorage:`, localConfig);
          } catch (e) {
            console.error('Failed to parse cached config:', e);
          }
        }
        
        try {
          const response = await retryRequest(() => supabaseAPI.get<ApiConfig | EmployeeApiConfig | AbsenteeismApiConfig | CompanyApiConfig>(`/api-config/${type}`), 2);
          
          if (!response.data || typeof response.data !== 'object') {
            console.warn(`Invalid response for ${type} API config:`, response.data);
            return localConfig || null;
          }
          
          console.log(`Successfully fetched ${type} API config:`, response.data);
          
          if (response.data) {
            response.data.isConfigured = !!(response.data.empresa && response.data.codigo && response.data.chave);
            
            localStorage.setItem(`api_config_${type}`, JSON.stringify(response.data));
          }
          
          return response.data;
        } catch (err) {
          console.error(`Error fetching ${type} API config from server:`, err);
          
          if (localConfig) {
            console.log(`Using cached ${type} config due to API error`);
            return localConfig;
          }
          
          throw err;
        }
      } catch (error) {
        console.error(`Error fetching ${type} API config:`, error);
        
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          console.error('User is not authenticated when fetching API config');
        }
        
        return {
          type,
          empresa: '',
          codigo: '',
          chave: '',
          tipoSaida: 'json',
          isConfigured: false
        };
      }
    },
    save: async (config: ApiConfig | EmployeeApiConfig | AbsenteeismApiConfig | CompanyApiConfig): Promise<ApiConfig | null> => {
      try {
        if (localStorageService.isPreviewEnvironment()) {
          console.log(`Preview environment detected, saving ${config.type} config to localStorage`);
          const success = localStorageService.saveConfig(config.type, config);
          
          if (success) {
            return {
              ...config,
              isConfigured: !!(config.empresa && config.codigo && config.chave),
              savedLocally: true,
              savedAt: new Date().toISOString()
            };
          } else {
            throw new Error('Failed to save to localStorage');
          }
        }
        
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          console.error('User is not authenticated when saving API config');
          throw new Error('Authentication required to save configuration');
        }
        
        const configToSave = {
          ...config,
          tipoSaida: 'json'
        };
        
        console.log('Saving API config:', configToSave);
        
        const isConnected = await checkApiConnectivity();
        if (!isConnected) {
          console.warn('API connectivity check failed, saving to localStorage only');
          localStorage.setItem(`api_config_${config.type}`, JSON.stringify(configToSave));
          throw new Error('Não foi possível conectar ao servidor. Configurações salvas apenas localmente.');
        }
        
        const response = await retryRequest(
          async () => {
            try {
              return await supabaseAPI.post<ApiConfig>('/api-config', configToSave);
            } catch (err) {
              if (err.message.includes('Network Error')) {
                console.log("Network error, trying alternate endpoint format...");
                return await axios.post(
                  'https://rdrvashvfvjdtuuuqjio.supabase.co/functions/v1/save-api-config',
                  configToSave,
                  {
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${session.access_token}`
                    }
                  }
                );
              }
              throw err;
            }
          }, 
          2
        );
        
        if (!response.data || typeof response.data !== 'object') {
          console.warn('Invalid response when saving API config:', 
            typeof response.data === 'string' ? response.data.substring(0, 100) : response.data);
          throw new Error('Invalid response from server');
        }
        
        console.log('API config saved successfully:', response.data);
        
        const result = {...response.data};
        result.isConfigured = !!(result.empresa && result.codigo && result.chave);
        
        localStorage.setItem(`api_config_${config.type}`, JSON.stringify(result));
        
        return result;
      } catch (error) {
        console.error('Error saving API config:', error);
        
        if ((error as any).isHtmlResponse) {
          throw new Error('Authentication error. Please log in and try again.');
        }
        
        if (error.message.includes('Network Error') || error.message.includes('Não foi possível conectar')) {
          const savedConfig = {
            ...config,
            isConfigured: !!(config.empresa && config.codigo && config.chave),
            savedLocally: true,
            savedAt: new Date().toISOString()
          };
          localStorage.setItem(`api_config_${config.type}`, JSON.stringify(savedConfig));
          
          throw new Error('Não foi possível conectar ao servidor. Configurações salvas apenas localmente.');
        }
        
        throw error;
      }
    },
    test: async (type: 'company' | 'employee' | 'absenteeism'): Promise<{success: boolean, message: string}> => {
      try {
        if (localStorageService.isPreviewEnvironment()) {
          console.log(`Preview environment detected, simulating test for ${type} API`);
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          return {
            success: true,
            message: 'Conexão simulada bem-sucedida no ambiente de prévia. No ambiente de produção, uma conexão real seria testada.'
          };
        }
        
        const config = await apiService.getApiConfig(type);
        if (!config) {
          throw new Error(`No ${type} API config found`);
        }
        
        return await apiService.testApiConnection(config);
      } catch (error) {
        console.error('Error testing API config:', error);
        throw error;
      }
    }
  },
  getApiConfig: async (type: 'company' | 'employee' | 'absenteeism'): Promise<ApiConfig | EmployeeApiConfig | AbsenteeismApiConfig | CompanyApiConfig | null> => {
    return apiService.apiConfig.get(type);
  },
  saveApiConfig: async (config: ApiConfig | EmployeeApiConfig | AbsenteeismApiConfig | CompanyApiConfig): Promise<ApiConfig | null> => {
    return apiService.apiConfig.save(config);
  },
  testApiConnection: async (config: ApiConfig | EmployeeApiConfig | AbsenteeismApiConfig | CompanyApiConfig): Promise<{success: boolean, message: string}> => {
    try {
      if (localStorageService.isPreviewEnvironment()) {
        console.log(`Preview environment detected, simulating test for API connection`);
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        return {
          success: true,
          message: 'Conexão simulada bem-sucedida no ambiente de prévia. No ambiente de produção, uma conexão real seria testada.'
        };
      }
      
      console.log('Testing API connection with config:', config);
      
      const response = await retryRequest(
        async () => {
          try {
            return await supabaseAPI.post('/test-connection', config);
          } catch (err) {
            if (err.message === 'Network Error') {
              console.log("Network error, trying direct endpoint...");
              const { data: { session } } = await supabase.auth.getSession();
              return await axios.post(
                'https://rdrvashvfvjdtuuuqjio.supabase.co/functions/v1/test-connection',
                config,
                {
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': session ? `Bearer ${session.access_token}` : ''
                  }
                }
              );
            }
            throw err;
          }
        }, 
        2
      );
      
      console.log('Test connection response:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('Error testing API connection:', error);
      
      if (error.isHtmlResponse) {
        return { 
          success: false, 
          message: 'Error connecting to the API. Please check your network connection and authentication status.' 
        };
      }
      
      if (error.message === 'Network Error' || error.code === 'ERR_NETWORK') {
        return {
          success: false,
          message: 'Não foi possível conectar ao servidor API. Verifique sua conexão de internet.'
        };
      }
      
      let message = 'Failed to connect to the API';
      if (error.response?.data?.message) {
        message = error.response.data.message;
      } else if (error.message) {
        message = error.message;
      }
      
      return { success: false, message };
    }
  },
  async getDashboardData(): Promise<DashboardData> {
    try {
      const [companyConfig, employeeConfig, absenteeismConfig] = await Promise.all([
        this.apiConfig.get('company'),
        this.apiConfig.get('employee'),
        this.apiConfig.get('absenteeism')
      ]);
      
      const allConfigured = 
        companyConfig?.isConfigured && 
        employeeConfig?.isConfigured && 
        absenteeismConfig?.isConfigured;
      
      if (!allConfigured) {
        console.warn('Not all APIs are configured, returning mock dashboard data');
        return generateMockData('dashboard') as DashboardData;
      }
      
      const absenteeismData = await this.absenteeism.getAll();
      const employeesData = await this.employees.getAll();
      
      if (!absenteeismData || absenteeismData.length === 0) {
        console.warn('No absenteeism data available, returning mock dashboard data');
        return generateMockData('dashboard') as DashboardData;
      }
      
      return {
        absenteeismRate: calculateAbsenteeismRate(absenteeismData),
        totalAbsenceDays: calculateTotalAbsenceDays(absenteeismData),
        employeesAbsent: countUniqueEmployees(absenteeismData),
        costImpact: calculateCostImpact(absenteeismData),
        trend: determineTrend(absenteeismData),
        monthlyTrend: getMonthlyEvolution(absenteeismData),
        bySector: getSectorAbsenceData(absenteeismData)
      };
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      return generateMockData('dashboard') as DashboardData;
    }
  }
};

const determineTrend = (absenteeismData: any[]): 'up' | 'down' | 'stable' => {
  const monthlyData = getMonthlyEvolution(absenteeismData);
  
  if (monthlyData.length < 2) {
    return 'stable';
  }
  
  const lastMonth = monthlyData[monthlyData.length - 1].value;
  const previousMonth = monthlyData[monthlyData.length - 2].value;
  
  if (lastMonth > previousMonth * 1.05) {
    return 'up';
  } else if (lastMonth < previousMonth * 0.95) {
    return 'down';
  } else {
    return 'stable';
  }
};

const calculateTotalAbsenceDays = (absenteeismData: any[]): number => {
  return absenteeismData.reduce((sum, record) => {
    const startDate = new Date(record.start_date || record.startDate);
    const endDate = new Date(record.end_date || record.endDate);
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return sum + (record.days_absent || 1);
    }
    
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
    return sum + diffDays;
  }, 0);
};

const countUniqueEmployees = (absenteeismData: any[]): number => {
  const uniqueEmployees = new Set(absenteeismData.map(record => record.employee_id || record.employeeId));
  return uniqueEmployees.size;
};

const calculateCostImpact = (absenteeismData: any[]): string => {
  const totalAbsentHours = absenteeismData.reduce((sum, record) => {
    return sum + hoursToDecimal(record.hours_absent || record.hoursAbsent || "0:00");
  }, 0);
  
  const averageHourlyCost = 30;
  const totalCost = totalAbsentHours * averageHourlyCost;
  
  return new Intl.NumberFormat('pt-BR', { 
    style: 'currency', 
    currency: 'BRL' 
  }).format(totalCost);
};

const getSectorAbsenceData = (absenteeismData: any[]): SectorData[] => {
  const sectorCounts = absenteeismData.reduce((acc: Record<string, number>, record) => {
    const sector = record.sector || 'Não informado';
    if (!acc[sector]) {
      acc[sector] = 0;
    }
    
    let days = 0;
    const startDate = new Date(record.start_date || record.startDate);
    const endDate = new Date(record.end_date || record.endDate);
    
    if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
      const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
      days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
    } else {
      days = record.days_absent || 1;
    }
    
    acc[sector] += days;
    return acc;
  }, {} as Record<string, number>);
  
  return Object.entries(sectorCounts)
    .map(([name, value]): SectorData => ({ name, value: Number(value) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
};

const calculateAbsenteeismRate = (absenteeismData: any[]) => {
  const totalAbsentHours = absenteeismData.reduce((sum, record) => {
    return sum + hoursToDecimal(record.hours_absent || record.hoursAbsent || "0:00");
  }, 0);
  
  const avgWorkHoursPerMonth = 220;
  const estimatedTotalWorkHours = absenteeismData.length > 0 ? absenteeismData.length * avgWorkHoursPerMonth : 1;
  
  return (totalAbsentHours / estimatedTotalWorkHours) * 100;
};

const getTopCids = (absenteeismData: any[]) => {
  const cidCounts = absenteeismData.reduce((acc: Record<string, number>, record) => {
    const cid = record.primary_icd || record.primaryIcd || 'Não informado';
    acc[cid] = (acc[cid] || 0) + 1;
    return acc;
  }, {});
  
  return Object.entries(cidCounts)
    .map(([cid, count]) => ({ cid, count }))
    .sort((a, b) => (b.count as number) - (a.count as number))
    .slice(0, 10);
};

const getTopSectors = (absenteeismData: any[]) => {
  const sectorCounts = absenteeismData.reduce((acc: Record<string, number>, record) => {
    const sector = record.sector || 'Não informado';
    acc[sector] = (acc[sector] || 0) + 1;
    return acc;
  }, {});
  
  return Object.entries(sectorCounts)
    .map(([sector, count]) => ({ sector, count }))
    .sort((a, b) => (b.count as number) - (a.count as number))
    .slice(0, 10);
};

const getMonthlyEvolution = (absenteeismData: any[]): MonthlyTrendData[] => {
  const monthlyData: Record<string, MonthlyTrendData> = absenteeismData.reduce((acc: Record<string, MonthlyTrendData>, record) => {
    const startDate = new Date(record.start_date || record.startDate);
    
    if (isNaN(startDate.getTime())) {
      return acc;
    }
    
    const monthYear = `${startDate.getMonth() + 1}/${startDate.getFullYear()}`;
    
    if (!acc[monthYear]) {
      acc[monthYear] = { 
        month: monthYear, 
        count: 0, 
        hours: 0,
        value: 0 
      };
    }
    
    acc[monthYear].count += 1;
    acc[monthYear].hours += hoursToDecimal(record.hours_absent || record.hoursAbsent || "0:00");
    
    const avgWorkHoursPerMonth = 220;
    acc[monthYear].value = (acc[monthYear].hours / (acc[monthYear].count * avgWorkHoursPerMonth)) * 100;
    
    return acc;
  }, {});
  
  return Object.values(monthlyData)
    .sort((a, b) => {
      const [aMonth, aYear] = a.month.split('/').map(Number);
      const [bMonth, bYear] = b.month.split('/').map(Number);
      return (aYear - bYear) || (aMonth - bMonth);
    });
};

export default apiService;
