// src/components/sync/SyncLogItem.tsx
import React, { useState, useEffect } from 'react';
import { SyncLog } from '@/types/sync';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { 
  Ban, 
  CalendarDays, 
  CheckCircle2, 
  Clock, 
  Users, 
  AlertCircle,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { syncLogsService } from '@/services/syncLogsService';
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

interface SyncLogItemProps {
  log: SyncLog;
  onUpdate: () => void;
  onCancel?: () => void;
}

const SyncLogItem: React.FC<SyncLogItemProps> = ({ log, onUpdate, onCancel }) => {
  const { toast } = useToast();
  const [isCancelling, setIsCancelling] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState<string | null>(null);
  const [estimatedCompletion, setEstimatedCompletion] = useState<string | null>(null);
  
  // Update the time elapsed for active syncs
  useEffect(() => {
    let intervalId: number | null = null;
    
    if (isActiveSync) {
      // Immediately calculate elapsed time
      calculateTimeElapsed();
      
      // Set up interval to update elapsed time every second
      intervalId = window.setInterval(() => {
        calculateTimeElapsed();
      }, 1000);
    }
    
    return () => {
      if (intervalId !== null) {
        clearInterval(intervalId);
      }
    };
  }, [log]);
  
  const calculateTimeElapsed = () => {
    try {
      const startTime = new Date(log.started_at).getTime();
      const now = new Date().getTime();
      const elapsedMs = now - startTime;
      
      // Format time elapsed
      const seconds = Math.floor(elapsedMs / 1000) % 60;
      const minutes = Math.floor(elapsedMs / (1000 * 60)) % 60;
      const hours = Math.floor(elapsedMs / (1000 * 60 * 60));
      
      let timeString = '';
      if (hours > 0) {
        timeString = `${hours}h ${minutes}m ${seconds}s`;
      } else if (minutes > 0) {
        timeString = `${minutes}m ${seconds}s`;
      } else {
        timeString = `${seconds}s`;
      }
      
      setTimeElapsed(timeString);
      
      // Calculate estimated completion time if we have progress data
      if (log.processed_records && log.total_records && log.processed_records > 0) {
        const percentComplete = (log.processed_records / log.total_records);
        if (percentComplete > 0.05) { // Only estimate if we have at least 5% complete
          const totalEstimatedMs = elapsedMs / percentComplete;
          const remainingMs = totalEstimatedMs - elapsedMs;
          
          // Only show estimate if more than 30 seconds remaining
          if (remainingMs > 30000) {
            const remainingMinutes = Math.ceil(remainingMs / (1000 * 60));
            setEstimatedCompletion(`~${remainingMinutes} ${remainingMinutes === 1 ? 'minuto' : 'minutos'}`);
          } else {
            setEstimatedCompletion("menos de 1 minuto");
          }
        }
      }
    } catch (error) {
      console.error('Error calculating time elapsed:', error);
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
      case 'completed':
        return (
          <span className="flex items-center text-green-700 bg-green-50 rounded-full px-2.5 py-0.5 text-xs font-medium">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Concluído
          </span>
        );
      case 'pending':
      case 'in_progress':
      case 'processing':
      case 'queued':
      case 'started':
      case 'continues':
        return (
          <span className="flex items-center text-amber-700 bg-amber-50 rounded-full px-2.5 py-0.5 text-xs font-medium">
            <Clock className="w-3 h-3 mr-1" />
            {status === 'pending' ? 'Pendente' : 
             status === 'queued' ? 'Na Fila' : 
             status === 'started' ? 'Iniciado' : 
             status === 'continues' ? 'Continuando' : 'Em Progresso'}
          </span>
        );
      case 'error':
        return (
          <span className="flex items-center text-red-700 bg-red-50 rounded-full px-2.5 py-0.5 text-xs font-medium">
            <AlertCircle className="w-3 h-3 mr-1" />
            Erro
          </span>
        );
      case 'cancelled':
        return (
          <span className="flex items-center text-slate-700 bg-slate-100 rounded-full px-2.5 py-0.5 text-xs font-medium">
            <Ban className="w-3 h-3 mr-1" />
            Cancelado
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
  
  const isActiveSync = ['processing', 'in_progress', 'queued', 'started', 'continues'].includes(log.status);
  
  const calculateProgress = () => {
    if (!log.processed_records || !log.total_records) return 0;
    const progress = (log.processed_records / log.total_records) * 100;
    return Math.min(Math.max(progress, 0), 100);
  };
  
  const progressValue = calculateProgress();
  
  const handleCancelSync = async () => {
    if (!isActiveSync) return;
    
    try {
      setIsDialogOpen(false);
      setIsCancelling(true);
      console.log(`Attempting to cancel sync #${log.id}...`);
      
      const result = await syncLogsService.cancelSync(log.id);
      
      if (result.success) {
        toast({
          title: "Sincronização cancelada",
          description: "A operação de sincronização foi cancelada com sucesso."
        });
        
        // Give the backend a moment to update the status
        setTimeout(() => {
          if (onCancel) {
            onCancel();
          } else {
            onUpdate();
          }
        }, 1000);
      } else {
        throw new Error(result.message || 'Falha ao cancelar sincronização');
      }
    } catch (error) {
      console.error('Error cancelling sync:', error);
      toast({
        variant: "destructive",
        title: "Erro ao cancelar",
        description: error instanceof Error ? error.message : "Não foi possível cancelar a sincronização."
      });
    } finally {
      setIsCancelling(false);
    }
  };
  
  const calculateDuration = () => {
    if (!log.started_at || !log.completed_at) return null;
    
    try {
      const startTime = new Date(log.started_at).getTime();
      const endTime = new Date(log.completed_at).getTime();
      const durationMs = endTime - startTime;
      
      // Format duration
      const seconds = Math.floor(durationMs / 1000) % 60;
      const minutes = Math.floor(durationMs / (1000 * 60)) % 60;
      const hours = Math.floor(durationMs / (1000 * 60 * 60));
      
      if (hours > 0) {
        return `${hours}h ${minutes}m ${seconds}s`;
      } else if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
      } else {
        return `${seconds}s`;
      }
    } catch (error) {
      console.error('Error calculating duration:', error);
      return null;
    }
  };
  
  const duration = calculateDuration();
  
  const handleRetrySync = async () => {
    try {
      toast({
        title: "Tentando novamente",
        description: "Tentando retomar a sincronização..."
      });
      
      const result = await syncLogsService.retrySync(log.id);
      
      if (result.success) {
        toast({
          title: "Sincronização retomada",
          description: "A operação de sincronização foi retomada com sucesso."
        });
        
        // Refresh status
        setTimeout(() => {
          onUpdate();
        }, 1000);
      } else {
        throw new Error(result.message || 'Falha ao retomar sincronização');
      }
    } catch (error) {
      console.error('Error retrying sync:', error);
      toast({
        variant: "destructive",
        title: "Erro ao retomar",
        description: error instanceof Error ? error.message : "Não foi possível retomar a sincronização."
      });
    }
  };
  
  return (
    <div className={`border rounded-md p-4 mb-4 bg-white shadow-sm ${isActiveSync ? 'border-amber-300' : ''}`}>
      <div className="flex flex-col space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            {getTypeIcon(log.type)}
            <span className="font-medium">{getTypeName(log.type)}</span>
            {getStatusBadge(log.status)}
          </div>
          
          {isActiveSync ? (
            <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="text-red-600 border-red-200 hover:bg-red-50"
                  disabled={isCancelling}
                >
                  {isCancelling ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                      Cancelando...
                    </>
                  ) : (
                    <>
                      <Ban className="h-3.5 w-3.5 mr-1" />
                      Cancelar
                    </>
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancelar sincronização</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tem certeza que deseja cancelar esta sincronização? 
                    O processo será interrompido e os dados podem ficar incompletos.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Voltar</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleCancelSync}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Sim, cancelar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : log.status === 'error' ? (
            <Button 
              variant="outline" 
              size="sm"
              className="text-amber-600 border-amber-200 hover:bg-amber-50"
              onClick={handleRetrySync}
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              Tentar Novamente
            </Button>
          ) : null}
        </div>
        
        <div className="text-sm text-muted-foreground">
          {log.message || '-'}
        </div>
        
        {isActiveSync && log.total_records && log.processed_records !== undefined && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Progresso: {log.processed_records} de {log.total_records} registros</span>
              <span>{progressValue.toFixed(0)}%</span>
            </div>
            <Progress value={progressValue} className="h-2" />
            
            <div className="flex flex-wrap justify-between text-xs text-muted-foreground mt-1">
              {timeElapsed && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Tempo decorrido: {timeElapsed}
                </span>
              )}
              
              {estimatedCompletion && (
                <span className="flex items-center gap-1">
                  Tempo restante estimado: {estimatedCompletion}
                </span>
              )}
            </div>
            
            {log.batch !== undefined && log.total_batches && (
              <div className="text-xs text-muted-foreground">
                Lote: {log.batch} de {log.total_batches}
              </div>
            )}
          </div>
        )}
        
        <div className="flex flex-col sm:flex-row justify-between text-xs text-muted-foreground">
          <div>
            Iniciado: {formatDateTime(log.started_at)}
          </div>
          {log.completed_at && (
            <div className="flex items-center gap-1">
              Finalizado: {formatDateTime(log.completed_at)}
              {duration && (
                <span className="text-xs text-muted-foreground ml-2">
                  (Duração: {duration})
                </span>
              )}
            </div>
          )}
        </div>
        
        {log.error_details && (
          <div className="mt-2 text-xs p-2 bg-red-50 text-red-800 rounded border border-red-100 whitespace-pre-wrap">
            <div className="font-semibold">Detalhes do erro:</div>
            <div className="whitespace-pre-wrap break-words">{log.error_details}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SyncLogItem;
