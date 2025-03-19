
import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import ApiConfigTabs from '@/components/integration/ApiConfigTabs';
import { Loader2 } from 'lucide-react';
import apiService from '@/services/api';
import { useToast } from '@/components/ui/use-toast';

const Settings = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const loadAllConfigs = async () => {
      try {
        setIsLoading(true);
        // Preload all configs when the settings page loads
        await Promise.all([
          apiService.apiConfig.get('company'),
          apiService.apiConfig.get('employee'),
          apiService.apiConfig.get('absenteeism')
        ]);
        setHasError(false);
      } catch (err) {
        console.error('Error loading API configurations:', err);
        setHasError(true);
        toast({
          variant: 'destructive',
          title: 'Erro ao carregar configurações',
          description: 'Não foi possível carregar as configurações das APIs.'
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadAllConfigs();
  }, [toast]);

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
          <h3 className="text-lg font-medium text-red-800 mb-2">Erro ao carregar configurações</h3>
          <p className="text-red-600">
            Ocorreu um erro ao carregar as configurações. Por favor, tente novamente mais tarde.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout 
      title="Configurações" 
      subtitle="Configure as integrações com APIs externas"
    >
      <div className="max-w-5xl mx-auto">
        <ApiConfigTabs />
      </div>
    </DashboardLayout>
  );
};

export default Settings;
