
import React from 'react';
import { Link } from 'react-router-dom';
import RegisterForm from '@/components/auth/RegisterForm';
import GlassPanel from '@/components/ui-custom/GlassPanel';
import Logo from '@/components/ui-custom/Logo';

const Register = () => {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50 relative overflow-hidden">
      <div className="absolute inset-0 bg-grid mask-radial-faded" />
      
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md mx-auto">
          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-2 mb-6 justify-center">
              <Logo variant="full" size="xl" />
            </Link>
            
            <h1 className="text-2xl font-bold mt-6">Crie sua conta</h1>
            <p className="text-muted-foreground mt-2">
              Comece a analisar o absenteísmo da sua empresa
            </p>
          </div>
          
          <GlassPanel intensity="strong" className="p-8">
            <RegisterForm />
          </GlassPanel>
        </div>
      </div>
    </div>
  );
};

export default Register;
