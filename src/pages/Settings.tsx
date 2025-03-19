
import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import ApiConfigTabs from '@/components/integration/ApiConfigTabs';
import { Loader2, AlertTriangle } from 'lucide-react';
import apiService from '@/services/api';
import { useToast } from '@/components/ui/use-toast';
import ErrorBoundary from '@/components/ui-custom/ErrorBoundary';
import { Button } from '@/components/ui/button';

const Settings = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const { toast } = useToast();

  const loadAllConfigs = async () => {
    try {
      setIsLoading(true);
      setHasError(false);
      // Preload all configs when the settings page loads
      const results = await Promise.all([
        apiService.apiConfig.get('company'),
        apiService.apiConfig.get('employee'),
        apiService.apiConfig.get('absenteeism')
      ]);
      
      console.log('All API configs loaded:', results);
      setHasError(false);
    } catch (err) {
      console.error('Error loading API configurations:', err);
      setHasError(true);
      setErrorMessage(err instanceof Error ? err.message : 'Erro desconhecido ao carregar configurações');
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar configurações',
        description: 'Não foi possível carregar as configurações das APIs.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAllConfigs();
  }, []);

  if (isLoading) {
    return (
      <DashboardLayout 
        title="Configurações" 
        subtitle="Configure as integrações com APIs externas"
      >
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-vitalis-600" />
            <p className="text-muted-foreground">Carregando configurações...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (hasError) {
    return (
      <DashboardLayout 
        title="Configurações" 
        subtitle="Configure as integrações com APIs externas"
      >
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-red-400 mb-3" />
          <h3 className="text-lg font-medium text-red-800 mb-2">Erro ao carregar configurações</h3>
          <p className="text-red-600 mb-4">
            {errorMessage || "Ocorreu um erro ao carregar as configurações. Por favor, tente novamente mais tarde."}
          </p>
          <Button 
            onClick={loadAllConfigs} 
            variant="outline" 
            className="flex mx-auto items-center gap-2"
          >
            <Loader2 className="h-4 w-4" />
            Tentar novamente
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout 
      title="Configurações" 
      subtitle="Configure as integrações com APIs externas"
    >
      <ErrorBoundary>
        <div className="max-w-5xl mx-auto">
          <ApiConfigTabs />
        </div>
      </ErrorBoundary>
    </DashboardLayout>
  );
};

export default Settings;
