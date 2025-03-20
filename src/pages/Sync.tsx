// src/pages/Sync.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { 
  Loader2, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  Ban, 
  InfoIcon,
  Clock 
} from 'lucide-react';
import apiService from '@/services/api';
import SyncHistory from '@/components/sync/SyncHistory';
import { useNavigate } from 'react-router-dom';
import { syncLogsService } from '@/services/syncLogsService';
import { supabase } from '@/integrations/supabase/client';

const Sync = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [syncInProgress, setSyncInProgress] = useState(false);
  const [activeSyncProcesses, setActiveSyncProcesses] = useState<{count: number, types: string[], logs: any[]}>({ count: 0, types: [], logs: [] });
  const [syncResult, setSyncResult] = useState<{type: string; success: boolean; message: string} | null>(null);
  const [authStatus, setAuthStatus] = useState<any>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(false);
  const [isResettingSyncs, setIsResettingSyncs] = useState(false);
  const [shouldRefreshHistory, setShouldRefreshHistory] = useState(false);
  const checkIntervalRef = useRef<number | null>(null);
  const watchdogIntervalRef = useRef<number | null>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  
  // More robust activity check
  const checkActiveSyncs = useCallback(async () => {
    try {
      console.log('Checking active syncs...');
      const activeSyncs = await syncLogsService.getActiveSyncs();
      console.log('Active syncs result:', activeSyncs);
      
      // Only update state if there's a change to prevent unnecessary renders
      if (activeSyncProcesses.count !== activeSyncs.count || 
          JSON.stringify(activeSyncProcesses.types) !== JSON.stringify(activeSyncs.types)) {
        setActiveSyncProcesses(activeSyncs);
      }
      
      return activeSyncs;
    } catch (error) {
      console.error('Error checking active syncs:', error);
      setActiveSyncProcesses({ count: 0, types: [], logs: [] });
      return { count: 0, types: [], logs: [] };
    }
  }, [activeSyncProcesses.count, activeSyncProcesses.types]);
  
  // Set up watchdog to check for hung synchronizations
  const setupWatchdog = useCallback(() => {
    if (watchdogIntervalRef.current) {
      clearInterval(watchdogIntervalRef.current);
    }
    
    watchdogIntervalRef.current = window.setInterval(async () => {
      try {
        await syncLogsService.setupSyncWatchdog();
      } catch (error) {
        console.error('Error in sync watchdog:', error);
      }
    }, 5 * 60 * 1000); // Check every 5 minutes
  }, []);
  
  useEffect(() => {
    console.log('Sync component mounted');
    
    // Initial check for active syncs
    checkActiveSyncs();
    
    // Set up regular polling for active syncs
    if (!checkIntervalRef.current) {
      console.log('Setting up active sync check interval');
      checkIntervalRef.current = window.setInterval(() => {
        checkActiveSyncs();
      }, 10000); // Check every 10 seconds
    }
    
    // Setup the watchdog
    setupWatchdog();
    
    // Cleanup intervals on unmount
    return () => {
      console.log('Sync component unmounting, clearing intervals');
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
      
      if (watchdogIntervalRef.current) {
        clearInterval(watchdogIntervalRef.current);
        watchdogIntervalRef.current = null;
      }
    };
  }, [checkActiveSyncs, setupWatchdog]);
  
  // When shouldRefreshHistory changes, notify SyncHistory to refresh
  useEffect(() => {
    if (shouldRefreshHistory) {
      setShouldRefreshHistory(false);
    }
  }, [shouldRefreshHistory]);
  
  const handleSync = async (type: 'employee' | 'absenteeism') => {
    try {
      // First check for active syncs before starting a new one
      const activeSyncs = await checkActiveSyncs();
      
      if (activeSyncs.count > 0) {
        toast({
          variant: 'destructive',
          title: 'Sincronização já em andamento',
          description: `Já existe uma sincronização de ${activeSyncs.types.join(', ')} em andamento. Aguarde a conclusão para iniciar uma nova.`,
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
      
      console.log(`Starting ${type} sync...`);
      
      let result;
      if (type === 'employee') {
        result = await apiService.sync.employees();
      } else if (type === 'absenteeism') {
        result = await apiService.sync.absenteeism();
      } else {
        throw new Error(`Tipo de sincronização não suportado: ${type}`);
      }
      
      console.log(`Sync result:`, result);
      
      setSyncResult({
        type,
        success: true,
        message: `Sincronização de ${typeLabels[type]} iniciada com sucesso. Acompanhe o progresso no histórico abaixo.`
      });
      
      toast({
        title: 'Sincronização iniciada',
        description: `A sincronização de ${typeLabels[type]} foi iniciada com sucesso.`,
      });
      
      // Scroll to history section
      if (historyRef.current) {
        setTimeout(() => {
          historyRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 500);
      }
      
      // Update active syncs after starting
      setTimeout(() => checkActiveSyncs(), 1000);
      
      // Set flag to refresh history
      setShouldRefreshHistory(true);
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
  
  const handleResetActiveSyncs = async () => {
  try {
    setIsResettingSyncs(true);
    
    console.log('Attempting to reset all active syncs...');
    const result = await syncLogsService.resetActiveSyncs();
    
    console.log('Reset result:', result);
    
    if (result && result.success) {
      toast({
        title: 'Sincronizações resetadas',
        description: result.message || 'Todas as sincronizações ativas foram canceladas com sucesso.',
      });
      
      // Immediately check for active syncs
      await checkActiveSyncs();
      
      // Trigger history refresh
      setShouldRefreshHistory(true);
      
      // If there were any syncs in needs_continuation status, offer to restart them
      if (result.continuableSyncs && result.continuableSyncs.length > 0) {
        toast({
          title: 'Sincronizações continuáveis',
          description: `Existem ${result.continuableSyncs.length} sincronizações que podem ser retomadas.`,
          action: (
            <ToastAction altText="Retomar todas" onClick={() => handleRetryAllSyncs(result.continuableSyncs)}>
              Retomar todas
            </ToastAction>
          ),
        });
      }
    } else {
      throw new Error(result?.message || 'Erro desconhecido ao resetar sincronizações');
    }
  } catch (error) {
    console.error('Error resetting active syncs:', error);
    toast({
      variant: 'destructive',
      title: 'Erro ao resetar sincronizações',
      description: error instanceof Error ? error.message : 'Não foi possível cancelar todas as sincronizações ativas.',
    });
  } finally {
    setIsResettingSyncs(false);
  }
};

// Adicione esta nova função para tentar retomar todas as sincronizações continuáveis
const handleRetryAllSyncs = async (syncIds: number[]) => {
  try {
    setSyncInProgress(true);
    
    const results = [];
    for (const syncId of syncIds) {
      try {
        const result = await syncLogsService.retrySync(syncId);
        results.push(result);
        
        // Pequeno delay entre as tentativas para evitar sobrecarregar
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (err) {
        console.error(`Error retrying sync ${syncId}:`, err);
        results.push({ 
          success: false, 
          syncId, 
          error: err instanceof Error ? err.message : 'Erro desconhecido' 
        });
      }
    }
    
    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;
    
    toast({
      title: 'Retomada de sincronizações',
      description: `${successful} sincronizações retomadas com sucesso, ${failed} falhas.`,
    });
    
    // Refresh the sync history
    setShouldRefreshHistory(true);
    
  } catch (error) {
    console.error('Error retrying syncs:', error);
    toast({
      variant: 'destructive',
      title: 'Erro ao retomar sincronizações',
      description: error instanceof Error ? error.message : 'Falha ao tentar retomar sincronizações',
    });
  } finally {
    setSyncInProgress(false);
  }
};
  
  const handleViewEmployees = () => {
    navigate('/employees');
  };
  
  const checkAuthStatus = async () => {
    try {
      setIsCheckingAuth(true);
      
      const { diagnoseAuthIssues } = await import('@/integrations/supabase/client');
      
      const result = await diagnoseAuthIssues();
      console.log('Auth diagnosis result:', result);
      
      setAuthStatus(result);
      
      if (result.success) {
        toast({
          title: 'Autenticação válida',
          description: 'Seu token de autenticação está funcionando corretamente.',
        });
      } else {
        try {
          console.log('Attempting to refresh authentication...');
          const { error } = await supabase.auth.refreshSession();
          if (error) {
            console.error('Error refreshing session:', error);
            toast({
              variant: 'destructive',
              title: 'Problema de autenticação',
              description: 'Há problemas com sua autenticação que não puderam ser corrigidos automaticamente. Tente fazer login novamente.',
            });
          } else {
            toast({
              title: 'Autenticação renovada',
              description: 'Tentamos renovar sua autenticação. Por favor, tente novamente a operação.',
            });
            const newResult = await diagnoseAuthIssues();
            setAuthStatus(newResult);
          }
        } catch (refreshError) {
          console.error('Error during authentication refresh:', refreshError);
          toast({
            variant: 'destructive',
            title: 'Problema de autenticação',
            description: 'Há problemas com sua autenticação. Verifique os detalhes no console e tente fazer login novamente.',
          });
        }
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
      setAuthStatus({
        success: false,
        message: error instanceof Error ? error.message : 'Erro ao verificar autenticação'
      });
      
      toast({
        variant: 'destructive',
        title: 'Erro de autenticação',
        description: 'Não foi possível verificar o status da autenticação.',
      });
    } finally {
      setIsCheckingAuth(false);
    }
  };
  
  return (
    <DashboardLayout
      title="Sincronização de Dados"
      subtitle="Sincronize dados do SOC com o Vitalis"
    >
      <div className="space-y-6">
        {activeSyncProcesses.count > 0 && (
          <Alert className="bg-amber-50 border-amber-200">
            <Clock className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-700">Sincronização em andamento</AlertTitle>
            <AlertDescription className="flex flex-col space-y-2 text-amber-600">
              <p>
                Existe {activeSyncProcesses.count > 1 ? 'existem' : 'existe'} {activeSyncProcesses.count} sincronização(ões) de {activeSyncProcesses.types.join(', ')} em andamento. 
                Aguarde a conclusão ou cancele o processo atual para iniciar uma nova sincronização.
              </p>
              <Button 
                variant="outline" 
                size="sm" 
                className="self-end text-red-600 border-red-200 hover:bg-red-50 mt-2 w-auto"
                onClick={handleResetActiveSyncs}
                disabled={isResettingSyncs}
              >
                {isResettingSyncs ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Ban className="h-3.5 w-3.5 mr-1" />
                    Cancelar todas sincronizações
                  </>
                )}
              </Button>
            </AlertDescription>
          </Alert>
        )}
        
        <Card>
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              <span>Iniciar Sincronização</span>
              <Button 
                variant="outline" 
                size="sm"
                onClick={checkAuthStatus}
                disabled={isCheckingAuth}
              >
                {isCheckingAuth ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Verificar Autenticação
                  </>
                )}
              </Button>
            </CardTitle>
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
                    A sincronização de funcionários é processada em lotes paralelos para maior eficiência, 
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
                    A sincronização de absenteísmo é processada em lotes paralelos para maior eficiência, 
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
          
          {authStatus && (
            <CardFooter className="pt-0">
              <Alert variant={authStatus.success ? "default" : "destructive"} className="w-full">
                {authStatus.success ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <AlertTitle>Status da Autenticação</AlertTitle>
                <AlertDescription className="mt-2">
                  <div className="text-sm">
                    {authStatus.success 
                      ? `Autenticação válida para o usuário: ${authStatus.user?.email}` 
                      : 'Problemas na autenticação. Tente fazer login novamente.'}
                  </div>
                  
                  {!authStatus.success && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => navigate('/login')}
                      className="mt-2"
                    >
                      Fazer Login Novamente
                    </Button>
                  )}
                </AlertDescription>
              </Alert>
            </CardFooter>
          )}
        </Card>
        
        <div id="sync-history" ref={historyRef}>
          <SyncHistory 
            forceRefresh={shouldRefreshHistory}
            onResetActiveSyncs={handleResetActiveSyncs}
          />
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Sync;
