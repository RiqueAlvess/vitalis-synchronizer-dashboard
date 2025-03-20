
import React from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import EmployeeList from '@/components/dashboard/EmployeeList';
import { Button } from "@/components/ui/button";
import { RefreshCw } from 'lucide-react';
import apiService from '@/services/api';
import { useToast } from "@/components/ui/use-toast";

const Employees = () => {
  const { toast } = useToast();
  
  const handleSync = async () => {
    try {
      toast({
        title: 'Sincronizando funcionários',
        description: 'A sincronização foi iniciada e pode levar alguns minutos.',
      });
      
      await apiService.sync.employees();
      
      toast({
        title: 'Sincronização iniciada',
        description: 'A sincronização dos dados de funcionários foi iniciada com sucesso.',
      });
    } catch (error) {
      console.error('Error syncing employees:', error);
      
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        variant: 'destructive',
        title: 'Erro na sincronização',
        description: `Não foi possível iniciar a sincronização. ${errorMsg}`,
      });
    }
  };
  
  return (
    <DashboardLayout 
      title="Funcionários" 
      subtitle="Informações e absenteísmo por funcionário"
      actionComponent={
        <Button 
          onClick={handleSync}
          variant="outline"
          size="sm"
          className="flex items-center gap-1"
        >
          <RefreshCw className="h-4 w-4" />
          Sincronizar
        </Button>
      }
    >
      <EmployeeList />
    </DashboardLayout>
  );
};

export default Employees;
