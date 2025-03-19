import axios from 'axios';
import { supabase } from '@/integrations/supabase/client';
import { DashboardData, MonthlyTrendData, SectorData, MockCompanyData, MockEmployeeData } from '@/types/dashboard';

// Define the structure of the API configuration
export interface ApiConfig {
  type: 'company' | 'employee' | 'absenteeism';
  empresa: string;
  codigo: string;
  chave: string;
  tipoSaida: string;
  isConfigured?: boolean;
}

// Specific config types for different APIs
export interface CompanyApiConfig extends ApiConfig {
  type: 'company';
}

export interface EmployeeApiConfig extends ApiConfig {
  type: 'employee';
  ativo: string;
  inativo: string;
  afastado: string;
  pendente: string;
  ferias: string;
}

export interface AbsenteeismApiConfig extends ApiConfig {
  type: 'absenteeism';
  empresaTrabalho: string;
  dataInicio: string;
  dataFim: string;
}

// Define the structure of the API response
interface ApiResponse<T> {
  data: T[] | null;
  error: string | null;
}

// Define the structure of the Company
export interface Company {
  id: number;
  name: string;
  cnpj: string;
  createdAt: Date;
  updatedAt: Date;
}

// Define the structure of the Employee
export interface Employee {
  id: number;
  name: string;
  email: string;
  phone: string;
  companyId: number;
  createdAt: Date;
  updatedAt: Date;
}

// Define the structure of the Absenteeism
export interface Absenteeism {
  id: number;
  employeeId: number;
  companyId: number;
  startDate: Date;
  endDate: Date;
  reason: string;
  cid: string;
  createdAt: Date;
  updatedAt: Date;
}

// Define the structure of the User
export interface User {
  id: number;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

// Function to generate mock data
const generateMockData = (type: string): MockCompanyData[] | MockEmployeeData[] | DashboardData => {
  if (type === 'dashboard') {
    return {
      absenteeismRate: 3.42,
      totalAbsenceDays: 128,
      employeesAbsent: 24,
      costImpact: 'R$ 18.750,00',
      trend: 'down',
      monthlyTrend: [
        { month: '1/2023', count: 10, hours: 80, value: 2.8 },
        { month: '2/2023', count: 12, hours: 96, value: 3.1 },
        { month: '3/2023', count: 14, hours: 112, value: 3.6 },
        { month: '4/2023', count: 16, hours: 128, value: 4.2 },
        { month: '5/2023', count: 15, hours: 120, value: 3.9 },
        { month: '6/2023', count: 13, hours: 104, value: 3.4 },
      ],
      bySector: [
        { name: 'Administrativo', value: 45 },
        { name: 'Produção', value: 32 },
        { name: 'Comercial', value: 24 },
        { name: 'Logística', value: 18 },
        { name: 'Manutenção', value: 9 }
      ]
    } as DashboardData;
  } else if (type === 'companies') {
    return Array.from({ length: 5 }, (_, i) => ({
      id: i + 1,
      name: `Empresa ${i + 1} Ltda`,
      short_name: `Empresa ${i + 1}`,
      corporate_name: `Empresa ${i + 1} Ltda`,
      tax_id: `${10000000000000 + i}`,
      employees: Math.floor(Math.random() * 100) + 10,
      syncStatus: ['synced', 'pending', 'error'][Math.floor(Math.random() * 3)],
      lastSync: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()
    })) as MockCompanyData[];
  } else if (type === 'employees') {
    return Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      name: `Funcionário ${i + 1}`,
      full_name: `Funcionário Exemplo ${i + 1}`,
      position: `Cargo ${Math.floor(i / 3) + 1}`,
      position_name: `Cargo ${Math.floor(i / 3) + 1}`,
      sector: `Setor ${Math.floor(i / 2) + 1}`,
      sector_name: `Setor ${Math.floor(i / 2) + 1}`,
      status: ['Ativo', 'Afastado', 'Inativo'][Math.floor(Math.random() * 3)],
      absentDays: Math.floor(Math.random() * 20)
    })) as MockEmployeeData[];
  }
  return [] as MockCompanyData[];
};

// Function to convert hours string to decimal
const hoursToDecimal = (hoursString: string): number => {
  if (!hoursString) return 0;
  
  const [hours, minutes] = hoursString.split(':').map(part => {
    const num = parseInt(part, 10);
    return isNaN(num) ? 0 : num;
  });
  
  return hours + (minutes / 60);
};

// Function to fetch data from an external API
async function fetchDataFromExternalApi<T>(config: ApiConfig): Promise<ApiResponse<T>> {
  try {
    if (!config) {
      throw new Error('API configuration not found');
    }

    let url = '';
    if (config.type === 'company') {
      url = `/api/companies?empresa=${config.empresa}&codigo=${config.codigo}&chave=${config.chave}&tipoSaida=${config.tipoSaida}`;
    } else if (config.type === 'employee') {
      url = `/api/employees?empresa=${config.empresa}&codigo=${config.codigo}&chave=${config.chave}&tipoSaida=${config.tipoSaida}`;
    } else if (config.type === 'absenteeism') {
      url = `/api/absenteeism?empresa=${config.empresa}&codigo=${config.codigo}&chave=${config.chave}&tipoSaida=${config.tipoSaida}`;
    } else {
      throw new Error('Invalid API type');
    }

    const response = await axios.get(url);

    if (response.status !== 200) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    return { data: response.data as T[], error: null };
  } catch (error: any) {
    console.error('Error fetching data from external API:', error);
    return { data: null, error: error.message || 'Failed to fetch data from external API' };
  }
}

// Mock API service
const apiService = {
  companies: {
    getAll: async (): Promise<MockCompanyData[]> => {
      try {
        // Check if API is configured first
        const config = await apiService.apiConfig.get('company');
        
        if (!config || !config.isConfigured) {
          console.warn('Company API not configured, returning mock data');
          return generateMockData('companies') as MockCompanyData[];
        }
        
        const response = await axios.get<MockCompanyData[]>('/api/companies');
        
        if (Array.isArray(response.data) && response.data.length > 0) {
          return response.data;
        } else {
          console.warn('Empty response from API, returning mock data');
          return generateMockData('companies') as MockCompanyData[];
        }
      } catch (error) {
        console.error('Error fetching companies, using mock data:', error);
        return generateMockData('companies') as MockCompanyData[];
      }
    },
    getById: async (id: number): Promise<MockCompanyData | null> => {
      try {
        const response = await axios.get<MockCompanyData>(`/api/companies/${id}`);
        return response.data;
      } catch (error) {
        console.error('Error fetching company:', error);
        return null;
      }
    },
    create: async (data: Omit<MockCompanyData, 'id' | 'createdAt' | 'updatedAt'>): Promise<MockCompanyData | null> => {
      try {
        const response = await axios.post<MockCompanyData>('/api/companies', data);
        return response.data;
      } catch (error) {
        console.error('Error creating company:', error);
        return null;
      }
    },
    update: async (id: number, data: Omit<MockCompanyData, 'createdAt' | 'updatedAt' | 'id'>): Promise<MockCompanyData | null> => {
      try {
        const response = await axios.put<MockCompanyData>(`/api/companies/${id}`, data);
        return response.data;
      } catch (error) {
        console.error('Error updating company:', error);
        return null;
      }
    },
    delete: async (id: number): Promise<boolean> => {
      try {
        await axios.delete(`/api/companies/${id}`);
        return true;
      } catch (error) {
        console.error('Error deleting company:', error);
        return false;
      }
    },
    sync: async (): Promise<boolean> => {
      try {
        // Check if API is configured first
        const config = await apiService.apiConfig.get('company');
        
        if (!config || !config.isConfigured) {
          console.warn('Company API not configured, sync not attempted');
          return false;
        }
        
        await axios.post('/api/companies/sync');
        return true;
      } catch (error) {
        console.error('Error syncing companies:', error);
        return false;
      }
    }
  },
  employees: {
    getAll: async (): Promise<MockEmployeeData[]> => {
      try {
        // Check if API is configured first
        const config = await apiService.apiConfig.get('employee');
        
        if (!config || !config.isConfigured) {
          console.warn('Employee API not configured, returning mock data');
          return generateMockData('employees') as MockEmployeeData[];
        }
        
        const response = await axios.get<MockEmployeeData[]>('/api/employees');
        
        if (Array.isArray(response.data) && response.data.length > 0) {
          return response.data;
        } else {
          console.warn('Empty response from API, returning mock data');
          return generateMockData('employees') as MockEmployeeData[];
        }
      } catch (error) {
        console.error('Error fetching employees, using mock data:', error);
        return generateMockData('employees') as MockEmployeeData[];
      }
    },
    getById: async (id: number): Promise<MockEmployeeData | null> => {
      try {
        const response = await axios.get<MockEmployeeData>(`/api/employees/${id}`);
        return response.data;
      } catch (error) {
        console.error('Error fetching employee:', error);
        return null;
      }
    },
    create: async (data: Omit<MockEmployeeData, 'id' | 'createdAt' | 'updatedAt'>): Promise<MockEmployeeData | null> => {
      try {
        const response = await axios.post<MockEmployeeData>('/api/employees', data);
        return response.data;
      } catch (error) {
        console.error('Error creating employee:', error);
        return null;
      }
    },
    update: async (id: number, data: Omit<MockEmployeeData, 'createdAt' | 'updatedAt' | 'id'>): Promise<MockEmployeeData | null> => {
      try {
        const response = await axios.put<MockEmployeeData>(`/api/employees/${id}`, data);
        return response.data;
      } catch (error) {
        console.error('Error updating employee:', error);
        return null;
      }
    },
    delete: async (id: number): Promise<boolean> => {
      try {
        await axios.delete(`/api/employees/${id}`);
        return true;
      } catch (error) {
        console.error('Error deleting employee:', error);
        return false;
      }
    },
    sync: async (): Promise<boolean> => {
      try {
        // Check if API is configured first
        const config = await apiService.apiConfig.get('employee');
        
        if (!config || !config.isConfigured) {
          console.warn('Employee API not configured, sync not attempted');
          return false;
        }
        
        await axios.post('/api/employees/sync');
        return true;
      } catch (error) {
        console.error('Error syncing employees:', error);
        return false;
      }
    },
    testConnection: async (config: EmployeeApiConfig): Promise<{success: boolean, count: number}> => {
      try {
        const response = await axios.post('/api/employees/test-connection', config);
        return response.data;
      } catch (error) {
        console.error('Error testing employee API connection:', error);
        throw error;
      }
    }
  },
  absenteeism: {
    getAll: async (): Promise<Absenteeism[]> => {
      try {
        const response = await axios.get<Absenteeism[]>('/api/absenteeism');
        return response.data;
      } catch (error) {
        console.error('Error fetching absenteeism:', error);
        return [];
      }
    },
    getById: async (id: number): Promise<Absenteeism | null> => {
      try {
        const response = await axios.get<Absenteeism>(`/api/absenteeism/${id}`);
        return response.data;
      } catch (error) {
        console.error('Error fetching absenteeism:', error);
        return null;
      }
    },
    create: async (data: Omit<Absenteeism, 'id' | 'createdAt' | 'updatedAt'>): Promise<Absenteeism | null> => {
      try {
        const response = await axios.post<Absenteeism>('/api/absenteeism', data);
        return response.data;
      } catch (error) {
        console.error('Error creating absenteeism:', error);
        return null;
      }
    },
    update: async (id: number, data: Omit<Absenteeism, 'createdAt' | 'updatedAt' | 'id'>): Promise<Absenteeism | null> => {
      try {
        const response = await axios.put<Absenteeism>(`/api/absenteeism/${id}`, data);
        return response.data;
      } catch (error) {
        console.error('Error updating absenteeism:', error);
        return null;
      }
    },
    delete: async (id: number): Promise<boolean> => {
      try {
        await axios.delete(`/api/absenteeism/${id}`);
        return true;
      } catch (error) {
        console.error('Error deleting absenteeism:', error);
        return false;
      }
    }
  },
  users: {
    getMe: async (): Promise<User | null> => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;
        
        // Construct a user object from Supabase auth
        return {
          id: parseInt(user.id, 36) % 1000000, // Convert UUID to a numeric ID
          name: user.user_metadata?.name || 'User',
          email: user.email || '',
          createdAt: new Date(user.created_at),
          updatedAt: new Date()
        };
      } catch (error) {
        console.error('Error fetching user:', error);
        return null;
      }
    },
  },
  apiConfig: {
    get: async (type: 'company' | 'employee' | 'absenteeism'): Promise<ApiConfig | EmployeeApiConfig | AbsenteeismApiConfig | CompanyApiConfig | null> => {
      try {
        const response = await axios.get<ApiConfig | EmployeeApiConfig | AbsenteeismApiConfig | CompanyApiConfig>(`/api/api-config/${type}`);
        
        // Add isConfigured flag based on required fields
        if (response.data) {
          response.data.isConfigured = !!(response.data.empresa && response.data.codigo && response.data.chave);
        }
        
        return response.data;
      } catch (error) {
        console.error('Error fetching API config:', error);
        
        // Return a default empty config on error
        return {
          type,
          empresa: '',
          codigo: '',
          chave: '',
          tipoSaida: 'json',
          isConfigured: false
        };
      }
    },
    save: async (config: ApiConfig | EmployeeApiConfig | AbsenteeismApiConfig | CompanyApiConfig): Promise<ApiConfig | null> => {
      try {
        // Ensure tipoSaida is always 'json'
        const configToSave = {
          ...config,
          tipoSaida: 'json'
        };
        
        const response = await axios.post<ApiConfig>('/api/api-config', configToSave);
        
        // Add isConfigured flag based on required fields
        if (response.data) {
          response.data.isConfigured = !!(response.data.empresa && response.data.codigo && response.data.chave);
        }
        
        return response.data;
      } catch (error) {
        console.error('Error saving API config:', error);
        return null;
      }
    },
    test: async (type: 'company' | 'employee' | 'absenteeism'): Promise<{success: boolean, message: string}> => {
      try {
        const config = await apiService.getApiConfig(type);
        if (!config) {
          throw new Error(`No ${type} API config found`);
        }
        
        return await apiService.testApiConnection(config);
      } catch (error) {
        console.error('Error testing API config:', error);
        throw error;
      }
    }
  },
  getApiConfig: async (type: 'company' | 'employee' | 'absenteeism'): Promise<ApiConfig | EmployeeApiConfig | AbsenteeismApiConfig | CompanyApiConfig | null> => {
    return apiService.apiConfig.get(type);
  },
  saveApiConfig: async (config: ApiConfig | EmployeeApiConfig | AbsenteeismApiConfig | CompanyApiConfig): Promise<ApiConfig | null> => {
    return apiService.apiConfig.save(config);
  },
  testApiConnection: async (config: ApiConfig | EmployeeApiConfig | AbsenteeismApiConfig | CompanyApiConfig): Promise<{success: boolean, message: string}> => {
    try {
      const response = await axios.post('/api/test-connection', config);
      return response.data;
    } catch (error) {
      console.error('Error testing API connection:', error);
      throw error;
    }
  },
  async getDashboardData(): Promise<DashboardData> {
    try {
      // Check if all APIs are configured first
      const [companyConfig, employeeConfig, absenteeismConfig] = await Promise.all([
        this.apiConfig.get('company'),
        this.apiConfig.get('employee'),
        this.apiConfig.get('absenteeism')
      ]);
      
      const allConfigured = 
        companyConfig?.isConfigured && 
        employeeConfig?.isConfigured && 
        absenteeismConfig?.isConfigured;
      
      if (!allConfigured) {
        console.warn('Not all APIs are configured, returning mock dashboard data');
        return generateMockData('dashboard') as DashboardData;
      }
      
      const absenteeismData = await this.absenteeism.getAll();
      const employeesData = await this.employees.getAll();
      
      if (!absenteeismData || absenteeismData.length === 0) {
        console.warn('No absenteeism data available, returning mock dashboard data');
        return generateMockData('dashboard') as DashboardData;
      }
      
      // Process data for dashboard metrics
      return {
        absenteeismRate: calculateAbsenteeismRate(absenteeismData),
        totalAbsenceDays: calculateTotalAbsenceDays(absenteeismData),
        employeesAbsent: countUniqueEmployees(absenteeismData),
        costImpact: calculateCostImpact(absenteeismData),
        trend: determineTrend(absenteeismData), 
        monthlyTrend: getMonthlyEvolution(absenteeismData),
        bySector: getSectorAbsenceData(absenteeismData)
      };
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      // Return mock data on any error
      return generateMockData('dashboard') as DashboardData;
    }
  },
};

// Helper function to determine the trend
const determineTrend = (absenteeismData: any[]): 'up' | 'down' | 'stable' => {
  const monthlyData = getMonthlyEvolution(absenteeismData);
  
  if (monthlyData.length < 2) {
    return 'stable';
  }
  
  const lastMonth = monthlyData[monthlyData.length - 1].value;
  const previousMonth = monthlyData[monthlyData.length - 2].value;
  
  if (lastMonth > previousMonth * 1.05) {
    return 'up';
  } else if (lastMonth < previousMonth * 0.95) {
    return 'down';
  } else {
    return 'stable';
  }
};

// Additional helper functions for the dashboard data
const calculateTotalAbsenceDays = (absenteeismData: any[]): number => {
  return absenteeismData.reduce((sum, record) => {
    const startDate = new Date(record.start_date || record.startDate);
    const endDate = new Date(record.end_date || record.endDate);
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return sum + (record.days_absent || 1);
    }
    
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
    return sum + diffDays;
  }, 0);
};

const countUniqueEmployees = (absenteeismData: any[]): number => {
  const uniqueEmployees = new Set(absenteeismData.map(record => record.employee_id || record.employeeId));
  return uniqueEmployees.size;
};

const calculateCostImpact = (absenteeismData: any[]): string => {
  const totalAbsentHours = absenteeismData.reduce((sum, record) => {
    return sum + hoursToDecimal(record.hours_absent || record.hoursAbsent || "0:00");
  }, 0);
  
  const averageHourlyCost = 30;
  const totalCost = totalAbsentHours * averageHourlyCost;
  
  return new Intl.NumberFormat('pt-BR', { 
    style: 'currency', 
    currency: 'BRL' 
  }).format(totalCost);
};

const getSectorAbsenceData = (absenteeismData: any[]): SectorData[] => {
  const sectorCounts = absenteeismData.reduce((acc: Record<string, number>, record) => {
    const sector = record.sector || 'Não informado';
    if (!acc[sector]) {
      acc[sector] = 0;
    }
    
    // Try to calculate days based on dates first
    let days = 0;
    const startDate = new Date(record.start_date || record.startDate);
    const endDate = new Date(record.end_date || record.endDate);
    
    if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
      const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
      days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
    } else {
      // Fallback to days_absent field
      days = record.days_absent || 1;
    }
    
    acc[sector] += days;
    return acc;
  }, {} as Record<string, number>);
  
  return Object.entries(sectorCounts)
    .map(([name, value]): SectorData => ({ name, value: Number(value) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
};

// Original helper functions
const calculateAbsenteeismRate = (absenteeismData: any[]) => {
  const totalAbsentHours = absenteeismData.reduce((sum, record) => {
    return sum + hoursToDecimal(record.hours_absent || record.hoursAbsent || "0:00");
  }, 0);
  
  const avgWorkHoursPerMonth = 220;
  const estimatedTotalWorkHours = absenteeismData.length > 0 ? absenteeismData.length * avgWorkHoursPerMonth : 1;
  
  return (totalAbsentHours / estimatedTotalWorkHours) * 100;
};

const getTopCids = (absenteeismData: any[]) => {
  const cidCounts = absenteeismData.reduce((acc: Record<string, number>, record) => {
    const cid = record.primary_icd || record.primaryIcd || 'Não informado';
    acc[cid] = (acc[cid] || 0) + 1;
    return acc;
  }, {});
  
  return Object.entries(cidCounts)
    .map(([cid, count]) => ({ cid, count }))
    .sort((a, b) => (b.count as number) - (a.count as number))
    .slice(0, 10);
};

const getTopSectors = (absenteeismData: any[]) => {
  const sectorCounts = absenteeismData.reduce((acc: Record<string, number>, record) => {
    const sector = record.sector || 'Não informado';
    acc[sector] = (acc[sector] || 0) + 1;
    return acc;
  }, {});
  
  return Object.entries(sectorCounts)
    .map(([sector, count]) => ({ sector, count }))
    .sort((a, b) => (b.count as number) - (a.count as number))
    .slice(0, 10);
};

// Fix the getMonthlyEvolution function to ensure proper typing
const getMonthlyEvolution = (absenteeismData: any[]): MonthlyTrendData[] => {
  const monthlyData: Record<string, MonthlyTrendData> = absenteeismData.reduce((acc: Record<string, MonthlyTrendData>, record) => {
    const startDate = new Date(record.start_date || record.startDate);
    
    // If date is invalid, skip this record
    if (isNaN(startDate.getTime())) {
      return acc;
    }
    
    const monthYear = `${startDate.getMonth() + 1}/${startDate.getFullYear()}`;
    
    if (!acc[monthYear]) {
      acc[monthYear] = { 
        month: monthYear, 
        count: 0, 
        hours: 0,
        value: 0 
      };
    }
    
    acc[monthYear].count += 1;
    acc[monthYear].hours += hoursToDecimal(record.hours_absent || record.hoursAbsent || "0:00");
    
    // Calculate absenteeism rate for this month
    const avgWorkHoursPerMonth = 220;
    acc[monthYear].value = (acc[monthYear].hours / (acc[monthYear].count * avgWorkHoursPerMonth)) * 100;
    
    return acc;
  }, {});
  
  return Object.values(monthlyData)
    .sort((a, b) => {
      const [aMonth, aYear] = a.month.split('/').map(Number);
      const [bMonth, bYear] = b.month.split('/').map(Number);
      return (aYear - bYear) || (aMonth - bMonth);
    });
};

export default apiService;
