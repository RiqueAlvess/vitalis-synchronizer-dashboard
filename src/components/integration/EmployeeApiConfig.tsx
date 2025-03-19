
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import apiService, { EmployeeApiConfig as EmployeeApiConfigType } from '@/services/api';
import { Loader2 } from 'lucide-react';
import { useApiConfig } from '@/hooks/use-api-config';

const EmployeeApiConfig = () => {
  const { toast } = useToast();
  const { config: savedConfig, saveConfig, isLoading: isLoadingConfig } = useApiConfig('employee');
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
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
    if (savedConfig) {
      setConfig(savedConfig as EmployeeApiConfigType);
    }
  }, [savedConfig]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setConfig(prev => ({ ...prev, [name]: value }));
  };

  const handleTest = async () => {
    try {
      setIsTesting(true);
      setTestResult(null);
      
      // Test the API connection
      const result = await apiService.employees.testConnection(config);
      
      setTestResult({
        success: true,
        message: `Conexão bem-sucedida! ${result.count || 0} funcionários encontrados.`
      });
      
      toast({
        title: "Teste concluído",
        description: "Conexão com a API de funcionários estabelecida com sucesso.",
        variant: "default"
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
      setIsLoading(true);
      
      // Create proper EmployeeApiConfig object
      const configToSave: EmployeeApiConfigType = {
        type: 'employee',
        empresa: config.empresa,
        codigo: config.codigo,
        chave: config.chave,
        tipoSaida: 'json',
        ativo: config.ativo,
        inativo: config.inativo,
        afastado: config.afastado,
        pendente: config.pendente,
        ferias: config.ferias
      };
      
      await saveConfig(configToSave);
      
      toast({
        title: "Configuração salva",
        description: "As configurações da API de funcionários foram salvas com sucesso.",
        variant: "default"
      });
    } catch (error) {
      console.error('Error saving employee API config:', error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar as configurações da API de funcionários.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoadingConfig) {
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
          />
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
          <div className={`p-4 rounded-md ${testResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {testResult.message}
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={handleTest} disabled={isTesting}>
          {isTesting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Testando...
            </>
          ) : (
            'Testar Conexão'
          )}
        </Button>
        <Button onClick={handleSave} disabled={isLoading}>
          {isLoading ? (
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
