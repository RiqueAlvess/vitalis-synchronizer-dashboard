
import React from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import UserProfile from '@/components/profile/UserProfile';
import { useAuth } from '@/context/AuthContext';

const Profile = () => {
  const { user } = useAuth();

  return (
    <DashboardLayout 
      title="Meu Perfil" 
      subtitle="Gerencie suas informações pessoais e preferências"
    >
      <div className="max-w-4xl mx-auto">
        <UserProfile />
      </div>
    </DashboardLayout>
  );
};

export default Profile;
