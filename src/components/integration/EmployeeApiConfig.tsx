
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useApiConfig } from '@/hooks/use-api-config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';

const EmployeeApiConfig = () => {
  const { config, isLoading, saveConfig, testConnection } = useApiConfig('employee');
  const { toast } = useToast();
  
  // Estado local para os campos do formulário
  const [empresa, setEmpresa] = useState('');
  const [codigo, setCodigo] = useState('');
  const [chave, setChave] = useState('');
  const [ativo, setAtivo] = useState(false);
  const [inativo, setInativo] = useState(false);
  const [afastado, setAfastado] = useState(false);
  const [pendente, setPendente] = useState(false);
  const [ferias, setFerias] = useState(false);
  
  // Estado para controlar o teste de conexão
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{success?: boolean; message?: string} | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Carregar configuração quando o componente montar
  useEffect(() => {
    if (config) {
      setEmpresa(config.empresa || '');
      setCodigo(config.codigo || '');
      setChave(config.chave || '');
      setAtivo(config.ativo === 'Sim');
      setInativo(config.inativo === 'Sim');
      setAfastado(config.afastado === 'Sim');
      setPendente(config.pendente === 'Sim');
      setFerias(config.ferias === 'Sim');
    }
  }, [config]);

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
    
    try {
      setIsSaving(true);
      
      const configData = {
        type: 'employee',
        empresa,
        codigo,
        chave,
        tipoSaida: 'json',
        ativo: ativo ? 'Sim' : '',
        inativo: inativo ? 'Sim' : '',
        afastado: afastado ? 'Sim' : '',
        pendente: pendente ? 'Sim' : '',
        ferias: ferias ? 'Sim' : ''
      };
      
      await saveConfig(configData);
      
      toast({
        title: 'Configuração salva',
        description: 'Configuração da API de funcionários salva com sucesso.'
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
    
    try {
      setIsTesting(true);
      setTestResult(null);
      
      const configData = {
        type: 'employee',
        empresa,
        codigo,
        chave,
        tipoSaida: 'json',
        ativo: ativo ? 'Sim' : '',
        inativo: inativo ? 'Sim' : '',
        afastado: afastado ? 'Sim' : '',
        pendente: pendente ? 'Sim' : '',
        ferias: ferias ? 'Sim' : ''
      };
      
      const result = await testConnection(configData);
      setTestResult(result);
      
      if (result.success) {
        toast({
          title: 'Teste bem-sucedido',
          description: 'Conexão com a API de funcionários estabelecida com sucesso.'
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Erro no teste',
          description: result.message || 'Falha ao conectar com a API de funcionários.'
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

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <h3 className="text-lg font-medium">Configuração da API de Funcionários</h3>
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
        <h3 className="text-lg font-medium">Configuração da API de Funcionários</h3>
        <p className="text-sm text-gray-500">
          Configure os parâmetros para integração com a API de funcionários do SOC
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="empresa">Empresa*</Label>
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
          
          <div className="pt-2">
            <Label className="mb-2 block">Situações dos funcionários a incluir:</Label>
            <div className="grid gap-3">
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="ativo" 
                  checked={ativo} 
                  onCheckedChange={(checked) => setAtivo(checked === true)}
                />
                <Label htmlFor="ativo" className="text-sm font-normal">Ativos</Label>
              </div>
              
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="inativo" 
                  checked={inativo} 
                  onCheckedChange={(checked) => setInativo(checked === true)}
                />
                <Label htmlFor="inativo" className="text-sm font-normal">Inativos</Label>
              </div>
              
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="afastado" 
                  checked={afastado} 
                  onCheckedChange={(checked) => setAfastado(checked === true)}
                />
                <Label htmlFor="afastado" className="text-sm font-normal">Afastados</Label>
              </div>
              
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="pendente" 
                  checked={pendente} 
                  onCheckedChange={(checked) => setPendente(checked === true)}
                />
                <Label htmlFor="pendente" className="text-sm font-normal">Pendentes</Label>
              </div>
              
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="ferias" 
                  checked={ferias} 
                  onCheckedChange={(checked) => setFerias(checked === true)}
                />
                <Label htmlFor="ferias" className="text-sm font-normal">Em férias</Label>
              </div>
            </div>
          </div>
          
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

export default EmployeeApiConfig;
