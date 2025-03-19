
import React, { useState, useEffect } from 'react';
import apiService from '@/services/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui-custom/Card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2, RefreshCw, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';

const CompanyList = () => {
  const { toast } = useToast();
  const [companies, setCompanies] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCompanies = async () => {
    setIsLoading(true);
    setError(null);
    try {
      console.log('Fetching companies...');
      const response = await apiService.companies.getAll();
      console.log('Companies data received:', response);
      
      // Validate response is array before processing
      if (Array.isArray(response)) {
        setCompanies(response);
      } else {
        console.error('Invalid response format. Expected array, got:', typeof response);
        // Initialize with empty array instead of throwing error
        setCompanies([]);
        
        // Set detailed error message based on response type
        if (response === null || response === undefined) {
          setError('Nenhum dado foi retornado da API. Verifique a configuração da API de empresas.');
        } else if (typeof response === 'string') {
          // Check if response is HTML (common when API returns error page)
          const responseStr = String(response); // Cast to string to ensure string methods work
          if (responseStr.includes('<!DOCTYPE html>') || responseStr.includes('<html>')) {
            setError('A API retornou uma página HTML ao invés de dados. Verifique a URL e as configurações da API.');
          } else {
            setError(`Resposta inesperada da API: ${responseStr.substring(0, 100)}...`);
          }
        } else {
          const responseJson = JSON.stringify(response);
          setError(`Os dados recebidos não estão no formato esperado: ${responseJson.substring(0, 100)}... Certifique-se de que a API está configurada corretamente.`);
        }
        
        toast({
          variant: 'destructive',
          title: 'Formato de dados inválido',
          description: 'A API retornou dados em um formato inesperado. Verifique a configuração da API.'
        });
      }
    } catch (err: any) {
      console.error('Error fetching companies:', err);
      setError(`Erro ao buscar empresas: ${err.message || 'Erro desconhecido'}`);
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar empresas',
        description: 'Não foi possível carregar os dados de empresas.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  const syncCompanies = async () => {
    setIsSyncing(true);
    try {
      console.log('Syncing companies...');
      const result = await apiService.companies.sync();
      console.log('Sync result:', result);
      
      if (result) {
        toast({
          title: 'Sincronização concluída',
          description: 'Dados de empresas sincronizados com sucesso.'
        });
      } else {
        throw new Error('Falha na sincronização');
      }
      // Add a slight delay before fetching to allow backend processing
      setTimeout(fetchCompanies, 1500);
    } catch (err: any) {
      console.error('Error syncing companies:', err);
      toast({
        variant: 'destructive',
        title: 'Erro na sincronização',
        description: 'Não foi possível sincronizar as empresas. Verifique a configuração da API.'
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Nunca';
    
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    } catch (e) {
      console.error('Error formatting date:', e);
      return 'Data inválida';
    }
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

  if (error) {
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
            onClick={fetchCompanies}
            className="flex items-center"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Tentar novamente
          </Button>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
            <AlertCircle className="mx-auto h-10 w-10 text-red-400 mb-3" />
            <h3 className="text-lg font-medium text-red-800 mb-1">Erro ao carregar dados</h3>
            <p className="text-red-600 mb-4">{error}</p>
            <div className="flex gap-2 justify-center">
              <Button onClick={fetchCompanies} variant="outline" className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Tentar novamente
              </Button>
              <Button onClick={() => window.location.href = "/api-config"} variant="default" className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Verificar configuração da API
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

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
        ) : !companies || companies.length === 0 ? (
          <div className="py-8 text-center">
            <Building2 className="mx-auto h-10 w-10 text-muted-foreground mb-3 opacity-40" />
            <p className="text-muted-foreground">Nenhuma empresa encontrada</p>
            <Button onClick={syncCompanies} variant="outline" className="mt-4">
              Sincronizar Empresas
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            {companies.map((company, index) => (
              <div key={index} className="flex items-center justify-between py-3 border-b last:border-0">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-vitalis-100 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-vitalis-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium">{company.name || company.short_name || company.NOMEABREVIADO || company.RAZAOSOCIAL || 'Empresa sem nome'}</h3>
                    <p className="text-xs text-muted-foreground">
                      {company.employees || 0} funcionários
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {getSyncStatusBadge(company.syncStatus || 'pending')}
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
