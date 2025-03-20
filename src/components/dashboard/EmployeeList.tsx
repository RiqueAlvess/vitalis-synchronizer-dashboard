
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

const EmployeeList = () => {
  const [employees, setEmployees] = useState<MockEmployeeData[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<MockEmployeeData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  // Function to load employees
  const loadEmployees = async () => {
    try {
      setIsLoading(true);
      const data = await apiService.employees.getAll();
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

  // Function to refresh employee data
  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      toast({
        title: 'Atualizando lista de funcionários',
        description: 'Buscando dados mais recentes...',
      });
      
      await loadEmployees();
      
      toast({
        title: 'Lista atualizada',
        description: 'Os dados dos funcionários foram atualizados com sucesso.',
      });
    } catch (error) {
      console.error('Error refreshing employees:', error);
      toast({
        title: 'Erro ao atualizar',
        description: 'Não foi possível atualizar a lista de funcionários. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Load employees on component mount
  useEffect(() => {
    loadEmployees();
    
    // Auto refresh every 30 seconds if a sync is in progress
    const interval = setInterval(() => {
      if (!isRefreshing && !isLoading) {
        loadEmployees();
      }
    }, 30000);
    
    return () => clearInterval(interval);
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
            Atualizar Lista
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
              {isRefreshing ? 'Atualizando...' : 'Atualizar Agora'}
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
