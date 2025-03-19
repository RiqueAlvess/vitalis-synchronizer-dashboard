
import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import LoginForm from '@/components/auth/LoginForm';
import GlassPanel from '@/components/ui-custom/GlassPanel';
import Logo from '@/components/ui-custom/Logo';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';

const Login = () => {
  const { isLoading, isAuthenticated } = useAuth();

  // Verificar se tem algum erro na sessão
  useEffect(() => {
    console.log("Página de login carregada, status de autenticação:", 
      isAuthenticated ? "Autenticado" : "Não autenticado",
      "isLoading:", isLoading);
  }, [isAuthenticated, isLoading]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-vitalis-600 mb-4" />
        <p className="text-lg text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 relative overflow-hidden">
      <div className="absolute inset-0 bg-grid mask-radial-faded" />
      
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md mx-auto">
          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-2 mb-6 justify-center">
              <Logo variant="full" size="xl" />
            </Link>
            
            <h1 className="text-2xl font-bold mt-6">Bem-vindo de volta</h1>
            <p className="text-muted-foreground mt-2">
              Entre na sua conta para acessar o dashboard
            </p>
          </div>
          
          <GlassPanel intensity="strong" className="p-8">
            <LoginForm />
          </GlassPanel>
        </div>
      </div>
    </div>
  );
};

export default Login;
