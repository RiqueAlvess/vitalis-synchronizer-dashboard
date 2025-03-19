
import axios, { AxiosRequestConfig } from 'axios';
import { supabase } from '@/integrations/supabase/client';

export const supabaseAPI = axios.create({
  baseURL: import.meta.env.DEV 
    ? '/api'
    : 'https://rdrvashvfvjdtuuuqjio.supabase.co/functions/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
  withCredentials: true,
});

// Lock para evitar múltiplas atualizações de token simultaneamente
let refreshPromise: Promise<any> | null = null;

// Função para obter token atualizado com lock
const getUpdatedToken = async () => {
  if (!refreshPromise) {
    refreshPromise = supabase.auth.refreshSession()
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

// Verificar se o token está expirado
const isTokenExpired = (token: string | undefined): boolean => {
  if (!token) return true;
  
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    // Considerando expirado 5 minutos antes para garantir renovação tranquila
    return Date.now() >= (payload.exp * 1000) - 300000;
  } catch (e) {
    console.error('Error checking token expiry:', e);
    return true;
  }
};

// Interceptor para adicionar cabeçalhos de autenticação
supabaseAPI.interceptors.request.use(
  async (config) => {
    try {
      // Obter sessão atual
      const { data: { session } } = await supabase.auth.getSession();
      
      // Se não há sessão ou o token expirou, tentar atualizar
      if (!session || isTokenExpired(session.access_token)) {
        console.log('Token expirado ou ausente, atualizando...');
        const { data, error } = await getUpdatedToken();
        
        if (data.session) {
          config.headers['Authorization'] = `Bearer ${data.session.access_token}`;
        } else {
          console.error('Falha na atualização da sessão:', error);
          // Se falhar, limpar sessão e requerer novo login
          await supabase.auth.signOut();
          throw new Error('Sessão de autenticação expirada');
        }
      } else {
        // Usar token existente válido
        config.headers['Authorization'] = `Bearer ${session.access_token}`;
      }
      
      return config;
    } catch (error) {
      console.error('Erro no interceptor de requisição:', error);
      return Promise.reject(error);
    }
  },
  (error) => Promise.reject(error)
);

// Interceptor para tratar erros de resposta
supabaseAPI.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Erro 401 (não autorizado) - token expirado
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const { data, error: refreshError } = await getUpdatedToken();
        
        if (refreshError || !data.session) {
          // Limpar sessão e redirecionar para login
          await supabase.auth.signOut();
          window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
          return Promise.reject(new Error('Sessão expirada. Faça login novamente.'));
        }
        
        // Retentar requisição original com novo token
        originalRequest.headers['Authorization'] = `Bearer ${data.session.access_token}`;
        return axios(originalRequest);
      } catch (refreshError) {
        console.error('Erro ao atualizar token:', refreshError);
        window.location.href = '/login';
        return Promise.reject(new Error('Autenticação falhou. Faça login novamente.'));
      }
    }
    
    // Melhorar tratamento de erros de rede com retry automático
    if (error.message === 'Network Error' && !originalRequest._networkRetry) {
      originalRequest._networkRetry = true;
      
      // Verificar se está online antes de retentar
      if (navigator.onLine) {
        console.log('Retentando requisição após erro de rede');
        return new Promise(resolve => {
          setTimeout(() => resolve(axios(originalRequest)), 1000);
        });
      }
      
      error.message = navigator.onLine 
        ? 'Erro de conexão com o servidor. Tente novamente mais tarde.' 
        : 'Sem conexão com a internet. Verifique sua conexão e tente novamente.';
    }
    
    return Promise.reject(error);
  }
);

// Função de retry com backoff exponencial
export const retryRequest = async <T>(
  fn: () => Promise<T>, 
  maxRetries: number = 3, 
  initialDelay: number = 1000
): Promise<T> => {
  let delay = initialDelay;
  let lastError: any;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      console.log(`Tentativa ${attempt + 1} falhou:`, error);
      lastError = error;
      
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 1.5; // Backoff exponencial
      }
    }
  }
  
  throw lastError;
};

// Função utilitária para executar API calls com retry automático
export const apiCall = async <T>(
  config: AxiosRequestConfig, 
  retries: number = 2
): Promise<T> => {
  return retryRequest<T>(
    () => supabaseAPI(config).then(res => res.data),
    retries
  );
};
