import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import apiService, { EmployeeApiConfig as EmployeeApiConfigType } from '@/services/api';
import { Loader2, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import PreviewModeIndicator from '@/components/ui-custom/PreviewModeIndicator';
import { localStorageService } from '@/services/localStorageService';

const EmployeeApiConfig = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showSecrets, setShowSecrets] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null);

  const [isAtivo, setIsAtivo] = useState(false);
  const [isInativo, setIsInativo] = useState(false);
  const [isAfastado, setIsAfastado] = useState(false);
  const [isPendente, setIsPendente] = useState(false);
  const [isFerias, setIsFerias] = useState(false);

  const initialConfig: EmployeeApiConfigType = {
    type: 'employee',
    empresa: '',
    codigo: '',
    chave: '',
    tipoSaida: 'json',
    ativo: '',
    inativo: '',
    afastado: '',
    pendente: '',
    ferias: '',
    isConfigured: false
  };

  const [config, setConfig] = useState<EmployeeApiConfigType>(initialConfig);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        setIsLoading(true);
        const data = await apiService.getApiConfig('employee');
        if (data) {
          const typedData = data as EmployeeApiConfigType;
          
          setIsAtivo(typedData.ativo === 'Sim');
          setIsInativo(typedData.inativo === 'Sim');
          setIsAfastado(typedData.afastado === 'Sim');
          setIsPendente(typedData.pendente === 'Sim');
          setIsFerias(typedData.ferias === 'Sim');
          
          setConfig({
            ...typedData,
            tipoSaida: 'json',
            isConfigured: !!typedData.empresa && !!typedData.codigo && !!typedData.chave
          });
        }
      } catch (error) {
        console.error('Error loading employee API config:', error);
        toast({
          variant: 'destructive',
          title: 'Erro ao carregar configurações',
          description: 'Não foi possível carregar as configurações da API de funcionários.'
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchConfig();
  }, [toast]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setConfig(prev => ({ ...prev, [name]: value }));
    if (testResult) {
      setTestResult(null);
    }
    if (syncResult) {
      setSyncResult(null);
    }
  };

  const handleCheckboxChange = (name: string, checked: boolean) => {
    setConfig(prev => ({ 
      ...prev, 
      [name]: checked ? 'Sim' : '' 
    }));
    
    switch (name) {
      case 'ativo':
        setIsAtivo(checked);
        break;
      case 'inativo':
        setIsInativo(checked);
        break;
      case 'afastado':
        setIsAfastado(checked);
        break;
      case 'pendente':
        setIsPendente(checked);
        break;
      case 'ferias':
        setIsFerias(checked);
        break;
    }
    
    if (testResult) {
      setTestResult(null);
    }
    if (syncResult) {
      setSyncResult(null);
    }
  };

  const handleTest = async () => {
    try {
      setIsTesting(true);
      setTestResult(null);
      
      const testConfig = {
        ...config,
        tipoSaida: 'json'
      };
      
      let result;
      
      if (localStorageService.isPreviewEnvironment()) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        result = {
          success: true,
          message: 'Conexão simulada bem-sucedida no ambiente de prévia.'
        };
      } else {
        result = await apiService.testApiConnection(testConfig);
      }
      
      setTestResult({
        success: result.success,
        message: result.message || (result.success 
          ? 'Conexão com a API de Funcionários estabelecida com sucesso!' 
          : 'Falha ao conectar com a API de Funcionários.')
      });
      
      toast({
        title: result.success ? "Teste concluído" : "Erro no teste",
        description: result.success 
          ? "Conexão com a API de funcionários estabelecida com sucesso." 
          : "Não foi possível conectar à API de funcionários. Verifique as configurações.",
        variant: result.success ? "default" : "destructive"
      });
    } catch (error) {
      console.error('Error testing employee API connection:', error);
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Erro desconhecido ao testar conexão'
      });
      
      toast({
        title: "Erro no teste",
        description: "Não foi possível conectar à API de funcionários. Verifique as configurações.",
        variant: "destructive"
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSync = async () => {
    try {
      setIsSyncing(true);
      setSyncResult(null);
      
      if (!config.isConfigured) {
        await handleSave();
      }
      
      const result = await apiService.employees.sync();
      
      setSyncResult({
        success: result.success,
        message: result.message || (result.success 
          ? 'Sincronização de funcionários concluída com sucesso!' 
          : 'Falha ao sincronizar dados de funcionários.')
      });
      
      toast({
        title: result.success ? "Sincronização concluída" : "Erro na sincronização",
        description: result.success 
          ? "Dados de funcionários sincronizados com sucesso." 
          : "Não foi possível sincronizar dados de funcionários. Verifique as configurações.",
        variant: result.success ? "default" : "destructive"
      });
    } catch (error) {
      console.error('Error syncing employee data:', error);
      setSyncResult({
        success: false,
        message: error instanceof Error ? error.message : 'Erro desconhecido ao sincronizar dados'
      });
      
      toast({
        title: "Erro na sincronização",
        description: "Não foi possível sincronizar dados de funcionários. Verifique as configurações.",
        variant: "destructive"
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      
      const configToSave: EmployeeApiConfigType = {
        type: 'employee',
        empresa: config.empresa,
        codigo: config.codigo,
        chave: config.chave,
        tipoSaida: 'json',
        ativo: isAtivo ? 'Sim' : '',
        inativo: isInativo ? 'Sim' : '',
        afastado: isAfastado ? 'Sim' : '',
        pendente: isPendente ? 'Sim' : '',
        ferias: isFerias ? 'Sim' : '',
        isConfigured: true
      };
      
      const result = await apiService.saveApiConfig(configToSave);
      
      if (!result) {
        throw new Error('Falha ao salvar configurações');
      }
      
      toast({
        title: "Configuração salva",
        description: "As configurações da API de funcionários foram salvas com sucesso.",
        variant: "default"
      });
      
      const savedConfig = await apiService.getApiConfig('employee');
      if (savedConfig) {
        setConfig(savedConfig as EmployeeApiConfigType);
      }
    } catch (error) {
      console.error('Error saving employee API config:', error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar as configurações da API de funcionários.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-center items-center h-40">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuração da API de Funcionários</CardTitle>
        <CardDescription>
          Configure a integração com a API SOC para importar dados de funcionários.
        </CardDescription>
      </CardHeader>
      
      <PreviewModeIndicator />
      
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="empresa">Empresa</Label>
            <Input
              id="empresa"
              name="empresa"
              value={config.empresa}
              onChange={handleChange}
              placeholder="Código da empresa"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="codigo">Código</Label>
            <Input
              id="codigo"
              name="codigo"
              value={config.codigo}
              onChange={handleChange}
              placeholder="Código de acesso"
              type={showSecrets ? "text" : "password"}
              required
            />
          </div>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="chave">Chave de API</Label>
          <Input
            id="chave"
            name="chave"
            value={config.chave}
            onChange={handleChange}
            placeholder="Chave de autenticação da API"
            type={showSecrets ? "text" : "password"}
            required
          />
        </div>
        
        <div className="flex items-center space-x-2 pt-2">
          <Checkbox
            id="showSecrets"
            checked={showSecrets}
            onCheckedChange={(checked) => setShowSecrets(!!checked)}
          />
          <label
            htmlFor="showSecrets"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            Mostrar credenciais
          </label>
        </div>
        
        <div className="border rounded-md p-4 mt-4">
          <h3 className="text-sm font-medium mb-3">Filtros de status</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="ativoCheck"
                checked={isAtivo}
                onCheckedChange={(checked) => handleCheckboxChange('ativo', !!checked)}
              />
              <label
                htmlFor="ativoCheck"
                className="text-sm font-medium leading-none"
              >
                Ativo
              </label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="inativoCheck"
                checked={isInativo}
                onCheckedChange={(checked) => handleCheckboxChange('inativo', !!checked)}
              />
              <label
                htmlFor="inativoCheck"
                className="text-sm font-medium leading-none"
              >
                Inativo
              </label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="afastadoCheck"
                checked={isAfastado}
                onCheckedChange={(checked) => handleCheckboxChange('afastado', !!checked)}
              />
              <label
                htmlFor="afastadoCheck"
                className="text-sm font-medium leading-none"
              >
                Afastado
              </label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="pendenteCheck"
                checked={isPendente}
                onCheckedChange={(checked) => handleCheckboxChange('pendente', !!checked)}
              />
              <label
                htmlFor="pendenteCheck"
                className="text-sm font-medium leading-none"
              >
                Pendente
              </label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="feriasCheck"
                checked={isFerias}
                onCheckedChange={(checked) => handleCheckboxChange('ferias', !!checked)}
              />
              <label
                htmlFor="feriasCheck"
                className="text-sm font-medium leading-none"
              >
                Férias
              </label>
            </div>
          </div>
        </div>
        
        {testResult && (
          <div className={`p-4 rounded-md ${testResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'} flex items-center space-x-3`}>
            {testResult.success ? (
              <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
            )}
            <span>{testResult.message}</span>
          </div>
        )}
        
        {syncResult && (
          <div className={`p-4 rounded-md ${syncResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'} flex items-center space-x-3`}>
            {syncResult.success ? (
              <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
            )}
            <span>{syncResult.message}</span>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col sm:flex-row gap-2">
        <Button 
          variant="outline" 
          onClick={handleTest} 
          disabled={isTesting || isLoading || isSaving || isSyncing || !config.empresa || !config.codigo || !config.chave}
          className="w-full sm:w-auto"
        >
          {isTesting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Testando...
            </>
          ) : (
            'Testar Conexão'
          )}
        </Button>
        
        <Button 
          variant="outline"
          onClick={handleSync}
          disabled={isLoading || isTesting || isSaving || isSyncing || !config.empresa || !config.codigo || !config.chave}
          className="w-full sm:w-auto flex items-center gap-2"
        >
          {isSyncing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Sincronizando...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" />
              Sincronizar Dados
            </>
          )}
        </Button>
        
        <Button 
          onClick={handleSave} 
          disabled={isLoading || isTesting || isSaving || isSyncing || !config.empresa || !config.codigo || !config.chave}
          className="w-full sm:w-auto"
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            'Salvar Configurações'
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default EmployeeApiConfig;
