
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-custom/Card';
import StatCard from '@/components/ui-custom/StatCard';
import apiService from '@/services/api';
import { BarChart3, Users, CalendarDays, DollarSign, AlertTriangle, RefreshCw, Info } from 'lucide-react';
import AbsenteeismChart from './AbsenteeismChart';
import AbsenteeismStats from './AbsenteeismStats';
import PremiumFeatures from './PremiumFeatures';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { DashboardData } from '@/types/dashboard';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

const DashboardOverview = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [isUsingMockData, setIsUsingMockData] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  
  // Premium mock data
  const [premiumData] = useState({
    byDayOfWeek: [
      { name: 'Segunda', value: 28 },
      { name: 'Terça', value: 22 },
      { name: 'Quarta', value: 19 },
      { name: 'Quinta', value: 25 },
      { name: 'Sexta', value: 32 },
      { name: 'Sábado', value: 10 },
      { name: 'Domingo', value: 5 },
    ],
    byGender: [
      { name: 'Masculino', value: 75 },
      { name: 'Feminino', value: 52 },
    ],
    byCid: [
      { name: 'J11 - Influenza', value: 18, cost: 6300 },
      { name: 'M54 - Dorsalgia', value: 15, cost: 5250 },
      { name: 'F41 - Ansiedade', value: 12, cost: 4200 },
      { name: 'K29 - Gastrite', value: 9, cost: 3150 },
      { name: 'H10 - Conjuntivite', value: 7, cost: 2450 },
    ],
  });

  // Check if user has premium
  useEffect(() => {
    if (user) {
      setIsPremium(user.isPremium || false);
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log("Fetching dashboard data...");
      const data = await apiService.getDashboardData();
      console.log("Dashboard data received:", data);
      
      if (!data) {
        throw new Error('Dados não recebidos');
      }
      
      // Check if we're using mock data by looking at the exact absenteeism rate value
      // This is a heuristic, since our mock data always returns 3.42%
      setIsUsingMockData(data.absenteeismRate === 3.42);
      
      // Ensure we have default values for all needed properties
      const processedData: DashboardData = {
        absenteeismRate: data.absenteeismRate || 0,
        totalAbsenceDays: data.totalAbsenceDays || 0,
        employeesAbsent: data.employeesAbsent || 0,
        costImpact: data.costImpact || 'R$ 0,00',
        trend: data.trend || 'stable',
        monthlyTrend: data.monthlyTrend || [],
        bySector: data.bySector || []
      };
      
      setDashboardData(processedData);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('Não foi possível carregar os dados do dashboard. Verifique a configuração da API.');
      // Only show error toast in development mode
      if (process.env.NODE_ENV === 'development') {
        toast({
          variant: 'destructive',
          title: 'Erro ao carregar dados',
          description: 'Não foi possível carregar os dados do dashboard. Verifique a configuração da API.'
        });
      }
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
  
  const handleConfigureAPI = () => {
    navigate('/settings');
  };
  
  const handleUpgradeToPremium = () => {
    toast({
      title: 'Recurso em desenvolvimento',
      description: 'O upgrade para o plano premium estará disponível em breve!',
    });
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Add refresh info and button */}
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          {lastRefresh && (
            <>Última atualização: {lastRefresh.toLocaleTimeString()}</>
          )}
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleRefresh} 
          disabled={isLoading}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

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
        ) : dashboardData ? (
          <>
            <StatCard 
              title="Taxa de Absenteísmo" 
              value={`${dashboardData.absenteeismRate.toFixed(2) || '0'}%`}
              description="Este mês"
              trend={dashboardData.trend === 'up' 
                ? { value: 5.2, positive: false } 
                : dashboardData.trend === 'down' 
                  ? { value: 3.8, positive: true } 
                  : undefined}
              icon={<BarChart3 className="h-5 w-5" />}
            />
            
            <StatCard 
              title="Dias de Ausência" 
              value={dashboardData.totalAbsenceDays || 0}
              description="Total do período"
              icon={<CalendarDays className="h-5 w-5" />}
            />
            
            <StatCard 
              title="Funcionários Ausentes" 
              value={dashboardData.employeesAbsent || 0}
              description="No período"
              icon={<Users className="h-5 w-5" />}
            />
            
            <StatCard 
              title="Impacto Financeiro" 
              value={dashboardData.costImpact || 'R$ 0,00'}
              description="Este mês"
              icon={<DollarSign className="h-5 w-5" />}
            />
          </>
        ) : (
          // Empty state when no data and not loading
          <>
            {Array.from({ length: 4 }).map((_, index) => (
              <Card key={index} className="p-6">
                <h3 className="text-sm font-medium text-muted-foreground mb-2">
                  {index === 0 ? "Taxa de Absenteísmo" : 
                   index === 1 ? "Dias de Ausência" : 
                   index === 2 ? "Funcionários Ausentes" : "Impacto Financeiro"}
                </h3>
                <p className="text-2xl font-bold">
                  {index === 0 ? "0.00%" : 
                   index === 1 ? "0" : 
                   index === 2 ? "0" : "R$ 0,00"}
                </p>
                <p className="text-xs text-muted-foreground">Sem dados</p>
              </Card>
            ))}
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
            ) : dashboardData?.monthlyTrend && dashboardData.monthlyTrend.length > 0 ? (
              <AbsenteeismChart data={dashboardData.monthlyTrend} />
            ) : (
              <div className="h-[300px] flex items-center justify-center flex-col">
                <p className="text-muted-foreground">Nenhum dado de evolução disponível</p>
                <Button 
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={handleRefresh}
                >
                  Tentar novamente
                </Button>
              </div>
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
            ) : dashboardData?.bySector && dashboardData.bySector.length > 0 ? (
              <div className="space-y-4">
                {dashboardData.bySector.map((sector, index) => (
                  <div key={index}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium">{sector.name || 'Setor desconhecido'}</span>
                      <span className="text-sm text-muted-foreground">{sector.value || 0} dias</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-vitalis-500"
                        style={{ 
                          width: `${(sector.value && dashboardData.bySector.some((s) => s.value > 0)) ? 
                            (sector.value / Math.max(...dashboardData.bySector.map((s) => s.value || 0))) * 100 : 0}%` 
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center">
                <p className="text-muted-foreground">Nenhum dado de setor disponível</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Premium Features Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <AbsenteeismStats 
            data={premiumData}
            isPremium={isPremium}
          />
        </div>
        
        <div>
          <PremiumFeatures 
            isPremium={isPremium}
            onUpgrade={handleUpgradeToPremium}
          />
        </div>
      </div>

      {/* Demo Data Notice - Show only if using mock data */}
      {isUsingMockData && !isLoading && (
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <Info className="h-6 w-6 text-amber-500 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-lg font-medium text-amber-800 mb-2">Dados de demonstração</h3>
                <p className="text-amber-700 mb-1">
                  Os dados mostrados são apenas para demonstração. Para visualizar dados reais, configure as APIs do SOC nas configurações do sistema.
                </p>
                <Button 
                  variant="outline" 
                  className="mt-3 bg-white border-amber-300 text-amber-800 hover:bg-amber-100"
                  onClick={handleConfigureAPI}
                >
                  Configurar API
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error state - Only show if there's an error and we're not using mock data */}
      {error && !isUsingMockData && !isLoading && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-red-400 mb-3" />
          <h3 className="text-lg font-medium text-red-800 mb-1">Erro ao carregar dados</h3>
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={handleRefresh} variant="outline" className="flex mx-auto items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Tentar novamente
          </Button>
        </div>
      )}
    </div>
  );
};

export default DashboardOverview;
