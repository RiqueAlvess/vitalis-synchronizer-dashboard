import React, { useState, useEffect } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Loader2, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import apiService from '@/services/api';
import { syncLogsService, SyncLog } from '@/services/syncLogsService';

interface SyncLogsTableProps {
  onSync?: (type: 'company' | 'employee' | 'absenteeism') => Promise<void>;
}

const SyncLogsTable: React.FC<SyncLogsTableProps> = ({ onSync }) => {
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncType, setSyncType] = useState<string | null>(null);

  const fetchLogs = async () => {
    try {
      setIsLoading(true);
      const data = await syncLogsService.getLogs();
      setLogs(data);
    } catch (error) {
      console.error('Error fetching sync logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    
    // Poll for updates every 5 seconds if there's an in-progress sync
    const hasInProgressSync = logs.some(log => log.status === 'pending' || log.status === 'in_progress');
    
    if (hasInProgressSync) {
      const interval = setInterval(fetchLogs, 5000);
      return () => clearInterval(interval);
    }
  }, [logs]);

  const handleSync = async (type: 'company' | 'employee' | 'absenteeism') => {
    if (onSync) {
      setIsSyncing(true);
      setSyncType(type);
      try {
        await onSync(type);
        fetchLogs();
      } finally {
        setIsSyncing(false);
        setSyncType(null);
      }
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-500">Sucesso</Badge>;
      case 'error':
        return <Badge variant="destructive">Erro</Badge>;
      case 'in_progress':
        return <Badge className="bg-blue-500">Em andamento</Badge>;
      case 'pending':
        return <Badge variant="outline" className="border-blue-500 text-blue-500">Pendente</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'in_progress':
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      case 'pending':
        return <Clock className="h-5 w-5 text-blue-500" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'company':
        return 'Empresas';
      case 'employee':
        return 'Funcionários';
      case 'absenteeism':
        return 'Absenteísmo';
      default:
        return type;
    }
  };

  const calculateDuration = (startDate: string, endDate: string | null) => {
    if (!endDate) return 'Em andamento';
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    const durationMs = end.getTime() - start.getTime();
    
    const seconds = Math.floor(durationMs / 1000);
    
    if (seconds < 60) {
      return `${seconds} segundos`;
    }
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    return `${minutes} min ${remainingSeconds} seg`;
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium">Histórico de sincronização</h3>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleSync('company')}
            disabled={isSyncing}
          >
            {isSyncing && syncType === 'company' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Sincronizar Empresas
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleSync('employee')}
            disabled={isSyncing}
          >
            {isSyncing && syncType === 'employee' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Sincronizar Funcionários
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleSync('absenteeism')}
            disabled={isSyncing}
          >
            {isSyncing && syncType === 'absenteeism' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Sincronizar Absenteísmo
          </Button>
        </div>
      </div>
      
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px]">Status</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead className="w-[250px]">Data</TableHead>
            <TableHead>Duração</TableHead>
            <TableHead>Mensagem</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-8">
                <div className="flex justify-center items-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Carregando logs...</span>
                </div>
              </TableCell>
            </TableRow>
          ) : logs.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                Nenhum log de sincronização encontrado
              </TableCell>
            </TableRow>
          ) : (
            logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell>
                  <div className="flex items-center justify-center">
                    {getStatusIcon(log.status)}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{getTypeLabel(log.type)}</span>
                    <span className="text-xs text-muted-foreground mt-1">
                      {getStatusBadge(log.status)}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">Iniciado:</span>
                    <span className="text-sm">{formatDate(log.created_at)}</span>
                    
                    {log.completed_at && (
                      <>
                        <span className="font-medium mt-1">Concluído:</span>
                        <span className="text-sm">{formatDate(log.completed_at)}</span>
                      </>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {calculateDuration(log.created_at, log.completed_at)}
                </TableCell>
                <TableCell>
                  <div className="max-w-md truncate">
                    {log.message || 'Sem mensagem'}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default SyncLogsTable;
