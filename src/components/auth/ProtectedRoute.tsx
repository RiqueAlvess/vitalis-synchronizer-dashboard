
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
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

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
        console.log('Already authenticated, showing content');
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

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Delay the initial check slightly to allow auth context to initialize
    if (!initialCheckDone.current) {
      timeoutRef.current = setTimeout(verifyAuthentication, 100);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [isAuthenticated, isLoading, location.pathname, navigate, checkAuth, isAuthChecking]);

  // Show loading state while checking authentication, but with a maximum timeout
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    
    if (isLoading || isAuthChecking) {
      // Set a maximum timeout for loading state
      timeout = setTimeout(() => {
        if (!redirected.current) {
          console.log('Authentication check timed out, showing content anyway');
          initialCheckDone.current = true;
        }
      }, 3000); // 3 second timeout - reduced from 5
    }
    
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [isLoading, isAuthChecking]);

  // After 3 seconds, just show content even if still loading
  if ((isLoading || isAuthChecking) && !initialCheckDone.current) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-vitalis-600 mb-4" />
        <p className="text-lg text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  // Render children - even if not fully authenticated after timeout
  return <>{children}</>;
};

export default ProtectedRoute;
