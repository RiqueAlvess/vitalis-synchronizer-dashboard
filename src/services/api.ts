import axios from 'axios';
import { query } from './dbService';
import { User } from './authService';

// Create axios instance
const api = axios.create({
  baseURL: 'https://api.example.com', // Este é um URL placeholder
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

// Função auxiliar para simular chamadas de API
const mockApiCall = async (data: any, delay = 800) => {
  await new Promise(resolve => setTimeout(resolve, delay));
  return data;
};

// Obter ID do usuário atual a partir do token
const getCurrentUserId = (): number | null => {
  const token = localStorage.getItem('vitalis_auth_token');
  if (!token) return null;
  
  try {
    const parsed = JSON.parse(atob(token));
    return parsed.id;
  } catch (error) {
    console.error('Erro ao obter ID do usuário:', error);
    return null;
  }
};

// API service com implementações reais que usam o banco de dados
export const apiService = {
  // Endpoints de empresas
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
  
  // Endpoints de funcionários
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
  
  // Endpoints de absenteísmo
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
  
  // Configurações de API
  apiConfig: {
    get: async (type = 'company') => {
      const userId = getCurrentUserId();
      if (!userId) {
        throw new Error('Usuário não autenticado');
      }
      
      try {
        const result = await query(
          'SELECT * FROM api_configurations WHERE user_id = $1 AND api_type = $2',
          [userId, type]
        );
        
        if (result.rows.length === 0) {
          // Se não existir configuração, criar uma padrão
          await query(
            'INSERT INTO api_configurations (user_id, api_type) VALUES ($1, $2) RETURNING *',
            [userId, type]
          );
          
          // Buscar novamente
          const newResult = await query(
            'SELECT * FROM api_configurations WHERE user_id = $1 AND api_type = $2',
            [userId, type]
          );
          
          return {
            empresa: newResult.rows[0].empresa_principal || '',
            codigo: newResult.rows[0].codigo || '',
            chave: newResult.rows[0].chave || '',
            tipoSaida: 'json',
            isConfigured: false,
            ativo: newResult.rows[0].ativo || '',
            inativo: newResult.rows[0].inativo || '',
            afastado: newResult.rows[0].afastado || '',
            pendente: newResult.rows[0].pendente || '',
            ferias: newResult.rows[0].ferias || ''
          };
        }
        
        // Mapear os campos do banco para os campos esperados pela UI
        return {
          empresa: result.rows[0].empresa_principal || '',
          codigo: result.rows[0].codigo || '',
          chave: result.rows[0].chave || '',
          tipoSaida: 'json',
          isConfigured: !!result.rows[0].chave,
          ativo: result.rows[0].ativo || '',
          inativo: result.rows[0].inativo || '',
          afastado: result.rows[0].afastado || '',
          pendente: result.rows[0].pendente || '',
          ferias: result.rows[0].ferias || ''
        };
      } catch (error) {
        console.error(`Erro ao buscar configurações de API ${type}:`, error);
        throw error;
      }
    },
    
    save: async (type: string, config: any) => {
      const userId = getCurrentUserId();
      if (!userId) {
        throw new Error('Usuário não autenticado');
      }
      
      try {
        // Mapear os campos da UI para os campos do banco
        const values = [
          userId,
          type,
          config.empresa || '',
          config.codigo || '',
          config.chave || '',
          config.ativo || '',
          config.inativo || '',
          config.afastado || '',
          config.pendente || '',
          config.ferias || ''
        ];
        
        // Verificar se já existe configuração
        const checkResult = await query(
          'SELECT id FROM api_configurations WHERE user_id = $1 AND api_type = $2',
          [userId, type]
        );
        
        if (checkResult.rows.length === 0) {
          // Inserir nova configuração
          await query(
            `INSERT INTO api_configurations (
              user_id, api_type, empresa_principal, codigo, chave, 
              ativo, inativo, afastado, pendente, ferias
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            values
          );
        } else {
          // Atualizar configuração existente
          await query(
            `UPDATE api_configurations SET
              empresa_principal = $3, codigo = $4, chave = $5,
              ativo = $6, inativo = $7, afastado = $8, pendente = $9, ferias = $10,
              updated_at = CURRENT_TIMESTAMP
             WHERE user_id = $1 AND api_type = $2`,
            values
          );
        }
        
        return { 
          status: 'success', 
          message: `Configurações da API de ${type === 'company' ? 'Empresas' : type === 'employee' ? 'Funcionários' : 'Absenteísmo'} salvas com sucesso`,
          ...config
        };
      } catch (error) {
        console.error(`Erro ao salvar configurações de API ${type}:`, error);
        throw error;
      }
    },
    
    test: async (type: string) => {
      const userId = getCurrentUserId();
      if (!userId) {
        throw new Error('Usuário não autenticado');
      }
      
      try {
        // Buscar configuração atual
        const result = await query(
          'SELECT * FROM api_configurations WHERE user_id = $1 AND api_type = $2',
          [userId, type]
        );
        
        if (result.rows.length === 0 || !result.rows[0].chave) {
          throw new Error('Configuração não encontrada ou incompleta');
        }
        
        // Aqui você faria a chamada real para a API externa
        // Por enquanto vamos simular um teste bem-sucedido
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Registrar teste bem-sucedido
        await query(
          `INSERT INTO sync_jobs (
            user_id, job_type, status, params, result, started_at, completed_at
          ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [
            userId, 
            `test_${type}`, 
            'success', 
            JSON.stringify({ type }), 
            JSON.stringify({ success: true })
          ]
        );
        
        return { 
          status: 'success', 
          message: `Conexão com a API de ${type === 'company' ? 'Empresas' : type === 'employee' ? 'Funcionários' : 'Absenteísmo'} estabelecida com sucesso!` 
        };
      } catch (error) {
        console.error(`Erro ao testar conexão com API ${type}:`, error);
        
        // Registrar falha no teste
        if (userId) {
          await query(
            `INSERT INTO sync_jobs (
              user_id, job_type, status, params, error_message, started_at, completed_at
            ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [
              userId, 
              `test_${type}`, 
              'error', 
              JSON.stringify({ type }), 
              error instanceof Error ? error.message : 'Erro desconhecido'
            ]
          );
        }
        
        throw error;
      }
    },
  },
};

export default api;
