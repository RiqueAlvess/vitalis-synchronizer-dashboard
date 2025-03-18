
import React, { useState, useEffect } from 'react';
import { apiService } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui-custom/Card';
import { Loader2, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AbsenteeismApiConfig {
  empresa: string;
  codigo: string;
  chave: string;
  tipoSaida: string;
  empresaTrabalho: string;
  dataInicio: string;
  dataFim: string;
  isConfigured: boolean;
}

const AbsenteeismApiConfig = () => {
  const [config, setConfig] = useState<AbsenteeismApiConfig>({
    empresa: '',
    codigo: '',
    chave: '',
    tipoSaida: 'json',
    empresaTrabalho: '',
    dataInicio: '',
    dataFim: '',
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
      const data = await apiService.apiConfig.get('absenteeism');
      // Map API response to our component state
      setConfig({
        empresa: data.empresa || '',
        codigo: data.codigo || '',
        chave: data.chave || '',
        tipoSaida: 'json',
        empresaTrabalho: data.empresaTrabalho || '',
        dataInicio: data.dataInicio || '',
        dataFim: data.dataFim || '',
        isConfigured: !!data.chave,
      });
    } catch (err) {
      console.error('Error fetching absenteeism API config:', err);
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar configurações',
        description: 'Não foi possível carregar as configurações da API de Absenteísmo.',
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
      await apiService.apiConfig.save('absenteeism', config);
      toast({
        title: 'Configurações salvas',
        description: 'As configurações da API de Absenteísmo foram salvas com sucesso.',
      });
      setConfig(prev => ({ ...prev, isConfigured: true }));
    } catch (err) {
      console.error('Error saving absenteeism API config:', err);
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar as configurações da API de Absenteísmo.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const testConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    
    try {
      const result = await apiService.apiConfig.test('absenteeism');
      setTestResult({
        success: true,
        message: result.message || 'Conexão com a API de Absenteísmo estabelecida com sucesso!'
      });
      toast({
        title: 'Teste bem-sucedido',
        description: 'A conexão com a API de Absenteísmo foi estabelecida com sucesso.',
      });
    } catch (err) {
      console.error('Absenteeism API connection test failed:', err);
      setTestResult({
        success: false,
        message: 'Falha ao conectar com a API de Absenteísmo. Verifique suas credenciais.'
      });
      toast({
        variant: 'destructive',
        title: 'Teste falhou',
        description: 'Não foi possível conectar com a API de Absenteísmo.',
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
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Configuração da API de Absenteísmo</CardTitle>
              <CardDescription>
                Configure suas credenciais para integrar com a API de Absenteísmo.
              </CardDescription>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-5 w-5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-md">
                  <p>Esta API é utilizada para sincronizar os dados de absenteísmo do sistema SOC.</p>
                  <p className="mt-1">Formato: {`{"empresa":"valor","codigo":"valor","chave":"valor","tipoSaida":"json","empresaTrabalho":"","dataInicio":"","dataFim":""}`}</p>
                  <p className="mt-1">As datas de início e fim serão geradas automaticamente pelo sistema.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="empresa">Código da Empresa Principal</Label>
            <Input
              id="empresa"
              name="empresa"
              value={config.empresa}
              onChange={handleChange}
              placeholder="Ex: 423"
            />
            <p className="text-xs text-muted-foreground">Código numérico da empresa principal no sistema SOC</p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="codigo">Código de Integração</Label>
            <Input
              id="codigo"
              name="codigo"
              type={showSecrets ? "text" : "password"}
              value={config.codigo}
              onChange={handleChange}
              placeholder="Ex: 183868"
            />
            <p className="text-xs text-muted-foreground">Código numérico fornecido pelo sistema SOC</p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="chave">Chave de Integração</Label>
            <Input
              id="chave"
              name="chave"
              type={showSecrets ? "text" : "password"}
              value={config.chave}
              onChange={handleChange}
              placeholder="Ex: 6dff7b9a8a635edaddf5"
            />
            <p className="text-xs text-muted-foreground">Chave alfanumérica fornecida pelo sistema SOC</p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="empresaTrabalho">Código da Empresa de Trabalho (opcional)</Label>
            <Input
              id="empresaTrabalho"
              name="empresaTrabalho"
              value={config.empresaTrabalho}
              onChange={handleChange}
              placeholder="Deixe em branco para todas as empresas"
            />
            <p className="text-xs text-muted-foreground">Deixe em branco para obter dados de todas as empresas</p>
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
          
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
            <h4 className="text-sm font-medium text-blue-800 mb-2 flex items-center">
              <Info className="h-4 w-4 mr-2" />
              Período de sincronização
            </h4>
            <p className="text-sm text-blue-700">
              O sistema irá sincronizar automaticamente os dados dos últimos 60 dias, 
              atualizando os dados a cada 30 dias. Não é necessário configurar as datas 
              manualmente.
            </p>
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
            disabled={isTesting || isSaving || !config.empresa || !config.codigo || !config.chave}
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
            disabled={isSaving || !config.empresa || !config.codigo || !config.chave}
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

export default AbsenteeismApiConfig;
