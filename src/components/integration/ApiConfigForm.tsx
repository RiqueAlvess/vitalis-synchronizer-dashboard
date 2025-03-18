
import React, { useState, useEffect } from 'react';
import { apiService } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui-custom/Card';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

interface ApiConfig {
  apiKey: string;
  apiSecret: string;
  baseUrl: string;
  isConfigured: boolean;
}

const ApiConfigForm = () => {
  const [config, setConfig] = useState<ApiConfig>({
    apiKey: '',
    apiSecret: '',
    baseUrl: 'https://api.soc.com.br',
    isConfigured: false,
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [showSecrets, setShowSecrets] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setIsLoading(true);
    try {
      const data = await apiService.apiConfig.get('company');
      // Map API response to our component state
      setConfig({
        apiKey: data.codigo || '',
        apiSecret: data.chave || '',
        baseUrl: data.baseUrl || 'https://api.soc.com.br',
        isConfigured: !!data.chave,
      });
    } catch (err) {
      console.error('Error fetching API config:', err);
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar configurações',
        description: 'Não foi possível carregar as configurações da API.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setConfig(prev => ({ ...prev, [name]: value }));
    
    // Clear test result when form is changed
    if (testResult) {
      setTestResult(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    try {
      // Map our component state to the API expected format
      const apiConfig = {
        empresa: '',
        codigo: config.apiKey,
        chave: config.apiSecret,
        tipoSaida: 'json',
      };
      
      await apiService.apiConfig.save('company', apiConfig);
      toast({
        title: 'Configurações salvas',
        description: 'As configurações da API foram salvas com sucesso.',
      });
      setConfig(prev => ({ ...prev, isConfigured: true }));
    } catch (err) {
      console.error('Error saving API config:', err);
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar as configurações da API.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const testConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    
    try {
      const result = await apiService.apiConfig.test('company');
      setTestResult({
        success: true,
        message: result.message || 'Conexão estabelecida com sucesso!'
      });
      toast({
        title: 'Teste bem-sucedido',
        description: 'A conexão com a API foi estabelecida com sucesso.',
      });
    } catch (err) {
      console.error('API connection test failed:', err);
      setTestResult({
        success: false,
        message: 'Falha ao conectar com a API. Verifique suas credenciais.'
      });
      toast({
        variant: 'destructive',
        title: 'Teste falhou',
        description: 'Não foi possível conectar com a API SOC.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardHeader>
          <CardTitle>Carregando...</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-5 bg-gray-200 rounded w-1/3"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="h-5 bg-gray-200 rounded w-1/3"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="animate-fade-in">
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <CardTitle>Configuração da API SOC</CardTitle>
          <CardDescription>
            Configure suas credenciais para integrar com a API SOC.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="baseUrl">URL da API</Label>
            <Input
              id="baseUrl"
              name="baseUrl"
              value={config.baseUrl}
              onChange={handleChange}
              placeholder="https://api.soc.com.br"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="apiKey">Chave da API (API Key)</Label>
            <Input
              id="apiKey"
              name="apiKey"
              type={showSecrets ? "text" : "password"}
              value={config.apiKey}
              onChange={handleChange}
              placeholder="Informe sua chave de API"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="apiSecret">Segredo da API (API Secret)</Label>
            <Input
              id="apiSecret"
              name="apiSecret"
              type={showSecrets ? "text" : "password"}
              value={config.apiSecret}
              onChange={handleChange}
              placeholder="Informe seu segredo de API"
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
          
          {testResult && (
            <div className={`p-4 rounded-lg mt-4 flex items-center space-x-3 ${
              testResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
            }`}>
              {testResult.success ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600" />
              )}
              <span>{testResult.message}</span>
            </div>
          )}
        </CardContent>
        
        <CardFooter className="flex justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={testConnection}
            disabled={isTesting || isSaving || !config.apiKey || !config.apiSecret}
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
            type="submit"
            disabled={isSaving || !config.apiKey || !config.apiSecret}
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
      </form>
    </Card>
  );
};

export default ApiConfigForm;
