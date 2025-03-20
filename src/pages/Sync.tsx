
import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import SyncLogsTable from '@/components/integration/SyncLogsTable';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import apiService from '@/services/api';
import { Progress } from '@/components/ui/progress';

const SyncPage = () => {
  const { toast } = useToast();
  const [syncResult, setSyncResult] = useState<{ 
    type: string; 
    success: boolean; 
    message: string;
    syncId?: number;
  } | null>(null);
  
  const [syncStatus, setSyncStatus] = useState<{
    status: 'queued' | 'started' | 'processing' | 'completed' | 'error';
    message: string;
    progress: number;
    error_details?: string;
  } | null>(null);
  
  // Consultar status da sincronização
  useEffect(() => {
    if (!syncResult?.syncId) {
      return;
    }
    
    const checkSyncStatus = async () => {
      try {
        console.log('Verificando status da sincronização:', syncResult.syncId);
        const status = await apiService.syncLogs.getById(syncResult.syncId!);
        console.log('Status da sincronização:', status);
        
        if (status) {
          // Calcular progresso com base no status
          let progress = 0;
          switch (status.status) {
            case 'queued':
              progress = 10;
              break;
            case 'started':
              progress = 20;
              break;
            case 'processing':
              progress = 50;
              break;
            case 'completed':
              progress = 100;
              break;
            case 'error':
              progress = 100;
              break;
          }
          
          setSyncStatus({
            status: status.status,
            message: status.message,
            progress: progress,
            error_details: status.error_details
          });
          
          // Parar de consultar quando a sincronização for concluída ou falhar
          if (status.status === 'completed' || status.status === 'error') {
            toast({
              variant: status.status === 'completed' ? 'default' : 'destructive',
              title: status.status === 'completed' ? 'Sincronização concluída' : 'Erro na sincronização',
              description: status.message
            });
            return;
          }
        }
      } catch (error) {
        console.error('Erro ao verificar status da sincronização:', error);
      }
    };
    
    // Verificar status imediatamente
    checkSyncStatus();
    
    // Configurar verificação periódica
    const interval = setInterval(checkSyncStatus, 3000); // Verificar a cada 3 segundos
    
    return () => clearInterval(interval);
  }, [syncResult?.syncId, toast]);
  
  const handleSync = async (type: 'employee' | 'absenteeism' | 'company') => {
    try {
      setSyncResult(null);
      setSyncStatus(null);
      
      const typeLabel = 
        type === 'employee' ? 'funcionários' : 
        type === 'absenteeism' ? 'absenteísmo' : 'empresas';
      
      toast({
        title: 'Sincronização iniciada',
        description: `Iniciando sincronização de ${typeLabel}...`
      });
      
      let result;
      
      switch (type) {
        case 'employee':
          result = await apiService.sync.employees();
          break;
        case 'absenteeism':
          result = await apiService.sync.absenteeism();
          break;
        case 'company':
          result = await apiService.sync.companies();
          break;
      }
      
      console.log('Resultado da sincronização:', result);
      
      if (!result) {
        throw new Error('Resposta vazia do servidor');
      }
      
      setSyncResult({
        type: typeLabel,
        success: result.success !== false,
        message: result.message || 'Sincronização iniciada',
        syncId: result.syncId
      });
      
      toast({
        variant: 'default',
        title: 'Sincronização em andamento',
        description: `Sincronização de ${typeLabel} iniciada. Você pode acompanhar o progresso nesta página.`
      });
      
      return result;
    } catch (error) {
      console.error(`Erro durante a sincronização de ${type}:`, error);
      
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      
      setSyncResult({
        type: type === 'employee' ? 'funcionários' : 
              type === 'absenteeism' ? 'absenteísmo' : 'empresas',
        success: false,
        message: errorMessage
      });
      
      toast({
        variant: 'destructive',
        title: 'Erro na sincronização',
        description: errorMessage
      });
      
      throw error;
    }
  };
  
  const renderSyncStatus = () => {
    if (!syncStatus) return null;
    
    const statusLabels = {
      queued: 'Em fila',
      started: 'Iniciado',
      processing: 'Processando',
      completed: 'Concluído',
      error: 'Erro'
    };
    
    const statusColors = {
      queued: 'bg-blue-100 text-blue-800',
      started: 'bg-blue-100 text-blue-800',
      processing: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      error: 'bg-red-100 text-red-800'
    };
    
    return (
      <div className="space-y-4 mt-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[syncStatus.status]}`}>
              {statusLabels[syncStatus.status]}
            </span>
            <span className="text-sm text-muted-foreground">
              {syncStatus.message}
            </span>
          </div>
          <span className="text-sm font-medium">{syncStatus.progress}%</span>
        </div>
        <Progress value={syncStatus.progress} className="h-2" />
        
        {syncStatus.error_details && (
          <div className="text-sm text-red-600 mt-2 p-2 bg-red-50 rounded overflow-auto max-h-32">
            <strong>Detalhes do erro:</strong>
            <pre className="text-xs mt-1">{syncStatus.error_details}</pre>
          </div>
        )}
      </div>
    );
  };
  
  return (
    <DashboardLayout 
      title="Sincronização" 
      subtitle="Sincronize dados com a API do SOC"
    >
      <div className="space-y-6">
        {syncResult && (
          <Alert variant={syncResult.success ? 'default' : 'destructive'}>
            {syncResult.success ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertTitle>
              {syncResult.success ? 'Sincronização em andamento' : 'Erro na sincronização'}
            </AlertTitle>
            <AlertDescription>
              {syncResult.message}
              {renderSyncStatus()}
            </AlertDescription>
          </Alert>
        )}
        
        <Card>
          <CardHeader>
            <CardTitle>Sincronização de Dados</CardTitle>
            <CardDescription>
              Sincronize dados da API do SOC para o sistema. É necessário configurar as APIs antes de realizar a sincronização.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SyncLogsTable onSync={handleSync} />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default SyncPage;
