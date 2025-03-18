
import React from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import EmployeeList from '@/components/dashboard/EmployeeList';

const Employees = () => {
  return (
    <DashboardLayout 
      title="Funcionários" 
      subtitle="Informações e absenteísmo por funcionário"
    >
      <EmployeeList />
    </DashboardLayout>
  );
};

export default Employees;
