
import React, { useEffect, useState, useRef } from 'react';
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
  const checkAttempts = useRef(0);
  const maxAttempts = 3;
  const redirected = useRef(false);

  useEffect(() => {
    // Resetar tentativas quando a rota muda
    if (location.pathname) {
      checkAttempts.current = 0;
      redirected.current = false;
    }
  }, [location.pathname]);

  useEffect(() => {
    const verifyAuthentication = async () => {
      // Evitar verificações desnecessárias
      if (!isLoading && isAuthenticated) {
        // Já está autenticado, não precisa fazer nada
        return;
      }

      // Evitar verificações desnecessárias se já está em verificação ou excedeu tentativas
      if (isAuthChecking || checkAttempts.current >= maxAttempts) {
        return;
      }

      // Verificar se há sessão armazenada antes de tentar verificar auth
      if (!hasStoredSession()) {
        if (!redirected.current) {
          console.log('Sem sessão armazenada, redirecionando para login');
          redirected.current = true;
          
          navigate('/login', { 
            state: { from: location.pathname },
            replace: true 
          });
        }
        return;
      }

      try {
        console.log('Verificando autenticação para rota protegida:', location.pathname);
        setIsAuthChecking(true);
        checkAttempts.current += 1;
        
        const isAuth = await checkAuth();
        
        if (!isAuth && !redirected.current) {
          console.log('Autenticação falhou, redirecionando para login');
          redirected.current = true;
          
          toast({
            variant: 'destructive',
            title: 'Acesso negado',
            description: 'Você precisa estar logado para acessar esta página.',
          });
          
          navigate('/login', { 
            state: { from: location.pathname },
            replace: true 
          });
        }
      } finally {
        setIsAuthChecking(false);
      }
    };

    // Só verificar se não estamos carregando e não estamos autenticados
    if (!isLoading && !isAuthenticated) {
      verifyAuthentication();
    }
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
