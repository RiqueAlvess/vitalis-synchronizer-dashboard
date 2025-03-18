
import React from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import CompanyList from '@/components/dashboard/CompanyList';

const Companies = () => {
  return (
    <DashboardLayout 
      title="Empresas" 
      subtitle="Gerencie empresas e sincronize dados"
    >
      <CompanyList />
    </DashboardLayout>
  );
};

export default Companies;
