
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { SyncLog } from '@/types/sync';
import { syncLogsService } from '@/services/syncLogsService';
import { useToast } from '@/components/ui/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import SyncLogItem from './SyncLogItem';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const SyncHistory: React.FC = () => {
  const { toast } = useToast();
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isClearing, setIsClearing] = useState(false);
  
  const fetchLogs = async () => {
    try {
      setIsLoading(true);
      const syncLogs = await syncLogsService.getLogs();
      setLogs(syncLogs);
    } catch (error) {
      console.error('Error fetching sync logs:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar histórico',
        description: 'Não foi possível carregar o histórico de sincronização.'
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleClearHistory = async () => {
    try {
      setIsClearing(true);
      await syncLogsService.clearHistory();
      toast({
        title: 'Histórico limpo',
        description: 'O histórico de sincronização foi limpo com sucesso.'
      });
      fetchLogs(); // Recarregar lista após limpar
    } catch (error) {
      console.error('Error clearing sync history:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao limpar histórico',
        description: 'Não foi possível limpar o histórico de sincronização.'
      });
    } finally {
      setIsClearing(false);
    }
  };
  
  useEffect(() => {
    fetchLogs();
    
    // Atualização automática a cada 10 segundos para mostrar progresso
    const interval = setInterval(() => {
      // Somente recarregar automaticamente se houver sincronizações ativas
      const hasActiveSync = logs.some(log => 
        ['processing', 'in_progress', 'queued', 'started', 'continues'].includes(log.status)
      );
      
      if (hasActiveSync) {
        fetchLogs();
      }
    }, 5000);
    
    return () => clearInterval(interval);
  }, [logs]);
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xl font-bold">Histórico de Sincronização</CardTitle>
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchLogs} 
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-2 hidden sm:inline">Atualizar</span>
          </Button>
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant="outline" 
                size="sm"
                className="text-red-600 border-red-200 hover:bg-red-50"
                disabled={isClearing || logs.length === 0}
              >
                {isClearing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                <span className="ml-2 hidden sm:inline">Limpar</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Limpar histórico</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação vai remover todos os registros de sincronização concluídos, com erro ou cancelados.
                  Sincronizações em andamento não serão afetadas.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={handleClearHistory}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Limpar histórico
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          // Skeleton loading state
          <>
            {[1, 2, 3].map((_, index) => (
              <div key={index} className="border rounded-md p-4 mb-4">
                <div className="flex flex-col space-y-3">
                  <div className="flex justify-between">
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-6 w-24" />
                  </div>
                  <Skeleton className="h-4 w-full" />
                  <div className="flex justify-between">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                </div>
              </div>
            ))}
          </>
        ) : logs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Nenhum histórico de sincronização encontrado.
          </div>
        ) : (
          <div className="space-y-1">
            {logs.map((log) => (
              <SyncLogItem 
                key={log.id} 
                log={log} 
                onUpdate={fetchLogs}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SyncHistory;
