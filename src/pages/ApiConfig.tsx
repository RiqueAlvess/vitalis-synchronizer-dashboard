
import React from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import ApiConfigForm from '@/components/integration/ApiConfigForm';

const ApiConfig = () => {
  return (
    <DashboardLayout 
      title="Configuração da API" 
      subtitle="Integre com a API SOC para sincronizar dados"
    >
      <div className="max-w-3xl mx-auto">
        <ApiConfigForm />
      </div>
    </DashboardLayout>
  );
};

export default ApiConfig;
