
import axios from 'axios';
import { supabase } from '@/integrations/supabase/client';

export const supabaseAPI = axios.create({
  baseURL: import.meta.env.DEV 
    ? '/api'
    : 'https://rdrvashvfvjdtuuuqjio.supabase.co/functions/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // Increased timeout
  withCredentials: true, // Enable sending cookies with cross-origin requests
});

// Function to check if token is expired
function isTokenExpired(token) {
  if (!token) return true;
  
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const expiryTime = payload.exp * 1000;
    return Date.now() >= expiryTime - 120000; // Consider token expired 2 minutes before actual expiry
  } catch (e) {
    console.error('Error checking token expiry:', e);
    return true;
  }
}

// Add request interceptor to include authentication headers
supabaseAPI.interceptors.request.use(
  async config => {
    try {
      // Get current session
      const { data: { session } } = await supabase.auth.getSession();
      
      // If no session or token expired, try to refresh
      if (!session || isTokenExpired(session.access_token)) {
        console.log('Token expired or missing, refreshing...');
        const { data, error } = await supabase.auth.refreshSession();
        
        if (data.session) {
          console.log('Session refreshed successfully');
          config.headers['Authorization'] = `Bearer ${data.session.access_token}`;
        } else {
          console.error('Session refresh failed:', error);
          
          // If unable to refresh, remove any stale session data
          await supabase.auth.signOut();
          
          throw new Error('Authentication session expired');
        }
      } else {
        // Use existing valid token
        config.headers['Authorization'] = `Bearer ${session.access_token}`;
      }
      
      return config;
    } catch (error) {
      console.error('Error in request interceptor:', error);
      return Promise.reject(error);
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
      message: error.message,
      data: error.response?.data
    });
    
    // Handle authentication errors (token expired)
    if (error.response?.status === 401 && !originalRequest._retry) {
      console.log('Received 401, attempting to refresh token...');
      originalRequest._retry = true;
      
      try {
        // Try to refresh the session
        const { data, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError || !data.session) {
          console.error('Session refresh failed during 401 handling:', refreshError);
          // Force sign out to clear any stale session data
          await supabase.auth.signOut();
          
          // Redirect to login page with current location
          const currentPath = window.location.pathname;
          window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
          return Promise.reject(new Error('Authentication session expired. Please log in again.'));
        }
        
        // Retry the original request with the new token
        originalRequest.headers['Authorization'] = `Bearer ${data.session.access_token}`;
        return axios(originalRequest);
      } catch (refreshError) {
        console.error('Error during token refresh:', refreshError);
        window.location.href = '/login';
        return Promise.reject(new Error('Authentication failed. Please log in again.'));
      }
    }
    
    // Handle CORS errors more explicitly
    if (error.message === 'Network Error') {
      console.error('CORS or Network error detected');
      const isOnline = navigator.onLine;
      
      if (isOnline && error.request) {
        console.warn('Possible CORS issue with request', {
          url: originalRequest?.url,
          withCredentials: originalRequest?.withCredentials
        });
        
        error.message = 'Erro de conexão com o servidor. Isso pode ser um problema de CORS.';
      } else {
        error.message = isOnline 
          ? 'Falha na conexão com o servidor. Tente novamente mais tarde.' 
          : 'Sem conexão com a internet.';
      }
    }
    
    // Handle HTML responses (indicates CORS or server issues)
    if (typeof error.response?.data === 'string' && 
        error.response.data.includes('<!DOCTYPE html>')) {
      console.error('Received HTML instead of JSON - possible auth or endpoint issue');
      error.isHtmlResponse = true;
      error.message = 'Authentication error. Please log in and try again.';
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
