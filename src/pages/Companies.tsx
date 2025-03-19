
import React from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import CompanyList from '@/components/dashboard/CompanyList';
import ErrorBoundary from '@/components/ui-custom/ErrorBoundary';

const Companies = () => {
  return (
    <DashboardLayout 
      title="Empresas" 
      subtitle="Gerencie empresas e sincronize dados"
    >
      <ErrorBoundary>
        <CompanyList />
      </ErrorBoundary>
    </DashboardLayout>
  );
};

export default Companies;
