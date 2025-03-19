
import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { toast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading, checkAuth } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const verifyAuthentication = async () => {
      if (!isLoading && !isAuthenticated) {
        console.log('Usuário não autenticado tentando acessar rota protegida:', location.pathname);
        const isAuth = await checkAuth();
        
        if (!isAuth) {
          console.log('Autenticação falhou, redirecionando para login');
          toast({
            variant: 'destructive',
            title: 'Acesso negado',
            description: 'Você precisa estar logado para acessar esta página.',
          });
          
          // Armazena a rota atual para redirecionar depois do login
          navigate('/login', { 
            state: { from: location.pathname },
            replace: true 
          });
        }
      }
    };

    verifyAuthentication();
  }, [isAuthenticated, isLoading, location.pathname, navigate, checkAuth]);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-vitalis-600 mb-4" />
        <p className="text-lg text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  // Render children if authenticated
  return isAuthenticated ? <>{children}</> : null;
};

export default ProtectedRoute;
