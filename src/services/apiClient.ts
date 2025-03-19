
import axios from 'axios';
import { supabase } from '@/integrations/supabase/client';

// Create a base axios instance for Supabase Functions
export const supabaseAPI = axios.create({
  baseURL: import.meta.env.DEV 
    ? '/api'
    : 'https://rdrvashvfvjdtuuuqjio.supabase.co/functions/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000
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
      }
      
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
    
    // If the error is a 401 (Unauthorized) and we haven't tried to refresh yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        // Refresh the session only once if multiple requests fail simultaneously
        if (!isRefreshing) {
          isRefreshing = true;
          refreshPromise = supabase.auth.refreshSession();
        }
        
        const refreshResult = refreshPromise ? await refreshPromise : await supabase.auth.refreshSession();
        refreshPromise = null;
        isRefreshing = false;
        
        if (refreshResult.error) {
          // If refresh fails, sign out and reject
          await supabase.auth.signOut();
          return Promise.reject(new Error('Session expired. Please log in again.'));
        }
        
        // Update the request with the new token and retry
        const newToken = refreshResult.data.session?.access_token;
        if (newToken) {
          originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
          return axios(originalRequest);
        }
      } catch (refreshError) {
        console.error('Error refreshing token:', refreshError);
        // Clear refresh state
        refreshPromise = null;
        isRefreshing = false;
        // Sign out on failure
        await supabase.auth.signOut();
        return Promise.reject(new Error('Authentication failed. Please log in again.'));
      }
    }
    
    // Handle network errors with better messages
    if (error.message === 'Network Error') {
      error.message = navigator.onLine 
        ? 'Erro de conexão com o servidor. Tente novamente mais tarde.' 
        : 'Sem conexão com a internet. Verifique sua conexão e tente novamente.';
    }
    
    return Promise.reject(error);
  }
);

// Simple retry mechanism for API calls
export const retryRequest = async (fn: () => Promise<any>, maxRetries = 2, delay = 1000) => {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      console.log(`API request failed (attempt ${attempt + 1}/${maxRetries + 1}):`, error);
      lastError = error;
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 1.5; // Increase delay with each retry
      }
    }
  }
  
  throw lastError;
};

export default supabaseAPI;
