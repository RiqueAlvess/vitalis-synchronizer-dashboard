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
import { RefreshCw, CalendarDays, Users, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { SyncLog } from '@/types/sync';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { syncLogsService } from '@/services/syncLogsService';

interface SyncLogsTableProps {
  onSync: (type: 'employee' | 'absenteeism') => Promise<any>;
}

const SyncLogsTable: React.FC<SyncLogsTableProps> = ({ onSync }) => {
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState<{ [key: string]: boolean }>({});

  const fetchLogs = async () => {
    try {
      setIsLoading(true);
      const syncLogs = await syncLogsService.getLogs();
      setLogs(syncLogs);
    } catch (error) {
      console.error('Error fetching sync logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleSync = async (type: 'employee' | 'absenteeism') => {
    try {
      setIsSyncing(prev => ({ ...prev, [type]: true }));
      await onSync(type);
      await fetchLogs(); // Refresh logs after sync
    } catch (error) {
      console.error(`Error syncing ${type}:`, error);
    } finally {
      setIsSyncing(prev => ({ ...prev, [type]: false }));
    }
  };

  const formatDateTime = (dateString: string) => {
    if (!dateString) return '-';
    try {
      return format(new Date(dateString), "dd/MM/yyyy 'às' HH:mm", { locale: pt });
    } catch (e) {
      console.error('Error formatting date:', e);
      return 'Data inválida';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return (
          <span className="flex items-center text-green-700 bg-green-50 rounded-full px-2.5 py-0.5 text-xs font-medium">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Sucesso
          </span>
        );
      case 'pending':
      case 'in_progress':
        return (
          <span className="flex items-center text-amber-700 bg-amber-50 rounded-full px-2.5 py-0.5 text-xs font-medium">
            <Clock className="w-3 h-3 mr-1" />
            {status === 'pending' ? 'Pendente' : 'Em Progresso'}
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

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-5 w-5 text-blue-500" />
              <h3 className="font-medium">Sincronizar Funcionários</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Sincronize dados de funcionários da API SOC.
            </p>
            <Button 
              onClick={() => handleSync('employee')} 
              disabled={isSyncing.employee}
              className="mt-auto"
            >
              {isSyncing.employee ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Sincronizando...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Sincronizar Funcionários
                </>
              )}
            </Button>
          </div>
        </Card>
        
        <Card className="p-5">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 mb-1">
              <CalendarDays className="h-5 w-5 text-purple-500" />
              <h3 className="font-medium">Sincronizar Absenteísmo</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Sincronize dados de absenteísmo da API SOC.
            </p>
            <Button 
              onClick={() => handleSync('absenteeism')} 
              disabled={isSyncing.absenteeism}
              className="mt-auto"
            >
              {isSyncing.absenteeism ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Sincronizando...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Sincronizar Absenteísmo
                </>
              )}
            </Button>
          </div>
        </Card>
      </div>
      
      <h3 className="text-lg font-medium mt-8 mb-4">Histórico de Sincronização</h3>
      
      {isLoading ? (
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
                <TableHead>Mensagem</TableHead>
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
                  <TableCell>{getStatusBadge(log.status)}</TableCell>
                  <TableCell>
                    <div className="max-w-md text-sm truncate" title={log.message}>
                      {log.message || '-'}
                    </div>
                  </TableCell>
                  <TableCell>{formatDateTime(log.started_at)}</TableCell>
                  <TableCell>{log.completed_at ? formatDateTime(log.completed_at) : '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      
      <div className="flex justify-end mt-4">
        <Button variant="outline" onClick={fetchLogs} disabled={isLoading}>
          {isLoading ? (
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
  );
};

export default SyncLogsTable;
