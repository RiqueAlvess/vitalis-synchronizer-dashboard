
import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, RefreshCw, AlertCircle, CheckCircle2, Ban, InfoIcon } from 'lucide-react';
import apiService from '@/services/api';
import SyncHistory from '@/components/sync/SyncHistory';
import { useNavigate } from 'react-router-dom';
import { syncLogsService } from '@/services/syncLogsService';

const Sync = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [syncInProgress, setSyncInProgress] = useState(false);
  const [activeSyncProcesses, setActiveSyncProcesses] = useState<{count: number, types: string[]}>({ count: 0, types: [] });
  const [syncResult, setSyncResult] = useState<{type: string; success: boolean; message: string} | null>(null);
  
  // Verificar se há sincronizações ativas
  const checkActiveSyncs = async () => {
    try {
      const activeSyncs = await syncLogsService.getActiveSyncs();
      if (activeSyncs.count > 0) {
        setActiveSyncProcesses(activeSyncs);
      } else {
        setActiveSyncProcesses({ count: 0, types: [] });
      }
    } catch (error) {
      console.error('Error checking active syncs:', error);
    }
  };
  
  // Verificar sincronizações ativas ao carregar a página e a cada 5 segundos
  useEffect(() => {
    checkActiveSyncs();
    
    const interval = setInterval(() => {
      checkActiveSyncs();
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);
  
  const handleSync = async (type: 'employee' | 'absenteeism') => {
    try {
      // Verificar novamente se há sincronizações ativas
      await checkActiveSyncs();
      
      if (activeSyncProcesses.count > 0) {
        toast({
          variant: 'destructive',
          title: 'Sincronização já em andamento',
          description: `Já existe uma sincronização de ${activeSyncProcesses.types.join(', ')} em andamento. Aguarde a conclusão para iniciar uma nova.`,
        });
        return;
      }
      
      setSyncInProgress(true);
      setSyncResult(null);
      
      const typeLabels = {
        employee: 'funcionários',
        absenteeism: 'absenteísmo'
      };
      
      toast({
        title: `Sincronizando ${typeLabels[type]}`,
        description: 'A sincronização foi iniciada e pode levar alguns minutos.',
      });
      
      // Usando explicitamente cada método para evitar erros de função
      let result;
      if (type === 'employee') {
        // Iniciar sincronização com processamento em paralelo
        result = await apiService.sync.employees();
      } else if (type === 'absenteeism') {
        // Iniciar sincronização com processamento em paralelo
        result = await apiService.sync.absenteeism();
      } else {
        throw new Error(`Tipo de sincronização não suportado: ${type}`);
      }
      
      setSyncResult({
        type,
        success: true,
        message: `Sincronização de ${typeLabels[type]} iniciada com sucesso. Acompanhe o progresso no histórico abaixo.`
      });
      
      toast({
        title: 'Sincronização iniciada',
        description: `A sincronização de ${typeLabels[type]} foi iniciada com sucesso.`,
      });
      
      // Atualizar lista de sincronizações ativas
      checkActiveSyncs();
      
    } catch (error) {
      console.error(`Error syncing ${type}:`, error);
      
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      setSyncResult({
        type,
        success: false,
        message: `Falha ao iniciar sincronização: ${errorMsg}`
      });
      
      toast({
        variant: 'destructive',
        title: 'Erro na sincronização',
        description: `Não foi possível iniciar a sincronização. ${errorMsg}`,
      });
    } finally {
      setSyncInProgress(false);
    }
  };
  
  // Navegar para a página de funcionários após sincronização
  const handleViewEmployees = () => {
    navigate('/employees');
  };
  
  // Atualizar o histórico quando uma sincronização for concluída
  useEffect(() => {
    if (syncResult && syncResult.success) {
      // Aqui podemos implementar polling para verificar o status da sincronização se necessário
      const syncComponent = document.getElementById('sync-history');
      if (syncComponent) {
        syncComponent.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [syncResult]);
  
  return (
    <DashboardLayout
      title="Sincronização de Dados"
      subtitle="Sincronize dados do SOC com o Vitalis"
    >
      <div className="space-y-6">
        {activeSyncProcesses.count > 0 && (
          <Alert className="bg-amber-50 border-amber-200">
            <Ban className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-700">Sincronização em andamento</AlertTitle>
            <AlertDescription className="text-amber-600">
              Já existe uma sincronização de {activeSyncProcesses.types.join(', ')} em andamento. 
              Aguarde a conclusão ou cancele o processo atual para iniciar uma nova sincronização.
            </AlertDescription>
          </Alert>
        )}
        
        <Card>
          <CardHeader>
            <CardTitle>Iniciar Sincronização</CardTitle>
            <CardDescription>
              Escolha qual tipo de dados você deseja sincronizar do sistema SOC.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="employee" className="w-full">
              <TabsList className="grid grid-cols-2 mb-4">
                <TabsTrigger value="employee">Funcionários</TabsTrigger>
                <TabsTrigger value="absenteeism">Absenteísmo</TabsTrigger>
              </TabsList>
              
              <TabsContent value="employee" className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  Sincroniza os dados de todos os funcionários cadastrados no SOC, incluindo informações pessoais, cargos, setores e departamentos.
                </div>
                <Alert className="bg-blue-50 border-blue-100">
                  <InfoIcon className="h-4 w-4 text-blue-600" />
                  <AlertTitle className="text-blue-700">Processamento em paralelo</AlertTitle>
                  <AlertDescription className="text-blue-600">
                    A sincronização de funcionários agora é processada em lotes paralelos para maior eficiência, 
                    especialmente com grandes volumes de dados.
                  </AlertDescription>
                </Alert>
                <Button 
                  onClick={() => handleSync('employee')} 
                  disabled={syncInProgress || activeSyncProcesses.count > 0}
                  className="w-full"
                >
                  {syncInProgress ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sincronizando...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Sincronizar Funcionários
                    </>
                  )}
                </Button>
              </TabsContent>
              
              <TabsContent value="absenteeism" className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  Sincroniza os dados de absenteísmo (faltas, atestados, afastamentos) registrados no sistema SOC.
                </div>
                <Alert className="bg-blue-50 border-blue-100">
                  <InfoIcon className="h-4 w-4 text-blue-600" />
                  <AlertTitle className="text-blue-700">Processamento em paralelo</AlertTitle>
                  <AlertDescription className="text-blue-600">
                    A sincronização de absenteísmo agora é processada em lotes paralelos para maior eficiência, 
                    permitindo sincronização mais rápida de grandes volumes de dados.
                  </AlertDescription>
                </Alert>
                <Button 
                  onClick={() => handleSync('absenteeism')} 
                  disabled={syncInProgress || activeSyncProcesses.count > 0}
                  className="w-full"
                >
                  {syncInProgress ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sincronizando...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Sincronizar Absenteísmo
                    </>
                  )}
                </Button>
              </TabsContent>
            </Tabs>
          </CardContent>
          
          {syncResult && (
            <CardFooter className="flex flex-col items-start gap-4">
              <Alert variant={syncResult.success ? "default" : "destructive"}>
                {syncResult.success ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <AlertTitle>{syncResult.success ? 'Sincronização iniciada' : 'Erro na sincronização'}</AlertTitle>
                <AlertDescription>
                  {syncResult.message}
                </AlertDescription>
              </Alert>
              
              {syncResult.success && syncResult.type === 'employee' && (
                <Button 
                  variant="outline" 
                  onClick={handleViewEmployees}
                  className="self-end"
                >
                  Visualizar Funcionários
                </Button>
              )}
            </CardFooter>
          )}
        </Card>
        
        <div id="sync-history">
          <SyncHistory />
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Sync;
