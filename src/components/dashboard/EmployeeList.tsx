import React, { useState, useEffect } from 'react';
import apiService from '@/services/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui-custom/Card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const EmployeeList = () => {
  const [employees, setEmployees] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    setIsLoading(true);
    try {
      const data = await apiService.employees.getAll();
      setEmployees(data);
    } catch (err) {
      console.error('Error fetching employees:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const syncEmployees = async () => {
    setIsSyncing(true);
    try {
      await apiService.employees.sync();
      setTimeout(fetchEmployees, 1500);
    } catch (err) {
      console.error('Error syncing employees:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'ativo':
        return (
          <span className="bg-green-50 text-green-700 rounded-full px-2.5 py-0.5 text-xs font-medium">
            Ativo
          </span>
        );
      case 'afastado':
        return (
          <span className="bg-amber-50 text-amber-700 rounded-full px-2.5 py-0.5 text-xs font-medium">
            Afastado
          </span>
        );
      case 'inativo':
        return (
          <span className="bg-gray-100 text-gray-700 rounded-full px-2.5 py-0.5 text-xs font-medium">
            Inativo
          </span>
        );
      default:
        return (
          <span className="bg-gray-100 text-gray-700 rounded-full px-2.5 py-0.5 text-xs font-medium">
            {status}
          </span>
        );
    }
  };

  const filteredEmployees = employees.filter(employee =>
    employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.position.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.sector.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Funcionários</CardTitle>
          <CardDescription>
            Lista de funcionários das suas empresas
          </CardDescription>
        </div>
        <Button
          size="sm"
          onClick={syncEmployees}
          disabled={isSyncing}
          className="flex items-center"
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", isSyncing && "animate-spin")} />
          Sincronizar
        </Button>
      </CardHeader>
      <CardContent>
        <div className="mb-4 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Buscar funcionários..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex items-start justify-between py-3">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-5 w-20" />
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="px-2 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Nome
                  </th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Cargo
                  </th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Setor
                  </th>
                  <th className="px-2 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Dias Ausentes
                  </th>
                  <th className="px-2 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-2 py-6 text-center text-muted-foreground">
                      Nenhum funcionário encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((employee) => (
                    <tr key={employee.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-2 py-3 text-sm font-medium">
                        {employee.name}
                      </td>
                      <td className="px-2 py-3 text-sm text-muted-foreground">
                        {employee.position}
                      </td>
                      <td className="px-2 py-3 text-sm text-muted-foreground">
                        {employee.sector}
                      </td>
                      <td className="px-2 py-3 text-sm text-center">
                        <span className={employee.absentDays > 0 ? "text-amber-600 font-medium" : "text-muted-foreground"}>
                          {employee.absentDays}
                        </span>
                      </td>
                      <td className="px-2 py-3 text-right">
                        {getStatusBadge(employee.status)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default EmployeeList;
