
import React, { useState } from 'react';
import { SyncLog } from '@/types/sync';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Ban, CalendarDays, CheckCircle2, Clock, Users, AlertCircle } from 'lucide-react';
import { syncLogsService } from '@/services/syncLogsService';
import { useToast } from '@/components/ui/use-toast';

interface SyncLogItemProps {
  log: SyncLog;
  onUpdate: () => void;
}

const SyncLogItem: React.FC<SyncLogItemProps> = ({ log, onUpdate }) => {
  const { toast } = useToast();
  const [isCancelling, setIsCancelling] = useState(false);
  
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
      setIsCancelling(true);
      await syncLogsService.cancelSync(log.id);
      toast({
        title: "Sincronização cancelada",
        description: "A operação de sincronização foi cancelada com sucesso."
      });
      onUpdate();
    } catch (error) {
      console.error('Error cancelling sync:', error);
      toast({
        variant: "destructive",
        title: "Erro ao cancelar",
        description: "Não foi possível cancelar a sincronização."
      });
    } finally {
      setIsCancelling(false);
    }
  };
  
  return (
    <div className="border rounded-md p-4 mb-4 bg-white shadow-sm">
      <div className="flex flex-col space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            {getTypeIcon(log.type)}
            <span className="font-medium">{getTypeName(log.type)}</span>
            {getStatusBadge(log.status)}
          </div>
          
          {isActiveSync && (
            <Button 
              variant="outline" 
              size="sm"
              className="text-red-600 border-red-200 hover:bg-red-50"
              onClick={handleCancelSync}
              disabled={isCancelling}
            >
              <Ban className="h-3.5 w-3.5 mr-1" />
              {isCancelling ? 'Cancelando...' : 'Cancelar'}
            </Button>
          )}
        </div>
        
        <div className="text-sm text-muted-foreground">
          {log.message}
        </div>
        
        {isActiveSync && log.total_records && log.processed_records !== undefined && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Progresso: {log.processed_records} de {log.total_records} registros</span>
              <span>{progressValue.toFixed(0)}%</span>
            </div>
            <Progress value={progressValue} className="h-2" />
            
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
            <div>
              Finalizado: {formatDateTime(log.completed_at)}
            </div>
          )}
        </div>
        
        {log.error_details && (
          <div className="mt-2 text-xs p-2 bg-red-50 text-red-800 rounded border border-red-100">
            <div className="font-semibold">Detalhes do erro:</div>
            <div className="whitespace-pre-wrap break-words">{log.error_details}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SyncLogItem;
