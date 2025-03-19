
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
