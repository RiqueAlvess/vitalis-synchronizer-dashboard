
import axios from 'axios';
import { supabase } from '@/integrations/supabase/client';

// Enable debug mode for development environments
const DEBUG = import.meta.env.DEV;

// Create a base axios instance for Supabase Functions with increased timeout
export const supabaseAPI = axios.create({
  baseURL: import.meta.env.DEV 
    ? '/api'
    : 'https://rdrvashvfvjdtuuuqjio.supabase.co/functions/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  // Significantly increased timeout for large sync operations - 20 minutes
  timeout: 1200000 // 20 minutes for large data processing
});

// Track if we're currently refreshing the token
let isRefreshing = false;
let refreshPromise: Promise<any> | null = null;

// Add interceptor to handle authentication
supabaseAPI.interceptors.request.use(
  async (config) => {
    try {
      // Get the current session
      const { data: { session } } = await supabase.auth.getSession();
      
      // Add the token to the request if available
      if (session?.access_token) {
        config.headers['Authorization'] = `Bearer ${session.access_token}`;
        if (DEBUG) console.log('Setting Authorization header with token');
      } else {
        console.warn('No session token available for API request');
        // Force token refresh and try again
        try {
          const { data } = await supabase.auth.refreshSession();
          if (data.session?.access_token) {
            config.headers['Authorization'] = `Bearer ${data.session.access_token}`;
            if (DEBUG) console.log('Setting Authorization header with refreshed token');
          }
        } catch (refreshError) {
          console.error('Failed to refresh token:', refreshError);
        }
      }
      
      // Add a custom header with the request time for debugging
      config.headers['x-request-time'] = new Date().toISOString();
      
      return config;
    } catch (error) {
      console.error('Error in request interceptor:', error);
      return config;
    }
  },
  (error) => Promise.reject(error)
);

// Add interceptor to handle token refresh on 401 errors
supabaseAPI.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Log detailed request information for debugging
    if (error.response) {
      console.error(`API Error (${error.response.status}):`, {
        url: originalRequest.url,
        method: originalRequest.method,
        responseTime: new Date().toISOString(),
        error: error.response.data
      });
    } else {
      console.error('API Error (No Response):', {
        url: originalRequest?.url,
        method: originalRequest?.method,
        error: error.message
      });
    }
    
    // If the error is a 401 (Unauthorized) and we haven't tried to refresh yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        // Refresh the session only once if multiple requests fail simultaneously
        if (!isRefreshing) {
          isRefreshing = true;
          console.log('Token expired, refreshing session...');
          refreshPromise = supabase.auth.refreshSession();
        }
        
        const refreshResult = refreshPromise ? await refreshPromise : await supabase.auth.refreshSession();
        refreshPromise = null;
        isRefreshing = false;
        
        if (refreshResult.error) {
          console.error('Session refresh failed:', refreshResult.error);
          // If refresh fails, sign out and reject
          await supabase.auth.signOut();
          return Promise.reject(new Error('Sessão expirada. Por favor, faça login novamente.'));
        }
        
        // Update the request with the new token and retry
        const newToken = refreshResult.data.session?.access_token;
        if (newToken) {
          console.log('Token refreshed successfully, retrying request');
          originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
          
          // Add a small delay to ensure token propagation
          await new Promise(resolve => setTimeout(resolve, 500));
          
          return axios(originalRequest);
        } else {
          console.error('No new token received after refresh');
        }
      } catch (refreshError) {
        console.error('Error refreshing token:', refreshError);
        // Clear refresh state
        refreshPromise = null;
        isRefreshing = false;
        // Sign out on failure
        await supabase.auth.signOut();
        return Promise.reject(new Error('Autenticação falhou. Por favor, faça login novamente.'));
      }
    }
    
    // Handle network errors with better messages
    if (error.message === 'Network Error') {
      error.message = navigator.onLine 
        ? 'Erro de conexão com o servidor. Tente novamente mais tarde.' 
        : 'Sem conexão com a internet. Verifique sua conexão e tente novamente.';
    }
    
    // Handle timeout errors
    if (error.code === 'ECONNABORTED') {
      error.message = 'A solicitação demorou muito para ser concluída. Tente novamente mais tarde.';
    }
    
    return Promise.reject(error);
  }
);

// Enhanced retry mechanism for API calls with exponential backoff
export const retryRequest = async (fn: () => Promise<any>, maxRetries = 5, initialDelay = 1000) => {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      console.log(`API request failed (attempt ${attempt + 1}/${maxRetries + 1}):`, error);
      lastError = error;
      
      if (attempt < maxRetries) {
        // Calculate delay with exponential backoff and jitter
        const delay = initialDelay * Math.pow(2, attempt) + Math.random() * 1000;
        console.log(`Retrying in ${Math.round(delay)}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
};

export default supabaseAPI;
