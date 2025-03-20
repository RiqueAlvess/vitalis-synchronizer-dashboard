
import React, { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Search, UserRound } from 'lucide-react';
import apiService from '@/services/api';
import { MockEmployeeData } from '@/types/dashboard';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { retryRequest } from '@/services/apiClient';

const EmployeeList = () => {
  const [employees, setEmployees] = useState<MockEmployeeData[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<MockEmployeeData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  // Function to load employees with retry logic
  const loadEmployees = async () => {
    try {
      setIsLoading(true);
      // Use the imported retryRequest helper for better reliability
      const data = await retryRequest(
        () => apiService.employees.getAll(),
        3,  // 3 retries
        1000 // 1s initial delay
      );
      
      console.log('Loaded employees:', data);
      setEmployees(data);
      setFilteredEmployees(data);
    } catch (error) {
      console.error('Error loading employees:', error);
      toast({
        title: 'Erro ao carregar funcionários',
        description: 'Não foi possível carregar a lista de funcionários. Tente novamente mais tarde.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Function to refresh employee data with periodic status check
  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      toast({
        title: 'Atualizando lista de funcionários',
        description: 'Buscando dados mais recentes...',
      });
      
      // Start sync process
      const syncResult = await apiService.sync.employees();
      console.log('Sync initiated:', syncResult);
      
      if (syncResult && syncResult.syncId) {
        toast({
          title: 'Sincronização iniciada',
          description: 'A sincronização foi iniciada. Os dados aparecerão conforme forem processados.',
        });
        
        // Check status initially after 5 seconds
        setTimeout(() => checkSyncProgressAndReload(syncResult.syncId), 5000);
      }
    } catch (error) {
      console.error('Error refreshing employees:', error);
      toast({
        title: 'Erro ao atualizar',
        description: 'Não foi possível atualizar a lista de funcionários. Tente novamente.',
        variant: 'destructive',
      });
      setIsRefreshing(false);
    }
  };
  
  // Check sync progress and reload data when finished
  const checkSyncProgressAndReload = async (syncId: number) => {
    try {
      const status = await apiService.sync.checkSyncStatus(syncId);
      console.log('Sync status:', status);
      
      if (status.status === 'completed' || status.status === 'error') {
        // Sync is done, reload data
        await loadEmployees();
        setIsRefreshing(false);
        
        toast({
          title: status.status === 'completed' ? 'Sincronização concluída' : 'Sincronização com erros',
          description: status.message || 'Os dados foram atualizados.',
          variant: status.status === 'completed' ? 'default' : 'destructive',
        });
      } else {
        // Still processing, check again after a delay
        setTimeout(() => checkSyncProgressAndReload(syncId), 5000);
      }
    } catch (error) {
      console.error('Error checking sync status:', error);
      // Even on error, try to reload data
      await loadEmployees();
      setIsRefreshing(false);
    }
  };

  // Load employees on component mount
  useEffect(() => {
    loadEmployees();
  }, []);

  // Filter employees when search term changes
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredEmployees(employees);
      return;
    }

    const lowercasedTerm = searchTerm.toLowerCase();
    const filtered = employees.filter(
      employee =>
        employee.name?.toLowerCase().includes(lowercasedTerm) ||
        employee.full_name?.toLowerCase().includes(lowercasedTerm) ||
        employee.position_name?.toLowerCase().includes(lowercasedTerm) ||
        employee.sector_name?.toLowerCase().includes(lowercasedTerm)
    );
    setFilteredEmployees(filtered);
  }, [searchTerm, employees]);

  // Helper function to get status badge color
  const getStatusBadge = (status: string) => {
    const lowerStatus = status?.toLowerCase() || '';
    if (lowerStatus.includes('ativo')) return 'bg-green-100 text-green-800';
    if (lowerStatus.includes('inativo') || lowerStatus.includes('demit')) return 'bg-red-100 text-red-800';
    if (lowerStatus.includes('afastado')) return 'bg-yellow-100 text-yellow-800';
    if (lowerStatus.includes('férias')) return 'bg-blue-100 text-blue-800';
    return 'bg-gray-100 text-gray-800';
  };

  if (isLoading) {
    return (
      <div className="w-full h-64 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Carregando funcionários...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="relative w-full sm:w-auto flex-1 max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar funcionário..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-1"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {isRefreshing ? 'Sincronizando...' : 'Atualizar Lista'}
          </Button>
        </div>
      </div>

      {filteredEmployees.length === 0 ? (
        <div className="text-center py-12 bg-muted/20 rounded-md">
          <UserRound className="h-12 w-12 mx-auto text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">Nenhum funcionário encontrado</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {employees.length === 0
              ? 'Parece que você ainda não sincronizou seus funcionários. Clique em "Sincronizar" para começar.'
              : 'Nenhum funcionário encontrado com o filtro atual. Tente outro termo de busca.'}
          </p>
          {employees.length === 0 && (
            <Button onClick={handleRefresh} className="mt-4" disabled={isRefreshing}>
              {isRefreshing ? 'Sincronizando...' : 'Sincronizar Agora'}
            </Button>
          )}
        </div>
      ) : (
        <div className="border rounded-md">
          <Table>
            <TableCaption>Lista de funcionários ({filteredEmployees.length})</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Setor</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmployees.map((employee) => (
                <TableRow key={employee.id || employee.soc_code || employee.employee_id || Math.random().toString()}>
                  <TableCell className="font-medium">{employee.full_name || employee.name || '-'}</TableCell>
                  <TableCell>{employee.position_name || employee.position || '-'}</TableCell>
                  <TableCell>{employee.sector_name || employee.sector || '-'}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getStatusBadge(employee.status || '')}>
                      {employee.status || 'Desconhecido'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default EmployeeList;
