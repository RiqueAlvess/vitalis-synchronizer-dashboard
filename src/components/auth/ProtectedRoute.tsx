
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
  const maxAttempts = 2;
  const redirected = useRef(false);
  const initialCheckDone = useRef(false);

  useEffect(() => {
    // Reset attempts when route changes
    if (location.pathname) {
      checkAttempts.current = 0;
      redirected.current = false;
    }
  }, [location.pathname]);

  useEffect(() => {
    const verifyAuthentication = async () => {
      // If already authenticated, no need to check
      if (!isLoading && isAuthenticated) {
        return;
      }

      // Prevent concurrent or excessive checks
      if (isAuthChecking || checkAttempts.current >= maxAttempts || initialCheckDone.current) {
        return;
      }

      // Check for stored session before attempting auth verification
      if (!hasStoredSession()) {
        if (!redirected.current) {
          console.log('No stored session, redirecting to login');
          redirected.current = true;
          initialCheckDone.current = true;
          
          // Delay redirect slightly to avoid potential race conditions
          setTimeout(() => {
            navigate('/login', { 
              state: { from: location.pathname },
              replace: true 
            });
          }, 100);
        }
        return;
      }

      try {
        console.log('Verifying authentication for protected route:', location.pathname);
        setIsAuthChecking(true);
        checkAttempts.current += 1;
        
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

    // Delay the initial check slightly to allow auth context to initialize
    if (!initialCheckDone.current) {
      setTimeout(verifyAuthentication, 100);
    }
  }, [isAuthenticated, isLoading, location.pathname, navigate, checkAuth, isAuthChecking]);

  // Show loading state while checking authentication, but with a maximum timeout
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    
    if (isLoading || isAuthChecking) {
      // Set a maximum timeout for loading state
      timeout = setTimeout(() => {
        if (!isAuthenticated && !redirected.current) {
          console.log('Authentication check timed out, redirecting to login');
          redirected.current = true;
          navigate('/login', { 
            state: { from: location.pathname },
            replace: true 
          });
        }
      }, 5000); // 5 second timeout
    }
    
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [isLoading, isAuthChecking, isAuthenticated, navigate, location.pathname]);

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
