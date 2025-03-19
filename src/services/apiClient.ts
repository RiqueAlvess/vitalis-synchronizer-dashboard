
import axios from 'axios';
import { supabase } from '@/integrations/supabase/client';

export const supabaseAPI = axios.create({
  baseURL: import.meta.env.DEV 
    ? '/api'
    : 'https://rdrvashvfvjdtuuuqjio.supabase.co/functions/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Add request interceptor to include authentication headers
supabaseAPI.interceptors.request.use(
  async config => {
    try {
      // Get the current session from Supabase
      const { data: { session } } = await supabase.auth.getSession();
      
      // Add Authorization header if session exists
      if (session) {
        config.headers['Authorization'] = `Bearer ${session.access_token}`;
      }
      
      return config;
    } catch (error) {
      console.error('Error setting auth header:', error);
      return config;
    }
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
      
      // Try to refresh the session
      try {
        const { data, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError || !data.session) {
          console.error('Session refresh failed:', refreshError);
          // Redirect to login page
          window.location.href = '/login';
          return Promise.reject(new Error('Authentication session expired. Please log in again.'));
        }
        
        // Retry the original request with the new token
        if (error.config) {
          error.config.headers['Authorization'] = `Bearer ${data.session.access_token}`;
          return axios(error.config);
        }
      } catch (refreshError) {
        console.error('Error refreshing session:', refreshError);
        window.location.href = '/login';
        return Promise.reject(new Error('Authentication failed. Please log in again.'));
      }
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
