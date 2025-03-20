// src/components/dashboard/EmployeeList.tsx
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
import { 
  RefreshCw, 
  Search, 
  UserRound,
  AlertCircle, 
  RotateCw,
  Loader2
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import apiService from '@/services/api';
import { MockEmployeeData } from '@/types/dashboard';
import { useToast } from '@/components/ui/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { retryRequest } from '@/services/apiClient';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { syncLogsService } from '@/services/syncLogsService';

const ITEMS_PER_PAGE = 10;

const EmployeeList = () => {
  const { toast } = useToast();
  const [employees, setEmployees] = useState<MockEmployeeData[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<MockEmployeeData[]>([]);
  const [displayedEmployees, setDisplayedEmployees] = useState<MockEmployeeData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [syncProgress, setSyncProgress] = useState<{current: number, total: number} | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [activeSyncs, setActiveSyncs] = useState<{count: number, types: string[]}>({ count: 0, types: [] });

  const checkForActiveSyncs = async () => {
    try {
      const activeSyncs = await syncLogsService.getActiveSyncs();
      setActiveSyncs(activeSyncs);
      return activeSyncs.count > 0;
    } catch (error) {
      console.error('Error checking active syncs:', error);
      return false;
    }
  };

  const loadEmployees = async () => {
    try {
      setIsLoading(true);
      setLoadError(null);
      
      let data: MockEmployeeData[] = [];
      
      try {
        data = await retryRequest(
          () => apiService.employees.getAll(),
          3,
          1000
        );
      } catch (error) {
        console.error('Error loading employees with retry:', error);
        throw error;
      }
      
      if (!Array.isArray(data)) {
        console.error('Received non-array data:', data);
        throw new Error('Formato de dados inválido');
      }
      
      console.log('Loaded employees:', data);
      setEmployees(data);
      setFilteredEmployees(data);
    } catch (error) {
      console.error('Error loading employees:', error);
      setLoadError('Não foi possível carregar a lista de funcionários. Tente novamente mais tarde.');
      toast({
        title: 'Erro ao carregar funcionários',
        description: 'Não foi possível carregar a lista de funcionários. Tente novamente mais tarde.',
        variant: 'destructive',
      });
      
      setEmployees([]);
      setFilteredEmployees([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);

      const hasSyncInProgress = await checkForActiveSyncs();
      
      if (hasSyncInProgress) {
        toast({
          title: 'Sincronização em andamento',
          description: 'Uma sincronização já está em andamento. Os dados serão atualizados automaticamente quando concluído.',
        });
        
        await loadEmployees();
      } else {
        toast({
          title: 'Atualizando lista',
          description: 'Carregando dados mais recentes do banco de dados...',
        });
        
        await loadEmployees();
        
        toast({
          title: 'Lista atualizada',
          description: 'Os dados dos funcionários foram atualizados.',
        });
      }
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

  const handleStartSync = async () => {
    try {
      const hasSyncInProgress = await checkForActiveSyncs();
      
      if (hasSyncInProgress) {
        toast({
          title: 'Sincronização em andamento',
          description: 'Uma sincronização já está em andamento. Aguarde a conclusão antes de iniciar uma nova.',
          variant: 'default'
        });
        return;
      }
      
      setIsRefreshing(true);
      setSyncProgress(null);
      
      toast({
        title: 'Iniciando sincronização',
        description: 'Iniciando a sincronização de funcionários com o SOC...',
      });
      
      const syncResult = await apiService.sync.employees();
      console.log('Sync initiated:', syncResult);
      
      if (syncResult && syncResult.syncId) {
        toast({
          title: 'Sincronização iniciada',
          description: 'A sincronização foi iniciada. Isso pode levar alguns minutos para ser concluído.',
        });
        
        const pollSyncStatus = async () => {
          try {
            await new Promise(resolve => setTimeout(resolve, 5000));
            checkSyncProgressAndReload(syncResult.syncId);
          } catch (error) {
            console.error('Error in polling sync status:', error);
            setIsRefreshing(false);
          }
        };
        
        pollSyncStatus();
      }
    } catch (error) {
      console.error('Error initiating sync:', error);
      toast({
        title: 'Erro ao iniciar sincronização',
        description: 'Não foi possível iniciar a sincronização de funcionários. Tente novamente.',
        variant: 'destructive',
      });
      setIsRefreshing(false);
    }
  };

  const checkSyncProgressAndReload = async (syncId: number) => {
    try {
      const status = await apiService.sync.checkSyncStatus(syncId);
      console.log('Sync status:', status);
      
      const progressMatch = status.message?.match(/Processed (\d+) of (\d+)/i);
      if (progressMatch && progressMatch.length >= 3) {
        const current = parseInt(progressMatch[1], 10);
        const total = parseInt(progressMatch[2], 10);
        if (!isNaN(current) && !isNaN(total)) {
          setSyncProgress({ current, total });
        }
      }
      
      if (status.status === 'continues') {
        toast({
          title: 'Sincronização em andamento',
          description: status.message || 'O processo está dividido em múltiplas etapas para melhor desempenho.',
        });
        
        await loadEmployees();
        
        setTimeout(() => checkSyncProgressAndReload(syncId), 5000);
        return;
      }
      
      if (status.status === 'completed' || status.status === 'error') {
        await loadEmployees();
        setIsRefreshing(false);
        setSyncProgress(null);
        
        toast({
          title: status.status === 'completed' ? 'Sincronização concluída' : 'Sincronização com erros',
          description: status.message || 'Os dados foram atualizados.',
          variant: status.status === 'completed' ? 'default' : 'destructive',
        });
      } else {
        setTimeout(() => checkSyncProgressAndReload(syncId), 5000);
      }
    } catch (error) {
      console.error('Error checking sync status:', error);
      await loadEmployees();
      setIsRefreshing(false);
      setSyncProgress(null);
    }
  };

  useEffect(() => {
    const initialize = async () => {
      await checkForActiveSyncs();
      loadEmployees();
    };
    
    initialize();
    
    const intervalId = setInterval(async () => {
      const hasSyncInProgress = await checkForActiveSyncs();
      if (!hasSyncInProgress && activeSyncs.count > 0) {
        loadEmployees();
      }
    }, 10000);
    
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!Array.isArray(employees)) {
      console.error('employees is not an array:', employees);
      setFilteredEmployees([]);
      setTotalPages(1);
      setCurrentPage(1);
      return;
    }
    
    if (!searchTerm.trim()) {
      setFilteredEmployees(employees);
      
      const pages = Math.max(1, Math.ceil(employees.length / ITEMS_PER_PAGE));
      setTotalPages(pages);
      
      if (currentPage > pages) {
        setCurrentPage(1);
      }
      return;
    }

    const lowercasedTerm = searchTerm.toLowerCase();
    const filtered = employees.filter(
      employee =>
        (employee.name?.toLowerCase() || "").includes(lowercasedTerm) ||
        (employee.full_name?.toLowerCase() || "").includes(lowercasedTerm) ||
        (employee.position_name?.toLowerCase() || "").includes(lowercasedTerm) ||
        (employee.sector_name?.toLowerCase() || "").includes(lowercasedTerm)
    );
    setFilteredEmployees(filtered);
    
    const pages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
    setTotalPages(pages);
    
    setCurrentPage(1);
  }, [searchTerm, employees]);

  useEffect(() => {
    if (!Array.isArray(filteredEmployees)) {
      console.error('filteredEmployees is not an array:', filteredEmployees);
      setDisplayedEmployees([]);
      return;
    }
    
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    setDisplayedEmployees(filteredEmployees.slice(startIndex, endIndex));
  }, [filteredEmployees, currentPage]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const getStatusBadge = (status: string) => {
    const lowerStatus = status?.toLowerCase() || '';
    if (lowerStatus.includes('ativo')) return 'bg-green-100 text-green-800';
    if (lowerStatus.includes('inativo') || lowerStatus.includes('demit')) return 'bg-red-100 text-red-800';
    if (lowerStatus.includes('afastado')) return 'bg-yellow-100 text-yellow-800';
    if (lowerStatus.includes('férias')) return 'bg-blue-100 text-blue-800';
    return 'bg-gray-100 text-gray-800';
  };

  const renderPaginationItems = () => {
    const items = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        items.push(
          <PaginationItem key={i}>
            <PaginationLink 
              onClick={() => handlePageChange(i)} 
              isActive={currentPage === i}
            >
              {i}
            </PaginationLink>
          </PaginationItem>
        );
      }
    } else {
      items.push(
        <PaginationItem key={1}>
          <PaginationLink 
            onClick={() => handlePageChange(1)} 
            isActive={currentPage === 1}
          >
            1
          </PaginationLink>
        </PaginationItem>
      );
      
      if (currentPage > 3) {
        items.push(
          <PaginationItem key="ellipsis-start">
            <PaginationEllipsis />
          </PaginationItem>
        );
      }
      
      const startNearby = Math.max(2, currentPage - 1);
      const endNearby = Math.min(totalPages - 1, currentPage + 1);
      
      for (let i = startNearby; i <= endNearby; i++) {
        items.push(
          <PaginationItem key={i}>
            <PaginationLink 
              onClick={() => handlePageChange(i)} 
              isActive={currentPage === i}
            >
              {i}
            </PaginationLink>
          </PaginationItem>
        );
      }
      
      if (currentPage < totalPages - 2) {
        items.push(
          <PaginationItem key="ellipsis-end">
            <PaginationEllipsis />
          </PaginationItem>
        );
      }
      
      items.push(
        <PaginationItem key={totalPages}>
          <PaginationLink 
            onClick={() => handlePageChange(totalPages)} 
            isActive={currentPage === totalPages}
          >
            {totalPages}
          </PaginationLink>
        </PaginationItem>
      );
    }
    
    return items;
  };

  if (isLoading) {
    return (
      <div className="w-full h-64 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Carregando funcionários...</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro ao carregar funcionários</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
        
        <div className="flex justify-center">
          <Button onClick={loadEmployees} className="mr-2">
            Tentar novamente
          </Button>
          <Button onClick={handleStartSync} variant="outline">
            Sincronizar dados
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {activeSyncs.count > 0 && (
        <Alert className="bg-blue-50 border-blue-200">
          <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
          <AlertTitle className="text-blue-700">Sincronização em andamento</AlertTitle>
          <AlertDescription className="text-blue-600">
            Existe uma sincronização de funcionários em andamento. Os dados serão atualizados automaticamente quando concluída.
          </AlertDescription>
        </Alert>
      )}
      
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
          
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-1"
            onClick={handleStartSync}
            disabled={isRefreshing || activeSyncs.count > 0}
          >
            {isRefreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCw className="h-4 w-4" />
            )}
            Sincronizar
          </Button>
        </div>
      </div>
      
      {(isRefreshing && syncProgress) && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-2">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            <span className="text-blue-800 font-medium">Sincronizando funcionários: {syncProgress.current} de {syncProgress.total} ({Math.round((syncProgress.current / syncProgress.total) * 100)}%)</span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2.5 mt-2">
            <div 
              className="bg-blue-600 h-2.5 rounded-full" 
              style={{width: `${Math.round((syncProgress.current / syncProgress.total) * 100)}%`}}
            ></div>
          </div>
        </div>
      )}

      {(!Array.isArray(filteredEmployees) || filteredEmployees.length === 0) ? (
        <div className="text-center py-12 bg-muted/20 rounded-md">
          <UserRound className="h-12 w-12 mx-auto text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">Nenhum funcionário encontrado</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {!Array.isArray(employees) || employees.length === 0
              ? 'Parece que você ainda não sincronizou seus funcionários. Clique em "Sincronizar" para começar.'
              : 'Nenhum funcionário encontrado com o filtro atual. Tente outro termo de busca.'}
          </p>
          {(!Array.isArray(employees) || employees.length === 0) && (
            <Button onClick={handleStartSync} className="mt-4" disabled={isRefreshing || activeSyncs.count > 0}>
              {isRefreshing ? 'Sincronizando...' : 'Sincronizar Agora'}
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="border rounded-md">
            <Table>
              <TableCaption>
                Mostrando {displayedEmployees.length} de {filteredEmployees.length} funcionários 
                (Página {currentPage} de {totalPages})
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Setor</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.isArray(displayedEmployees) && displayedEmployees.map((employee) => (
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
          
          {totalPages > 1 && (
            <Pagination className="mt-4">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious 
                    onClick={() => handlePageChange(currentPage - 1)}
                    className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
                
                {renderPaginationItems()}
                
                <PaginationItem>
                  <PaginationNext 
                    onClick={() => handlePageChange(currentPage + 1)}
                    className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </>
      )}
    </div>
  );
};

export default EmployeeList;
