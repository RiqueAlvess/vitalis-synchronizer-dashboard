
import React, { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import CompanyList from '@/components/dashboard/CompanyList';
import ErrorBoundary from '@/components/ui-custom/ErrorBoundary';

const Companies = () => {
  // Use a key to force remount of the CompanyList when needed
  const [companyListKey, setCompanyListKey] = useState(0);
  
  const resetCompanyList = () => {
    console.log("Resetting CompanyList after error");
    // Increment the key to force the component to remount completely
    setCompanyListKey(prevKey => prevKey + 1);
  };

  return (
    <DashboardLayout 
      title="Empresas" 
      subtitle="Gerencie empresas e sincronize dados"
    >
      <ErrorBoundary onReset={resetCompanyList}>
        <CompanyList key={companyListKey} />
      </ErrorBoundary>
    </DashboardLayout>
  );
};

export default Companies;
