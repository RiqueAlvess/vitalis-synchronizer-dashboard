
import axios from 'axios';
import { supabase } from '@/integrations/supabase/client';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

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
  },

  // API Configuration
  apiConfig: {
    get: async () => {
      try {
        const { data } = await api.get('/functions/v1/get-api-config');
        return data;
      } catch (error) {
        console.error('Error fetching API configuration:', error);
        throw error;
      }
    },

    save: async (config: any) => {
      try {
        const { data } = await api.post('/functions/v1/save-api-config', config);
        return data;
      } catch (error) {
        console.error('Error saving API configuration:', error);
        throw error;
      }
    },

    test: async (config: any) => {
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
    
    // Novo método para cancelar um processo de sincronização
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
};

export default apiService;
