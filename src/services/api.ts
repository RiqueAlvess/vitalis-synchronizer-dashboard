
import axios from 'axios';

// This is a mock API service for demo purposes
// In a real app, this would connect to your backend API

// Create axios instance
const api = axios.create({
  baseURL: 'https://api.example.com', // This is a placeholder URL
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor for authentication
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('vitalis_auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Mock function to simulate API calls
const mockApiCall = async (data: any, delay = 800) => {
  await new Promise(resolve => setTimeout(resolve, delay));
  return data;
};

// Mock data for API configurations
const mockApiConfigs = {
  company: {
    empresa: '423',
    codigo: '183868',
    chave: '6dff7b9a8a635edaddf5',
    tipoSaida: 'json',
    isConfigured: true
  },
  employee: {
    empresa: '423',
    codigo: '25722',
    chave: 'b4c740208036d64c467b',
    tipoSaida: 'json',
    ativo: 'Sim',
    inativo: '',
    afastado: '',
    pendente: '',
    ferias: '',
    isConfigured: true
  },
  absenteeism: {
    empresa: '423',
    codigo: '183868',
    chave: '6dff7b9a8a635edaddf5',
    tipoSaida: 'json',
    empresaTrabalho: '',
    dataInicio: '',
    dataFim: '',
    isConfigured: true
  }
};

// API service with mock implementations
export const apiService = {
  // Company endpoints
  companies: {
    list: async () => mockApiCall([
      { id: '1', name: 'Empresa ABC', employees: 120, syncStatus: 'synced', lastSync: '2023-06-15T14:30:00Z' },
      { id: '2', name: 'Distribuidora XYZ', employees: 85, syncStatus: 'synced', lastSync: '2023-06-10T09:15:00Z' },
      { id: '3', name: 'Indústria 123', employees: 210, syncStatus: 'pending', lastSync: null },
    ]),
    
    getById: async (id: string) => mockApiCall({
      id,
      name: id === '1' ? 'Empresa ABC' : 'Outra Empresa',
      employees: 120,
      sectors: 8,
      address: 'Rua Principal, 123',
      city: 'São Paulo',
      state: 'SP',
      syncStatus: 'synced',
      lastSync: '2023-06-15T14:30:00Z'
    }),
    
    sync: async () => mockApiCall({ status: 'success', jobId: '12345' }),
  },
  
  // Employees endpoints
  employees: {
    list: async () => mockApiCall([
      { id: '101', name: 'João Silva', position: 'Analista', sector: 'TI', status: 'Ativo', absentDays: 3 },
      { id: '102', name: 'Maria Santos', position: 'Gerente', sector: 'RH', status: 'Ativo', absentDays: 0 },
      { id: '103', name: 'Pedro Costa', position: 'Desenvolvedor', sector: 'TI', status: 'Afastado', absentDays: 15 },
      { id: '104', name: 'Ana Sousa', position: 'Analista', sector: 'Financeiro', status: 'Ativo', absentDays: 1 },
    ]),
    
    getById: async (id: string) => mockApiCall({
      id,
      name: 'João Silva',
      position: 'Analista',
      sector: 'TI',
      companyId: '1',
      status: 'Ativo',
      startDate: '2020-03-15',
      absenceHistory: [
        { id: 'a1', startDate: '2023-05-10', endDate: '2023-05-12', reason: 'Doença', cid: 'J00' },
        { id: 'a2', startDate: '2023-02-22', endDate: '2023-02-22', reason: 'Consulta médica', cid: 'Z00.0' },
      ]
    }),
    
    sync: async () => mockApiCall({ status: 'success', jobId: '67890' }),
  },
  
  // Absenteeism endpoints
  absenteeism: {
    getDashboardData: async () => mockApiCall({
      absenteeismRate: 3.2,
      trend: { value: 0.5, positive: false },
      totalAbsenceDays: 147,
      employeesAbsent: 12,
      costImpact: 'R$ 28.500,00',
      bySector: [
        { name: 'Produção', value: 42 },
        { name: 'Administrativo', value: 26 },
        { name: 'Comercial', value: 18 },
        { name: 'TI', value: 15 },
        { name: 'RH', value: 7 }
      ],
      byReason: [
        { name: 'Doença', value: 68 },
        { name: 'Acidente', value: 22 },
        { name: 'Familiar', value: 15 },
        { name: 'Outros', value: 42 }
      ],
      monthlyTrend: [
        { month: 'Jan', value: 2.8 },
        { month: 'Fev', value: 3.1 },
        { month: 'Mar', value: 2.9 },
        { month: 'Abr', value: 3.5 },
        { month: 'Mai', value: 3.2 },
        { month: 'Jun', value: 2.7 }
      ]
    }),
    
    sync: async () => mockApiCall({ status: 'success', jobId: '24680' }),
  },
  
  // API configuration endpoints
  apiConfig: {
    get: async (type = 'company') => {
      // Return specific config based on type
      return mockApiCall(mockApiConfigs[type as keyof typeof mockApiConfigs] || {});
    },
    
    save: async (type: string, config: any) => {
      // Save config based on type
      return mockApiCall({ 
        status: 'success', 
        message: `Configurações da API de ${type === 'company' ? 'Empresas' : type === 'employee' ? 'Funcionários' : 'Absenteísmo'} salvas com sucesso`,
        ...config
      });
    },
    
    test: async (type: string) => {
      // Test connection based on type
      return mockApiCall({ 
        status: 'success', 
        message: `Conexão com a API de ${type === 'company' ? 'Empresas' : type === 'employee' ? 'Funcionários' : 'Absenteísmo'} estabelecida com sucesso!` 
      });
    },
  },
};

export default api;
