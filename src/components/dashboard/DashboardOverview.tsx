
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { MetricCard } from "@/components/ui-custom/metrics/MetricCard";
import { AreaChartCard } from "@/components/ui-custom/charts/AreaChartCard";
import { DoughnutChartCard } from "@/components/ui-custom/charts/DoughnutChartCard";
import { DashboardData, MonthlyTrendData, SectorData } from '@/types/dashboard';
import apiService from '@/services/api';
import { Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

const DashboardOverview = () => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUsingMockData, setIsUsingMockData] = useState(false);

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('Fetching dashboard data...');
      const data = await apiService.dashboard.getAbsenteeismData();
      
      // This is a heuristic, since our mock data always returns 3.42%
      setIsUsingMockData(data.absenteeismRate === 3.42);
      
      // Ensure we have default values and correct property names for all needed properties
      const processedData: DashboardData = {
        absenteeismRate: data.absenteeismRate || 0,
        totalAbsenceDays: data.totalAbsenceDays || 0,
        employeesAbsent: data.employeesAbsent || 0,
        costImpact: data.costImpact || 'R$ 0,00',
        trend: data.trend || 'stable',
        
        // Map monthly trend data with correct property names
        monthlyTrend: (data.monthlyTrend || []).map((item: any) => ({
          month: item.month,
          value: item.value !== undefined ? item.value : (item.rate !== undefined ? item.rate : 0)
        })),
        
        // Map sector data with correct property names
        bySector: (data.bySector || []).map((item: any) => ({
          name: item.name !== undefined ? item.name : (item.sector !== undefined ? item.sector : 'Setor desconhecido'),
          value: item.value !== undefined ? item.value : (item.rate !== undefined ? item.rate : 0),
          count: item.count || 0
        })),
        
        topCIDs: data.topCIDs || []
      };
      
      setDashboardData(processedData);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setError('Não foi possível carregar os dados do dashboard.');
      
      // Use default mock data on error
      const mockData: DashboardData = {
        absenteeismRate: 0,
        totalAbsenceDays: 0,
        employeesAbsent: 0,
        costImpact: 'R$ 0,00',
        trend: 'neutral',
        monthlyTrend: [
          { month: 'Jan', value: 0 },
          { month: 'Fev', value: 0 },
          { month: 'Mar', value: 0 }
        ],
        bySector: [
          { name: 'Sem dados', value: 0, count: 0 }
        ],
        topCIDs: []
      };
      
      setDashboardData(mockData);
      setIsUsingMockData(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-vitalis-600" />
        <span className="ml-2">Carregando dados...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <AlertTriangle className="h-10 w-10 text-red-500 mx-auto mb-2" />
        <h3 className="text-lg font-medium text-red-800 mb-1">Erro ao carregar dados</h3>
        <p className="text-red-600 mb-4">{error}</p>
        <Button 
          onClick={fetchDashboardData} 
          variant="outline" 
          className="mx-auto flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
        <p className="text-gray-500">Nenhum dado disponível. Configure a integração para visualizar os dados de absenteísmo.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        title="Taxa de absenteísmo"
        value={`${dashboardData.absenteeismRate.toFixed(2)}%`}
        trend={dashboardData.trend}
        helpText={isUsingMockData ? "Dados de demonstração" : undefined}
      />
      <MetricCard
        title="Total de dias de ausência"
        value={dashboardData.totalAbsenceDays.toString()}
        trend={dashboardData.trend}
        helpText={isUsingMockData ? "Dados de demonstração" : undefined}
      />
      <MetricCard
        title="Funcionários ausentes"
        value={dashboardData.employeesAbsent.toString()}
        trend={dashboardData.trend}
        helpText={isUsingMockData ? "Dados de demonstração" : undefined}
      />
      <MetricCard
        title="Impacto do custo"
        value={dashboardData.costImpact}
        trend={dashboardData.trend}
        helpText={isUsingMockData ? "Dados de demonstração" : undefined}
      />

      <AreaChartCard
        title="Tendência mensal"
        data={dashboardData.monthlyTrend}
        dataKey="value"
        xAxisKey="month"
      />

      <DoughnutChartCard
        title="Absenteísmo por setor"
        data={dashboardData.bySector}
        dataKey="value"
        nameKey="name"
      />
    </div>
  );
};

export default DashboardOverview;
