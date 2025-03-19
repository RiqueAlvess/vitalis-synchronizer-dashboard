
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
  withCredentials: false,
});

supabaseAPI.interceptors.request.use(async (config) => {
  try {
    // Get the current session
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
      // Set the Authorization header with the access token
      config.headers.Authorization = `Bearer ${session.access_token}`;
      console.log('Added auth token to request:', config.url);
    } else {
      console.warn('No active session found when making API request to:', config.url);
      
      // Try to refresh the session
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError) {
        console.error('Failed to refresh session:', refreshError.message);
        // Could redirect to login page here or throw an error
        throw new Error('Authentication failed: ' + refreshError.message);
      }
      
      if (refreshData.session) {
        config.headers.Authorization = `Bearer ${refreshData.session.access_token}`;
        console.log('Added refreshed auth token to request:', config.url);
      } else {
        console.error('No valid session after refresh attempt');
        throw new Error('No valid authentication session');
      }
    }
  } catch (error) {
    console.error('Error adding auth token to request:', error);
    // Don't throw here, let the request proceed and fail naturally
    // so the response interceptor can handle it
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
  async error => {
    console.error('API request failed:', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      error: error.message
    });
    
    // Handle authentication errors specifically
    if (error.response?.status === 401) {
      console.error('Authentication error (401 Unauthorized)');
      
      // Try to refresh the session
      try {
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError) {
          console.error('Failed to refresh session on 401:', refreshError.message);
          // Don't automatically redirect - let the AuthContext handle redirects
          return Promise.reject(new Error('Authentication failed. Please log in again.'));
        }
        
        if (refreshData.session) {
          // If we successfully refreshed, retry the original request
          error.config.headers.Authorization = `Bearer ${refreshData.session.access_token}`;
          console.log('Retrying request with new token after 401:', error.config.url);
          return axios(error.config);
        }
      } catch (refreshError) {
        console.error('Error during session refresh after 401:', refreshError);
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
