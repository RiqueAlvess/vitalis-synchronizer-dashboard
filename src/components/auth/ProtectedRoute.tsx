
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { toast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import { hasStoredSession } from '@/integrations/supabase/client';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading, checkAuth } = useAuth();
  const [isAuthChecking, setIsAuthChecking] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const verifyAuthentication = async () => {
      // Evitar verificações desnecessárias se já está autenticado ou não há sessão armazenada
      if (!isLoading && !isAuthenticated && !isAuthChecking && hasStoredSession()) {
        try {
          console.log('Verificando autenticação para rota protegida:', location.pathname);
          setIsAuthChecking(true);
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
        } finally {
          setIsAuthChecking(false);
        }
      } else if (!isLoading && !isAuthenticated && !hasStoredSession()) {
        // Se não há sessão armazenada e não está autenticado, redirecionar imediatamente
        console.log('Sem sessão armazenada, redirecionando para login');
        navigate('/login', { 
          state: { from: location.pathname },
          replace: true 
        });
      }
    };

    verifyAuthentication();
  }, [isAuthenticated, isLoading, location.pathname, navigate, checkAuth, isAuthChecking]);

  // Show loading state while checking authentication
  if (isLoading || isAuthChecking) {
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
