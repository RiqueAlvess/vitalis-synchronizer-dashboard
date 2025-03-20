
import React, { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import apiService from '@/services/api';
import SyncHistory from '@/components/sync/SyncHistory';

const Sync = () => {
  const { toast } = useToast();
  const [syncInProgress, setSyncInProgress] = useState(false);
  const [syncResult, setSyncResult] = useState<{type: string; success: boolean; message: string} | null>(null);
  
  const handleSync = async (type: 'employee' | 'absenteeism') => {
    try {
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
      
      // Corrigindo o erro de chamada de método
      let result;
      if (type === 'employee') {
        result = await apiService.sync.employees();
      } else if (type === 'absenteeism') {
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
  
  return (
    <DashboardLayout
      title="Sincronização de Dados"
      subtitle="Sincronize dados do SOC com o Vitalis"
    >
      <div className="space-y-6">
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
                <Button 
                  onClick={() => handleSync('employee')} 
                  disabled={syncInProgress}
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
                <Button 
                  onClick={() => handleSync('absenteeism')} 
                  disabled={syncInProgress}
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
            <CardFooter>
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
            </CardFooter>
          )}
        </Card>
        
        <SyncHistory />
      </div>
    </DashboardLayout>
  );
};

export default Sync;
