
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
  const { isAuthenticated, isLoading, checkAuth, user } = useAuth();
  const [isAuthChecking, setIsAuthChecking] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const initialCheckDone = useRef(false);
  const redirected = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const maxLoadingTime = useRef<NodeJS.Timeout | null>(null);

  // Effect para limpar e redefinir estados quando a rota muda
  useEffect(() => {
    if (location.pathname) {
      redirected.current = false;
      
      // Se já estiver autenticado, não precisamos verificar novamente
      if (user) {
        initialCheckDone.current = true;
      }
    }
    
    return () => {
      // Limpar timeouts quando componente desmonta ou rota muda
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (maxLoadingTime.current) {
        clearTimeout(maxLoadingTime.current);
      }
    };
  }, [location.pathname, user]);

  useEffect(() => {
    const verifyAuthentication = async () => {
      // Se já estiver autenticado, não precisamos verificar novamente
      if (!isLoading && isAuthenticated) {
        console.log('Already authenticated, showing content');
        initialCheckDone.current = true;
        return;
      }

      // Evitar verificações concorrentes
      if (isAuthChecking || initialCheckDone.current) {
        return;
      }

      // Verificar sessão armazenada antes de tentar autenticação
      if (!hasStoredSession()) {
        if (!redirected.current) {
          console.log('No stored session, redirecting to login');
          redirected.current = true;
          initialCheckDone.current = true;
          
          navigate('/login', { 
            state: { from: location.pathname },
            replace: true 
          });
        }
        return;
      }

      try {
        console.log('Verifying authentication for protected route:', location.pathname);
        setIsAuthChecking(true);
        
        const isAuth = await checkAuth();
        initialCheckDone.current = true;
        
        if (!isAuth && !redirected.current) {
          console.log('Authentication failed, redirecting to login');
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
        } else {
          console.log('Authentication successful for protected route');
        }
      } catch (error) {
        console.error('Error verifying authentication:', error);
        if (!redirected.current) {
          redirected.current = true;
          navigate('/login', { 
            state: { from: location.pathname },
            replace: true 
          });
        }
      } finally {
        setIsAuthChecking(false);
      }
    };

    // Definir um tempo máximo de carregamento
    if (!initialCheckDone.current && !maxLoadingTime.current) {
      maxLoadingTime.current = setTimeout(() => {
        console.log('Max loading time reached, showing content anyway');
        initialCheckDone.current = true;
      }, 3000); // 3 segundo de tempo máximo
    }

    // Atrasar a verificação inicial para permitir inicialização do contexto de autenticação
    if (!initialCheckDone.current && !timeoutRef.current) {
      timeoutRef.current = setTimeout(verifyAuthentication, 100);
    }
  }, [isAuthenticated, isLoading, location.pathname, navigate, checkAuth, isAuthChecking]);

  // Mostrar estado de carregamento enquanto verifica autenticação, mas com timeout máximo
  if ((isLoading || isAuthChecking) && !initialCheckDone.current) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-vitalis-600 mb-4" />
        <p className="text-lg text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  // Renderizar children - mesmo se não estiver totalmente autenticado após o timeout
  return <>{children}</>;
};

export default ProtectedRoute;
