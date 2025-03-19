import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { AbsenteeismApiConfig as AbsenteeismApiConfigType } from '@/services/api';
import { apiService } from '@/services/api';
import { DatePicker } from '@/components/ui/date-picker';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';

const AbsenteeismApiConfig = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testSuccess, setTestSuccess] = useState<boolean | null>(null);

  // Initialize config with the correct structure
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
          setConfig(savedConfig as AbsenteeismApiConfigType);
          
          // Set date pickers if dates exist
          if (savedConfig.dataInicio) {
            setStartDate(new Date(savedConfig.dataInicio));
          }
          if (savedConfig.dataFim) {
            setEndDate(new Date(savedConfig.dataFim));
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
  };

  const handleStartDateChange = (date: Date | undefined) => {
    setStartDate(date);
    if (date) {
      setConfig(prev => ({ ...prev, dataInicio: format(date, 'yyyy-MM-dd') }));
    }
  };

  const handleEndDateChange = (date: Date | undefined) => {
    setEndDate(date);
    if (date) {
      setConfig(prev => ({ ...prev, dataFim: format(date, 'yyyy-MM-dd') }));
    }
  };

  const handleSave = async () => {
    try {
      setIsLoading(true);
      // Create proper AbsenteeismApiConfig object
      const configToSave: AbsenteeismApiConfigType = {
        type: 'absenteeism',
        empresa: config.empresa,
        codigo: config.codigo,
        chave: config.chave,
        tipoSaida: 'json',
        empresaTrabalho: config.empresaTrabalho,
        dataInicio: config.dataInicio,
        dataFim: config.dataFim
      };
      
      await apiService.saveApiConfig(configToSave);
      toast({
        title: 'Configuração salva',
        description: 'Configuração da API de absenteísmo salva com sucesso.'
      });
    } catch (error) {
      console.error('Error saving absenteeism API config:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível salvar a configuração da API de absenteísmo.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTest = async () => {
    try {
      setIsTesting(true);
      setTestSuccess(null);
      
      const result = await apiService.testApiConnection(config);
      setTestSuccess(result.success);
      
      toast({
        variant: result.success ? 'default' : 'destructive',
        title: result.success ? 'Teste bem-sucedido' : 'Falha no teste',
        description: result.message
      });
    } catch (error) {
      console.error('Error testing API connection:', error);
      setTestSuccess(false);
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
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button
          variant="outline"
          onClick={handleTest}
          disabled={isLoading || isTesting}
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
          disabled={isLoading || isTesting}
        >
          {isLoading ? (
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
