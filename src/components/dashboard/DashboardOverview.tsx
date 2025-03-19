
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-custom/Card';
import StatCard from '@/components/ui-custom/StatCard';
import apiService from '@/services/api';
import { BarChart3, Users, CalendarDays, DollarSign, AlertTriangle, RefreshCw } from 'lucide-react';
import AbsenteeismChart from './AbsenteeismChart';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

const DashboardOverview = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const data = await apiService.getDashboardData();
      console.log("Dashboard data received:", data);
      
      if (!data) {
        throw new Error('Dados não recebidos');
      }
      
      // Ensure we have default values for all needed properties
      const processedData = {
        absenteeismRate: data.absenteeismRate || 0,
        totalAbsenceDays: data.totalAbsenceDays || 0,
        employeesAbsent: data.employeesAbsent || 0,
        costImpact: data.costImpact || 'R$ 0,00',
        trend: data.trend || 'stable',
        monthlyTrend: data.monthlyTrend || [],
        bySector: data.bySector || []
      };
      
      setDashboardData(processedData);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('Não foi possível carregar os dados do dashboard. Verifique a configuração da API.');
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar os dados do dashboard. Verifique a configuração da API.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleRefresh = () => {
    fetchDashboardData();
  };

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-red-400 mb-3" />
        <h3 className="text-lg font-medium text-red-800 mb-1">Erro ao carregar dados</h3>
        <p className="text-red-600 mb-4">{error}</p>
        <Button onClick={handleRefresh} variant="outline" className="flex mx-auto items-center gap-2">
          <RefreshCw className="h-4 w-4" />
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          <>
            {Array.from({ length: 4 }).map((_, index) => (
              <Card key={index} className="p-6">
                <Skeleton className="h-5 w-24 mb-3" />
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-4 w-32" />
              </Card>
            ))}
          </>
        ) : (
          <>
            <StatCard 
              title="Taxa de Absenteísmo" 
              value={`${dashboardData?.absenteeismRate?.toFixed(2) || '0'}%`}
              description="Este mês"
              trend={dashboardData?.trend}
              icon={<BarChart3 className="h-5 w-5" />}
            />
            
            <StatCard 
              title="Dias de Ausência" 
              value={dashboardData?.totalAbsenceDays || 0}
              description="Total do período"
              icon={<CalendarDays className="h-5 w-5" />}
            />
            
            <StatCard 
              title="Funcionários Ausentes" 
              value={dashboardData?.employeesAbsent || 0}
              description="No período"
              icon={<Users className="h-5 w-5" />}
            />
            
            <StatCard 
              title="Impacto Financeiro" 
              value={dashboardData?.costImpact || 'R$ 0,00'}
              description="Este mês"
              icon={<DollarSign className="h-5 w-5" />}
            />
          </>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Evolução do Absenteísmo</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <AbsenteeismChart data={dashboardData?.monthlyTrend || []} />
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Absenteísmo por Setor</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <div className="space-y-4">
                {dashboardData?.bySector && dashboardData.bySector.length > 0 ? (
                  dashboardData.bySector.map((sector: any, index: number) => (
                    <div key={index}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium">{sector.name || 'Setor desconhecido'}</span>
                        <span className="text-sm text-muted-foreground">{sector.value || 0} dias</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-vitalis-500"
                          style={{ 
                            width: `${(sector.value && dashboardData.bySector.some((s: any) => s.value > 0)) ? 
                              (sector.value / Math.max(...dashboardData.bySector.map((s: any) => s.value || 0))) * 100 : 0}%` 
                          }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    Nenhum dado de setor disponível
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardOverview;
