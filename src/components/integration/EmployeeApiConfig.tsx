
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import apiService, { EmployeeApiConfig as EmployeeApiConfigType } from '@/services/api';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { localStorageService } from '@/services/localStorageService';
import PreviewModeIndicator from '@/components/ui-custom/PreviewModeIndicator';

const EmployeeApiConfig = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSecrets, setShowSecrets] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Initialize config with the correct structure
  const initialConfig: EmployeeApiConfigType = {
    type: 'employee',
    empresa: '',
    codigo: '',
    chave: '',
    tipoSaida: 'json',
    ativo: 'Sim',
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
          setConfig({
            ...typedData,
            // Force tipoSaida to always be 'json'
            tipoSaida: 'json',
            // Set ativo default if not provided
            ativo: typedData.ativo || 'Sim',
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
  };

  const handleTest = async () => {
    try {
      setIsTesting(true);
      setTestResult(null);
      
      // Use current form values for testing
      const testConfig = {
        ...config,
        tipoSaida: 'json'
      };
      
      // Test the API connection
      let result;
      
      if (localStorageService.isPreviewEnvironment()) {
        // In preview mode, simulate a successful test after a delay
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

  // Ensure the handleSave function properly updates with all required fields
  const handleSave = async () => {
    try {
      setIsSaving(true);
      
      // Create proper EmployeeApiConfig object with complete fields
      const configToSave: EmployeeApiConfigType = {
        type: 'employee',
        empresa: config.empresa,
        codigo: config.codigo,
        chave: config.chave,
        tipoSaida: 'json',
        ativo: config.ativo || 'Sim',
        inativo: config.inativo || '',
        afastado: config.afastado || '',
        pendente: config.pendente || '',
        ferias: config.ferias || '',
        isConfigured: true
      };
      
      let result;
      
      try {
        result = await apiService.saveApiConfig(configToSave);
      } catch (error) {
        // If there was an error but we're in preview mode, show a specific message
        if (localStorageService.isPreviewEnvironment()) {
          toast({
            title: 'Configurações salvas localmente',
            description: 'No ambiente de prévia, as configurações são salvas apenas neste navegador.',
          });
          
          // Update the local config
          setConfig(prev => ({
            ...prev, 
            savedLocally: true,
            savedAt: new Date().toISOString()
          }));
          return;
        }
        throw error; // Re-throw for the outer catch to handle
      }
      
      if (!result && !localStorageService.isPreviewEnvironment()) {
        throw new Error('Falha ao salvar configurações');
      }
      
      toast({
        title: "Configuração salva",
        description: "As configurações da API de funcionários foram salvas com sucesso.",
        variant: "default"
      });
      
      // Refresh the config
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
      
      {config.savedLocally && (
        <Alert className="mx-6 mb-4">
          <AlertDescription>
            Estas configurações estão salvas apenas neste navegador.
            {localStorageService.isPreviewEnvironment() ? 
              " No ambiente de prévia, as configurações não são sincronizadas com o servidor." : 
              " Quando a conexão com o servidor for restabelecida, elas serão sincronizadas automaticamente."}
          </AlertDescription>
        </Alert>
      )}
      
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
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="ativo">Filtro Ativo</Label>
            <Input
              id="ativo"
              name="ativo"
              value={config.ativo}
              onChange={handleChange}
              placeholder="Ex: Sim"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="inativo">Filtro Inativo</Label>
            <Input
              id="inativo"
              name="inativo"
              value={config.inativo}
              onChange={handleChange}
              placeholder="Ex: Não"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="afastado">Filtro Afastado</Label>
            <Input
              id="afastado"
              name="afastado"
              value={config.afastado}
              onChange={handleChange}
              placeholder="Ex: Afastado"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pendente">Filtro Pendente</Label>
            <Input
              id="pendente"
              name="pendente"
              value={config.pendente}
              onChange={handleChange}
              placeholder="Ex: Pendente"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ferias">Filtro Férias</Label>
            <Input
              id="ferias"
              name="ferias"
              value={config.ferias}
              onChange={handleChange}
              placeholder="Ex: Férias"
            />
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
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button 
          variant="outline" 
          onClick={handleTest} 
          disabled={isTesting || isLoading || isSaving || !config.empresa || !config.codigo || !config.chave}
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
          onClick={handleSave} 
          disabled={isLoading || isSaving || !config.empresa || !config.codigo || !config.chave}
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
