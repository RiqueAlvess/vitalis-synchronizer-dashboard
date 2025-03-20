
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
  UserRound 
} from 'lucide-react';
import apiService from '@/services/api';
import { MockEmployeeData } from '@/types/dashboard';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
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

const ITEMS_PER_PAGE = 10;

const EmployeeList = () => {
  const [employees, setEmployees] = useState<MockEmployeeData[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<MockEmployeeData[]>([]);
  const [displayedEmployees, setDisplayedEmployees] = useState<MockEmployeeData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [syncProgress, setSyncProgress] = useState<{current: number, total: number} | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
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
      setSyncProgress(null);
      
      toast({
        title: 'Atualizando lista de funcionários',
        description: 'Iniciando sincronização com o SOC...',
      });
      
      // Start sync process
      const syncResult = await apiService.sync.employees();
      console.log('Sync initiated:', syncResult);
      
      if (syncResult && syncResult.syncId) {
        toast({
          title: 'Sincronização iniciada',
          description: 'A sincronização foi iniciada. Isso pode levar alguns minutos para ser concluído.',
        });
        
        // Polling function to check status
        const pollSyncStatus = async () => {
          try {
            // Check status initially after 5 seconds
            await new Promise(resolve => setTimeout(resolve, 5000));
            checkSyncProgressAndReload(syncResult.syncId);
          } catch (error) {
            console.error('Error in polling sync status:', error);
            setIsRefreshing(false);
          }
        };
        
        // Start polling
        pollSyncStatus();
      }
    } catch (error) {
      console.error('Error refreshing employees:', error);
      toast({
        title: 'Erro ao atualizar',
        description: 'Não foi possível iniciar a sincronização de funcionários. Tente novamente.',
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
      
      // Extract progress information from message if available
      const progressMatch = status.message?.match(/Processed (\d+) of (\d+)/i);
      if (progressMatch && progressMatch.length >= 3) {
        const current = parseInt(progressMatch[1], 10);
        const total = parseInt(progressMatch[2], 10);
        if (!isNaN(current) && !isNaN(total)) {
          setSyncProgress({ current, total });
        }
      }
      
      // Handle continuation status
      if (status.status === 'continues') {
        toast({
          title: 'Sincronização em andamento',
          description: status.message || 'O processo está dividido em múltiplas etapas para melhor desempenho.',
        });
        
        // Load any available data
        await loadEmployees();
        
        // Continue checking after a delay
        setTimeout(() => checkSyncProgressAndReload(syncId), 5000);
        return;
      }
      
      if (status.status === 'completed' || status.status === 'error') {
        // Sync is done, reload data
        await loadEmployees();
        setIsRefreshing(false);
        setSyncProgress(null);
        
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
      setSyncProgress(null);
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
      
      // Calculate total pages based on all employees
      const pages = Math.max(1, Math.ceil(employees.length / ITEMS_PER_PAGE));
      setTotalPages(pages);
      
      // Reset to first page when clearing search
      if (currentPage > pages) {
        setCurrentPage(1);
      }
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
    
    // Calculate total pages based on filtered results
    const pages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
    setTotalPages(pages);
    
    // Reset to first page when search changes
    setCurrentPage(1);
  }, [searchTerm, employees]);
  
  // Update displayed employees when page or filtered list changes
  useEffect(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    setDisplayedEmployees(filteredEmployees.slice(startIndex, endIndex));
  }, [filteredEmployees, currentPage]);

  // Change page handler
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // Helper function to get status badge color
  const getStatusBadge = (status: string) => {
    const lowerStatus = status?.toLowerCase() || '';
    if (lowerStatus.includes('ativo')) return 'bg-green-100 text-green-800';
    if (lowerStatus.includes('inativo') || lowerStatus.includes('demit')) return 'bg-red-100 text-red-800';
    if (lowerStatus.includes('afastado')) return 'bg-yellow-100 text-yellow-800';
    if (lowerStatus.includes('férias')) return 'bg-blue-100 text-blue-800';
    return 'bg-gray-100 text-gray-800';
  };
  
  // Generate pagination items
  const renderPaginationItems = () => {
    const items = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      // Show all pages if there are 5 or fewer
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
      // Show first page
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
      
      // Show ellipsis if current page is far from start
      if (currentPage > 3) {
        items.push(
          <PaginationItem key="ellipsis-start">
            <PaginationEllipsis />
          </PaginationItem>
        );
      }
      
      // Show nearby pages
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
      
      // Show ellipsis if current page is far from end
      if (currentPage < totalPages - 2) {
        items.push(
          <PaginationItem key="ellipsis-end">
            <PaginationEllipsis />
          </PaginationItem>
        );
      }
      
      // Show last page
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
      
      {/* Sync progress indicator */}
      {isRefreshing && syncProgress && (
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
                {displayedEmployees.map((employee) => (
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
          
          {/* Pagination */}
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
