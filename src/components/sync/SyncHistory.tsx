
import React, { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, RefreshCw, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import apiService from '@/services/api';
import { useToast } from "@/components/ui/use-toast";

const formatDateTime = (dateStr: string) => {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    return format(date, 'dd/MM/yyyy \'às\' HH:mm', { locale: ptBR });
  } catch (e) {
    console.error('Error formatting date:', e);
    return dateStr;
  }
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'completed':
      return <Badge className="bg-green-500">Concluído</Badge>;
    case 'error':
      return <Badge variant="destructive">Erro</Badge>;
    case 'processing':
      return <Badge className="bg-blue-500">Processando</Badge>;
    case 'queued':
      return <Badge variant="outline">Na fila</Badge>;
    case 'started':
      return <Badge className="bg-yellow-500">Iniciado</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
};

const getTypeLabel = (type: string) => {
  switch (type) {
    case 'employee':
      return 'Funcionários';
    case 'absenteeism':
      return 'Absenteísmo';
    case 'company':
      return 'Empresas';
    default:
      return type;
  }
};

const StatusIcon = ({ status }: { status: string }) => {
  switch (status) {
    case 'completed':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'error':
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    case 'processing':
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    case 'queued':
      return <Clock className="h-4 w-4 text-gray-500" />;
    case 'started':
      return <Loader2 className="h-4 w-4 text-yellow-500 animate-spin" />;
    default:
      return null;
  }
};

const SyncHistory = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeLogId, setActiveLogId] = useState<number | null>(null);
  const { toast } = useToast();

  // Load sync logs
  const loadLogs = async () => {
    try {
      setIsRefreshing(true);
      const data = await apiService.syncLogs.getAll();
      setLogs(data || []);
    } catch (error) {
      console.error('Error loading sync logs:', error);
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

  useEffect(() => {
    loadLogs();
  }, []);

  // Auto-refresh logs in progress
  useEffect(() => {
    const inProgressLogs = logs.filter(log => 
      log.status === 'started' || log.status === 'processing' || log.status === 'queued'
    );
    
    if (inProgressLogs.length > 0) {
      const interval = setInterval(loadLogs, 5000);
      return () => clearInterval(interval);
    }
  }, [logs]);

  // Check details of a specific log
  const checkLogDetails = async (logId: number) => {
    if (activeLogId === logId) {
      setActiveLogId(null);
      return;
    }
    
    setActiveLogId(logId);
    
    try {
      // Refresh this specific log
      const updatedLog = await apiService.syncLogs.getById(logId);
      
      // Update this log in the array
      setLogs(prev => prev.map(log => 
        log.id === logId ? updatedLog : log
      ));
    } catch (error) {
      console.error(`Error fetching details for log ${logId}:`, error);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xl font-bold">Histórico de Sincronização</CardTitle>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={loadLogs}
          disabled={isRefreshing}
        >
          {isRefreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          <span className="ml-2">Atualizar</span>
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center items-center h-40">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center p-6 text-muted-foreground">
            Nenhuma sincronização realizada ainda.
          </div>
        ) : (
          <Table>
            <TableCaption>Histórico das últimas sincronizações</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Mensagem</TableHead>
                <TableHead>Iniciado em</TableHead>
                <TableHead>Concluído em</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <React.Fragment key={log.id}>
                  <TableRow 
                    className={activeLogId === log.id ? "bg-muted/50" : undefined}
                    onClick={() => checkLogDetails(log.id)}
                  >
                    <TableCell>
                      <div className="font-medium">{getTypeLabel(log.type)}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <StatusIcon status={log.status} />
                        <span>{getStatusBadge(log.status)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-md truncate">{log.message}</div>
                    </TableCell>
                    <TableCell>
                      {formatDateTime(log.started_at)}
                    </TableCell>
                    <TableCell>
                      {log.completed_at ? formatDateTime(log.completed_at) : '-'}
                    </TableCell>
                    <TableCell>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={(e) => {
                          e.stopPropagation();
                          checkLogDetails(log.id);
                        }}
                      >
                        {activeLogId === log.id ? 'Menos detalhes' : 'Mais detalhes'}
                      </Button>
                    </TableCell>
                  </TableRow>
                  
                  {activeLogId === log.id && log.error_details && (
                    <TableRow className="bg-muted/30">
                      <TableCell colSpan={6} className="p-4">
                        <div className="text-sm text-destructive">
                          <div className="font-semibold mb-1">Detalhes do erro:</div>
                          <pre className="text-xs overflow-auto p-2 bg-destructive/10 rounded whitespace-pre-wrap">
                            {log.error_details}
                          </pre>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default SyncHistory;
