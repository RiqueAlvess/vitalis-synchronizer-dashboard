
import React, { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { 
  RefreshCw, 
  CalendarDays, 
  Users, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Loader2,
  ChevronDown,
  ChevronRight,
  Trash2,
  StopCircle,
  XCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { SyncLog } from '@/types/sync';
import { Skeleton } from '@/components/ui/skeleton';
import { syncLogsService } from '@/services/syncLogsService';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
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
import apiService from '@/services/api';

const SyncHistory = () => {
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedLogs, setExpandedLogs] = useState<Record<number, boolean>>({});
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCancelling, setIsCancelling] = useState<Record<number, boolean>>({});
  const { toast } = useToast();
  
  // Organizar logs por grupos de sincronização
  const organizeLogsByGroup = (logs: SyncLog[]): Record<string, SyncLog[]> => {
    const groups: Record<string, SyncLog[]> = {};
    
    logs.forEach(log => {
      // Usar parent_id para agrupar, ou o próprio ID se for pai
      const groupId = log.parent_id?.toString() || log.id.toString();
      
      if (!groups[groupId]) {
        groups[groupId] = [];
      }
      
      groups[groupId].push(log);
    });
    
    return groups;
  };
  
  // Obter os logs principais (aqueles sem parent_id)
  const getParentLogs = (logs: SyncLog[]): SyncLog[] => {
    return logs.filter(log => !log.parent_id);
  };
  
  // Obter logs filhos de um log específico
  const getChildLogs = (logs: SyncLog[], parentId: number): SyncLog[] => {
    return logs.filter(log => log.parent_id === parentId);
  };
  
  const fetchLogs = async () => {
    try {
      setIsRefreshing(true);
      const syncLogs = await syncLogsService.getLogs();
      setLogs(syncLogs);
    } catch (error) {
      console.error('Error fetching sync logs:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar histórico',
        description: 'Não foi possível carregar o histórico de sincronização.',
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Auto-refresh logs every 5 segundos to show updated status
  useEffect(() => {
    fetchLogs();
    
    // Set up auto-refresh interval
    const interval = setInterval(() => {
      fetchLogs();
    }, 5000); // 5 segundos
    
    return () => clearInterval(interval);
  }, []);

  const formatDateTime = (dateString: string) => {
    if (!dateString) return '-';
    try {
      return format(new Date(dateString), "dd/MM/yyyy 'às' HH:mm", { locale: pt });
    } catch (e) {
      console.error('Error formatting date:', e);
      return 'Data inválida';
    }
  };

  const getProgressValue = (log: SyncLog) => {
    if (log.status === 'completed') return 100;
    if (log.status === 'queued' || log.status === 'started') return 10;
    if (log.status === 'error') return 0;
    
    // Try to extract progress from message
    if (log.message) {
      const progressMatch = log.message.match(/(\d+)%/);
      if (progressMatch && progressMatch[1]) {
        return parseInt(progressMatch[1], 10);
      }
      
      const countMatch = log.message.match(/Processed (\d+) of (\d+)/i);
      if (countMatch && countMatch[1] && countMatch[2]) {
        const processed = parseInt(countMatch[1], 10);
        const total = parseInt(countMatch[2], 10);
        if (!isNaN(processed) && !isNaN(total) && total > 0) {
          return Math.round((processed / total) * 100);
        }
      }
    }
    
    // Default value for processing status
    return log.status === 'processing' || log.status === 'in_progress' ? 50 : 0;
  };

  const getStatusBadge = (log: SyncLog) => {
    const status = log.status;
    
    switch (status) {
      case 'completed':
        return (
          <Badge variant="outline" className="flex items-center bg-green-50 text-green-700 border-green-200 gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Concluído
          </Badge>
        );
      case 'queued':
      case 'started':
      case 'processing':
      case 'in_progress':
        return (
          <Badge variant="outline" className="flex items-center bg-amber-50 text-amber-700 border-amber-200 gap-1">
            {log.message && log.message.includes('%') ? (
              <span>{log.message.match(/(\d+)%/)?.[0] || 'Em Progresso'}</span>
            ) : (
              <>
                <Clock className="w-3 h-3" />
                {status === 'queued' || status === 'started' ? 'Pendente' : 'Em Progresso'}
              </>
            )}
          </Badge>
        );
      case 'continues':
        return (
          <Badge variant="outline" className="flex items-center bg-blue-50 text-blue-700 border-blue-200 gap-1">
            <RefreshCw className="w-3 h-3" />
            Continuando
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="outline" className="flex items-center bg-red-50 text-red-700 border-red-200 gap-1">
            <AlertCircle className="w-3 h-3" />
            Erro
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge variant="outline" className="flex items-center bg-gray-50 text-gray-700 border-gray-200 gap-1">
            <XCircle className="w-3 h-3" />
            Cancelado
          </Badge>
        );
      default:
        return <Badge variant="outline" className="text-xs">{status}</Badge>;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'employee':
        return <Users className="h-4 w-4 text-blue-500" />;
      case 'absenteeism':
        return <CalendarDays className="h-4 w-4 text-purple-500" />;
      default:
        return null;
    }
  };

  const getTypeName = (type: string) => {
    switch (type) {
      case 'employee':
        return 'Funcionários';
      case 'absenteeism':
        return 'Absenteísmo';
      default:
        return type;
    }
  };
  
  // Verificar se há sincronização ativa para o usuário atual
  const hasActiveSyncProcess = () => {
    return logs.some(log => 
      ['processing', 'in_progress', 'queued', 'started', 'continues'].includes(log.status)
    );
  };
  
  // Verificar se o log específico está em processamento
  const isLogProcessing = (log: SyncLog) => {
    return ['processing', 'in_progress', 'queued', 'started', 'continues'].includes(log.status);
  };
  
  // Cancelar processo de sincronização
  const cancelSyncProcess = async (logId: number) => {
    try {
      setIsCancelling(prev => ({ ...prev, [logId]: true }));
      
      // Chamar API para cancelar processo
      await apiService.sync.cancelSync(logId);
      
      toast({
        title: 'Processo cancelado',
        description: 'O processo de sincronização foi cancelado com sucesso.',
      });
      
      // Atualizar lista após cancelamento
      fetchLogs();
    } catch (error) {
      console.error('Error cancelling sync process:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao cancelar',
        description: 'Não foi possível cancelar o processo de sincronização.',
      });
    } finally {
      setIsCancelling(prev => ({ ...prev, [logId]: false }));
    }
  };
  
  // Limpar histórico de sincronização
  const clearSyncHistory = async () => {
    try {
      setIsDeleting(true);
      
      // Verificar se há processos ativos
      if (hasActiveSyncProcess()) {
        toast({
          variant: 'destructive',
          title: 'Operação não permitida',
          description: 'Existem processos de sincronização ativos. Cancele-os antes de limpar o histórico.',
        });
        return;
      }
      
      // Chamar API para limpar histórico
      await syncLogsService.clearHistory();
      
      toast({
        title: 'Histórico limpo',
        description: 'O histórico de sincronização foi limpo com sucesso.',
      });
      
      // Atualizar lista após limpeza
      setLogs([]);
    } catch (error) {
      console.error('Error clearing sync history:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao limpar histórico',
        description: 'Não foi possível limpar o histórico de sincronização.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const hasPendingSync = logs.some(log => 
    ['processing', 'in_progress', 'queued', 'started'].includes(log.status)
  );
  
  // Organiza logs em grupos
  const parentLogs = getParentLogs(logs);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium">Histórico de Sincronização</h3>
        <div className="flex gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant="outline" 
                size="sm"
                disabled={isDeleting || logs.length === 0}
                className="flex items-center gap-1"
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Limpar Histórico
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Limpar histórico de sincronização</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação irá remover todos os registros de sincronização concluídos ou com erro.
                  {hasActiveSyncProcess() && (
                    <p className="mt-2 text-amber-500 font-medium">
                      Atenção: Existem processos de sincronização ativos que não serão afetados.
                    </p>
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={clearSyncHistory}>
                  Limpar Histórico
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          
          <Button variant="outline" onClick={fetchLogs} disabled={isRefreshing} size="sm">
            {isRefreshing ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Atualizando...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Atualizar
              </>
            )}
          </Button>
        </div>
      </div>
      
      {hasPendingSync && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
          <div className="flex items-center mb-2">
            <Loader2 className="h-5 w-5 text-amber-600 animate-spin mr-2" />
            <h4 className="font-medium text-amber-700">Sincronização em andamento</h4>
          </div>
          <p className="text-sm text-amber-600 mb-2">
            Uma ou mais sincronizações estão sendo processadas. Os dados serão atualizados automaticamente.
          </p>
          <div className="text-xs text-amber-600">
            A página será atualizada automaticamente a cada 5 segundos.
          </div>
        </div>
      )}
      
      {isLoading && logs.length === 0 ? (
        Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="flex items-center space-x-4 mb-4">
            <Skeleton className="h-12 w-full rounded" />
          </div>
        ))
      ) : logs.length === 0 ? (
        <div className="text-center py-8 border rounded-lg">
          <p className="text-muted-foreground">Nenhum registro de sincronização encontrado</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-6"></TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-full">Mensagem</TableHead>
                <TableHead>Progresso</TableHead>
                <TableHead>Iniciado em</TableHead>
                <TableHead>Concluído em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {parentLogs.map((log) => {
                const childLogs = getChildLogs(logs, log.id);
                const hasChildren = childLogs.length > 0;
                const isExpanded = expandedLogs[log.id] || false;
                const isProcessing = isLogProcessing(log);

                return (
                  <React.Fragment key={log.id}>
                    <TableRow className={hasChildren ? "border-b-0" : ""}>
                      <TableCell>
                        {hasChildren ? (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 p-0"
                            onClick={() => setExpandedLogs({...expandedLogs, [log.id]: !isExpanded})}
                          >
                            {isExpanded ? 
                              <ChevronDown className="h-4 w-4" /> : 
                              <ChevronRight className="h-4 w-4" />
                            }
                          </Button>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getTypeIcon(log.type)}
                          <span>{getTypeName(log.type)}</span>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(log)}</TableCell>
                      <TableCell>
                        <div className="max-w-md text-sm truncate" title={log.message}>
                          {log.message || '-'}
                        </div>
                      </TableCell>
                      <TableCell className="w-24">
                        <Progress value={getProgressValue(log)} className="h-2 w-full" />
                      </TableCell>
                      <TableCell>{formatDateTime(log.started_at)}</TableCell>
                      <TableCell>{log.completed_at ? formatDateTime(log.completed_at) : '-'}</TableCell>
                      <TableCell className="text-right">
                        {isProcessing && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-2 text-xs"
                            onClick={() => cancelSyncProcess(log.id)}
                            disabled={isCancelling[log.id]}
                          >
                            {isCancelling[log.id] ? (
                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            ) : (
                              <StopCircle className="h-3 w-3 mr-1" />
                            )}
                            Cancelar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                    
                    {/* Exibir logs filhos quando expandido */}
                    {isExpanded && hasChildren && childLogs.map(childLog => {
                      const isChildProcessing = isLogProcessing(childLog);
                      
                      return (
                        <TableRow key={childLog.id} className="bg-muted/30">
                          <TableCell></TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 pl-4">
                              <div className="h-4 w-0.5 bg-muted-foreground/20 mr-2"></div>
                              <span className="text-xs">Continuação</span>
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(childLog)}</TableCell>
                          <TableCell>
                            <div className="max-w-md text-sm truncate" title={childLog.message}>
                              {childLog.message || '-'}
                            </div>
                          </TableCell>
                          <TableCell className="w-24">
                            <Progress value={getProgressValue(childLog)} className="h-2 w-full" />
                          </TableCell>
                          <TableCell>{formatDateTime(childLog.started_at)}</TableCell>
                          <TableCell>{childLog.completed_at ? formatDateTime(childLog.completed_at) : '-'}</TableCell>
                          <TableCell className="text-right">
                            {isChildProcessing && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 px-2 text-xs"
                                onClick={() => cancelSyncProcess(childLog.id)}
                                disabled={isCancelling[childLog.id]}
                              >
                                {isCancelling[childLog.id] ? (
                                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                ) : (
                                  <StopCircle className="h-3 w-3 mr-1" />
                                )}
                                Cancelar
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default SyncHistory;
