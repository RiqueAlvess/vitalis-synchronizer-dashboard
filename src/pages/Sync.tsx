
import React, { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import SyncLogsTable from '@/components/integration/SyncLogsTable';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import apiService from '@/services/api';

const SyncPage = () => {
  const { toast } = useToast();
  const [syncResult, setSyncResult] = useState<{ 
    type: string; 
    success: boolean; 
    message: string;
  } | null>(null);
  
  const handleSync = async (type: 'employee' | 'absenteeism') => {
    try {
      setSyncResult(null);
      
      const typeLabel = type === 'employee' ? 'funcionários' : 'absenteísmo';
        
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
      }
      
      setSyncResult({
        type: typeLabel,
        success: result.success,
        message: result.message
      });
      
      toast({
        variant: result.success ? 'default' : 'destructive',
        title: result.success ? 'Sincronização concluída' : 'Erro na sincronização',
        description: result.message
      });
      
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
              {syncResult.success ? 'Sincronização concluída' : 'Erro na sincronização'}
            </AlertTitle>
            <AlertDescription>
              {syncResult.message}
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
