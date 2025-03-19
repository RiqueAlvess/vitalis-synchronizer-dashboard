import axios from 'axios';

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

// Define the structure of the API service
interface ApiService {
  companies: {
    getAll: () => Promise<Company[]>;
    getById: (id: number) => Promise<Company | null>;
    create: (data: Omit<Company, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Company | null>;
    update: (id: number, data: Omit<Company, 'createdAt' | 'updatedAt' | 'id'>) => Promise<Company | null>;
    delete: (id: number) => Promise<boolean>;
    sync: () => Promise<boolean>;
  };
  employees: {
    getAll: () => Promise<Employee[]>;
    getById: (id: number) => Promise<Employee | null>;
    create: (data: Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Employee | null>;
    update: (id: number, data: Omit<Employee, 'createdAt' | 'updatedAt' | 'id'>) => Promise<Employee | null>;
    delete: (id: number) => Promise<boolean>;
    sync: () => Promise<boolean>;
    testConnection: (config: EmployeeApiConfig) => Promise<{success: boolean, count: number}>;
  };
  absenteeism: {
    getAll: () => Promise<Absenteeism[]>;
    getById: (id: number) => Promise<Absenteeism | null>;
    create: (data: Omit<Absenteeism, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Absenteeism | null>;
    update: (id: number, data: Omit<Absenteeism, 'createdAt' | 'updatedAt' | 'id'>) => Promise<Absenteeism | null>;
    delete: (id: number) => Promise<boolean>;
  };
  users: {
    getMe: () => Promise<User | null>;
  };
  apiConfig: {
    get: (type: 'company' | 'employee' | 'absenteeism') => Promise<ApiConfig | null>;
    save: (config: ApiConfig | EmployeeApiConfig | AbsenteeismApiConfig | CompanyApiConfig) => Promise<ApiConfig | null>;
    test: (type: 'company' | 'employee' | 'absenteeism') => Promise<{success: boolean, message: string}>;
  };
  testApiConnection: (config: ApiConfig | EmployeeApiConfig | AbsenteeismApiConfig | CompanyApiConfig) => Promise<{success: boolean, message: string}>;
  getApiConfig: (type: 'company' | 'employee' | 'absenteeism') => Promise<ApiConfig | null>;
  saveApiConfig: (config: ApiConfig | EmployeeApiConfig | AbsenteeismApiConfig | CompanyApiConfig) => Promise<ApiConfig | null>;
  getDashboardData: () => Promise<any>;
}

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
      url = `${process.env.NEXT_PUBLIC_API_URL}/integration/companies?empresa=${config.empresa}&codigo=${config.codigo}&chave=${config.chave}&tipoSaida=${config.tipoSaida}`;
    } else if (config.type === 'employee') {
      url = `${process.env.NEXT_PUBLIC_API_URL}/integration/employees?empresa=${config.empresa}&codigo=${config.codigo}&chave=${config.chave}&tipoSaida=${config.tipoSaida}`;
    } else if (config.type === 'absenteeism') {
      url = `${process.env.NEXT_PUBLIC_API_URL}/integration/absenteeism?empresa=${config.empresa}&codigo=${config.codigo}&chave=${config.chave}&tipoSaida=${config.tipoSaida}`;
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
const apiService: ApiService = {
  companies: {
    getAll: async (): Promise<Company[]> => {
      try {
        const response = await axios.get<Company[]>('/api/companies');
        return response.data;
      } catch (error) {
        console.error('Error fetching companies:', error);
        return [];
      }
    },
    getById: async (id: number): Promise<Company | null> => {
      try {
        const response = await axios.get<Company>(`/api/companies/${id}`);
        return response.data;
      } catch (error) {
        console.error('Error fetching company:', error);
        return null;
      }
    },
    create: async (data: Omit<Company, 'id' | 'createdAt' | 'updatedAt'>): Promise<Company | null> => {
      try {
        const response = await axios.post<Company>('/api/companies', data);
        return response.data;
      } catch (error) {
        console.error('Error creating company:', error);
        return null;
      }
    },
    update: async (id: number, data: Omit<Company, 'createdAt' | 'updatedAt' | 'id'>): Promise<Company | null> => {
      try {
        const response = await axios.put<Company>(`/api/companies/${id}`, data);
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
        await axios.post('/api/companies/sync');
        return true;
      } catch (error) {
        console.error('Error syncing companies:', error);
        return false;
      }
    }
  },
  employees: {
    getAll: async (): Promise<Employee[]> => {
      try {
        const response = await axios.get<Employee[]>('/api/employees');
        return response.data;
      } catch (error) {
        console.error('Error fetching employees:', error);
        return [];
      }
    },
    getById: async (id: number): Promise<Employee | null> => {
      try {
        const response = await axios.get<Employee>(`/api/employees/${id}`);
        return response.data;
      } catch (error) {
        console.error('Error fetching employee:', error);
        return null;
      }
    },
    create: async (data: Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>): Promise<Employee | null> => {
      try {
        const response = await axios.post<Employee>('/api/employees', data);
        return response.data;
      } catch (error) {
        console.error('Error creating employee:', error);
        return null;
      }
    },
    update: async (id: number, data: Omit<Employee, 'createdAt' | 'updatedAt' | 'id'>): Promise<Employee | null> => {
      try {
        const response = await axios.put<Employee>(`/api/employees/${id}`, data);
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
        const response = await axios.get<User>('/api/users/me');
        return response.data;
      } catch (error) {
        console.error('Error fetching user:', error);
        return null;
      }
    },
  },
  apiConfig: {
    get: async (type: 'company' | 'employee' | 'absenteeism'): Promise<ApiConfig | null> => {
      try {
        const response = await axios.get<ApiConfig>(`/api/api-config/${type}`);
        return response.data;
      } catch (error) {
        console.error('Error fetching API config:', error);
        return null;
      }
    },
    save: async (config: ApiConfig | EmployeeApiConfig | AbsenteeismApiConfig | CompanyApiConfig): Promise<ApiConfig | null> => {
      try {
        const response = await axios.post<ApiConfig>('/api/api-config', config);
        return response.data;
      } catch (error) {
        console.error('Error saving API config:', error);
        return null;
      }
    },
    test: async (type: 'company' | 'employee' | 'absenteeism'): Promise<{success: boolean, message: string}> => {
      try {
        const response = await axios.post(`/api/api-config/${type}/test`);
        return response.data;
      } catch (error) {
        console.error('Error testing API config:', error);
        throw error;
      }
    }
  },
  getApiConfig: async (type: 'company' | 'employee' | 'absenteeism'): Promise<ApiConfig | null> => {
    return apiService.apiConfig.get(type);
  },
  saveApiConfig: async (config: ApiConfig): Promise<ApiConfig | null> => {
    return apiService.apiConfig.save(config);
  },
  testApiConnection: async (config: ApiConfig): Promise<{success: boolean, message: string}> => {
    try {
      const response = await axios.post('/api/test-connection', config);
      return response.data;
    } catch (error) {
      console.error('Error testing API connection:', error);
      throw error;
    }
  },
  async getDashboardData() {
    try {
      const absenteeismData = await this.absenteeism.getAll();
      const employeesData = await this.employees.getAll();
      
      // Process data for dashboard metrics
      return {
        absenteeismRate: calculateAbsenteeismRate(absenteeismData),
        totalAbsences: absenteeismData.length,
        topCids: getTopCids(absenteeismData),
        topSectors: getTopSectors(absenteeismData),
        monthlyTrend: getMonthlyEvolution(absenteeismData),
        totalAbsenceDays: calculateTotalAbsenceDays(absenteeismData),
        employeesAbsent: countUniqueEmployees(absenteeismData),
        costImpact: calculateCostImpact(absenteeismData),
        bySector: getSectorAbsenceData(absenteeismData)
      };
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      throw error;
    }
  },
};

// Additional helper functions for the dashboard data
const calculateTotalAbsenceDays = (absenteeismData: any[]): number => {
  return absenteeismData.reduce((sum, record) => {
    const startDate = new Date(record.start_date);
    const endDate = new Date(record.end_date);
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
    return sum + diffDays;
  }, 0);
};

const countUniqueEmployees = (absenteeismData: any[]): number => {
  const uniqueEmployees = new Set(absenteeismData.map(record => record.employee_id));
  return uniqueEmployees.size;
};

const calculateCostImpact = (absenteeismData: any[]): string => {
  const totalAbsentHours = absenteeismData.reduce((sum, record) => {
    return sum + hoursToDecimal(record.hours_absent || "0:00");
  }, 0);
  
  const averageHourlyCost = 30;
  const totalCost = totalAbsentHours * averageHourlyCost;
  
  return new Intl.NumberFormat('pt-BR', { 
    style: 'currency', 
    currency: 'BRL' 
  }).format(totalCost);
};

const getSectorAbsenceData = (absenteeismData: any[]): {name: string, value: number}[] => {
  const sectorCounts = absenteeismData.reduce((acc, record) => {
    const sector = record.sector || 'Não informado';
    if (!acc[sector]) {
      acc[sector] = 0;
    }
    
    const startDate = new Date(record.start_date);
    const endDate = new Date(record.end_date);
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
    
    acc[sector] += diffDays;
    return acc;
  }, {} as Record<string, number>);
  
  return Object.entries(sectorCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
};

// Original helper functions
const calculateAbsenteeismRate = (absenteeismData: any[]) => {
  const totalAbsentHours = absenteeismData.reduce((sum, record) => {
    return sum + hoursToDecimal(record.hours_absent || "0:00");
  }, 0);
  
  const avgWorkHoursPerMonth = 220;
  const estimatedTotalWorkHours = absenteeismData.length > 0 ? absenteeismData.length * avgWorkHoursPerMonth : 1;
  
  return (totalAbsentHours / estimatedTotalWorkHours) * 100;
};

const getTopCids = (absenteeismData: any[]) => {
  const cidCounts = absenteeismData.reduce((acc, record) => {
    const cid = record.primary_icd || 'Não informado';
    acc[cid] = (acc[cid] || 0) + 1;
    return acc;
  }, {});
  
  return Object.entries(cidCounts)
    .map(([cid, count]) => ({ cid, count }))
    .sort((a, b) => (b.count as number) - (a.count as number))
    .slice(0, 10);
};

const getTopSectors = (absenteeismData: any[]) => {
  const sectorCounts = absenteeismData.reduce((acc, record) => {
    const sector = record.sector || 'Não informado';
    acc[sector] = (acc[sector] || 0) + 1;
    return acc;
  }, {});
  
  return Object.entries(sectorCounts)
    .map(([sector, count]) => ({ sector, count }))
    .sort((a, b) => (b.count as number) - (a.count as number))
    .slice(0, 10);
};

const getMonthlyEvolution = (absenteeismData: any[]) => {
  const monthlyData = absenteeismData.reduce((acc, record) => {
    const date = new Date(record.start_date);
    const monthYear = `${date.getMonth() + 1}/${date.getFullYear()}`;
    
    if (!acc[monthYear]) {
      acc[monthYear] = { month: monthYear, count: 0, hours: 0 };
    }
    
    acc[monthYear].count += 1;
    acc[monthYear].hours += hoursToDecimal(record.hours_absent || "0:00");
    
    return acc;
  }, {});
  
  return Object.values(monthlyData)
    .sort((a: any, b: any) => {
      const [aMonth, aYear] = a.month.split('/');
      const [bMonth, bYear] = b.month.split('/');
      return (parseInt(aYear) - parseInt(bYear)) || (parseInt(aMonth) - parseInt(bMonth));
    });
};

export default apiService;
