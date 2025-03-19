
import React from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import CompanyList from '@/components/dashboard/CompanyList';
import ErrorBoundary from '@/components/ui-custom/ErrorBoundary';

const Companies = () => {
  const resetCompanyList = () => {
    console.log("Resetting CompanyList after error");
    // This function will be called when the ErrorBoundary resets
  };

  return (
    <DashboardLayout 
      title="Empresas" 
      subtitle="Gerencie empresas e sincronize dados"
    >
      <ErrorBoundary onReset={resetCompanyList}>
        <CompanyList />
      </ErrorBoundary>
    </DashboardLayout>
  );
};

export default Companies;
