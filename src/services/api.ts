import axios from 'axios';
import { supabase } from '@/integrations/supabase/client';
import { DashboardData, MonthlyTrendData, SectorData, ApiStorageProps } from '@/types/dashboard';
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

export type ApiConfigType = 'company' | 'employee' | 'absenteeism';

export interface ApiConfig extends ApiStorageProps {
  type: ApiConfigType;
  empresa: string;
  codigo: string;
  chave: string;
  tipoSaida: string;
  isConfigured?: boolean;
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
  getDashboardData: async (): Promise<DashboardData> => {
    try {
      const companyConfig = await apiService.apiConfig.get('company');
      const employeeConfig = await apiService.apiConfig.get('employee');
      const absenteeismConfig = await apiService.apiConfig.get('absenteeism');
      
      if (!companyConfig?.isConfigured || !employeeConfig?.isConfigured || !absenteeismConfig?.isConfigured) {
        console.warn('Um ou mais serviços de API não configurados, retornando dados simulados');
        return generateMockData('dashboard') as DashboardData;
      }
      
      try {
        const response = await supabaseAPI.get<DashboardData>('/api/dashboard');
        if (response.data) {
          return response.data;
        }
      } catch (err) {
        console.error('Erro ao buscar dados do dashboard da API:', err);
      }
      
      return generateMockData('dashboard') as DashboardData;
    } catch (error) {
      console.error('Erro ao buscar dados do dashboard, usando dados simulados:', error);
      return generateMockData('dashboard') as DashboardData;
    }
  },
  
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
    get: async (type: ApiConfigType): Promise<ApiConfig | EmployeeApiConfig | AbsenteeismApiConfig | CompanyApiConfig | null> => {
      try {
        console.log(`Fetching ${type} API config...`);
        
        if (localStorageService.isPreviewEnvironment()) {
          console.log(`Preview environment detected, using localStorage for ${type} config`);
          const localConfig = localStorageService.getConfig<ApiConfig>(type as string);
          
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
        
        // Get from Supabase edge function
        console.log(`Fetching ${type} config from Supabase...`);
        
        // First, try to find config in api_credentials (new format)
        const { data: credentials, error: credentialsError } = await supabase
          .from('api_credentials')
          .select('*')
          .eq('type', type)
          .maybeSingle();
        
        if (credentialsError) {
          console.error(`Error fetching ${type} credentials:`, credentialsError);
        }
        
        if (credentials) {
          console.log(`Found ${type} credentials:`, credentials);
          
          // Convert from Supabase schema to our API schema
          const config: ApiConfig = {
            type: credentials.type as ApiConfigType,
            empresa: credentials.empresa,
            codigo: credentials.codigo,
            chave: credentials.chave,
            tipoSaida: 'json',
            isConfigured: true
          };
          
          // Add type-specific fields
          if (type === 'employee') {
            (config as EmployeeApiConfig).ativo = credentials.ativo || 'Sim';
            (config as EmployeeApiConfig).inativo = credentials.inativo || '';
            (config as EmployeeApiConfig).afastado = credentials.afastado || '';
            (config as EmployeeApiConfig).pendente = credentials.pendente || '';
            (config as EmployeeApiConfig).ferias = credentials.ferias || '';
          } else if (type === 'absenteeism') {
            (config as AbsenteeismApiConfig).empresaTrabalho = credentials.empresatrabalho || '';
            (config as AbsenteeismApiConfig).dataInicio = credentials.datainicio || '';
            (config as AbsenteeismApiConfig).dataFim = credentials.datafim || '';
          }
          
          return config;
        }
        
        // If not found in api_credentials, try legacy format in api_configs
        const { data: apiConfigs, error } = await supabase
          .from('api_configs')
          .select('*')
          .eq('type', type)
          .order('updated_at', { ascending: false })
          .limit(1);
        
        if (error) {
          console.error(`Error fetching ${type} API config:`, error);
          throw error;
        }
        
        if (!apiConfigs || apiConfigs.length === 0) {
          console.log(`No ${type} config found`);
          return {
            type,
            empresa: '',
            codigo: '',
            chave: '',
            tipoSaida: 'json',
            isConfigured: false
          };
        }
        
        const config = apiConfigs[0];
        console.log(`Found ${type} config:`, config);
        
        // Map to the expected format
        const result: ApiConfig = {
          type: config.type as ApiConfigType,
          empresa: config.empresa,
          codigo: config.codigo,
          chave: config.chave,
          tipoSaida: config.tiposaida || 'json',
          isConfigured: true
        };
        
        // Add type-specific fields
        if (type === 'employee') {
          (result as EmployeeApiConfig).ativo = config.ativo || 'Sim';
          (result as EmployeeApiConfig).inativo = config.inativo || '';
          (result as EmployeeApiConfig).afastado = config.afastado || '';
          (result as EmployeeApiConfig).pendente = config.pendente || '';
          (result as EmployeeApiConfig).ferias = config.ferias || '';
        } else if (type === 'absenteeism') {
          (result as AbsenteeismApiConfig).empresaTrabalho = config.empresatrabalho || '';
          (result as AbsenteeismApiConfig).dataInicio = config.datainicio || '';
          (result as AbsenteeismApiConfig).dataFim = config.datafim || '';
        }
        
        return result;
      } catch (error) {
        console.error(`Error in getApiConfig(${type}):`, error);
        throw error;
      }
    },
    
    save: async (config: ApiConfig | EmployeeApiConfig | AbsenteeismApiConfig | CompanyApiConfig): Promise<ApiConfig | null> => {
      try {
        if (localStorageService.isPreviewEnvironment()) {
          console.log(`Preview environment detected, saving ${config.type} config to localStorage`);
          const success = localStorageService.saveConfig(config.type as string, config);
          
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
        
        // Try to save directly to Supabase first
        try {
          // Prepare credentials object based on config type
          let credentials: any = {
            type: config.type,
            empresa: config.empresa,
            codigo: config.codigo,
            chave: config.chave
          };
          
          // Add type-specific fields
          if (config.type === 'employee') {
            const empConfig = config as EmployeeApiConfig;
            credentials.ativo = empConfig.ativo || 'Sim';
            credentials.inativo = empConfig.inativo || '';
            credentials.afastado = empConfig.afastado || '';
            credentials.pendente = empConfig.pendente || '';
            credentials.ferias = empConfig.ferias || '';
          } else if (config.type === 'absenteeism') {
            const absConfig = config as AbsenteeismApiConfig;
            credentials.empresatrabalho = absConfig.empresaTrabalho || '';
            credentials.datainicio = absConfig.dataInicio || '';
            credentials.datafim = absConfig.dataFim || '';
          }
          
          // Check if record already exists
          const { data: existingRecord } = await supabase
            .from('api_credentials')
            .select('id')
            .eq('type', config.type)
            .maybeSingle();
            
          if (existingRecord) {
            // Update existing record
            const { data, error } = await supabase
              .from('api_credentials')
              .update(credentials)
              .eq('id', existingRecord.id)
              .select()
              .single();
              
            if (error) throw error;
            console.log(`Updated ${config.type} credentials in Supabase`, data);
            
            // Convert and return
            return {
              ...config,
              isConfigured: true
            };
          } else {
            // Insert new record
            const { data, error } = await supabase
              .from('api_credentials')
              .insert({
                ...credentials,
                user_id: session.user.id
              })
              .select()
              .single();
              
            if (error) throw error;
            console.log(`Inserted new ${config.type} credentials in Supabase`, data);
            
            // Convert and return
            return {
              ...config,
              isConfigured: true
            };
          }
        } catch (supabaseError) {
          console.error(`Error saving ${config.type} config directly to Supabase:`, supabaseError);
          // Fall through to try function API
        }
        
        // If direct Supabase save fails, try the function API
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
    
    test: async (type: ApiConfigType): Promise<{success: boolean, message: string}> => {
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
  sync: {
    companies: async (): Promise<{success: boolean, message: string, data?: any}> => {
      try {
        // Get the company API config
        const config = await apiService.getApiConfig('company');
        
        if (!config) {
          return {
            success: false,
            message: 'Configuração da API de empresas não encontrada'
          };
        }
        
        const params = {
          empresa: config.empresa,
          codigo: config.codigo,
          chave: config.chave,
          tipoSaida: 'json'
        };
        
        // Call the sync edge function
        const { data, error } = await supabase.functions.invoke('sync-soc-data', {
          body: {
            type: 'company',
            params
          }
        });
        
        if (error) {
          console.error('Error syncing companies:', error);
          return {
            success: false,
            message: 'Falha na sincronização de empresas'
          };
        }
        
        return data;
      } catch (error) {
        console.error('Error in company sync:', error);
        return {
          success: false,
          message: error instanceof Error ? error.message : 'Erro desconhecido'
        };
      }
    },
    
    employees: async (): Promise<{success: boolean, message: string, data?: any}> => {
      try {
        // Get the employee API config
        const config = await apiService.getApiConfig('employee') as EmployeeApiConfig;
        
        if (!config) {
          return {
            success: false,
            message: 'Configuração da API de funcionários não encontrada'
          };
        }
        
        const params = {
          empresa: config.empresa,
          codigo: config.codigo,
          chave: config.chave,
          tipoSaida: 'json',
          ativo: config.ativo || 'Sim',
          inativo: config.inativo || '',
          afastado: config.afastado || '',
          pendente: config.pendente || '',
          ferias: config.ferias || ''
        };
        
        // Call the sync edge function
        const { data, error } = await supabase.functions.invoke('sync-soc-data', {
          body: {
            type: 'employee',
            params
          }
        });
        
        if (error) {
          console.error('Error syncing employees:', error);
          return {
            success: false,
            message: 'Falha na sincronização de funcionários'
          };
        }
        
        return data;
      } catch (error) {
        console.error('Error in employee sync:', error);
        return {
          success: false,
          message: error instanceof Error ? error.message : 'Erro desconhecido'
        };
      }
    },
    
    absenteeism: async (): Promise<{success: boolean, message: string, data?: any}> => {
      try {
        // Get the absenteeism API config
        const config = await apiService.getApiConfig('absenteeism') as AbsenteeismApiConfig;
        
        if (!config) {
          return {
            success: false,
            message: 'Configuração da API de absenteísmo não encontrada'
          };
        }
        
        // If dates are not set, use a 30-day window ending today
        let dataInicio = config.dataInicio;
        let dataFim = config.dataFim;
        
        if (!dataInicio || !dataFim) {
          const today = new Date();
          const twoMonthsAgo = new Date();
          twoMonthsAgo.setMonth(today.getMonth() - 2);
          
          dataInicio = twoMonthsAgo.toISOString().split('T')[0];
          dataFim = today.toISOString().split('T')[0];
        }
        
        const params = {
          empresa: config.empresa,
          codigo: config.codigo,
          chave: config.chave,
          tipoSaida: 'json',
          empresaTrabalho: config.empresaTrabalho || '',
          dataInicio,
          dataFim
        };
        
        // Call the sync edge function
        const { data, error } = await supabase.functions.invoke('sync-soc-data', {
          body: {
            type: 'absenteeism',
            params
          }
        });
        
        if (error) {
          console.error('Error syncing absenteeism:', error);
          return {
            success: false,
            message: 'Falha na sincronização de absenteísmo'
          };
        }
        
        return data;
      } catch (error) {
        console.error('Error in absenteeism sync:', error);
        return {
          success: false,
          message: error instanceof Error ? error.message : 'Erro desconhecido'
        };
      }
    },
    
    getLogs: async (): Promise<{id: number, type: string, status: string, message: string, created_at: string, completed_at: string}[]> => {
      try {
        const { data, error } = await supabase
          .from('sync_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20);
          
        if (error) {
          console.error('Error fetching sync logs:', error);
          return [];
        }
        
        return data || [];
      } catch (error) {
        console.error('Error in getLogs:', error);
        return [];
      }
    }
  },
  
  getApiConfig: async (type: ApiConfigType): Promise<ApiConfig | EmployeeApiConfig | AbsenteeismApiConfig | CompanyApiConfig | null> => {
    return apiService.apiConfig.get(type);
  },
  
  saveApiConfig: async (config: ApiConfig | EmployeeApiConfig | AbsenteeismApiConfig | CompanyApiConfig): Promise<ApiConfig | null> => {
    return apiService.apiConfig.save(config);
  },
  
  testApiConnection: async (config: ApiConfig | EmployeeApiConfig | AbsenteeismApiConfig | CompanyApiConfig): Promise<{success: boolean, message: string}> => {
    return apiService.apiConfig.test(config.type);
  },
  
  getDashboardData: async (): Promise<DashboardData> => {
    try {
      const companyConfig = await apiService.apiConfig.get('company');
      const employeeConfig = await apiService.apiConfig.get('employee');
      const absenteeismConfig = await apiService.apiConfig.get('absenteeism');
      
      if (!companyConfig?.isConfigured || !employeeConfig?.isConfigured || !absenteeismConfig?.isConfigured) {
        console.warn('Um ou mais serviços de API não configurados, retornando dados simulados');
        return generateMockData('dashboard') as DashboardData;
      }
      
      try {
        const response = await supabaseAPI.get<DashboardData>('/api/dashboard');
        if (response.data) {
          return response.data;
        }
      } catch (err) {
        console.error('Erro ao buscar dados do dashboard da API:', err);
      }
      
      return generateMockData('dashboard') as DashboardData;
    } catch (error) {
      console.error('Erro ao buscar dados do dashboard, usando dados simulados:', error);
      return generateMockData('dashboard') as DashboardData;
    }
  }
};

function calculateDashboardData(data: any[]): DashboardData {
  try {
    // Basic metrics
    const totalAbsenceDays = data.reduce((sum, item) => sum + (item.days_absent || 0), 0);
    const uniqueEmployees = new Set(data.filter(item => item.employee_registration).map(item => item.employee_registration)).size;
    
    // Calculate average working hours per month (assuming 220 hours)
    const avgMonthlyHours = 220;
    const totalHoursAbsent = data.reduce((sum, item) => {
      const days = item.days_absent || 0;
      return sum + (days * 8); // assuming 8 hours per day
    }, 0);
    
    // Calculate absenteeism rate
    const absenteeismRate = (totalHoursAbsent / avgMonthlyHours) * 100;
    
    // Calculate financial impact (using minimum wage as a baseline)
    const minWage = 1412; // Brazilian minimum wage as of 2023 (R$)
    const hourlyRate = minWage / avgMonthlyHours;
    const costImpact = totalHoursAbsent * hourlyRate;
    
    // Analyze by sector
    const sectorCounts = data.reduce((acc, item) => {
      const sector = item.sector || 'Desconhecido';
      if (!acc[sector]) {
        acc[sector] = 0;
      }
      acc[sector] += item.days_absent || 0;
      return acc;
    }, {} as Record<string, number>);
    
    const bySector: SectorData[] = Object.entries(sectorCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
      
    // Calculate monthly trend
    const monthlyData = data.reduce((acc, item) => {
      if (!item.start_date) return acc;
      
      const date = new Date(item.start_date);
      const monthYear = `${date.getMonth() + 1}/${date.getFullYear()}`;
      
      if (!acc[monthYear]) {
        acc[monthYear] = {
          count: 0,
          days: 0,
          hours: 0
        };
      }
      
      acc[monthYear].count += 1;
      acc[monthYear].days += item.days_absent || 0;
      acc[monthYear].hours += (item.days_absent || 0) * 8;
      
      return acc;
    }, {} as Record<string, {count: number, days: number, hours: number}>);
    
    const monthlyTrend: MonthlyTrendData[] = Object.entries(monthlyData)
      .map(([month, data]) => ({
        month,
        count: data.count,
        hours: data.hours,
        value: data.days
      }))
      .sort((a, b) => {
        const [aMonth, aYear] = a.month.split('/').map(Number);
        const [bMonth, bYear] = b.month.split('/').map(Number);
        
        if (aYear !== bYear) return aYear - bYear;
        return aMonth - bMonth;
      });
    
    // Determine trend compared to previous period
    const trend = monthlyTrend.length >= 2 && 
                 monthlyTrend[monthlyTrend.length - 1].value > monthlyTrend[monthlyTrend.length - 2].value
                 ? 'up' : 'down';
    
    return {
      absenteeismRate,
      totalAbsenceDays,
      employeesAbsent: uniqueEmployees,
      costImpact: `R$ ${costImpact.toFixed(2)}`,
      trend,
      monthlyTrend,
      bySector
    };
  } catch (error) {
    console.error('Error calculating dashboard data:', error);
    return getMockDashboardData();
  }
}

function getMockDashboardData(): DashboardData {
  return {
    absenteeismRate: 3.42,
    totalAbsenceDays: 127,
    employeesAbsent: 42,
    costImpact: 'R$ 6.784,30',
    trend: 'up',
    monthlyTrend: [
      { month: '7/2023', count: 18, hours: 320, value: 40 },
      { month: '8/2023', count: 15, hours: 264, value: 33 },
      { month: '9/2023', count: 12, hours: 208, value: 26 },
      { month: '10/2023', count: 17, hours: 304, value: 38 },
      { month: '11/2023', count: 20, hours: 344, value: 43 },
      { month: '12/2023', count: 14, hours: 248, value: 31 }
    ],
    bySector: [
      { name: 'Produção', value: 45 },
      { name: 'Administrativo', value: 32 },
      { name: 'Logística', value: 27 },
      { name: 'Comercial', value: 15 },
      { name: 'TI', value: 8 }
    ]
  };
}

export default apiService;

