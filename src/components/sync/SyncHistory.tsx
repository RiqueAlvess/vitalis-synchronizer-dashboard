
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
import { RefreshCw, CalendarDays, Users, AlertCircle, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { SyncLog } from '@/types/sync';
import { Skeleton } from '@/components/ui/skeleton';
import { syncLogsService } from '@/services/syncLogsService';
import { Progress } from '@/components/ui/progress';

const SyncHistory = () => {
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const fetchLogs = async () => {
    try {
      setIsRefreshing(true);
      const syncLogs = await syncLogsService.getLogs();
      setLogs(syncLogs);
    } catch (error) {
      console.error('Error fetching sync logs:', error);
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
          <span className="flex items-center text-green-700 bg-green-50 rounded-full px-2.5 py-0.5 text-xs font-medium">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Concluído
          </span>
        );
      case 'queued':
      case 'started':
      case 'processing':
      case 'in_progress':
        return (
          <span className="flex items-center text-amber-700 bg-amber-50 rounded-full px-2.5 py-0.5 text-xs font-medium">
            {log.message && log.message.includes('%') ? (
              <span>{log.message.match(/(\d+)%/)?.[0] || 'Em Progresso'}</span>
            ) : (
              <>
                <Clock className="w-3 h-3 mr-1" />
                {status === 'queued' || status === 'started' ? 'Pendente' : 'Em Progresso'}
              </>
            )}
          </span>
        );
      case 'error':
        return (
          <span className="flex items-center text-red-700 bg-red-50 rounded-full px-2.5 py-0.5 text-xs font-medium">
            <AlertCircle className="w-3 h-3 mr-1" />
            Erro
          </span>
        );
      default:
        return <span className="text-xs">{status}</span>;
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

  const hasPendingSync = logs.some(log => 
    ['processing', 'in_progress', 'queued', 'started'].includes(log.status)
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium">Histórico de Sincronização</h3>
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
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-full">Mensagem</TableHead>
                <TableHead>Progresso</TableHead>
                <TableHead>Iniciado em</TableHead>
                <TableHead>Concluído em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default SyncHistory;
