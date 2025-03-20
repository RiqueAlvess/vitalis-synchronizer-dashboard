// src/components/sync/SyncHistory.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, RefreshCw, AlertCircle, Trash2 } from 'lucide-react';
import { syncLogsService } from '@/services/syncLogsService';
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
import { SyncLog } from '@/types/sync';

interface SyncHistoryProps {
  forceRefresh?: boolean;
  onResetActiveSyncs?: () => Promise<void>;
}

const SyncHistory: React.FC<SyncHistoryProps> = ({ forceRefresh, onResetActiveSyncs }) => {
  const { toast } = useToast();
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isClearing, setIsClearing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeSyncCount, setActiveSyncCount] = useState(0);
  const intervalRef = useRef<number | null>(null);
  
  const fetchLogs = useCallback(async (showLoadingState = true) => {
    try {
      if (showLoadingState) {
        setIsRefreshing(true);
      }
      
      console.log('Fetching sync logs...');
      const syncLogs = await syncLogsService.getLogs();
      
      // Count active syncs
      const activeCount = syncLogs.filter(log => 
        ['processing', 'in_progress', 'queued', 'started', 'continues'].includes(log.status)
      ).length;
      
      setActiveSyncCount(activeCount);
      setLogs(syncLogs);
      
      return activeCount;
    } catch (error) {
      console.error('Error fetching sync logs:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar histórico',
        description: 'Não foi possível carregar o histórico de sincronização.',
        duration: 3000
      });
      return 0;
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [toast]);
  
  // Setup polling for active syncs
  const setupPolling = useCallback((hasActiveSyncs: boolean) => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    // Set up polling interval based on active syncs
    const interval = hasActiveSyncs ? 5000 : 30000; // 5 seconds if active, 30 seconds otherwise
    console.log(`Setting up polling interval: ${interval}ms`);
    
    intervalRef.current = window.setInterval(() => {
      fetchLogs(false); // Don't show loading state for automatic refreshes
    }, interval);
  }, [fetchLogs]);
  
  // Initial load and setup
  useEffect(() => {
    console.log('SyncHistory component mounted');
    fetchLogs().then(activeCount => {
      setupPolling(activeCount > 0);
    });
    
    return () => {
      console.log('SyncHistory component unmounting');
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [fetchLogs, setupPolling]);
  
  // Handle force refresh prop changes
  useEffect(() => {
    if (forceRefresh) {
      console.log('Force refreshing sync history...');
      fetchLogs().then(activeCount => {
        setupPolling(activeCount > 0);
      });
    }
  }, [forceRefresh, fetchLogs, setupPolling]);
  
  // Update polling interval when active sync count changes
  useEffect(() => {
    setupPolling(activeSyncCount > 0);
  }, [activeSyncCount, setupPolling]);
  
  const handleRefresh = async () => {
    const activeCount = await fetchLogs();
    setupPolling(activeCount > 0);
  };
  
  const handleClearHistory = async () => {
    try {
      setIsClearing(true);
      console.log('Starting clear history operation');
      
      const result = await syncLogsService.clearHistory();
      console.log('Clear history result:', result);
      
      if (result.success) {
        toast({
          title: 'Histórico limpo',
          description: result.message || 'O histórico de sincronização foi limpo com sucesso.',
          duration: 3000
        });
        
        // Refresh list after clearing
        await fetchLogs();
      } else {
        throw new Error(result.message || 'Falha ao limpar histórico');
      }
    } catch (error) {
      console.error('Error clearing sync history:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao limpar histórico',
        description: error instanceof Error ? error.message : 'Não foi possível limpar o histórico de sincronização.',
        duration: 5000
      });
    } finally {
      setIsClearing(false);
      setIsDialogOpen(false); // Close dialog after operation
    }
  };
  
  // Handle log updates from child components
  const handleLogUpdate = useCallback(async () => {
    await fetchLogs(false);
  }, [fetchLogs]);
  
  // Handle reset active syncs
  const handleResetActiveSyncs = async () => {
    if (onResetActiveSyncs) {
      await onResetActiveSyncs();
      
      // Refresh logs after reset
      setTimeout(() => {
        fetchLogs();
      }, 1000);
    } else {
      try {
        console.log('Resetting all active syncs from SyncHistory component...');
        await syncLogsService.resetActiveSyncs();
        
        toast({
          title: 'Sincronizações resetadas',
          description: 'Todas as sincronizações ativas foram canceladas.',
          duration: 3000
        });
        
        // Refresh logs after reset
        setTimeout(() => {
          fetchLogs();
        }, 1000);
      } catch (error) {
        console.error('Error resetting active syncs:', error);
        toast({
          variant: 'destructive',
          title: 'Erro ao resetar sincronizações',
          description: 'Não foi possível cancelar as sincronizações ativas.',
          duration: 5000
        });
      }
    }
  };
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xl font-bold">Histórico de Sincronização</CardTitle>
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh} 
            disabled={isRefreshing}
            className="flex items-center gap-1"
          >
            {isRefreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-1 hidden sm:inline">Atualizar</span>
          </Button>
          
          {activeSyncCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetActiveSyncs}
              className="text-red-600 border-red-200 hover:bg-red-50 flex items-center gap-1"
            >
              <AlertCircle className="h-4 w-4" />
              <span className="ml-1 hidden sm:inline">Cancelar Ativos</span>
            </Button>
          )}
          
          <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button 
                variant="outline" 
                size="sm"
                className="text-red-600 border-red-200 hover:bg-red-50 flex items-center gap-1"
                disabled={isClearing || logs.length === 0}
              >
                {isClearing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                <span className="ml-1 hidden sm:inline">Limpar</span>
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
                <AlertDialogCancel onClick={() => setIsDialogOpen(false)}>Cancelar</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={handleClearHistory}
                  className="bg-red-600 hover:bg-red-700"
                  disabled={isClearing}
                >
                  {isClearing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    'Limpar histórico'
                  )}
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
                onUpdate={handleLogUpdate}
                onCancel={handleLogUpdate}
              />
            ))}
          </div>
        )}
        
        {activeSyncCount > 0 && (
          <Alert className="mt-4 bg-blue-50 border-blue-100">
            <RefreshCw className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-blue-700">Atualizações automáticas</AlertTitle>
            <AlertDescription className="text-blue-600">
              Esta página está sendo atualizada automaticamente a cada 5 segundos enquanto houver sincronizações ativas.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default SyncHistory;
