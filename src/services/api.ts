import axios from 'axios';
import { supabase } from '@/integrations/supabase/client';
import { 
  DashboardData, 
  MonthlyTrendData, 
  SectorData, 
  ApiStorageProps,
  MockEmployeeData
} from '@/types/dashboard';

const retryRequest = async (fn: () => Promise<any>, maxRetries = 3, delay = 1000) => {
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

export type ApiConfigType = 'employee' | 'absenteeism';

export interface ApiConfig extends ApiStorageProps {
  type: ApiConfigType;
  empresa: string;
  codigo: string;
  chave: string;
  tipoSaida: string;
  isConfigured?: boolean;
  savedLocally?: boolean;
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

export interface User {
  id: number;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

const hoursToDecimal = (hoursString: string): number => {
  if (!hoursString) return 0;
  
  const [hours, minutes] = hoursString.split(':').map(part => {
    const num = parseInt(part, 10);
    return isNaN(num) ? 0 : num;
  });
  
  return hours + (minutes / 60);
};

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
      const employeeConfig = await apiService.apiConfig.get('employee');
      const absenteeismConfig = await apiService.apiConfig.get('absenteeism');
      
      if (!employeeConfig?.isConfigured || !absenteeismConfig?.isConfigured) {
        console.warn('Um ou mais serviços de API não configurados');
        return {
          absenteeismRate: 0,
          totalAbsenceDays: 0,
          employeesAbsent: 0,
          costImpact: 'R$ 0,00',
          trend: 'neutral',
          monthlyTrend: [],
          bySector: []
        } as DashboardData;
      }
      
      try {
        const response = await supabaseAPI.get<DashboardData>('/api/dashboard');
        if (response.data) {
          return response.data;
        }
      } catch (err) {
        console.error('Erro ao buscar dados do dashboard da API:', err);
      }
      
      return {
        absenteeismRate: 0,
        totalAbsenceDays: 0,
        employeesAbsent: 0,
        costImpact: 'R$ 0,00',
        trend: 'neutral',
        monthlyTrend: [],
        bySector: []
      } as DashboardData;
    } catch (error) {
      console.error('Erro ao buscar dados do dashboard:', error);
      return {
        absenteeismRate: 0,
        totalAbsenceDays: 0,
        employeesAbsent: 0,
        costImpact: 'R$ 0,00',
        trend: 'neutral',
        monthlyTrend: [],
        bySector: []
      } as DashboardData;
    }
  },
  
  employees: {
    getAll: async (): Promise<MockEmployeeData[]> => {
      try {
        const config = await apiService.apiConfig.get('employee');
        
        if (!config || !config.isConfigured) {
          console.warn('Employee API not configured');
          return [];
        }
        
        const response = await supabaseAPI.get<MockEmployeeData[]>('/api/employees');
        
        if (Array.isArray(response.data) && response.data.length > 0) {
          return response.data;
        } else {
          console.warn('Empty response from API');
          return [];
        }
      } catch (error) {
        console.error('Error fetching employees:', error);
        return [];
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
    update: async (id: number, data: Partial<MockEmployeeData>): Promise<MockEmployeeData | null> => {
      try {
        const response = await supabaseAPI.put<MockEmployeeData>(`/api/employees/${id}`, data);
        return response.data;
      } catch (error) {
        console.error('Error updating employee:', error);
        return null;
      }
    },
    sync: async (): Promise<{success: boolean, message: string, data?: any}> => {
      try {
        const config = await apiService.apiConfig.get('employee');
        
        if (!config || !config.isConfigured) {
          console.warn('Employee API not configured, sync not attempted');
          return {
            success: false, 
            message: 'Configuração da API de funcionários não encontrada'
          };
        }
        
        const params = {
          type: 'employee',
          empresa: config.empresa,
          codigo: config.codigo,
          chave: config.chave,
          tipoSaida: 'json',
          ativo: (config as EmployeeApiConfig).ativo || 'Sim',
          inativo: (config as EmployeeApiConfig).inativo || '',
          afastado: (config as EmployeeApiConfig).afastado || '',
          pendente: (config as EmployeeApiConfig).pendente || '',
          ferias: (config as EmployeeApiConfig).ferias || ''
        };
        
        console.log('Initiating employee sync with params:', params);
        
        const response = await supabaseAPI.post('/sync-soc-data', {
          type: 'employee',
          params
        });
        
        return {
          success: response.data.success,
          message: response.data.message,
          data: response.data.data
        };
      } catch (error) {
        console.error('Error syncing employees:', error);
        return {
          success: false,
          message: error.message || 'Erro desconhecido durante a sincronização'
        };
      }
    }
  },
  
  absenteeism: {
    sync: async (): Promise<{success: boolean, message: string, data?: any}> => {
      try {
        const config = await apiService.apiConfig.get('absenteeism');
        
        if (!config || !config.isConfigured) {
          console.warn('Absenteeism API not configured, sync not attempted');
          return {
            success: false, 
            message: 'Configuração da API de absenteísmo não encontrada'
          };
        }
        
        const absConfig = config as AbsenteeismApiConfig;
        
        const params = {
          type: 'absenteeism',
          empresa: config.empresa,
          codigo: config.codigo,
          chave: config.chave,
          tipoSaida: 'json',
          empresaTrabalho: absConfig.empresaTrabalho || '',
          dataInicio: absConfig.dataInicio || '',
          dataFim: absConfig.dataFim || ''
        };
        
        console.log('Initiating absenteeism sync with params:', params);
        
        const response = await supabaseAPI.post('/sync-soc-data', {
          type: 'absenteeism',
          params
        });
        
        return {
          success: response.data.success,
          message: response.data.message,
          data: response.data.data
        };
      } catch (error) {
        console.error('Error syncing absenteeism data:', error);
        return {
          success: false,
          message: error.message || 'Erro desconhecido durante a sincronização'
        };
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
    get: async (type: ApiConfigType): Promise<ApiConfig | EmployeeApiConfig | AbsenteeismApiConfig | null> => {
      try {
        console.log(`Fetching ${type} API config...`);
        
        if (localStorageService.isPreviewEnvironment()) {
          console.log(`Preview environment detected, using localStorage for ${type} config`);
          const localConfig = localStorageService.getConfig<ApiConfig>(type);
          
          if (localConfig) {
            console.log(`Found local ${type} config:`, localConfig);
            return {
              ...localConfig,
              isConfigured: !!(localConfig.empresa && localConfig.codigo && localConfig.chave),
              savedLocally: true,
              savedAt: new Date().toISOString()
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
    
    save: async (config: ApiConfig | EmployeeApiConfig | AbsenteeismApiConfig): Promise<ApiConfig | null> => {
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
  
  // Sync service functions
  sync: {
    employees: async (): Promise<{success: boolean, message: string, data?: any}> => {
      try {
        return await apiService.employees.sync();
      } catch (error) {
        console.error('Error in sync.employees:', error);
        return {
          success: false,
          message: error.message || 'Erro desconhecido durante a sincronização de funcionários'
        };
      }
    },
    
    absenteeism: async (): Promise<{success: boolean, message: string, data?: any}> => {
      try {
        return await apiService.absenteeism.sync();
      } catch (error) {
        console.error('Error in sync.absenteeism:', error);
        return {
          success: false,
          message: error.message || 'Erro desconhecido durante a sincronização de absenteísmo'
        };
      }
    },
    
    status: async () => {
      try {
        const response = await supabaseAPI.get('/sync-status');
        return response.data;
      } catch (error) {
        console.error('Error fetching sync status:', error);
        return null;
      }
    }
  },
  
  // Helper function to test API connections
  testApiConnection: async (config: ApiConfig): Promise<{success: boolean; message: string}> => {
    try {
      if (!config) {
        throw new Error('API configuration not found');
      }
      
      console.log(`Testing API connection for ${config.type}:`, {
        empresa: config.empresa,
        codigo: '****',
        chave: '****',
        type: config.type
      });
      
      let params;
      
      if (config.type === 'employee') {
        const empConfig = config as EmployeeApiConfig;
        params = {
          type: 'employee',
          empresa: config.empresa,
          codigo: config.codigo,
          chave: config.chave,
          tipoSaida: 'json',
          ativo: empConfig.ativo || 'Sim',
          inativo: empConfig.inativo || '',
          afastado: empConfig.afastado || '',
          pendente: empConfig.pendente || '',
          ferias: empConfig.ferias || ''
        };
      } else if (config.type === 'absenteeism') {
        const absConfig = config as AbsenteeismApiConfig;
        params = {
          type: 'absenteeism',
          empresa: config.empresa,
          codigo: config.codigo,
          chave: config.chave,
          tipoSaida: 'json',
          empresaTrabalho: absConfig.empresaTrabalho || '',
          dataInicio: absConfig.dataInicio || '',
          dataFim: absConfig.dataFim || ''
        };
      } else {
        throw new Error('Invalid API type');
      }
      
      // Use the test-connection endpoint
      const response = await supabaseAPI.post('/test-connection', params);
      
      if (response.data.success) {
        return {
          success: true,
          message: `Conexão com a API de ${config.type === 'employee' ? 'Funcionários' : 'Absenteísmo'} estabelecida com sucesso!`
        };
      } else {
        return {
          success: false,
          message: response.data.message || `Falha ao conectar com a API de ${config.type === 'employee' ? 'Funcionários' : 'Absenteísmo'}.`
        };
      }
    } catch (error) {
      console.error('Error testing API connection:', error);
      return {
        success: false,
        message: `Falha ao conectar com a API: ${error.message || 'Erro desconhecido'}`
      };
    }
  },
  
  getApiConfig: async (type: ApiConfigType): Promise<ApiConfig | EmployeeApiConfig | AbsenteeismApiConfig | null> => {
    return await apiService.apiConfig.get(type);
  },
  
  saveApiConfig: async (config: ApiConfig | EmployeeApiConfig | AbsenteeismApiConfig): Promise<ApiConfig | null> => {
    return await apiService.apiConfig.save(config);
  }
};

export default apiService;
