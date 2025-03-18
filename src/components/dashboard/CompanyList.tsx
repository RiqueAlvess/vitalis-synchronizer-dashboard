
import React, { useState, useEffect } from 'react';
import { apiService } from '@/services/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui-custom/Card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2, RefreshCw, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const CompanyList = () => {
  const [companies, setCompanies] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    setIsLoading(true);
    try {
      const data = await apiService.companies.list();
      setCompanies(data);
    } catch (err) {
      console.error('Error fetching companies:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const syncCompanies = async () => {
    setIsSyncing(true);
    try {
      await apiService.companies.sync();
      // In a real app, you would handle the sync job status
      setTimeout(fetchCompanies, 1500); // Simulating sync completion
    } catch (err) {
      console.error('Error syncing companies:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Nunca';
    
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const getSyncStatusBadge = (status: string) => {
    switch (status) {
      case 'synced':
        return (
          <span className="flex items-center text-green-700 bg-green-50 rounded-full px-2.5 py-0.5 text-xs font-medium">
            <CheckCircle className="w-3 h-3 mr-1" />
            Sincronizado
          </span>
        );
      case 'pending':
        return (
          <span className="flex items-center text-amber-700 bg-amber-50 rounded-full px-2.5 py-0.5 text-xs font-medium">
            <Clock className="w-3 h-3 mr-1" />
            Pendente
          </span>
        );
      case 'error':
        return (
          <span className="flex items-center text-red-700 bg-red-50 rounded-full px-2.5 py-0.5 text-xs font-medium">
            <AlertCircle className="w-3 h-3 mr-1" />
            Erro
          </span>
        );
      default:
        return <span className="text-xs">-</span>;
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Empresas</CardTitle>
          <CardDescription>
            Gerencie suas empresas sincronizadas
          </CardDescription>
        </div>
        <Button
          size="sm"
          onClick={syncCompanies}
          disabled={isSyncing}
          className="flex items-center"
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", isSyncing && "animate-spin")} />
          Sincronizar
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-5">
            {companies.map((company) => (
              <div key={company.id} className="flex items-center justify-between py-3 border-b last:border-0">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-vitalis-100 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-vitalis-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium">{company.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {company.employees} funcionários
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {getSyncStatusBadge(company.syncStatus)}
                  <div className="text-xs text-muted-foreground">
                    Última sincronização: {formatDate(company.lastSync)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CompanyList;
