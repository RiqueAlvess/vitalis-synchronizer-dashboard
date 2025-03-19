import { supabase } from '@/integrations/supabase/client';

// API Service - Handles all API calls for data
export const apiService = {
  // Company API
  companies: {
    async getAll() {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('corporate_name', { ascending: true });
        
      if (error) throw error;
      return data || [];
    },
    
    async getById(id: number) {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', id)
        .single();
        
      if (error) throw error;
      return data;
    },
    
    async create(company: any) {
      const { data, error } = await supabase
        .from('companies')
        .insert([company])
        .select();
        
      if (error) throw error;
      return data[0];
    },
    
    async update(id: number, company: any) {
      const { data, error } = await supabase
        .from('companies')
        .update(company)
        .eq('id', id)
        .select();
        
      if (error) throw error;
      return data[0];
    },
    
    async delete(id: number) {
      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
      return true;
    },
    
    async sync(configId?: number) {
      try {
        const response = await fetch('/api/soc-api', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
          },
          body: JSON.stringify({
            type: 'company',
            params: {},
            configId
          })
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to sync companies');
        }
        
        return await response.json();
      } catch (error: any) {
        console.error('Error syncing companies:', error);
        throw new Error(error.message || 'Failed to sync companies');
      }
    }
  },
  
  // Employee API
  employees: {
    async getAll() {
      const { data, error } = await supabase
        .from('employees')
        .select(`
          *,
          company:companies(id, corporate_name)
        `)
        .order('full_name', { ascending: true });
        
      if (error) throw error;
      return data || [];
    },
    
    async getByCompany(companyId: number) {
      const { data, error } = await supabase
        .from('employees')
        .select(`
          *,
          company:companies(id, corporate_name)
        `)
        .eq('company_id', companyId)
        .order('full_name', { ascending: true });
        
      if (error) throw error;
      return data || [];
    },
    
    async getById(id: number) {
      const { data, error } = await supabase
        .from('employees')
        .select(`
          *,
          company:companies(id, corporate_name)
        `)
        .eq('id', id)
        .single();
        
      if (error) throw error;
      return data;
    },
    
    async sync(configId?: number) {
      try {
        const response = await fetch('/api/soc-api', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
          },
          body: JSON.stringify({
            type: 'employee',
            params: {},
            configId
          })
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to sync employees');
        }
        
        return await response.json();
      } catch (error: any) {
        console.error('Error syncing employees:', error);
        throw new Error(error.message || 'Failed to sync employees');
      }
    }
  },
  
  // Absenteeism API
  absenteeism: {
    async getAll() {
      const { data, error } = await supabase
        .from('absenteeism')
        .select(`
          *,
          company:companies(id, corporate_name),
          employee:employees(id, full_name)
        `)
        .order('start_date', { ascending: false });
        
      if (error) throw error;
      return data || [];
    },
    
    async getByCompany(companyId: number) {
      const { data, error } = await supabase
        .from('absenteeism')
        .select(`
          *,
          company:companies(id, corporate_name),
          employee:employees(id, full_name)
        `)
        .eq('company_id', companyId)
        .order('start_date', { ascending: false });
        
      if (error) throw error;
      return data || [];
    },
    
    async getByEmployee(employeeId: number) {
      const { data, error } = await supabase
        .from('absenteeism')
        .select(`
          *,
          company:companies(id, corporate_name),
          employee:employees(id, full_name)
        `)
        .eq('employee_id', employeeId)
        .order('start_date', { ascending: false });
        
      if (error) throw error;
      return data || [];
    },
    
    async sync(configId?: number) {
      try {
        const response = await fetch('/api/soc-api', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
          },
          body: JSON.stringify({
            type: 'absenteeism',
            params: {},
            configId
          })
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to sync absenteeism data');
        }
        
        return await response.json();
      } catch (error: any) {
        console.error('Error syncing absenteeism data:', error);
        throw new Error(error.message || 'Failed to sync absenteeism data');
      }
    },
    
    async getDashboardData() {
      try {
        const { data: absenteeismData, error } = await supabase
          .from('absenteeism')
          .select(`
            *,
            company:companies(id, corporate_name),
            employee:employees(id, full_name)
          `)
          .order('start_date', { ascending: false });

        if (error) throw error;

        // Process data for dashboard
        const totalAbsenceDays = absenteeismData.reduce((sum, item) => sum + (item.days_absent || 0), 0);
        const employeesAbsent = new Set(absenteeismData.map(item => item.employee_id).filter(Boolean)).size;
        
        // Calculate monthly trend (last 6 months)
        const now = new Date();
        const monthlyTrend = [];
        for (let i = 5; i >= 0; i--) {
          const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const monthName = month.toLocaleString('default', { month: 'short' });
          const monthData = absenteeismData.filter(item => {
            const itemDate = new Date(item.start_date);
            return itemDate.getMonth() === month.getMonth() && 
                  itemDate.getFullYear() === month.getFullYear();
          });
          const totalDays = monthData.reduce((sum, item) => sum + (item.days_absent || 0), 0);
          monthlyTrend.push({
            name: monthName,
            value: totalDays
          });
        }
        
        // Calculate by sector
        const sectors = {};
        absenteeismData.forEach(item => {
          if (item.sector) {
            sectors[item.sector] = (sectors[item.sector] || 0) + (item.days_absent || 0);
          }
        });
        
        const bySector = Object.entries(sectors)
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => (b.value as number) - (a.value as number))
          .slice(0, 5);
        
        // Calculate current month absenteeism rate
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const currentMonthData = absenteeismData.filter(item => {
          const itemDate = new Date(item.start_date);
          return itemDate.getMonth() === currentMonth && 
                itemDate.getFullYear() === currentYear;
        });
        
        const totalHoursAbsent = currentMonthData.reduce((sum, item) => {
          return sum + this.hoursToDecimal(item.hours_absent || '0:00');
        }, 0);
        
        const absenteeismRate = this.calculateRate(totalHoursAbsent).toFixed(2);
        
        // Calculate trend compared to previous month
        const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
        const prevMonthData = absenteeismData.filter(item => {
          const itemDate = new Date(item.start_date);
          return itemDate.getMonth() === prevMonth && 
                itemDate.getFullYear() === prevYear;
        });
        
        const prevTotalHoursAbsent = prevMonthData.reduce((sum, item) => {
          return sum + this.hoursToDecimal(item.hours_absent || '0:00');
        }, 0);
        
        const prevAbsenteeismRate = this.calculateRate(prevTotalHoursAbsent);
        const trend = prevAbsenteeismRate === 0 ? 0 : 
          ((parseFloat(absenteeismRate) - prevAbsenteeismRate) / prevAbsenteeismRate * 100).toFixed(1);
        
        // Calculate cost impact
        const costImpact = this.calculateFinancialImpact(totalHoursAbsent)
          .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        
        return {
          absenteeismRate,
          totalAbsenceDays,
          employeesAbsent,
          costImpact,
          monthlyTrend,
          bySector,
          trend: parseFloat(trend)
        };
      } catch (err) {
        console.error('Error in getDashboardData:', err);
        throw err;
      }
    },
    
    // Calculate absenteeism rate
    calculateRate(totalHoursAbsent: number, period: 'day' | 'week' | 'month' = 'month'): number {
      // Default to monthly rate (220 hours per month)
      let totalWorkHours = 220;
      
      if (period === 'day') {
        totalWorkHours = 8; // 8 hours per day
      } else if (period === 'week') {
        totalWorkHours = 44; // 44 hours per week
      }
      
      return (totalHoursAbsent / totalWorkHours) * 100;
    },
    
    // Calculate financial impact
    calculateFinancialImpact(totalHoursAbsent: number, hourlyRate: number = 6.22): number {
      // Default hourly rate based on minimum wage (R$ 1,370 / 220 hours = R$ 6.22)
      return totalHoursAbsent * hourlyRate;
    },
    
    // Convert HH:MM format to decimal hours
    hoursToDecimal(hoursString: string): number {
      if (!hoursString) return 0;
      
      const [hours, minutes] = hoursString.split(':').map(Number);
      return hours + (minutes / 60);
    }
  },
  
  // API Configuration
  apiConfig: {
    async get(type: 'company' | 'employee' | 'absenteeism') {
      const { data, error } = await supabase
        .from('api_configs')
        .select('*')
        .eq('type', type)
        .maybeSingle();
        
      if (error) throw error;
      
      // If we have no data, return a default config
      if (!data) {
        return {
          type,
          empresa: '',
          codigo: '',
          chave: '',
          tipoSaida: 'json',
          isConfigured: false
        };
      }
      
      return {
        ...data,
        isConfigured: true
      };
    },
    
    async save(type: 'company' | 'employee' | 'absenteeism', config: any) {
      // Check if a config already exists for this type
      const { data: existingConfig } = await supabase
        .from('api_configs')
        .select('id')
        .eq('type', type)
        .maybeSingle();
        
      if (existingConfig) {
        // Update existing config
        const { data, error } = await supabase
          .from('api_configs')
          .update({
            ...config,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingConfig.id)
          .select();
          
        if (error) throw error;
        return data[0];
      } else {
        // Insert new config
        const { data, error } = await supabase
          .from('api_configs')
          .insert([{
            ...config,
            type
          }])
          .select();
          
        if (error) throw error;
        return data[0];
      }
    },
    
    async test(type: 'company' | 'employee' | 'absenteeism') {
      // Get the config
      const { data: configData } = await supabase
        .from('api_configs')
        .select('id')
        .eq('type', type)
        .maybeSingle();
        
      if (!configData) {
        throw new Error('Configuração não encontrada');
      }
      
      // Test the API by syncing a single record
      try {
        const response = await fetch('/api/soc-api', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
          },
          body: JSON.stringify({
            type,
            params: {},
            configId: configData.id
          })
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Falha ao testar API de ${type}`);
        }
        
        return {
          success: true,
          message: `Conexão com a API de ${type} estabelecida com sucesso!`
        };
      } catch (error: any) {
        console.error(`Error testing ${type} API:`, error);
        throw new Error(error.message || `Falha ao testar API de ${type}`);
      }
    }
  },
  
  // Sync Logs
  syncLogs: {
    async getAll() {
      const { data, error } = await supabase
        .from('sync_logs')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      return data || [];
    },
    
    async getByType(type: 'company' | 'employee' | 'absenteeism') {
      const { data, error } = await supabase
        .from('sync_logs')
        .select('*')
        .eq('type', type)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      return data || [];
    },
    
    async getLatest(type: 'company' | 'employee' | 'absenteeism') {
      const { data, error } = await supabase
        .from('sync_logs')
        .select('*')
        .eq('type', type)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
        
      if (error) throw error;
      return data;
    }
  }
};
