
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { toast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading, checkAuth } = useAuth();
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationDone, setVerificationDone] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout | null = null;
    
    const verifyAuth = async () => {
      // Avoid redundant verifications
      if (isVerifying || (isAuthenticated && verificationDone)) return;
      
      setIsVerifying(true);
      
      // Set a timeout to prevent infinite loading
      timeoutId = setTimeout(() => {
        if (isMounted) {
          console.log('Authentication check timeout triggered, showing content anyway');
          setIsVerifying(false);
          setVerificationDone(true);
        }
      }, 3000);
      
      try {
        const isAuth = await checkAuth();
        
        if (isMounted) {
          setVerificationDone(true);
          if (!isAuth) {
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
        }
      } catch (error) {
        console.error('Error verifying authentication:', error);
        
        if (isMounted) {
          navigate('/login', { 
            state: { from: location.pathname },
            replace: true 
          });
        }
      } finally {
        if (isMounted) {
          setIsVerifying(false);
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
        }
      }
    };
    
    // Only run verification if not authenticated and verification not done
    if (!isAuthenticated && !verificationDone) {
      verifyAuth();
    }
    
    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isAuthenticated, isLoading, checkAuth, navigate, location.pathname, isVerifying, verificationDone]);

  // Show loading state only during initial verification
  if ((isLoading || isVerifying) && !isAuthenticated && !verificationDone) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-vitalis-600 mb-4" />
        <p className="text-lg text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  // Render the protected page
  return <>{children}</>;
};

export default ProtectedRoute;
