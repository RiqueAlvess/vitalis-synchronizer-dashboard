
import React from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import DashboardOverview from '@/components/dashboard/DashboardOverview';

const Dashboard = () => {
  return (
    <DashboardLayout 
      title="Dashboard" 
      subtitle="Visão geral do absenteísmo na sua empresa"
    >
      <DashboardOverview />
    </DashboardLayout>
  );
};

export default Dashboard;
