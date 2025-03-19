import axios from 'axios';

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

const apiService = {
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
        const response = await supabaseAPI.post('/sync-soc-api', {
          type: 'employee',
          params: {
            empresa: '423', // This should come from API config
            codigo: '25722', // This should come from API config
            chave: 'b4c740208036d64c467b', // This should come from API config
            tipoSaida: 'json',
            ativo: 'Sim',
            inativo: '',
            afastado: '',
            pendente: '',
            ferias: ''
          }
        });
        return response.data;
      } catch (error) {
        console.error('Error syncing employees:', error);
        throw error;
      }
    }
  },
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
        const response = await supabaseAPI.post('/sync-soc-api', {
          type: 'absenteeism',
          params: {
            empresa: '423', // This should come from API config
            codigo: '183868', // This should come from API config
            chave: '6dff7b9a8a635edaddf5', // This should come from API config
            tipoSaida: 'json',
            empresaTrabalho: '',
            dataInicio: '',
            dataFim: ''
          }
        });
        return response.data;
      } catch (error) {
        console.error('Error syncing absenteeism:', error);
        throw error;
      }
    }
  },
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
        const response = await supabaseAPI.post('/sync-soc-api', {
          type: 'company',
          params: {
            empresa: '423', // This should come from API config
            codigo: '26625', // This should come from API config
            chave: '7e9da216f3bfda8c024b', // This should come from API config
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
  
  sync: {
    employees: async () => {
      try {
        const response = await supabaseAPI.post('/queue-sync-processor/enqueue', {
          type: 'employee',
          params: {
            empresa: '423', // This should come from API config
            codigo: '25722', // This should come from API config
            chave: 'b4c740208036d64c467b', // This should come from API config
            tipoSaida: 'json',
            ativo: 'Sim',
            inativo: '',
            afastado: '',
            pendente: '',
            ferias: ''
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
        const response = await supabaseAPI.post('/queue-sync-processor/enqueue', {
          type: 'absenteeism',
          params: {
            empresa: '423', // This should come from API config
            codigo: '183868', // This should come from API config
            chave: '6dff7b9a8a635edaddf5', // This should come from API config
            tipoSaida: 'json',
            empresaTrabalho: '',
            dataInicio: '',
            dataFim: ''
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
        const response = await supabaseAPI.post('/queue-sync-processor/enqueue', {
          type: 'company',
          params: {
            empresa: '423', // This should come from API config
            codigo: '26625', // This should come from API config
            chave: '7e9da216f3bfda8c024b', // This should come from API config
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
