
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
    jobId?: string;
  } | null>(null);
  
  const [jobStatus, setJobStatus] = useState<{
    status: 'queued' | 'processing' | 'completed' | 'failed';
    progress: number;
    total?: number;
    processed?: number;
    error?: string;
  } | null>(null);
  
  // Poll for job status if we have an active job
  useEffect(() => {
    if (!syncResult?.jobId || jobStatus?.status === 'completed' || jobStatus?.status === 'failed') {
      return;
    }
    
    const interval = setInterval(async () => {
      try {
        const status = await apiService.sync.checkJobStatus(syncResult.jobId!);
        setJobStatus(status);
        
        if (status.status === 'completed' || status.status === 'failed') {
          clearInterval(interval);
          
          toast({
            variant: status.status === 'completed' ? 'default' : 'destructive',
            title: status.status === 'completed' ? 'Sincronização concluída' : 'Erro na sincronização',
            description: status.status === 'completed' 
              ? `Sincronização concluída com sucesso. ${status.processed} registros processados.`
              : `Erro durante a sincronização: ${status.error}`
          });
        }
      } catch (error) {
        console.error('Error checking job status:', error);
      }
    }, 2000);
    
    return () => clearInterval(interval);
  }, [syncResult?.jobId, jobStatus?.status, toast]);
  
  const handleSync = async (type: 'employee' | 'absenteeism') => {
    try {
      setSyncResult(null);
      setJobStatus(null);
      
      const typeLabel = type === 'employee' ? 'funcionários' : 'absenteísmo';
        
      toast({
        title: 'Sincronização iniciada',
        description: `Adicionando sincronização de ${typeLabel} à fila...`
      });
      
      let result;
      
      switch (type) {
        case 'employee':
          result = await apiService.sync.employees();
          break;
        case 'absenteeism':
          result = await apiService.sync.absenteeism();
          break;
      }
      
      setSyncResult({
        type: typeLabel,
        success: result.success,
        message: result.message,
        jobId: result.jobId
      });
      
      if (result.jobId) {
        setJobStatus({
          status: 'queued',
          progress: 0
        });
        
        toast({
          title: 'Sincronização em fila',
          description: `Sincronização de ${typeLabel} adicionada à fila de processamento.`
        });
      } else {
        toast({
          variant: result.success ? 'default' : 'destructive',
          title: result.success ? 'Sincronização concluída' : 'Erro na sincronização',
          description: result.message
        });
      }
      
      return result;
    } catch (error) {
      console.error(`Error during ${type} sync:`, error);
      
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      
      setSyncResult({
        type: type === 'employee' ? 'funcionários' : 'absenteísmo',
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
  
  const renderJobStatus = () => {
    if (!jobStatus) return null;
    
    const statusLabels = {
      queued: 'Em fila',
      processing: 'Processando',
      completed: 'Concluído',
      failed: 'Falhou'
    };
    
    const statusColors = {
      queued: 'bg-blue-100 text-blue-800',
      processing: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800'
    };
    
    return (
      <div className="space-y-4 mt-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[jobStatus.status]}`}>
              {statusLabels[jobStatus.status]}
            </span>
            <span className="text-sm text-muted-foreground">
              {jobStatus.processed && jobStatus.total 
                ? `${jobStatus.processed} de ${jobStatus.total} registros processados`
                : 'Aguardando início do processamento'}
            </span>
          </div>
          <span className="text-sm font-medium">{jobStatus.progress}%</span>
        </div>
        <Progress value={jobStatus.progress} className="h-2" />
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
              {renderJobStatus()}
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
