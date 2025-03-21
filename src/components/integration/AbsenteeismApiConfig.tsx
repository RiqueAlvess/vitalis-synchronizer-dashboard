
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useApiConfig } from '@/hooks/use-api-config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, CheckCircle, AlertCircle, Calendar, AlertTriangle } from 'lucide-react';
import { format, addDays, differenceInDays, parse, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Função para formatar data no formato dd/mm/aaaa
const formatDateString = (date: Date | null): string => {
  if (!date) return '';
  return format(date, 'dd/MM/yyyy');
};

// Função para converter string dd/mm/aaaa para objeto Date
const parseDate = (dateString: string): Date | null => {
  if (!dateString) return null;
  // Tenta fazer o parse da data
  const parsedDate = parse(dateString, 'dd/MM/yyyy', new Date());
  return isValid(parsedDate) ? parsedDate : null;
};

// Função para validar o formato da data
const isValidDateFormat = (dateString: string): boolean => {
  if (!dateString) return true; // Vazio é permitido
  const regex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
  if (!regex.test(dateString)) return false;
  
  const parsedDate = parseDate(dateString);
  return parsedDate !== null;
};

const AbsenteeismApiConfig = () => {
  const { config, isLoading, saveConfig, testConnection } = useApiConfig('absenteeism');
  const { toast } = useToast();
  
  // Estado local para os campos do formulário
  const [empresa, setEmpresa] = useState('');
  const [codigo, setCodigo] = useState('');
  const [chave, setChave] = useState('');
  const [empresaTrabalho, setEmpresaTrabalho] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  
  // Estado para controlar o teste de conexão
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{success?: boolean; message?: string} | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Estado para controlar validação das datas
  const [dataInicioError, setDataInicioError] = useState('');
  const [dataFimError, setDataFimError] = useState('');
  const [intervalError, setIntervalError] = useState('');

  // Carregar configuração quando o componente montar
  useEffect(() => {
    if (config) {
      setEmpresa(config.empresa || '');
      setCodigo(config.codigo || '');
      setChave(config.chave || '');
      setEmpresaTrabalho(config.empresaTrabalho || '');
      setDataInicio(config.dataInicio || '');
      setDataFim(config.dataFim || '');
    }
  }, [config]);

  // Validar datas quando mudam
  useEffect(() => {
    validateDates();
  }, [dataInicio, dataFim]);

  // Função para validar as datas
  const validateDates = () => {
    // Resetar erros
    setDataInicioError('');
    setDataFimError('');
    setIntervalError('');
    
    // Validar formato da data de início
    if (dataInicio && !isValidDateFormat(dataInicio)) {
      setDataInicioError('Data inválida. Use o formato dd/mm/aaaa.');
      return false;
    }
    
    // Validar formato da data de fim
    if (dataFim && !isValidDateFormat(dataFim)) {
      setDataFimError('Data inválida. Use o formato dd/mm/aaaa.');
      return false;
    }
    
    // Se ambas as datas estão preenchidas, validar o intervalo
    if (dataInicio && dataFim) {
      const inicio = parseDate(dataInicio);
      const fim = parseDate(dataFim);
      
      if (inicio && fim) {
        if (inicio > fim) {
          setIntervalError('A data inicial não pode ser posterior à data final.');
          return false;
        }
        
        const days = differenceInDays(fim, inicio);
        if (days > 30) {
          setIntervalError('O intervalo entre as datas não pode exceder 30 dias.');
          return false;
        }
      }
    }
    
    return true;
  };

  // Função para salvar a configuração
  const handleSave = async () => {
    if (!empresa || !codigo || !chave) {
      toast({
        variant: 'destructive',
        title: 'Campos obrigatórios',
        description: 'Empresa, Código e Chave são campos obrigatórios.'
      });
      return;
    }
    
    if (!validateDates()) {
      toast({
        variant: 'destructive',
        title: 'Datas inválidas',
        description: 'Verifique os erros nas datas antes de salvar.'
      });
      return;
    }
    
    try {
      setIsSaving(true);
      
      const configData = {
        type: 'absenteeism',
        empresa,
        codigo,
        chave,
        tipoSaida: 'json',
        empresaTrabalho,
        dataInicio,
        dataFim
      };
      
      await saveConfig(configData);
      
      toast({
        title: 'Configuração salva',
        description: 'Configuração da API de absenteísmo salva com sucesso.'
      });
    } catch (error) {
      console.error('Erro ao salvar configuração:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: error instanceof Error ? error.message : 'Erro desconhecido ao salvar configuração'
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Função para testar a conexão
  const handleTest = async () => {
    if (!empresa || !codigo || !chave) {
      toast({
        variant: 'destructive',
        title: 'Campos obrigatórios',
        description: 'Empresa, Código e Chave são campos obrigatórios para testar a conexão.'
      });
      return;
    }
    
    if (!validateDates()) {
      toast({
        variant: 'destructive',
        title: 'Datas inválidas',
        description: 'Verifique os erros nas datas antes de testar a conexão.'
      });
      return;
    }
    
    try {
      setIsTesting(true);
      setTestResult(null);
      
      const configData = {
        type: 'absenteeism',
        empresa,
        codigo,
        chave,
        tipoSaida: 'json',
        empresaTrabalho,
        dataInicio,
        dataFim
      };
      
      const result = await testConnection(configData);
      setTestResult(result);
      
      if (result.success) {
        toast({
          title: 'Teste bem-sucedido',
          description: 'Conexão com a API de absenteísmo estabelecida com sucesso.'
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Erro no teste',
          description: result.message || 'Falha ao conectar com a API de absenteísmo.'
        });
      }
    } catch (error) {
      console.error('Erro ao testar conexão:', error);
      setTestResult({ success: false, message: error instanceof Error ? error.message : 'Erro desconhecido' });
      
      toast({
        variant: 'destructive',
        title: 'Erro no teste',
        description: error instanceof Error ? error.message : 'Erro desconhecido ao testar conexão'
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Função auxiliar para definir o período atual (30 dias)
  const setCurrentPeriod = () => {
    const today = new Date();
    const thirtyDaysAgo = addDays(today, -30);
    
    setDataInicio(formatDateString(thirtyDaysAgo));
    setDataFim(formatDateString(today));
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <h3 className="text-lg font-medium">Configuração da API de Absenteísmo</h3>
          <p className="text-sm text-gray-500">Carregando configurações...</p>
        </CardHeader>
        <CardContent className="flex justify-center items-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <h3 className="text-lg font-medium">Configuração da API de Absenteísmo</h3>
        <p className="text-sm text-gray-500">
          Configure os parâmetros para integração com a API de absenteísmo do SOC
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="empresa">Empresa Principal*</Label>
            <Input
              id="empresa"
              value={empresa}
              onChange={(e) => setEmpresa(e.target.value)}
              placeholder="Código da empresa principal"
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="codigo">Código*</Label>
            <Input
              id="codigo"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="Código de acesso à API"
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="chave">Chave*</Label>
            <Input
              id="chave"
              value={chave}
              onChange={(e) => setChave(e.target.value)}
              placeholder="Chave de acesso à API"
              type="password"
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="empresaTrabalho">Empresa</Label>
            <Input
              id="empresaTrabalho"
              value={empresaTrabalho}
              onChange={(e) => setEmpresaTrabalho(e.target.value)}
              placeholder="Código da empresa de trabalho"
            />
            <p className="text-xs text-gray-500">
              Código da empresa retornado pela API de empresas
            </p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dataInicio">Data Inicial</Label>
              <div className="relative">
                <Input
                  id="dataInicio"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  placeholder="dd/mm/aaaa"
                  className={dataInicioError ? "border-red-300 focus:ring-red-500" : ""}
                />
                <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              </div>
              {dataInicioError && (
                <p className="text-xs text-red-500">{dataInicioError}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="dataFim">Data Final</Label>
              <div className="relative">
                <Input
                  id="dataFim"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  placeholder="dd/mm/aaaa"
                  className={dataFimError ? "border-red-300 focus:ring-red-500" : ""}
                />
                <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              </div>
              {dataFimError && (
                <p className="text-xs text-red-500">{dataFimError}</p>
              )}
            </div>
          </div>
          
          {intervalError && (
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3 flex items-start">
              <AlertTriangle className="h-5 w-5 text-amber-500 mr-2 flex-shrink-0" />
              <p className="text-sm text-amber-700">{intervalError}</p>
            </div>
          )}
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={setCurrentPeriod}
            className="mt-1"
          >
            Definir período de 30 dias
          </Button>
          
          <p className="text-xs text-gray-500">
            O intervalo entre as datas não pode exceder 30 dias. Formato: dd/mm/aaaa
          </p>
          
          {testResult && (
            <div className={`p-3 rounded-md ${testResult.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              <div className="flex items-start">
                {testResult.success ? 
                  <CheckCircle className="h-5 w-5 mr-2 text-green-500 flex-shrink-0" /> : 
                  <AlertCircle className="h-5 w-5 mr-2 text-red-500 flex-shrink-0" />
                }
                <div>
                  <p className="font-medium">
                    {testResult.success ? 'Conexão bem-sucedida' : 'Falha na conexão'}
                  </p>
                  {testResult.message && (
                    <p className="text-sm mt-1">{testResult.message}</p>
                  )}
                </div>
              </div>
            </div>
          )}
          
          <div className="flex gap-4 pt-2">
            <Button 
              onClick={handleTest} 
              variant="outline" 
              disabled={isTesting}
            >
              {isTesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Testar Conexão
            </Button>
            
            <Button 
              onClick={handleSave} 
              disabled={isSaving}
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Configuração
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AbsenteeismApiConfig;
