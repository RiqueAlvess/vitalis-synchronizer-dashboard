
import axios from 'axios';
import { supabase } from '@/integrations/supabase/client';

export const supabaseAPI = axios.create({
  baseURL: import.meta.env.DEV 
    ? '/api'
    : 'https://rdrvashvfvjdtuuuqjio.supabase.co/functions/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 20000, // Increased timeout
  withCredentials: true, // Enable sending cookies with cross-origin requests
});

// Add request interceptor to include authentication headers
supabaseAPI.interceptors.request.use(
  async config => {
    try {
      // Get the current session from Supabase
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.access_token) {
        config.headers['Authorization'] = `Bearer ${session.access_token}`;
      } else {
        // Try to refresh session if no access token is available
        const { data } = await supabase.auth.refreshSession();
        if (data.session) {
          config.headers['Authorization'] = `Bearer ${data.session.access_token}`;
        } else {
          console.warn('No active session available for API request');
        }
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
    const originalRequest = error.config;
    
    // Log detailed error information
    console.error('API request failed:', {
      url: originalRequest?.url,
      method: originalRequest?.method,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      error: error.message
    });
    
    // Handle authentication errors (token expired)
    if (error.response?.status === 401 && !originalRequest._retry) {
      console.error('Authentication error (401 Unauthorized)');
      originalRequest._retry = true;
      
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
        originalRequest.headers['Authorization'] = `Bearer ${data.session.access_token}`;
        return axios(originalRequest);
      } catch (refreshError) {
        console.error('Error refreshing session:', refreshError);
        window.location.href = '/login';
        return Promise.reject(new Error('Authentication failed. Please log in again.'));
      }
    }
    
    // Handle HTML responses (indicates CORS or server issues)
    if (typeof error.response?.data === 'string' && 
        error.response.data.includes('<!DOCTYPE html>')) {
      console.error('Received HTML instead of JSON - possible auth or endpoint issue');
      error.isHtmlResponse = true;
      error.message = 'Authentication error. Please log in and try again.';
    }
    
    // Handle network errors with more details
    if (error.message === 'Network Error') {
      const isOnline = navigator.onLine;
      console.error('Network error details:', {
        navigator: isOnline ? 'Online' : 'Offline',
        url: originalRequest?.url,
        method: originalRequest?.method,
      });
      error.message = isOnline 
        ? 'Falha na conexão com o servidor. Tente novamente mais tarde.' 
        : 'Sem conexão com a internet.';
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
        delay *= 1.5; // Exponential backoff
      }
    }
  }
  throw lastError;
};
