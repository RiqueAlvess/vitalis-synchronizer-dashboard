import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import apiService, { AbsenteeismApiConfig as AbsenteeismApiConfigType } from '@/services/api';
import { DatePicker } from '@/components/ui/date-picker';
import { format } from 'date-fns';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { localStorageService } from '@/services/localStorageService';
import PreviewModeIndicator from '@/components/ui-custom/PreviewModeIndicator';

const AbsenteeismApiConfig = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const initialConfig: AbsenteeismApiConfigType = {
    type: 'absenteeism',
    empresa: '',
    codigo: '',
    chave: '',
    tipoSaida: 'json',
    empresaTrabalho: '',
    dataInicio: '',
    dataFim: '',
    isConfigured: false
  };

  const [config, setConfig] = useState<AbsenteeismApiConfigType>(initialConfig);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        setIsLoading(true);
        const savedConfig = await apiService.getApiConfig('absenteeism');
        if (savedConfig) {
          const typedConfig = savedConfig as AbsenteeismApiConfigType;
          setConfig({
            ...typedConfig,
            // Ensure tipoSaida is always 'json'
            tipoSaida: 'json',
            isConfigured: !!typedConfig.empresa && !!typedConfig.codigo && !!typedConfig.chave
          });
          
          if (typedConfig.dataInicio) {
            try {
              setStartDate(new Date(typedConfig.dataInicio));
            } catch (e) {
              console.error('Invalid start date format:', e);
            }
          }
          
          if (typedConfig.dataFim) {
            try {
              setEndDate(new Date(typedConfig.dataFim));
            } catch (e) {
              console.error('Invalid end date format:', e);
            }
          }
        }
      } catch (error) {
        console.error('Error loading absenteeism API config:', error);
        toast({
          variant: 'destructive',
          title: 'Erro',
          description: 'Não foi possível carregar a configuração da API de absenteísmo.'
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadConfig();
  }, [toast]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setConfig(prev => ({ ...prev, [name]: value }));
    if (testResult) {
      setTestResult(null);
    }
  };

  const handleStartDateChange = (date: Date | undefined) => {
    setStartDate(date);
    if (date) {
      setConfig(prev => ({ ...prev, dataInicio: format(date, 'yyyy-MM-dd') }));
    } else {
      setConfig(prev => ({ ...prev, dataInicio: '' }));
    }
  };

  const handleEndDateChange = (date: Date | undefined) => {
    setEndDate(date);
    if (date) {
      setConfig(prev => ({ ...prev, dataFim: format(date, 'yyyy-MM-dd') }));
    } else {
      setConfig(prev => ({ ...prev, dataFim: '' }));
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const configToSave: AbsenteeismApiConfigType = {
        type: 'absenteeism',
        empresa: config.empresa,
        codigo: config.codigo,
        chave: config.chave,
        tipoSaida: 'json',
        empresaTrabalho: config.empresaTrabalho,
        dataInicio: config.dataInicio,
        dataFim: config.dataFim,
        isConfigured: true
      };
      
      const result = await apiService.saveApiConfig(configToSave);
      
      if (!result) {
        throw new Error('Falha ao salvar configurações');
      }
      
      toast({
        title: 'Configuração salva',
        description: 'Configuração da API de absenteísmo salva com sucesso.'
      });
      
      // Refresh config from the server
      const savedConfig = await apiService.getApiConfig('absenteeism');
      if (savedConfig) {
        setConfig(savedConfig as AbsenteeismApiConfigType);
      }
    } catch (error) {
      console.error('Error saving absenteeism API config:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível salvar a configuração da API de absenteísmo.'
      });
    } finally {
      setIsSaving(false);
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
          ? 'Conexão com a API de Absenteísmo estabelecida com sucesso!' 
          : 'Falha ao conectar com a API de Absenteísmo.')
      });
      
      toast({
        variant: result.success ? 'default' : 'destructive',
        title: result.success ? 'Teste bem-sucedido' : 'Falha no teste',
        description: result.message || (result.success 
          ? 'A conexão com a API de Absenteísmo foi estabelecida com sucesso.' 
          : 'Não foi possível conectar com a API de Absenteísmo.')
      });
    } catch (error) {
      console.error('Error testing API connection:', error);
      setTestResult({
        success: false,
        message: 'Ocorreu um erro ao testar a conexão com a API.'
      });
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Ocorreu um erro ao testar a conexão com a API.'
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Configuração da API de Absenteísmo</CardTitle>
        <CardDescription>
          Configure os parâmetros para sincronização dos dados de absenteísmo.
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
              onChange={handleInputChange}
              placeholder="Código da empresa"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="empresaTrabalho">Empresa de Trabalho</Label>
            <Input
              id="empresaTrabalho"
              name="empresaTrabalho"
              value={config.empresaTrabalho}
              onChange={handleInputChange}
              placeholder="Código da empresa de trabalho"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="codigo">Código</Label>
            <Input
              id="codigo"
              name="codigo"
              value={config.codigo}
              onChange={handleInputChange}
              placeholder="Código de acesso"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="chave">Chave</Label>
            <Input
              id="chave"
              name="chave"
              value={config.chave}
              onChange={handleInputChange}
              placeholder="Chave de acesso"
              type="password"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Data Início</Label>
            <DatePicker
              date={startDate}
              onSelect={handleStartDateChange}
              placeholder="Selecione a data inicial"
            />
          </div>
          <div className="space-y-2">
            <Label>Data Fim</Label>
            <DatePicker
              date={endDate}
              onSelect={handleEndDateChange}
              placeholder="Selecione a data final"
            />
          </div>
        </div>
        
        {testResult && (
          <div className={`p-4 rounded-lg mt-4 flex items-center space-x-3 ${
            testResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}>
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
          disabled={isLoading || isTesting || isSaving || !config.empresa || !config.codigo || !config.chave}
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
          disabled={isLoading || isTesting || isSaving || !config.empresa || !config.codigo || !config.chave}
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            'Salvar Configuração'
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default AbsenteeismApiConfig;
