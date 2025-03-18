
import React from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import ApiConfigTabs from '@/components/integration/ApiConfigTabs';

const Settings = () => {
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
